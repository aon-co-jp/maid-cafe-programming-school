# PORTING(お引越し可能ファイル一覧) — 日本語 / English

このファイルは、他プロジェクトへそのまま移植・応用できる実装パターンを
まとめたものです。詳細な開発経緯は[`CLAUDE.md`](CLAUDE.md)を参照。

This file lists implementation patterns from this repository that can be
ported to other projects as-is. See [`CLAUDE.md`](CLAUDE.md) for full
development history.

## 1. 非表示Webview経由のTTS(`speechSynthesis`)パターン

VS Code拡張ホスト(Node環境)にはブラウザのWeb Speech API
(`speechSynthesis`)が存在しない。`src/extension.ts`の
`ensureTtsPanel`/`speak`が、非表示の`WebviewPanel`を1枚保持し、
`postMessage`でテキストを送って発話させる薄いブリッジを実装している。
他のVS Code拡張機能でも、ブラウザ標準APIを使いたい場合はこの
パターン(隠しWebview + `postMessage`ブリッジ)がそのまま使える。

VS Code's extension host (a Node environment) has no browser Web Speech
API (`speechSynthesis`). `ensureTtsPanel`/`speak` in `src/extension.ts`
hold one hidden `WebviewPanel` and bridge to it via `postMessage` to
actually speak text. Any VS Code extension that needs a browser-standard
API can reuse this pattern (hidden webview + `postMessage` bridge).

## 2. AIプロバイダの汎用選択UI(`selectAiProvider`)

既定は無料・無制限の自前AIサーバー、オプションで各社クラウドAPI
(ご自身のキー)へ切り替えられる、という設計は`open-english`web版・
本拡張機能で共通のパターン。`PROVIDER_LABELS`+`providerApiKeySecretName`
+`context.secrets`の組み合わせをそのまま他プロジェクトへ移植できる。

The design — default to a free/unlimited self-hosted AI backend, with an
opt-in switch to each cloud provider using your own key — is shared
between the `open-english` web app and this extension. The
`PROVIDER_LABELS` + `providerApiKeySecretName` + `context.secrets`
combination can be ported directly to other projects.

## 3. `vscode://` ディープリンクによる外部サイト連携

`registerJobImportUriHandler`が示す通り、`vscode.window.
registerUriHandler`で`vscode://<publisher>.<extension-id>/<path>?
<query>`を受け取り、外部のWebサイト(`aruaru-jobs`)からVS Code拡張機能へ
直接データを渡す設計は、他の「外部サイト→VS Code連携」機能にも応用
できる。

`registerJobImportUriHandler` demonstrates receiving
`vscode://<publisher>.<extension-id>/<path>?<query>` via
`vscode.window.registerUriHandler`, letting an external website
(`aruaru-jobs`) hand data directly to a VS Code extension. This pattern
generalizes to any "external site → VS Code" integration.

## 4. キーワードベースの演出トリガー

`isOrderRequest`/`isTroubledRequest`のような、固定キーワード配列との
部分一致でユーザー発話の意図を分類し、AI推論を経由せず固定フレーズを
返す設計は、`open-english`側の`consumptionTaxSuffix`等と同型のパターン。
「AIに語らせると事実でない内容を作ってしまう」場面での代替として、
他プロジェクトでも再利用できる。

The `isOrderRequest`/`isTroubledRequest` pattern — classifying user
intent via substring matching against a fixed keyword list, then
returning a fixed phrase without going through AI inference — mirrors
`consumptionTaxSuffix` and friends on the `open-english` side. It's a
reusable alternative wherever letting the AI "make something up" would
be worse than a scripted response.

## 5. `easy-web.tokyo`上の静的ランディングページ配信パターン(`make-disk-web.service`と同型)

`webpage/index.html`(このリポジトリの紹介ページ、`https://easy-web.tokyo/
maid-cafe-programming-school`で公開)は、`make-disk`リポジトリの
`make-disk-web.service`と全く同じ最小構成で配信している:
`python3 -m http.server <port> --bind 127.0.0.1`をsystemdサービス化し、
VPS側`/root/open-web-server/domains.toml`に`host = "easy-web.tokyo"`・
`path_prefix = "/<name>"`・`strip_prefix = true`のエントリを1件追加する
だけ(専用のバックエンド実装は不要)。この構成は他の「GitHubリポジトリの
簡単な紹介ページをeasy-web.tokyo配下に置きたいだけ」の場合にそのまま
再利用できる。

`webpage/index.html` (this repository's introduction page, published at
`https://easy-web.tokyo/maid-cafe-programming-school`) is served with the
exact same minimal setup as `make-disk`'s `make-disk-web.service`:
`python3 -m http.server <port> --bind 127.0.0.1` as a systemd service,
plus one `domains.toml` entry on the VPS (`host = "easy-web.tokyo"`,
`path_prefix = "/<name>"`, `strip_prefix = true`) — no dedicated backend
needed. This pattern is directly reusable any time you just want a simple
GitHub-repo introduction page hosted under `easy-web.tokyo`.
