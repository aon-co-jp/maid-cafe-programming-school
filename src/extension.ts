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
    vscode.commands.registerCommand("maidCafeSchool.openTypingCorner", () => openTypingCorner(context)),
    vscode.commands.registerCommand("maidCafeSchool.openProgrammingBasics", () => openProgrammingBasics(context)),
    vscode.commands.registerCommand("maidCafeSchool.openJavaScriptClassroom", () => openJavaScriptClassroom(context)),
    vscode.commands.registerCommand("maidCafeSchool.todaysSampleTask", () => todaysSampleTask(context)),
    vscode.commands.registerCommand("maidCafeSchool.openWorldLearning", () => openWorldLearning(context)),
    vscode.commands.registerCommand("maidCafeSchool.setupRelatedRepos", () => setupRelatedRepos(context)),
    registerJobImportUriHandler(context)
  );

  // ユーザー指示(2026-09-28)「プラグインと同時にローカルPCにまだ
  // インストールしていなければ、open-easy-web+open-directx+open-cpu+
  // open-cuda+aruaru-llmなどと、その他関連リポジトリを一緒にダウン
  // ロードして利用して頂ける用にして」——起動のたびに毎回尋ねると
  // 煩わしいため、globalStateのフラグで「一度だけ」案内する
  // (何度でも手動では`setupRelatedRepos`コマンドから呼べる)。
  maybeOfferRelatedReposSetupOnce(context);

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
        "メイドカフェのお姉さんといっしょに楽しい、オンラインプログラミングスクール、は・じ・め・る・よ〜〜"
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
      { label: "$(keyboard) キーボードタイピングコーナー / Keyboard Typing Corner", value: "typing" },
      { label: "$(mortar-board) プログラミング基礎教室(幼稚園児にも分かるように) / Programming Basics", value: "basics" },
      { label: "$(symbol-method) JavaScript教室(初心者向け) / JavaScript Classroom", value: "javascript" },
      { label: "$(briefcase) 今日のサンプル案件 / Today's Sample Task", value: "sample" },
      { label: "$(globe) 日本語・英語・世界の言語を学ぶ / Learn Japanese, English, or a World Language", value: "world" },
      { label: "$(cloud-download) 関連リポジトリのセットアップ / Set Up Related Repos", value: "setup-repos" },
    ],
    { placeHolder: "Maid Cafe Programming School" }
  );
  if (!pick) return;
  if (pick.value === "ask") await askTeacher(context);
  else if (pick.value === "study") await toggleStudyWhileDeveloping();
  else if (pick.value === "provider") await selectAiProvider(context);
  else if (pick.value === "speak") await toggleSpeakText();
  else if (pick.value === "typing") await openTypingCorner(context);
  else if (pick.value === "basics") await openProgrammingBasics(context);
  else if (pick.value === "javascript") await openJavaScriptClassroom(context);
  else if (pick.value === "sample") await todaysSampleTask(context);
  else if (pick.value === "world") await openWorldLearning(context);
  else if (pick.value === "setup-repos") await setupRelatedRepos(context);
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
  speak(context, "めっ！いつまでも、くよくよ悩んでいちゃいけないんだぞ！こら！頑張ってね！萌え萌えキューン！お姉さんと一緒に頑張って行きましょ〜。");
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

// ユーザー指示(2026-09-28)「このメイドカフェオンラインパソコンスクールでは、
// キーボードタイピングコーナーから始まって、キーボード入力がミスが０だと
// パーフェクト、エクセレント、ナイス、おかえりなさいませ！ご主人様！、
// 萌え萌えビーム、おいしくなーれ萌え萌えキューン、などと可愛くメイドさん
// 風にしゃべる機能を付けて」——固定の練習文をタイプしてもらい、誤字数を
// 数えるだけの簡易実装(既存の`speak()`をそのまま再利用、AI推論は経由
// しない)。
const TYPING_PRACTICE_SENTENCES = [
  "こんにちは、せかい",
  "プログラミングはたのしいです",
  "おはようございます",
  "きょうもがんばりましょう",
  "ねこがつくえのうえにいます",
  "The quick brown fox jumps.",
  "Hello, world!",
  "I love programming.",
];
const PERFECT_TYPING_PHRASES = [
  "パーフェクト！",
  "エクセレント！",
  "ナイス！",
  "おかえりなさいませ！ご主人様！",
  "萌え萌えビーム！",
  "おいしくなーれ、萌え萌えキューん。",
];
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let typingPanel: vscode.WebviewPanel | undefined;

