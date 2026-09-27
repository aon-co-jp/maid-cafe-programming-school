import * as vscode from "vscode";
import * as http from "http";
import * as https from "https";

// Maid Cafe Programming School — VS Code companion extension for open-english.
//
// なぜ作ったか(正直な開示): open-englishのブラウザ版チャットだけでは、
// エディタ上のコード選択範囲・ファイルパスといったコンテキストを渡せず、
// 「一緒に開発しながら学ぶ」という体験がチャットの往復コピペに限定されて
// しまう限界があった(ユーザー指示「この機能はChatだけだと限界があるので、
// Visual Studio Codeのプラグインも開発して機能させて」への対応)。
//
// このプラグインは、open-english/aruaru-llmの既存API(`/v1/generate-with-
// search`・`/v1/chat-providers/complete-priority`)へエディタから直接
// 質問を送るだけの薄いクライアントであり、AI推論・検索(aruaru-search)は
// 一切実装しない——既存のaruaru-llmサーバーが担う。

const CLAUDE_API_KEY_SECRET = "maidCafeSchool.claudeApiKey";
const CLAUDE_COMBO_ENABLED_KEY = "maidCafeSchool.claudeComboEnabled";
const CLAUDE_COMBO_NEW_PROJECT_KEY = "maidCafeSchool.claudeComboNewProject";
const CLAUDE_COMBO_PROJECT_NAME_KEY = "maidCafeSchool.claudeComboProjectName";

// ユーザー指示(2026-09-28)「AIの先生は、基本は、aruaru-llm+無料のGoogleか、
// ChatGptかGeminiかDeepSeekかGrokか有料のClaudeかを選択可能にして」——
// 既定は"aruaru"(aruaru-search優先・自信が無い時のみ無料枠Google検索、
// 既存の`/v1/generate-with-search`経由)。それ以外を選ぶと、
// aruaru-llmの`/v1/chat-providers/complete-priority`経由でクラウド
// プロバイダを直接指定する(各プロバイダ自身のAPIキーが必要、
// Claudeのみ既存の「新規/既存プロジェクト」導線も併用)。
type AiProvider = "aruaru" | "chatgpt" | "gemini" | "deepseek" | "grok" | "claude";
const AI_PROVIDER_KEY = "maidCafeSchool.aiProvider";
const PROVIDER_LABELS: Record<AiProvider, string> = {
  aruaru: "$(rocket) aruaru-llm + 無料Google検索(既定) / aruaru-llm + free Google search (default)",
  chatgpt: "$(hubot) ChatGPT",
  gemini: "$(sparkle) Gemini",
  deepseek: "$(search) DeepSeek",
  grok: "$(comment) Grok",
  claude: "$(key) Claude(有料版・ご自身のAPIキー) / Claude (paid, your own API key)",
};
function providerApiKeySecretName(provider: AiProvider): string {
  return provider === "claude" ? CLAUDE_API_KEY_SECRET : `maidCafeSchool.apiKey.${provider}`;
}

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;
let ttsPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("Maid Cafe Programming School");

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "maidCafeSchool.openMenu";
  context.subscriptions.push(statusBarItem);
  refreshStatusBar(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("maidCafeSchool.openMenu", () => openMenu(context)),
    vscode.commands.registerCommand("maidCafeSchool.askTeacher", () => askTeacher(context)),
    vscode.commands.registerCommand("maidCafeSchool.toggleStudyWhileDeveloping", () => toggleStudyWhileDeveloping()),
    vscode.commands.registerCommand("maidCafeSchool.toggleClaudeCombo", () => toggleClaudeCombo(context)),
    vscode.commands.registerCommand("maidCafeSchool.selectAiProvider", () => selectAiProvider(context)),
    vscode.commands.registerCommand("maidCafeSchool.toggleSpeakText", () => toggleSpeakText()),
    registerJobImportUriHandler(context)
  );

  // ユーザー指示(2026-09-28): 「最初は『おかえりなさいませ！ご主人様！』
  // としゃべって。途中も全部しゃべるなら、テキスト内容をしゃべる、の
  // チェックボックスにチェックデフォルトで付けて」——`speakText`設定
  // (既定true、package.jsonで定義)がONの場合のみ、起動時に一度だけ
  // メイドカフェ風の出迎え挨拶を読み上げる。続けて「良い子のみんな
  // 元気〜！」からの案内フレーズも(2026-09-28追加指示)。
  const config = vscode.workspace.getConfiguration("maidCafeSchool");
  if (config.get<boolean>("speakText", true)) {
    speak(
      context,
      "おかえりなさいませ！ご主人様！良い子のみんな元気〜！はーい、これから" +
        "メイドカフェのお姉さんといっしょにオンラインプログラミングスクール始めるよ！"
    );
  }
}

