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

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

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
    vscode.commands.registerCommand("maidCafeSchool.toggleClaudeCombo", () => toggleClaudeCombo(context))
  );
}

export function deactivate() {
  /* nothing to clean up: this extension holds no persistent connections */
}

function refreshStatusBar(context: vscode.ExtensionContext) {
  const comboOn = context.globalState.get<boolean>(CLAUDE_COMBO_ENABLED_KEY, false);
  statusBarItem.text = comboOn ? "$(mortar-board) Maid Cafe School (Claude)" : "$(mortar-board) Maid Cafe School";
  statusBarItem.tooltip = "Maid Cafe Programming School / メイドカフェ・プログラミングスクール";
  statusBarItem.show();
}

async function openMenu(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("maidCafeSchool");
  const studying = config.get<boolean>("studyWhileDeveloping", false);
  const comboOn = context.globalState.get<boolean>(CLAUDE_COMBO_ENABLED_KEY, false);
  const pick = await vscode.window.showQuickPick(
    [
      { label: "$(comment-discussion) Ask the AI Teacher / AI先生に質問する", value: "ask" },
      {
        label: `$(book) Study while developing: ${studying ? "ON" : "OFF"} / 同時にプログラム学習: ${studying ? "ON" : "OFF"}`,
        value: "study",
      },
      {
        label: `$(key) Incorporate my paid Claude: ${comboOn ? "ON" : "OFF"} / 有料版Claudeの組み込み: ${comboOn ? "ON" : "OFF"}`,
        value: "claude",
      },
    ],
    { placeHolder: "Maid Cafe Programming School" }
  );
  if (!pick) return;
  if (pick.value === "ask") await askTeacher(context);
  else if (pick.value === "study") await toggleStudyWhileDeveloping();
  else if (pick.value === "claude") await toggleClaudeCombo(context);
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

  let prompt = question;
  if (selectionText) {
    prompt += `\n\nCode (${filePath}):\n\`\`\`\n${selectionText}\n\`\`\``;
  }

  const config = vscode.workspace.getConfiguration("maidCafeSchool");
  if (config.get<boolean>("studyWhileDeveloping", false)) {
    prompt +=
      "\n\n同時にプログラムの学習も行いたいです。開発を進めながら、関連する基礎知識も適宜教えてください。 / " +
      "I'd also like to study programming at the same time — please teach me relevant basics along the way as we develop this.";
  }

  const comboOn = context.globalState.get<boolean>(CLAUDE_COMBO_ENABLED_KEY, false);
  if (comboOn) {
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
    if (comboOn) {
      const apiKey = await context.secrets.get(CLAUDE_API_KEY_SECRET);
      const body: Record<string, unknown> = {
        prompt,
        providers: ["claude"],
        use_google_search: true,
        use_github_search: useGithub,
      };
      if (apiKey) body.provider_keys = { claude: apiKey };
      const data = await postJson(`${baseUrl}/v1/chat-providers/complete-priority`, body);
      responseText =
        (data && data.reply && typeof data.reply.text === "string" && data.reply.text) ||
        (data && typeof data.error === "string" && `⚠ ${data.error}`) ||
        JSON.stringify(data);
    } else {
      // 既定経路: aruaru-search(無制限・APIキー不要)を最優先で試す、
      // open-english web版と同じ`/v1/generate-with-search`。
      const body: Record<string, unknown> = { prompt, max_new_tokens: 96 };
      const data = await postJson(`${baseUrl}/v1/generate-with-search`, body);
      responseText =
        (data && typeof data.completion === "string" && data.completion) ||
        (data && typeof data.error === "string" && `⚠ ${data.error}`) ||
        JSON.stringify(data);
    }
    outputChannel.appendLine("\n--- Answer / 回答 ---");
    outputChannel.appendLine(responseText);
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