async function openTypingCorner(context: vscode.ExtensionContext) {
  const sentence = pickRandom(TYPING_PRACTICE_SENTENCES);
  if (typingPanel) {
    typingPanel.reveal(vscode.ViewColumn.Active);
  } else {
    typingPanel = vscode.window.createWebviewPanel(
      "maidCafeSchoolTyping",
      "⌨️ キーボードタイピングコーナー / Typing Corner",
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    typingPanel.onDidDispose(() => {
      typingPanel = undefined;
    });
    context.subscriptions.push(typingPanel);
    typingPanel.webview.onDidReceiveMessage((msg) => {
      if (msg?.type === "result") {
        const mistakes: number = msg.mistakes ?? 0;
        if (mistakes === 0) {
          speak(context, pickRandom(PERFECT_TYPING_PHRASES));
        } else {
          speak(context, `おしい！ミスが${mistakes}回ありました。もう一度がんばろう！`);
        }
      } else if (msg?.type === "next") {
        renderTypingSentence(pickRandom(TYPING_PRACTICE_SENTENCES));
      }
    });
  }
  renderTypingSentence(sentence);

  function renderTypingSentence(target: string) {
    if (!typingPanel) return;
    const escaped = target.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    typingPanel.webview.html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:1.5em;">
      <h2>⌨️ キーボードタイピングコーナー / Keyboard Typing Corner</h2>
      <p>このお手本の通りに入力してね！ / Type the sample exactly as shown!</p>
      <p style="font-size:1.4em;letter-spacing:0.05em;background:#3a1a2a;color:#fff;padding:0.6em;border-radius:8px;">${escaped}</p>
      <textarea id="input" rows="3" style="width:100%;font-size:1.2em;" autofocus></textarea>
      <div style="margin-top:0.8em;">
        <button id="submitBtn" style="font-size:1.1em;padding:0.4em 1em;">✅ 採点する / Grade it</button>
        <button id="nextBtn" style="font-size:1.1em;padding:0.4em 1em;">🔁 次の問題 / Next</button>
      </div>
      <p id="result" style="font-size:1.2em;font-weight:bold;"></p>
      <script>
        const vscodeApi = acquireVsCodeApi();
        const target = ${JSON.stringify(target)};
        function countMistakes(input) {
          const len = Math.max(target.length, input.length);
          let mistakes = 0;
          for (let i = 0; i < len; i++) {
            if (target[i] !== input[i]) mistakes++;
          }
          return mistakes;
        }
        document.getElementById("submitBtn").addEventListener("click", () => {
          const input = document.getElementById("input").value;
          const mistakes = countMistakes(input);
          document.getElementById("result").textContent =
            mistakes === 0 ? "🎉 ミス0回！パーフェクト！" : "ミス: " + mistakes + "回";
          vscodeApi.postMessage({ type: "result", mistakes });
        });
        document.getElementById("nextBtn").addEventListener("click", () => {
          vscodeApi.postMessage({ type: "next" });
        });
      </script>
    </body></html>`;
  }
}

// ユーザー指示(2026-09-28)「プログラミング教室風に最初は、変数の概念や
// forなどのループとの組合せ、簡単な5種類くらいの基本的なアルゴリズムの
// 考えかたを保育園児や幼稚園児でも分かるような…非常に分かりやすくなんど
// でも丁寧に教えてあげて、何度でも質問を受け付けてあげてください」+
// 「変数やオブジェクト思考のクラスなどいくつかの基本の考え方の概念…、
// グローバル変数をしようしないプログラムの書き方をお手本を…適用」——
// 幼稚園児向けの説明文を1つのドキュメントとして開き、その内容を踏まえて
// 何度でもAI先生へ質問できる導線を用意する(固定の説明文自体はAI推論を
// 経由しない、正直な開示)。
const PROGRAMMING_BASICS_LESSON = `# 🎀 プログラミング基礎教室(幼稚園児にも分かるように) / Programming Basics for Little Kids

## 1. 「へんすう(変数)」ってなあに？ / What is a "variable"?

**へんすうは、名前のついた「はこ」だよ！**
はこの中に、すきな物(数字や文字)を入れておけるの。あとで見たいときは、
その「はこの名前」を呼べば、中身がわかるよ！

\`\`\`js
let ohayo = "おはよう"; // "ohayo" というはこに "おはよう" を入れた！
console.log(ohayo); // はこの中身を見てみる → おはよう
\`\`\`

A **variable** is a labeled box. You put something inside it (a number or
some text), and later you can peek inside just by saying its name.

## 2. 「for」ってなあに？(くりかえしの魔法) / What is a "for" loop?

**forは「おなじことを、なんかいもくりかえす」魔法のじゅもんだよ！**
「1から5まで、1こずつ数える」みたいに、めんどくさいことを何回も自分で
書かなくていいように、コンピューターにおまかせできるの。

\`\`\`js
for (let i = 1; i <= 5; i++) {
  console.log(i + "かいめ！"); // 1かいめ！ 2かいめ！ ... 5かいめ！
}
\`\`\`

A **for loop** is a magic spell that repeats the same thing many times,
so you don't have to write it out by hand.

## 3. 「へんすう」+「for」を組み合わせてみよう / Combining variables and loops

\`\`\`js
let total = 0; // "total" というはこに、0を入れておく(まだ空っぽ)
for (let i = 1; i <= 3; i++) {
  total = total + i; // はこの中身に、いまの数字をたしていく
}
console.log(total); // 1+2+3 = 6
\`\`\`

## 4. きほんの「アルゴリズム(かんがえかた)」5つ / 5 Basic Algorithm Ideas

1. **かぞえる(Counting)**: 1から順番に数えて、いくつあるかを数える。
   forを使って「箱の中身に1ずつ足していく」だけ。
2. **いちばん大きいのをさがす(Finding the max)**: 1つずつ見て、
   「今までで一番おおきい数」をはこに入れておいて、もっと大きいのが
   見つかったら入れ替える。
3. **じゅんばんにならべる(Sorting、バブルソートのかんがえかた)**: お隣同士を
   くらべて、順番が逆だったら入れ替える、を何回もくりかえすと、
   だんだん順番にならぶよ(小さい方から大きい方へ)。
4. **さがしもの(Searching、線形探索)**: 1つずつ順番に見ていって、
   「これだ！」というものが見つかるまで探す。
5. **ごうけいをけいさんする(Summing)**: はこに0を入れておいて、
   1つずつ見つけるたびに、はこの中身にたしていく(上の3番の例と同じ)。

## 5. 「クラス」ってなあに？(おなじ形をつくる「型ぬき」) / What is a "class"?

**クラスは、クッキーの「型ぬき」だよ！**
1つの型ぬきがあれば、同じ形のクッキーをたくさん作れるよね？
プログラムでも、「同じ形(=同じデータと動き)」を持ったものを
たくさん作りたいときに、クラスという「型ぬき」を使うの。

\`\`\`js
class Neko {
  constructor(namae) {
    this.namae = namae; // このネコの名前を入れるはこ
  }
  naku() {
    console.log(this.namae + "が「にゃー」って鳴いたよ！");
  }
}
const tama = new Neko("たま"); // 型ぬきから「たま」というネコを1匹作った
tama.naku(); // たまが「にゃー」って鳴いたよ！
\`\`\`

A **class** is like a cookie cutter — one shape lets you stamp out many
cookies (objects) that all share the same data and behavior.

## 6. 「グローバル変数」には気をつけよう / Watch out for "global variables"

**グローバル変数は、教室のまんなかに置いた「みんなの共有はこ」だよ。**
みんなが自由に中身を書き換えられるから、誰かが勝手に書き換えると、
他の人がびっくりしちゃう(バグの原因になりやすい)。だから、なるべく
「自分専用のはこ」(関数の中だけで使う変数や、クラスの中の変数)を
使うのがお行儀がいいんだよ。AI先生は、あなたのプログラムを見て、
グローバル変数を使いすぎているなと思ったら、「自分専用のはこ」に
書き換えるお手本を、今使っている言語・フレームワークに合わせて
教えてくれるよ。

A **global variable** is like a shared box in the middle of the
classroom — anyone can change it, which can surprise other parts of the
program (a common source of bugs). Prefer variables scoped to a
function or a class instead. If the AI teacher notices you're relying
on too many global variables, it can show you how to rewrite the code
without them, tailored to the language/framework you're currently using.

---

わからないところがあったら、下の「🎓 AI先生に何度でも質問する」ボタンを
押して、いつでも何度でも質問してね！ぜんぶ丁寧に教えてあげるよ！
If anything is unclear, use the "🎓 Ask the AI Teacher" button below —
you can ask as many times as you like, and it will explain patiently.
`;

async function openProgrammingBasics(context: vscode.ExtensionContext) {
  const doc = await vscode.workspace.openTextDocument({
    content: PROGRAMMING_BASICS_LESSON,
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, { preview: false });
  await offerUnlimitedLessonQuestions(context, "プログラミング基礎教室(変数・forループ・5つの基本アルゴリズム・クラス・グローバル変数)");
}

// ユーザー指示(2026-09-28)「初心者向けにJavaScript教室も機能で開催して、
// すぐにJavaScriptからTypeScriptに移った方が良いと案内」+「非同期処理の
// 基本を学んだ後にAIにその処理を書かせる指示の出し方も学べるように」。
const JAVASCRIPT_CLASSROOM_LESSON = `# 💛 JavaScript教室(初心者向け) / JavaScript Classroom for Beginners

## JavaScriptって何？ / What is JavaScript?

Webページを動かすためのプログラミング言語だよ。ボタンを押したら何かが
起きる、みたいな「うごき」を作れるんだ。

## さっそく書いてみよう / Let's write some

\`\`\`js
let name = "たろう";
console.log("こんにちは、" + name + "さん！");
\`\`\`

## 📣 大事なお知らせ: すぐにTypeScriptへ移りましょう / Important: move to TypeScript soon

**JavaScriptに慣れてきたら、できるだけ早くTypeScriptへ移ることを
おすすめします。** TypeScriptはJavaScriptに「型(かた)」という、
値の種類をあらかじめ決めておく仕組みを足した言語で、AI先生や
エディタが「ここ、まちがっているよ！」と早めに教えてくれるように
なります。JavaScriptの書き方はほぼそのまま使えるので、こわがらなくて
大丈夫。

\`\`\`ts
// TypeScript版: nameは「文字だけ」と決めておける
let name: string = "たろう";
\`\`\`

**We strongly recommend moving from JavaScript to TypeScript as soon as
you're comfortable** — TypeScript adds "types" (declaring what kind of
value a variable holds), so your editor and the AI teacher can catch
mistakes earlier. Almost everything you already know from JavaScript
carries over directly.

## 非同期処理(asynchronous)の基本 / Basics of async processing

「時間がかかる作業(インターネットから何かを取ってくる、など)を
待っている間も、他のことができるようにする」仕組みが非同期処理だよ。
JavaScript/TypeScriptでは主に\`async\`/\`await\`を使う。

\`\`\`js
async function getMessage() {
  const response = await fetch("https://example.com/message.json");
  const data = await response.json();
  console.log(data.message);
}
\`\`\`

- \`async function\` … 「この関数の中では、待つ処理があるよ」という印。
- \`await\` … 「この行の結果が返ってくるまで、ここで待つよ」という意味。

## 非同期処理をAIに書かせる指示の出し方 / How to ask the AI to write async code for you

非同期処理をAIに書いてもらう時は、以下をはっきり伝えると良い結果に
なりやすいです:

1. **何を待つ処理か**(例: 「APIからデータを取ってくる」「ファイルを
   読み込む」)。
2. **成功した時に何をしてほしいか**(例: 「取得したデータを画面に
   表示する」)。
3. **失敗した時にどうしてほしいか**(例: 「エラーメッセージを表示する」
   ——\`try\`/\`catch\`で囲んでほしい、と伝えると分かりやすい)。
4. **使っている言語・フレームワーク**(例: 「TypeScript + React
   です」)。

例: 「TypeScript + Reactで、\`/api/users\`から利用者一覧を取得する
非同期関数を書いてください。取得できたら一覧を表示し、失敗したら
エラーメッセージを表示するようにしてください。」

When asking the AI to write async code, it helps to state clearly:
(1) what slow operation you're waiting on, (2) what should happen on
success, (3) what should happen on failure (mention you want
\`try\`/\`catch\`), and (4) which language/framework you're using.

---

わからないところは「🎓 AI先生に何度でも質問する」ボタンでいつでも
聞いてね！
`;

async function openJavaScriptClassroom(context: vscode.ExtensionContext) {
  const doc = await vscode.workspace.openTextDocument({
    content: JAVASCRIPT_CLASSROOM_LESSON,
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, { preview: false });
  await offerUnlimitedLessonQuestions(context, "JavaScript教室(基礎・TypeScriptへの移行・非同期処理とAIへの指示の出し方)");
}

/**
 * どのレッスンからでも呼べる「何度でも質問する」導線。1回のコマンド呼び
 * 出しで1問だけ受け付け、送信後に「もう一度質問しますか？」と尋ねること
 * で「何度でも質問を受け付けて」という要望を満たす(無限ループを避ける
 * ため、都度ユーザーの明示的な選択を挟む)。
 */
async function offerUnlimitedLessonQuestions(context: vscode.ExtensionContext, lessonLabel: string) {
  for (;;) {
    const proceed = await vscode.window.showInformationMessage(
      `${lessonLabel}について、AI先生に質問しますか？(何度でも聞けます) / Ask the AI teacher about "${lessonLabel}"? (ask as many times as you like)`,
      "🎓 質問する / Ask",
      "終わる / Done"
    );
    if (proceed !== "🎓 質問する / Ask") return;
    const question = await vscode.window.showInputBox({
      title: `AI先生に質問する / Ask the AI Teacher (${lessonLabel})`,
      prompt: "わからないところを何でも聞いてね(何度でもOK) / Ask anything — as many times as you like",
      ignoreFocusOut: true,
    });
    if (!question) continue;
    const prompt =
      `【${lessonLabel}についての質問です】\n${question}\n\n` +
      "保育園児・幼稚園児にも分かるくらい、とても丁寧に、やさしい言葉で説明してください。 / " +
      "Please explain this as simply and patiently as you would to a kindergartner.";
    await sendPromptToTeacher(context, question, prompt, /* skipStudyToggle */ true);
  }
}

// ユーザー指示(2026-09-28)「サンプルの課題の様な問題の様な、実際の
// フリーランスの案件を検索したり、AIがネットから自動でチョイスして
// 自動で選択して今日のサンプルなども題材に出来るようにして」——
// 姉妹プロジェクト`aruaru-jobs`の検索APIを叩き、返ってきた案件の中から
// 1件をランダムに「今日のサンプル課題」として選び、その内容をレッスン
// 教材として質問へ繋げる。**正直な開示**: 「AIが自動でチョイス」の実体は
// 単純なランダム選択であり、案件の質・難易度をAIが判定して選んでいる
// わけではない。
async function todaysSampleTask(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("maidCafeSchool");
  const jobsBaseUrl = config.get<string>("aruaruJobsBaseUrl", "https://easy-web.tokyo/aruaru-jobs");
  const query = await vscode.window.showInputBox({
    title: "今日のサンプル課題 / Today's Sample Task",
    prompt:
      "どんな案件を題材にしたいですか？(例: 初心者向け Webサイト) / What kind of job listing would you like as material? (e.g. beginner-friendly website)",
    value: "初心者 プログラミング",
    ignoreFocusOut: true,
  });
  if (!query) return;

  outputChannel.show(true);
  outputChannel.appendLine(`\n--- 今日のサンプル課題を検索中... / Searching today's sample task... ---`);
  try {
    const data = await postJson(`${jobsBaseUrl}/api/jobs/search`, { query });
    const items: any[] = extractJobItems(data?.results);
    if (items.length === 0) {
      outputChannel.appendLine("案件が見つかりませんでした。 / No job listings found.");
      vscode.window.showWarningMessage(
        "案件が見つかりませんでした。aruaru-jobsの接続先設定をご確認ください。 / " +
          "No job listings found. Please check the maidCafeSchool.aruaruJobsBaseUrl setting."
      );
      return;
    }
    const picked = pickRandom(items);
    const title: string = picked.title || picked.url || "無題の案件";
    const url: string = picked.url || picked.link || "";
    const snippet: string = picked.snippet || picked.description || "";
    outputChannel.appendLine(`🎯 今日のサンプル課題 / Today's sample task: ${title}\n${url}\n${snippet}`);

    const prompt =
      `以下の実際のフリーランス案件を題材に、プログラミングの練習をしたいです。 / ` +
      `I'd like to practice programming using this real freelance job listing as material.\n\n` +
      `Title / タイトル: ${title}\nURL: ${url}\nSnippet / 抜粋: ${snippet}\n\n` +
      "この案件の内容を、保育園児・幼稚園児にも分かるくらいやさしく解説した上で、" +
      "初心者でも取り組める簡単な練習課題に落とし込んでください。 / " +
      "Please explain this listing as simply as you would to a kindergartner, then turn it into a simple beginner-friendly practice exercise.";
    await sendPromptToTeacher(context, `Today's sample task: ${title}`, prompt, /* skipStudyToggle */ true);
    await offerUnlimitedLessonQuestions(context, `今日のサンプル課題「${title}」`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(
      `⚠ aruaru-jobs(${jobsBaseUrl})へ到達できませんでした: ${message}\n` +
        `⚠ Could not reach aruaru-jobs at ${jobsBaseUrl}: ${message}`
    );
    vscode.window.showWarningMessage(
      `aruaru-jobsへ到達できませんでした。設定"maidCafeSchool.aruaruJobsBaseUrl"をご確認ください。 / ` +
        `Could not reach aruaru-jobs. Please check the "maidCafeSchool.aruaruJobsBaseUrl" setting.`
    );
  }
}

function extractJobItems(results: unknown): any[] {
  if (Array.isArray((results as any)?.items)) return (results as any).items;
  if (Array.isArray((results as any)?.results)) return (results as any).results;
  if (Array.isArray(results)) return results as any[];
  return [];
}

// ユーザー指示(2026-09-28)「open-englishの日本語と英語を基本に世界中の
// 言語を学べる機能＋Visual Studio Codeのプラグインと連携して…ユーザーは
// 日本語か英語か世界中の言語だけ学習もしくは、プログラミングだけ学習。
// もしくは、いっしょに学習したり。題材も…」——open-english web版が
// 持つ「学びたい言語」選択・題材選択の考え方をこのVS Code拡張機能側にも
// 持ち込み、モード(言語学習のみ/プログラミングのみ/両方いっしょ)+
// 学びたい言語+題材(メイドカフェ研修ブログ風・世界の都市/観光名所・
// お土産や体験・ニュースやYouTube検索・realdata.pro・aruaru-jobs案件)を
// 選んでAI先生への依頼文を組み立てる。**正直な開示**: このプラグイン
// 自体は検索・地理データベースを持たない——「ニュース/YouTube検索」
// 「realdata.pro情報」等の題材は、aruaru-llm側の検索補強
// (`use_google_search`/GitHub調査)に委ねるプロンプトを組み立てるのみ。
type LearningMode = "language" | "programming" | "both";
const LEARNING_MODE_LABELS: Record<LearningMode, string> = {
  language: "$(comment-discussion) 言語学習だけ / Language learning only",
  programming: "$(code) プログラミングだけ / Programming only",
  both: "$(rocket) いっしょに学習する / Learn both together",
};

// 全世界130言語のうち、まず主要な言語に絞った実用的な一覧(open-english
// web版の"world-language-exams.json"と同じ考え方、ただしこちらは新規に
// このリポジトリ用に定義したもの)。
const WORLD_LANGUAGES: { code: string; label: string }[] = [
  { code: "ja", label: "日本語 / Japanese" },
  { code: "en", label: "English / 英語" },
  { code: "es", label: "Español / スペイン語" },
  { code: "fr", label: "Français / フランス語" },
  { code: "de", label: "Deutsch / ドイツ語" },
  { code: "it", label: "Italiano / イタリア語" },
  { code: "pt", label: "Português / ポルトガル語" },
  { code: "ru", label: "Русский / ロシア語" },
  { code: "zh", label: "中文 / 中国語" },
  { code: "ko", label: "한국어 / 韓国語" },
  { code: "ar", label: "العربية / アラビア語" },
  { code: "hi", label: "हिन्दी / ヒンディー語" },
  { code: "vi", label: "Tiếng Việt / ベトナム語" },
  { code: "th", label: "ภาษาไทย / タイ語" },
  { code: "id", label: "Bahasa Indonesia / インドネシア語" },
  { code: "tr", label: "Türkçe / トルコ語" },
  { code: "nl", label: "Nederlands / オランダ語" },
  { code: "pl", label: "Polski / ポーランド語" },
  { code: "uk", label: "Українська / ウクライナ語" },
  { code: "sw", label: "Kiswahili / スワヒリ語" },
];

type LearningTopic =
  | "maid_cafe_blog"
  | "world_cities"
  | "tourist_spots"
  | "souvenirs_food"
  | "experiences_classes"
  | "news_and_youtube"
  | "realdata_pro"
  | "aruaru_jobs"
  | "free_chat";
const LEARNING_TOPIC_LABELS: Record<LearningTopic, string> = {
  maid_cafe_blog: "$(comment) メイドカフェ英会話研修ブログ風 / Maid-cafe English training blog style",
  world_cities: "$(globe) 世界の州・主要都市・都道府県・市区町村 / World states, major cities, prefectures, towns",
  tourist_spots: "$(location) 観光名所 / Tourist spots",
  souvenirs_food: "$(gift) 美味しいもの・お土産 / Delicious food and souvenirs",
  experiences_classes: "$(mortar-board) 様々な体験や教室 / Various experiences and classes",
  news_and_youtube: "$(rss) インターネットニュース・ブログ・YouTube検索結果 / News, blogs, YouTube search results",
  realdata_pro: "$(database) realdata.proの情報 / realdata.pro information",
  aruaru_jobs: "$(briefcase) aruaru-jobsのフリーランス案件 / aruaru-jobs freelance listings",
  free_chat: "$(comment-discussion) 自由に雑談する / Free chat, no fixed topic",
};
function topicMaterialHint(topic: LearningTopic): string {
  switch (topic) {
    case "maid_cafe_blog":
      return (
        "秋葉原メイドカフェの実際の接客・英会話研修ブログのスタイル(完璧な文法より" +
        "キーワード+笑顔で会話が成立する、という考え方)を参考にした題材にしてください。 / " +
        "Use the style of a real Akihabara maid-cafe customer-service/English-training blog " +
        "(the idea that keywords plus a smile matter more than perfect grammar) as material."
      );
    case "world_cities":
      return (
        "世界の州・主要都市・(日本の)都道府県・市区町村を題材にしてください。 / " +
        "Use world states/provinces, major cities, and Japan's prefectures/municipalities as material."
      );
    case "tourist_spots":
      return "観光名所を題材にしてください。 / Use tourist spots as material.";
    case "souvenirs_food":
      return "美味しいものやお土産を題材にしてください。 / Use delicious local food and souvenirs as material.";
    case "experiences_classes":
      return "様々な体験や教室(現地での体験・習い事等)を題材にしてください。 / Use various local experiences and classes as material.";
    case "news_and_youtube":
      return (
        "最新のインターネットニュース・ブログ・YouTube検索結果を調べた上で、それを題材にしてください" +
        "(検索補強を使ってください)。 / Look up the latest internet news, blogs, and YouTube search " +
        "results and use them as material (please use web-search grounding)."
      );
    case "realdata_pro":
      return (
        "realdata.pro(不動産・実データ検索サイト)の情報を調べた上で、それを題材にしてください。 / " +
        "Look up information from realdata.pro (a real-estate/real-data search site) and use it as material."
      );
    case "aruaru_jobs":
      return (
        "aruaru-jobs(フリーランス案件検索サイト)の実際の案件情報を調べた上で、それを題材にしてください。 / " +
        "Look up real freelance job listings from aruaru-jobs and use them as material."
      );
    case "free_chat":
    default:
      return "特に決まった題材はありません、自由に雑談してください。 / There is no fixed topic — just chat freely.";
  }
}
function learningModeInstruction(mode: LearningMode, langLabel: string): string {
  if (mode === "language") {
    return (
      `${langLabel}での会話練習をしたいです。上記の題材を使って、雑談しながら会話練習をしてください。 / ` +
      `I'd like to practice conversation in ${langLabel}. Please chat with me about the topic above.`
    );
  }
  if (mode === "programming") {
    return (
      "上記の題材を参考に、スマホアプリまたはWEBサイト開発の練習をしたいです。プログラミングの指導をしてください。 / " +
      "Using the topic above as inspiration, I'd like to practice developing a mobile app or website — please teach me the programming."
    );
  }
  return (
    `${langLabel}での会話練習と、スマホアプリ/WEBサイト開発の練習を、上記の題材を使いながら` +
    "いっしょに進めたいです。日本語と英語(または選んだ言語)で会話しつつ、開発も教えてください。 / " +
    `I'd like to practice both conversation in ${langLabel} and mobile-app/website development together, ` +
    "using the topic above — please converse with me while also teaching the development side."
  );
}

async function openWorldLearning(context: vscode.ExtensionContext) {
  const modePick = await vscode.window.showQuickPick(
    (Object.keys(LEARNING_MODE_LABELS) as LearningMode[]).map((value) => ({ label: LEARNING_MODE_LABELS[value], value })),
    { title: "どう学びますか？ / How would you like to learn?", ignoreFocusOut: true }
  );
  if (!modePick) return;
  const mode = modePick.value;

  let langLabel = "日本語・英語 / Japanese & English";
  if (mode !== "programming") {
    const langPick = await vscode.window.showQuickPick(
      WORLD_LANGUAGES.map((l) => ({ label: l.label, value: l.label })),
      { title: "学びたい言語を選んでください / Choose the language you'd like to learn", ignoreFocusOut: true }
    );
    if (!langPick) return;
    langLabel = langPick.value;
  }

  const topicPick = await vscode.window.showQuickPick(
    (Object.keys(LEARNING_TOPIC_LABELS) as LearningTopic[]).map((value) => ({ label: LEARNING_TOPIC_LABELS[value], value })),
    { title: "題材を選んでください / Choose a topic to use as material", ignoreFocusOut: true }
  );
  if (!topicPick) return;
  const topic = topicPick.value;

  if (topic === "aruaru_jobs") {
    // 既存の「今日のサンプル案件」フローをそのまま再利用する
    // (aruaru-jobsへの実検索は既にそちらに実装済みのため重複させない)。
    await todaysSampleTask(context);
    return;
  }

  const prompt = `${topicMaterialHint(topic)}\n\n${learningModeInstruction(mode, langLabel)}`;
  const label = `World learning: ${LEARNING_MODE_LABELS[mode]} / ${LEARNING_TOPIC_LABELS[topic]}`;
  await sendPromptToTeacher(context, label, prompt, /* skipStudyToggle */ true);
  await offerUnlimitedLessonQuestions(context, label);
}

// ユーザー指示(2026-09-28)「プラグインと同時にローカルPCにまだ
// インストールしていなければ、open-easy-web+open-directx+open-cpu+
// open-cuda+aruaru-llmなどと、その他関連リポジトリを一緒にダウン
// ロードして利用して頂ける用にして」——正直な開示: このプラグイン
// 自体はビルド・実行環境を持たないため、実際に行えるのは「まだ
// 存在しないリポジトリを、統合ターミナルで`git clone`する」ところ
// までであり、各リポジトリのビルド・起動は利用者自身がそれぞれの
// README/インストーラーに従って行う必要がある(黙って裏で自動ビルド
// する、というような誇張はしない)。
const RELATED_REPOS: { id: string; description: string }[] = [
  { id: "open-easy-web", description: "ドメイン簡単登録+HTTPS自動監視/発行/更新" },
  { id: "open-directx", description: "DirectX互換クロスプラットフォーム抽象化層" },
  { id: "open-cpu", description: "CPU命令セット検出共通ライブラリ" },
  { id: "open-cuda", description: "GPU compute抽象化(aruaru-llmの推論基盤)" },
  { id: "aruaru-llm", description: "AI推論・検索エンジン本体(このプラグインが接続する先)" },
];
const RELATED_REPOS_SETUP_DONE_KEY = "maidCafeSchool.relatedReposSetupOffered";

async function maybeOfferRelatedReposSetupOnce(context: vscode.ExtensionContext) {
  if (context.globalState.get<boolean>(RELATED_REPOS_SETUP_DONE_KEY, false)) return;
  await context.globalState.update(RELATED_REPOS_SETUP_DONE_KEY, true);
  const choice = await vscode.window.showInformationMessage(
    "AI先生機能をフルに使うには、open-easy-web・open-directx・open-cpu・open-cuda・aruaru-llm等の" +
      "関連リポジトリが必要です。まだお手元に無ければ、いま一緒にダウンロードしますか？ / " +
      "To use the full AI-teacher features, you'll need related repos like open-easy-web, open-directx, " +
      "open-cpu, open-cuda, and aruaru-llm. Would you like to download them now if you don't have them yet?",
    "🧰 セットアップする / Set up now",
    "あとで / Later"
  );
  if (choice === "🧰 セットアップする / Set up now") {
    await setupRelatedRepos(context);
  }
}

async function setupRelatedRepos(context: vscode.ExtensionContext) {
  const folders = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "このフォルダへclone / Clone into this folder",
    title: "関連リポジトリをどこへ配置しますか？ / Where should the related repos be placed?",
  });
  if (!folders || folders.length === 0) return;
  const baseDir = folders[0].fsPath;

  const picks = await vscode.window.showQuickPick(
    RELATED_REPOS.map((r) => ({
      label: r.id,
      description: r.description,
      picked: !repoAlreadyPresent(baseDir, r.id),
    })),
    {
      title: "セットアップするリポジトリを選んでください(既にあるものは既定でチェックを外しています) / " +
        "Choose which repos to set up (already-present ones are unchecked by default)",
      canPickMany: true,
      ignoreFocusOut: true,
    }
  );
  if (!picks || picks.length === 0) return;

  const terminal = vscode.window.createTerminal("Maid Cafe School: Related Repos Setup");
  terminal.show(true);
  for (const pick of picks) {
    if (repoAlreadyPresent(baseDir, pick.label)) {
      terminal.sendText(`echo "${pick.label} は既に存在するのでスキップします / already present, skipping"`);
      continue;
    }
    terminal.sendText(`git clone https://github.com/aon-co-jp/${pick.label}.git`);
  }
  vscode.window.showInformationMessage(
    "統合ターミナルでcloneを開始しました。各リポジトリのビルド・起動はそれぞれのREADMEに従って" +
      "ご自身で行ってください(このプラグインが裏で自動ビルドすることはありません)。 / " +
      "Cloning has started in the integrated terminal. Please build/run each repo yourself following " +
      "its own README (this extension never silently builds anything in the background)."
  );
}

function repoAlreadyPresent(baseDir: string, repoId: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("path") as typeof import("path");
    return fs.existsSync(path.join(baseDir, repoId));
  } catch {
    return false;
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