export function deactivate() {
  ttsPanel?.dispose();
  ttsPanel = undefined;
}

async function toggleSpeakText() {
  const config = vscode.workspace.getConfiguration("maidCafeSchool");
  const current = config.get<boolean>("speakText", true);
  await config.update("speakText", !current, vscode.ConfigurationTarget.Global);
  vscode.window.setStatusBarMessage(
    !current ? "✅ テキスト内容をしゃべる: ON / Speak text: ON" : "テキスト内容をしゃべる: OFF / Speak text: OFF",
    4000
  );
}

// 正直な開示: VS Code拡張機能本体(Node拡張ホスト)にはWeb Speech API
// (`speechSynthesis`)が存在しないため、非表示のWebviewパネル1枚を
// 裏で保持し、そこへ読み上げたいテキストを`postMessage`で送って
// Webview側(ブラウザ相当のコンテキスト)の`speechSynthesis`で実際に
// 発話させている——拡張機能自体が独自の音声合成エンジンを持つわけ
// ではない。
function ensureTtsPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
  if (ttsPanel) return ttsPanel;
  ttsPanel = vscode.window.createWebviewPanel(
    "maidCafeSchoolTts",
    "Maid Cafe School (voice)",
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: true, retainContextWhenHidden: true }
  );
  ttsPanel.webview.html = `<!DOCTYPE html><html><body>
    <script>
      const vscodeApi = acquireVsCodeApi();
      window.addEventListener("message", (event) => {
        const { text, lang } = event.data || {};
        if (!text || !("speechSynthesis" in window)) return;
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = lang || "ja-JP";
        // ユーザー指示(2026-09-28)「声は、アイドルの様で思わせぶりで
        // 小悪魔の様な怪しい声にして」——正直な開示: Web Speech APIの
        // SpeechSynthesisUtteranceには「小悪魔っぽさ」を直接指定する
        // パラメータは無いため、実際に調整できる範囲(pitch/rateと、
        // 利用可能な音声の中から女性寄りの日本語音声を選ぶこと)で
        // 近づける。高めのpitch+やや遅めのrateで「思わせぶり」な
        // 抑揚を演出する。
        utter.pitch = 1.5;
        utter.rate = 0.92;
        const pickVoice = () => {
          const voices = window.speechSynthesis.getVoices();
          const ja = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("ja"));
          const female = ja.find((v) => /female|woman|女性|haruka|kyoko|sayaka|nanami/i.test(v.name));
          utter.voice = female || ja[0] || voices[0] || null;
          window.speechSynthesis.speak(utter);
        };
        if (window.speechSynthesis.getVoices().length > 0) {
          pickVoice();
        } else {
          window.speechSynthesis.onvoiceschanged = pickVoice;
        }
      });
    </script>
  </body></html>`;
  ttsPanel.onDidDispose(() => {
    ttsPanel = undefined;
  });
  context.subscriptions.push(ttsPanel);
  return ttsPanel;
}

function speak(context: vscode.ExtensionContext, text: string) {
  const config = vscode.workspace.getConfiguration("maidCafeSchool");
  if (!config.get<boolean>("speakText", true)) return;
  try {
    const panel = ensureTtsPanel(context);
    panel.webview.postMessage({ text, lang: "ja-JP" });
  } catch (e) {
    // 読み上げに失敗してもチャット/開発の本筋は止めない(ベストエフォート)。
    outputChannel?.appendLine(`(voice) could not speak: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function refreshStatusBar(context: vscode.ExtensionContext) {
  const provider = getAiProvider(context);
  statusBarItem.text =
    provider === "aruaru" ? "$(mortar-board) Maid Cafe School" : `$(mortar-board) Maid Cafe School (${provider})`;
  statusBarItem.tooltip = "Maid Cafe Programming School / メイドカフェ・プログラミングスクール";
  statusBarItem.show();
}

async function openMenu(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("maidCafeSchool");
  const studying = config.get<boolean>("studyWhileDeveloping", false);
  const pick = await vscode.window.showQuickPick(
    [
      { label: "$(comment-discussion) Ask the AI Teacher / AI先生に質問する", value: "ask" },
      {
        label: `$(book) Study while developing: ${studying ? "ON" : "OFF"} / 同時にプログラム学習: ${studying ? "ON" : "OFF"}`,
        value: "study",
      },
      {
        label: `$(list-selection) AI先生の選択: ${PROVIDER_LABELS[getAiProvider(context)]} / Choose AI teacher`,
        value: "provider",
      },
      {
        label: `$(unmute) テキスト内容をしゃべる: ${config.get<boolean>("speakText", true) ? "ON" : "OFF"} / Speak text: ${config.get<boolean>("speakText", true) ? "ON" : "OFF"}`,
        value: "speak",
      },
    ],
    { placeHolder: "Maid Cafe Programming School" }
  );
  if (!pick) return;
  if (pick.value === "ask") await askTeacher(context);
  else if (pick.value === "study") await toggleStudyWhileDeveloping();
  else if (pick.value === "provider") await selectAiProvider(context);
  else if (pick.value === "speak") await toggleSpeakText();
}

function getAiProvider(context: vscode.ExtensionContext): AiProvider {
  return context.globalState.get<AiProvider>(AI_PROVIDER_KEY, "aruaru");
}

async function selectAiProvider(context: vscode.ExtensionContext) {
  const current = getAiProvider(context);
  const pick = await vscode.window.showQuickPick(
    (Object.keys(PROVIDER_LABELS) as AiProvider[]).map((value) => ({
      label: `${value === current ? "$(check) " : ""}${PROVIDER_LABELS[value]}`,
      value,
    })),
    { title: "AIの先生を選択してください / Choose your AI teacher", ignoreFocusOut: true }
  );
  if (!pick) return;
  const provider = pick.value as AiProvider;

  if (provider === "aruaru") {
    await context.globalState.update(AI_PROVIDER_KEY, provider);
    refreshStatusBar(context);
    vscode.window.setStatusBarMessage(`✅ AI先生: ${PROVIDER_LABELS[provider]}`, 4000);
    return;
  }

  const secretName = providerApiKeySecretName(provider);
  let apiKey = await context.secrets.get(secretName);
  if (!apiKey) {
    apiKey = await vscode.window.showInputBox({
      title: `${PROVIDER_LABELS[provider]} API Key`,
      prompt: `${PROVIDER_LABELS[provider]}をご利用の場合、ご自身のAPIキーを入力してください。 / Enter your own API key to use ${provider}.`,
      password: true,
      ignoreFocusOut: true,
    });
    if (!apiKey) {
      vscode.window.showWarningMessage(
        "APIキーが入力されなかったため、AI先生の切り替えを中止しました。 / No API key entered — the AI teacher was not switched."
      );
      return;
    }
    await context.secrets.store(secretName, apiKey);
  }

  if (provider === "claude") {
    // Claudeのみ、既存の「新規/既存プロジェクト」導線を併用する
    // (open-english web版・従来のtoggleClaudeComboと同じ体験)。
    const projectChoice = await vscode.window.showQuickPick(
      [
        { label: "$(add) New project / 新規プロジェクト", value: true },
        { label: "$(history) Continue an existing project / 既存プロジェクトの続き", value: false },
      ],
      { title: "その時のClaudeは、新規プロジェクトにしますか？ / Start this as a new Claude project?", ignoreFocusOut: true }
    );
    if (!projectChoice) return;
    const previousName = context.globalState.get<string>(CLAUDE_COMBO_PROJECT_NAME_KEY, "");
    const projectName = await vscode.window.showInputBox({
      title: projectChoice.value
        ? "どこのプロジェクト内の会話にしますか？(新しいプロジェクト名) / Which project should this belong to? (new project name)"
        : "どこのプロジェクト内の会話にしますか？(既存のプロジェクト名) / Which project should this belong to? (existing project name)",
      value: previousName,
      ignoreFocusOut: true,
    });
    await context.globalState.update(CLAUDE_COMBO_ENABLED_KEY, true);
    await context.globalState.update(CLAUDE_COMBO_NEW_PROJECT_KEY, projectChoice.value);
    await context.globalState.update(CLAUDE_COMBO_PROJECT_NAME_KEY, (projectName || "").trim());
  }

  await context.globalState.update(AI_PROVIDER_KEY, provider);
  refreshStatusBar(context);
  vscode.window.setStatusBarMessage(`✅ AI先生: ${PROVIDER_LABELS[provider]}`, 4000);
}

async function toggleStudyWhileDeveloping() {
  const config = vscode.workspace.getConfiguration("maidCafeSchool");
  const current = config.get<boolean>("studyWhileDeveloping", false);
  await config.update("studyWhileDeveloping", !current, vscode.ConfigurationTarget.Global);
  vscode.window.setStatusBarMessage(
    !current
      ? "✅ Study while developing: ON / 同時にプログラム学習: ON"
      : "Study while developing: OFF / 同時にプログラム学習: OFF",
    4000
  );
}

async function toggleClaudeCombo(context: vscode.ExtensionContext) {
  const currentlyOn = context.globalState.get<boolean>(CLAUDE_COMBO_ENABLED_KEY, false);
  if (currentlyOn) {
    await context.globalState.update(CLAUDE_COMBO_ENABLED_KEY, false);
    refreshStatusBar(context);
    vscode.window.setStatusBarMessage("Claude combo: OFF / 有料版Claudeの組み込み: OFF", 4000);
    return;
  }

  // 有料版Claudeのご契約者向け(ユーザー指示、open-english web版と同じ
  // ガードレール): まずAPIキーが必要。無ければここで案内して中断する
  // (チェックだけで認証できるふりをしない)。
  let apiKey = await context.secrets.get(CLAUDE_API_KEY_SECRET);
  if (!apiKey) {
    apiKey = await vscode.window.showInputBox({
      title: "Claude (Anthropic) API Key",
      prompt: "有料版のClaudeをご契約中の方は、ご自身のAPIキーを入力してください。 / Enter your own paid Claude (Anthropic) API key.",
      password: true,
      ignoreFocusOut: true,
    });
    if (!apiKey) {
      vscode.window.showWarningMessage(
        "APIキーが入力されなかったため、Claudeの組み込みを中止しました。 / No API key entered — Claude combo was not enabled."
      );
      return;
    }
    await context.secrets.store(CLAUDE_API_KEY_SECRET, apiKey);
  }

  // 「新規プロジェクトにしますか？」(open-english web版と同じ機能)。
  const projectChoice = await vscode.window.showQuickPick(
    [
      { label: "$(add) New project / 新規プロジェクト", value: true },
      { label: "$(history) Continue an existing project / 既存プロジェクトの続き", value: false },
    ],
    {
      title: "その時のClaudeは、新規プロジェクトにしますか？ / Start this as a new Claude project?",
      ignoreFocusOut: true,
    }
  );
  if (!projectChoice) return; // ユーザーがEscでキャンセルした場合は組み込み自体を中止する

  // 「どこのプロジェクト内の会話にしますか？」。
  const previousName = context.globalState.get<string>(CLAUDE_COMBO_PROJECT_NAME_KEY, "");
  const projectName = await vscode.window.showInputBox({
    title: projectChoice.value
      ? "どこのプロジェクト内の会話にしますか？(新しいプロジェクト名) / Which project should this belong to? (new project name)"
      : "どこのプロジェクト内の会話にしますか？(既存のプロジェクト名) / Which project should this belong to? (existing project name)",
    value: previousName,
    ignoreFocusOut: true,
  });

  await context.globalState.update(CLAUDE_COMBO_ENABLED_KEY, true);
  await context.globalState.update(CLAUDE_COMBO_NEW_PROJECT_KEY, projectChoice.value);
  await context.globalState.update(CLAUDE_COMBO_PROJECT_NAME_KEY, (projectName || "").trim());
  refreshStatusBar(context);
  vscode.window.setStatusBarMessage("✅ Claude combo: ON / 有料版Claudeの組み込み: ON", 4000);
}

async function askTeacher(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  const selectionText = editor && !editor.selection.isEmpty ? editor.document.getText(editor.selection) : "";
  const filePath = editor ? vscode.workspace.asRelativePath(editor.document.uri) : "";

  const question = await vscode.window.showInputBox({
    title: "Ask the AI Teacher / AI先生に質問する",
    prompt: selectionText
      ? `選択中のコード(${filePath})について質問してください / Ask about the selected code in ${filePath}`
      : "質問を入力してください / Type your question",
    ignoreFocusOut: true,
  });
  if (!question) return;

  maybeCheerOnOrder(context, question);
  maybeCheerUpTroubled(context, question);

  let prompt = question;
  if (selectionText) {
    prompt += `\n\nCode (${filePath}):\n\`\`\`\n${selectionText}\n\`\`\``;
  }
  await sendPromptToTeacher(context, question, prompt);
}

// ユーザー指示(2026-09-28)「コーヒーやオムライスなどを注文したとみなす
// と『おいしくなーれ、萌え萌えキューん。』としゃべって」——メイドカフェ
// ごっこの一環。AI推論は経由せず、固定フレーズを読み上げるだけの
// ルールベース分岐(既存の`speak()`をそのまま再利用)。
const ORDER_VERBS = ["注文", "頼", "お願いします", "ください", "order", "get me", "i'll have", "i will have", "can i get"];
const ORDER_ITEMS = [
  "コーヒー", "珈琲", "オムライス", "オムレツ", "紅茶", "ケーキ", "パフェ", "パンケーキ", "ハンバーグ",
  "カレー", "パスタ", "サンドイッチ", "ジュース", "コーラ",
  "coffee", "omurice", "omelet", "omelette", "tea", "cake", "parfait", "pancake", "hamburger", "curry",
  "pasta", "sandwich", "juice", "cola",
];
function isOrderRequest(text: string): boolean {
  const lower = text.toLowerCase();
  const hasVerb = ORDER_VERBS.some((v) => lower.includes(v.toLowerCase()));
  const hasItem = ORDER_ITEMS.some((i) => lower.includes(i.toLowerCase()));
  return hasVerb && hasItem;
}
function maybeCheerOnOrder(context: vscode.ExtensionContext, text: string) {
  if (!isOrderRequest(text)) return;
  speak(context, "おいしくなーれ、萌え萌えキューん。");
}

// ユーザー指示(2026-09-28)「悩んでいるとみなすと、幼稚園の女の先生風で
// メイドカフェの女の子風に…『めっ！こらっ！いつまでも、くよくよ悩んで
// いちゃいけないんだぞ！萌え萌えキューン！』としゃべって」——上記の
// 注文検出と同じ「固定フレーズを読み上げるだけ」のルールベース分岐。
const TROUBLED_KEYWORDS = [
  "悩んで", "悩んでいる", "悩んでいます", "落ち込", "凹んで", "へこんで",
  "つらい", "辛い", "しんどい", "自信が無い", "自信がない", "不安",
  "worried", "i'm worried", "i am worried", "depressed", "down", "stressed",
  "anxious", "struggling", "i feel bad", "no confidence",
];
function isTroubledRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return TROUBLED_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
}
function maybeCheerUpTroubled(context: vscode.ExtensionContext, text: string) {
  if (!isTroubledRequest(text)) return;
  speak(context, "めっ！こらっ！いつまでも、くよくよ悩んでいちゃいけないんだぞ！萌え萌えキューン！");
}

// 2026-09-28追加(ユーザー指示「フリーランス案件をまとめて検索出来る
// サイトも新規リポジトリで作成して、そこで得た案件情報の内容をMadeと
// 一緒にプログラミングを学習しながら一緒に開発出来るシステムとして
// 下さい」): 新規リポジトリ`aruaru-jobs`(案件集約サイト)の各案件に
// 付けた「🎓 Maid Cafe Programming Schoolで開発」ボタンが開く
// `vscode://aon-co-jp.maid-cafe-programming-school/import-job?...`を
// 受け取り、案件情報(タイトル・URL・抜粋)を質問文へ組み込んで
// AI先生への依頼を自動生成する。
export function registerJobImportUriHandler(context: vscode.ExtensionContext) {
  return vscode.window.registerUriHandler({
    async handleUri(uri: vscode.Uri) {
      if (uri.path !== "/import-job") return;
      const params = new URLSearchParams(uri.query);
      const title = params.get("title") || "";
      const url = params.get("url") || "";
      const snippet = params.get("snippet") || "";
      if (!title && !url) return;
      const label = `Job listing: ${title || url}`;
      let prompt =
        `以下のフリーランス案件について、一緒にプログラミングを学習しながら開発したいです。 / ` +
        `I'd like to study programming while developing together, based on this freelance job listing.\n\n` +
        `Title / タイトル: ${title}\nURL: ${url}`;
      if (snippet) prompt += `\nSnippet / 抜粋: ${snippet}`;
      // 案件情報から始める場合は「同時にプログラム学習」を暗黙に希望している
      // とみなし、設定に関わらずこの1回だけ学習依頼を明示的に添える。
      prompt +=
        "\n\n同時にプログラムの学習も行いたいです。開発を進めながら、関連する基礎知識も適宜教えてください。 / " +
        "I'd also like to study programming at the same time — please teach me relevant basics along the way as we develop this.";
      await vscode.window.showTextDocument(
        await vscode.workspace.openTextDocument({ content: prompt, language: "markdown" })
      );
      const proceed = await vscode.window.showInformationMessage(
        `案件を取り込みました: ${title || url} / Imported job listing: ${title || url}\nこの内容でAI先生に相談しますか？ / Ask the AI teacher about this now?`,
        "Ask now / 今すぐ相談",
        "Later / あとで"
      );
      if (proceed === "Ask now / 今すぐ相談") {
        await sendPromptToTeacher(context, label, prompt, /* skipStudyToggle */ true);
      }
    },
  });
}

async function sendPromptToTeacher(
  context: vscode.ExtensionContext,
  question: string,
  promptIn: string,
  skipStudyToggle = false
) {
  let prompt = promptIn;
  const config = vscode.workspace.getConfiguration("maidCafeSchool");
  if (!skipStudyToggle && config.get<boolean>("studyWhileDeveloping", false)) {
    prompt +=
      "\n\n同時にプログラムの学習も行いたいです。開発を進めながら、関連する基礎知識も適宜教えてください。 / " +
      "I'd also like to study programming at the same time — please teach me relevant basics along the way as we develop this.";
  }

  const provider = getAiProvider(context);
  if (provider === "claude") {
    const isNewProject = context.globalState.get<boolean>(CLAUDE_COMBO_NEW_PROJECT_KEY, false);
    const projectName = context.globalState.get<string>(CLAUDE_COMBO_PROJECT_NAME_KEY, "");
    const named = projectName ? ` named "${projectName}"` : "";
    prompt += isNewProject
      ? `\n\n(これは新規プロジェクト${projectName ? `「${projectName}」` : ""}として開始してください。 / Please start this as a new project${named}.)`
      : `\n\n(これは既存プロジェクト${projectName ? `「${projectName}」` : ""}の続きとして扱ってください。 / Please treat this as a continuation of the existing project${named}.)`;
  }

  const baseUrl = config.get<string>("aruaruLlmBaseUrl", "http://127.0.0.1:4600");
  const useGithub = config.get<boolean>("useGithubInvestigation", true);

  outputChannel.show(true);
  outputChannel.appendLine(`\n--- Question / 質問 (${new Date().toLocaleString()}) ---`);
  outputChannel.appendLine(question);
  outputChannel.appendLine("\n... asking the AI teacher / AI先生に質問中 ...");

  try {
    let responseText: string;
    if (provider === "aruaru") {
      // 既定経路: aruaru-search(無制限・APIキー不要)を最優先で試し、
      // 自信が無い時だけ無料枠のGoogle検索で補う、open-english web版と
      // 同じ`/v1/generate-with-search`。
      const body: Record<string, unknown> = { prompt, max_new_tokens: 96 };
      const data = await postJson(`${baseUrl}/v1/generate-with-search`, body);
      responseText =
        (data && typeof data.completion === "string" && data.completion) ||
        (data && typeof data.error === "string" && `⚠ ${data.error}`) ||
        JSON.stringify(data);
    } else {
      // クラウドプロバイダ(ChatGPT/Gemini/DeepSeek/Grok/Claude)を
      // ユーザー自身のAPIキーで直接指定する経路。
      const apiKey = await context.secrets.get(providerApiKeySecretName(provider));
      const body: Record<string, unknown> = {
        prompt,
        providers: [provider],
        use_google_search: true,
        use_github_search: useGithub,
      };
      if (apiKey) body.provider_keys = { [provider]: apiKey };
      const data = await postJson(`${baseUrl}/v1/chat-providers/complete-priority`, body);
      responseText =
        (data && data.reply && typeof data.reply.text === "string" && data.reply.text) ||
        (data && typeof data.error === "string" && `⚠ ${data.error}`) ||
        JSON.stringify(data);
    }
    outputChannel.appendLine("\n--- Answer / 回答 ---");
    outputChannel.appendLine(responseText);
    speak(context, responseText);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(
      `\n⚠ Could not reach aruaru-llm at ${baseUrl}: ${message}\n` +
        `⚠ ${baseUrl} のaruaru-llmへ到達できませんでした: ${message}\n` +
        `(Check "maidCafeSchool.aruaruLlmBaseUrl" in settings, and that aruaru-llm is running locally. / ` +
        `設定の"maidCafeSchool.aruaruLlmBaseUrl"と、aruaru-llmがローカルで起動しているかご確認ください。)`
    );
  }
}

/** Minimal JSON POST helper using Node's built-in http/https (no extra runtime dependency). */
function postJson(url: string, body: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch (e) {
      reject(new Error(`invalid URL: ${url}`));
      return;
    }
    const payload = Buffer.from(JSON.stringify(body), "utf-8");
    const client = target.protocol === "https:" ? https : http;
    const req = client.request(
      {
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: target.pathname + target.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": payload.length,
        },
        timeout: 60000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf-8");
          try {
            resolve(text ? JSON.parse(text) : {});
          } catch (e) {
            resolve({ raw: text });
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("request timed out")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}
