# Maid Cafe Programming School (VS Code拡張機能)

[`open-english`](https://github.com/aon-co-jp/open-english)のブラウザ版チャットだけでは、
エディタ上のコード選択範囲・ファイルパスといったコンテキストを渡せず、「一緒に開発しながら
学ぶ」という体験がチャットの往復コピペに限定されてしまう限界がありました。本拡張機能は、
その限界を超えるために、VS Codeのエディタから直接、お使いのローカル`aruaru-llm`インスタンスへ
質問できるようにする**薄いクライアント**です。

## できること

- **AI先生に質問する**(コマンドパレット、またはステータスバーの🎓アイコン): 選択中のコードと
  ファイルパスを添えて、ローカルの`aruaru-llm`へ質問を送信します。
- **同時にプログラムの学習も行なう**: ONにすると、開発を進めながら関連する基礎知識も
  教えてもらうよう依頼文へ自動で追記します(open-english web版と同じ機能)。
- **AI先生を選択**: 既定は`aruaru-llm` + 無料のGoogle検索(自信が無い時だけ)。ご自身の
  APIキーをお持ちなら、ChatGPT・Gemini・DeepSeek・Grok・Claude(有料版)へも切り替え
  可能です。Claudeを選ぶと「新規プロジェクトにしますか？」「どこのプロジェクト内の会話に
  しますか？」と尋ねられます(open-english web版と同じ設計)。
- **[`aruaru-jobs`](https://github.com/aon-co-jp/aruaru-jobs)からの案件取り込み**:
  フリーランス案件検索サイト`aruaru-jobs`の各案件カードにある
  「🎓 Maid Cafe Programming Schoolで開発」ボタンから
  `vscode://aon-co-jp.maid-cafe-programming-school/import-job?...`が開かれると、
  その案件情報(タイトル・URL・抜粋)を元に「一緒に学習しながら開発したい」という
  依頼文を自動生成し、そのままAI先生へ相談できます。
- **日本語・英語・世界の言語を学ぶ**: モード(言語学習だけ/プログラミングだけ/
  いっしょに学習)+学びたい言語(日本語・英語+主要20言語)+題材
  (メイドカフェ英会話研修ブログ風・世界の州や主要都市/都道府県/市区町村・
  観光名所・美味しいもの/お土産・様々な体験や教室・インターネットニュース/
  ブログ/YouTube検索結果・realdata.proの情報・aruaru-jobsのフリーランス
  案件・自由な雑談)を選んで、AI先生への依頼文を自動生成します。
  「ニュース検索」「realdata.pro」等の題材は、実際の検索・データ取得は
  この拡張機能ではなく`aruaru-llm`側の検索補強機能に委ねます。
- **関連リポジトリのセットアップ**: 初回起動時に一度だけ、
  `open-easy-web`・`open-directx`・`open-cpu`・`open-cuda`・`aruaru-llm`が
  お手元に無ければ、統合ターミナルで`git clone`するかどうかを尋ねます
  (コマンドパレットからいつでも呼び出し可能)。**正直な開示**: cloneまで
  行いますが、各リポジトリのビルド・起動は行いません——それぞれの
  READMEに従ってご自身で行ってください。
- **学習中BGM(archive.org、商用利用可)**: コマンドパレット「学習中BGMを今すぐ生成・再生」、
  または`maidCafeSchool.studyBgm.enabled`設定から、[`aruaru-search`](https://github.com/aon-co-jp/aruaru-search)
  の`/v1/media-search`(`aruaru-llm`経由でプロキシ)でarchive.orgの音源を検索・
  ストリーミング再生できます。**パブリックドメイン・CC0・CC-BY・CC-BY-SAのみに
  限定済み**(CC-BY-NC等の非商用限定ライセンスは`aruaru-search`側で最初から除外)
  ——**商用利用も可能**です。再生パネルには**曲名・歌手名(演奏者)を表示**し、
  **ON/OFF(再生・一時停止)・音量調整・スキップ(次の曲)・10秒巻き戻し・10秒早送り**
  の操作ができます(いずれもWebview内の音声要素をJSで操作するだけで、この拡張機能自体は
  音声処理を一切行いません)。
  **ライセンスに関する重要な注意(Important license notice)**: パブリックドメイン
  以外(**CC-BY・CC-BY-SA**)の音源を商用利用する場合、そのライセンスにより
  **作成者のクレジット表示とライセンスへのリンクを表示する法的な義務があります**
  (CC-BY-SAはさらに同一ライセンスでの再配布も必要)。この機能は初回有効化時、
  および30日ごとに、英語・日本語併記の通知を表示し、クリックすると
  [`aruaru-search`の`ATTRIBUTION_NOTICE.md`](https://github.com/aon-co-jp/aruaru-search/blob/main/ATTRIBUTION_NOTICE.md)
  (日英正本+世界約130ヶ国語のAI翻訳)を開けます。再生中の音源のクレジット・
  ライセンスリンクは、BGMパネル内に常時表示されます。
  *(EN) Study BGM streams tracks from archive.org via `aruaru-search`'s
  `/v1/media-search` (proxied through `aruaru-llm`), limited to Public Domain, CC0,
  CC-BY, and CC-BY-SA licenses — **commercial use is allowed**. Important: for
  non-Public-Domain tracks (CC-BY / CC-BY-SA), commercial use legally requires
  attribution (credit the creator, link to the license). A bilingual notice is shown
  on first enable and every 30 days, linking to the full notice in EN/JA + ~130
  AI-translated languages.*
- **メイドカフェ風のしゃべり演出**(`speakText`設定、既定ON): 起動時に出迎えの挨拶
  (「おかえりなさいませ！ご主人様！良い子のみんな元気〜！…」)、AI先生の回答の読み上げ、
  コーヒー・オムライス等の注文を検知すると「おいしくなーれ、萌え萌えキューん。」、
  悩み相談的な発言を検知すると「めっ！こらっ！いつまでも、くよくよ悩んでいちゃいけないん
  だぞ！萌え萌えキューン！」を、幼稚園の先生風・メイドカフェの女の子風の声色
  (高めのpitch・やや遅めのrate・可能なら女性寄りの日本語音声を自動選択)で読み上げます。
  チェックの状態はVS Codeの設定に記憶されるため、一度ONにすれば次回以降も引き継がれます。

## Claude Code(有料版)なら、GitHub・VPS・ローカルドライブの操作も自動化できる / With paid Claude Code, automate GitHub, your VPS, and local files too

有料版のClaude Code(Desktop/CLI)をご利用の場合、無料のGitHub(公開リポジトリ・非公開
リポジトリのどちらも選択可能)でトークンを発行してローカルドライブに保存し、Claudeに
その場所を指定するだけで、新規リポジトリ作成や`push`等のアップロード、読み書きの自動化が
可能になります。VPSレンタルサーバー(有料)をご契約の場合も同様に、秘密鍵・公開鍵を
ローカルドライブに保存してClaudeに指定すれば(GitHubトークンと同じ要領です)、VPSへの
アップロード・ダウンロード、フォルダ名・ファイル名の変更や削除まで自動化できます。
もちろん、ローカルドライブ上のフォルダ作成・削除・読み書きの自動化も可能です。

*(EN)* With paid Claude Code (Desktop/CLI), you can issue a token for your free GitHub account
(public or private repositories, your choice), save it to your local drive, and simply point
Claude to it — enabling automated repository creation, pushing/uploading, and reading/writing
files. Likewise, once you have a paid VPS rental server, saving your private and public SSH
keys to your local drive and pointing Claude to them (the same way as the GitHub token) enables
automated uploading/downloading to the VPS, as well as renaming or deleting folders and files
there. Automating folder creation, deletion, and read/write operations on your local drive is
possible too.

**正直な開示 / Honest disclosure**: これはこの拡張機能自体の機能ではなく、Claude Code
(Anthropicが提供するAIコーディングエージェント)一般の機能です。トークンや秘密鍵は
ユーザーご自身が用意・管理するものであり、Claudeに与える操作範囲・権限は常にユーザーの
判断に委ねられます。 *This is a general capability of Claude Code itself, not a feature of
this extension — tokens and private keys are something you provide and control yourself, and
the scope of what Claude is allowed to do is always up to you.*

## 無料のGitHub→GitLab自動バックアップ同期も、Claudeに開発を依頼できる / You can also ask Claude to build free GitHub → GitLab auto-backup sync

非公開型か公開型かどうかは、ユーザーの皆様にご選択して頂き、無料のGitHubのバックアップ先に
GitLabを選択すると、1リポジトリあたりの最大容量は**10GBまで**となっております。GitHubの
無料の機能で、GitLabなど他のサイトに自動でバックアップの同期を取るシステムの開発を、
Claudeなどに依頼することも可能です。

*(EN)* Whether your repository is private or public is entirely your choice. If you choose
GitLab as the free backup destination for your GitHub repository, the maximum size per
repository is **up to 10GB**. Using GitHub's free features, you can also ask Claude to develop
a system that automatically syncs backups to other sites such as GitLab.

**正直な開示 / Honest disclosure**: これもこの拡張機能自体の機能ではなく、Claude Code
一般の機能です。実際の同期方法(GitHub Actions経由・VPS上の定期ジョブ等)は要件次第です。
*This too is a general Claude Code capability, not a feature of this extension — the actual
sync mechanism depends on your requirements.*

## 正直な開示(誇張しないこと)

- **AI推論・検索(aruaru-search)は、この拡張機能自体には一切実装されていません**——すべて
  お使いのローカル`aruaru-llm`インスタンス(既定`http://127.0.0.1:4600`)が行います。
  `aruaru-llm`が起動していない場合、この拡張機能は接続エラーを正直に表示するだけで、
  何らかの代替AI機能を独自に持つわけではありません。
- Claude(Anthropic)・その他クラウドプロバイダのAPIキーはVS Codeの`SecretStorage`
  (OSの資格情報ストアを利用する暗号化保存領域)に保存されますが、実際にAIへ問い合わせる際は
  お使いの`aruaru-llm`へ平文で送信されます(open-english web版の既存の設計・開示と同じ)。
- **「しゃべる」演出はWeb Speech API(`speechSynthesis`)によるもので、拡張機能自体が
  独自の音声合成エンジンを持つわけではありません**——VS Code拡張機能本体(Node拡張ホスト)には
  このAPIが存在しないため、非表示のWebviewパネルを1枚裏で保持し、そこへ読み上げたい
  テキストを送って発話させています。声色(pitch/rate/声の選択)で「可愛らしさ」に近づける
  調整はしていますが、実際に鳴る声はお使いのOS/ブラウザエンジンが提供する音声に依存し、
  常に同じ声・同じ抑揚になるとは限りません。
- 発話・注文検知・悩み相談検知はいずれも**固定キーワードによるルールベース判定**であり、
  AI推論を経由しません(誤検知・見逃しがあり得ます)。
- **学習中BGM機能は、この拡張機能自体には検索・音楽生成AIを一切実装していません**——
  既存アーキテクチャ方針どおり`aruaru-llm`(`aruaruLlmBaseUrl`)へHTTPで問い合わせる
  だけの薄いラッパーで、実際のarchive.org検索・ライセンス絞り込みは`aruaru-llm`が
  プロキシする`aruaru-search`の`/v1/media-search`が行います。`aruaru-llm`が未起動の場合、
  この拡張機能は接続エラーを正直に表示するだけです。**表示義務についての通知は
  自己申告・自己確認の仕組みであり(CC-BY/CC-BY-SAのライセンス表示義務そのものを技術的に
  強制する手段はありません)、あくまで利用者に思い出させるためのものです。**
  *(EN) The Study BGM feature implements no search or music-generation AI of its own — it
  is a thin HTTP client to your local `aruaru-llm` (`aruaruLlmBaseUrl`), which proxies
  `aruaru-search`'s `/v1/media-search` (the actual archive.org search and license
  filtering happens there). The attribution-obligation notice is a self-attestation/
  reminder mechanism only; there is no technical way to enforce the CC-BY/CC-BY-SA
  attribution requirement from code.*

## セットアップ

1. `npm install`
2. `npm run compile`
3. VS Codeで`F5`(拡張機能開発ホストの起動)、またはvsceでパッケージ化してインストール
   (`npm run package`で`.vsix`を生成、または将来的にVS Code Marketplaceで
   「Maid Cafe Programming School」を検索してインストール——公開準備は済み
   〈`icon`/`repository`/`LICENSE`等〉ですが、Marketplace公開自体はご自身の
   Azure DevOps発行者トークンでの`npm run publish`が必要です)
4. 設定(`maidCafeSchool.aruaruLlmBaseUrl`)でご自身の`aruaru-llm`の接続先を確認(既定は
   `http://127.0.0.1:4600`)
5. 「テキスト内容をしゃべる」(`maidCafeSchool.speakText`)は既定ONです。オフにしたい
   場合はコマンドパレットから「Maid Cafe School: Toggle "Speak Text"」を実行してください。

紹介ページ(日英併記、使い方・関連リンク)は
[easy-web.tokyo/maid-cafe-programming-school](https://easy-web.tokyo/maid-cafe-programming-school)
でも公開しています。

## Honest disclosure (English)

This extension implements **no AI inference or search of its own** — it is a thin HTTP client
that forwards your question (plus any selected code) to your own locally running `aruaru-llm`
instance (`http://127.0.0.1:4600` by default), which already prioritizes aruaru-search
(unlimited, no API key needed) internally. If `aruaru-llm` isn't running, this extension shows
an honest connection error rather than pretending to answer on its own.

The maid-cafe voice touches (startup greeting, spoken replies, a cute "おいしくなーれ、
萌え萌えキューん。" line on food/drink orders, and a kindergarten-teacher-meets-maid-cafe
"めっ！こらっ！…萌え萌えキューん！" line when you sound discouraged) use the browser-standard
Web Speech API (`speechSynthesis`) via a hidden webview — the extension has no speech engine of
its own, and the actual voice depends on what your OS/browser provides. All of this is gated by
the `maidCafeSchool.speakText` setting (default ON, remembered across sessions), and the
detection is simple keyword matching, not AI inference.

## Related projects / 関連プロジェクト

- **[open-english](https://github.com/aon-co-jp/open-english)** — The parent web app this
  extension is a companion to. A free, unlimited English/Japanese/world-language learning app
  that uses `aruaru-llm` + `aruaru-search` (no API key, no per-request cost) as its default AI
  teacher, with optional paid cloud providers (ChatGPT/Gemini/DeepSeek/Grok/Claude) if you bring
  your own key. This VS Code extension exists because the web chat alone couldn't pass editor
  context (selected code, file paths) to the AI teacher.
  *(JA)* この拡張機能の母体となっているWebアプリです。`aruaru-llm`+`aruaru-search`
  (APIキー不要・無制限)を既定のAI先生とし、ご自身のAPIキーがあれば有料クラウド
  プロバイダ(ChatGPT/Gemini/DeepSeek/Grok/Claude)にも切り替えられる、無料の
  日本語・英語・世界の言語学習アプリです。本拡張機能は、Webチャットだけではエディタの
  コンテキスト(選択中のコード・ファイルパス)を渡せないという限界を超えるために作られました。
- **[github.com/aon-co-jp](https://github.com/aon-co-jp)** — The GitHub organization behind
  this extension, `open-english`, `aruaru-llm`/`aruaru-search` (the free AI teacher/search
  engine behind it), and the wider `open-*`/`aruaru-*` ecosystem of open-source, self-hostable
  tools this project is built on.
  *(JA)* この拡張機能・`open-english`・その裏側にある無料のAI先生/検索エンジン
  `aruaru-llm`/`aruaru-search`をはじめ、このプロジェクトの土台となっている
  `open-*`/`aruaru-*`系オープンソース(自前ホスト可能)エコシステム全体を運営している
  GitHub organizationです。

## API 方針: REST 全廃・gRPC / Connect へ (2026-11-04)

### 日本語
- **REST は全廃する。新しい API は REST で作らない。** ブラウザや `curl` から呼ぶ API は **Connect の単純呼び出し**(`POST /<パッケージ>.<Service>/<Method>`、`content-type: application/json`、本文は JSON)、サービス間は **gRPC / gRPC-web**(RPoem の管理API `open_runo.admin.v1.Admin` と同じ流儀)。ストリーミングは、必要になってから。
- **既存の REST は、触るときに順に移す。** 移したら旧 REST の経路は消す。移行が終わるまで残るが、**新規には追加しない**。
- **JSON は RS-JSON に統一**する(読み込みは `from_str_secure` / `parse_secure` でサイズ・深さ・重複キーの上限つき、書き出しは `rust_json::fast`)。ブラウザの WASM に `prost` は入れない(サイズが増えるため)。
- **例外(自分たちの API ではなく、相手の規格が決めているもの)**: ACME、OAuth/OIDC のコールバック、第三者(GitHub など)からの Webhook、ヘルスチェック、静的ファイル配信、OTLP など。これらは規格どおりの HTTP を受ける。
- 参考実装: `RPoem`(`open_runo.admin.v1.Admin`)、`open-easy-web`(`server/src/connect.rs`、`proto/open_easy_web/admin/v1/admin.proto`)。
- ※ このリポジトリのコードが既に方針どおりかどうかは、各リポジトリの現状による。この節は方針の記録であり、コードの変更を意味しない。

### English
- **REST is being abolished. New APIs are not built as REST.** APIs called from browsers or `curl` use **Connect unary calls** (`POST /<package>.<Service>/<Method>`, `content-type: application/json`, JSON body); service-to-service calls use **gRPC / gRPC-web** (the same style as RPoem's admin API `open_runo.admin.v1.Admin`). Streaming only when it is actually needed.
- **Existing REST endpoints are migrated one by one, when they are touched.** The old REST route is removed once migrated. Until migration is finished they remain, but **no new ones are added**.
- **JSON is unified on RS-JSON**: reading with `from_str_secure` / `parse_secure` (size, depth and duplicate-key limits), writing with `rust_json::fast`. `prost` is not put into browser WASM (it would grow the binary).
- **Exceptions (shapes dictated by someone else's standard, not our own API)**: ACME, OAuth/OIDC callbacks, webhooks from third parties (e.g. GitHub), health checks, static file serving, OTLP, and so on. These accept plain HTTP as the standard requires.
- Reference implementations: `RPoem` (`open_runo.admin.v1.Admin`) and `open-easy-web` (`server/src/connect.rs`, `proto/open_easy_web/admin/v1/admin.proto`).
- Note: whether the code in a given repository already follows this policy depends on that repository. This section records the policy; it does not mean the code has been changed.

### Deutsch (KI-Übersetzung, redaktionell überarbeitet; noch nicht von Muttersprachlern geprüft)
- **REST wird vollständig abgeschafft; neue APIs entstehen nicht mehr als REST.** APIs, die aus dem Browser oder per `curl` aufgerufen werden, verwenden **unäre Connect-Aufrufe** (`POST /<Paket>.<Service>/<Methode>`, `content-type: application/json`, JSON-Body). Zwischen Diensten kommen **gRPC bzw. gRPC-web** zum Einsatz, im selben Stil wie die Admin-API von RPoem (`open_runo.admin.v1.Admin`). Streaming wird erst ergänzt, wenn es tatsächlich gebraucht wird.
- **Bestehende REST-Endpunkte werden schrittweise umgestellt, und zwar immer dann, wenn man ohnehin an ihnen arbeitet.** Sobald ein Endpunkt umgestellt ist, wird die alte REST-Route entfernt. Bis zum Abschluss der Migration bleiben die übrigen bestehen, es werden aber **keine neuen mehr hinzugefügt**.
- **JSON wird einheitlich über RS-JSON verarbeitet**: Gelesen wird mit `from_str_secure` bzw. `parse_secure` (mit Obergrenzen für Größe, Verschachtelungstiefe und doppelte Schlüssel), geschrieben mit `rust_json::fast`. `prost` wird nicht in das Browser-WASM aufgenommen, da es die Datei vergrößern würde.
- **Ausnahmen (Schnittstellen, deren Form ein fremder Standard vorgibt und die nicht zu unserer eigenen API gehören)**: ACME, OAuth/OIDC-Callbacks, Webhooks von Drittanbietern (z. B. GitHub), Health-Checks, die Auslieferung statischer Dateien, OTLP und Ähnliches. Diese nehmen, wie vom jeweiligen Standard verlangt, gewöhnliches HTTP entgegen.
- Referenzimplementierungen: `RPoem` (`open_runo.admin.v1.Admin`) und `open-easy-web` (`server/src/connect.rs`, `proto/open_easy_web/admin/v1/admin.proto`).
- Hinweis: Ob der Code eines einzelnen Repositorys diese Richtlinie bereits erfüllt, hängt vom jeweiligen Repository ab. Dieser Abschnitt dokumentiert lediglich die Richtlinie; er besagt nicht, dass der Code schon angepasst wurde.

### Русский (перевод выполнен с помощью ИИ и отредактирован; носителями языка пока не проверен)
- **От REST мы полностью отказываемся; новые API больше не создаются в стиле REST.** API, к которым обращаются из браузера или через `curl`, используют **унарные вызовы Connect** (`POST /<пакет>.<Service>/<Method>`, `content-type: application/json`, тело запроса — JSON). Для взаимодействия между сервисами применяются **gRPC и gRPC-web** — в том же стиле, что и административный API RPoem (`open_runo.admin.v1.Admin`). Потоковая передача данных добавляется лишь тогда, когда в ней действительно возникает необходимость.
- **Существующие REST-эндпоинты переводятся поэтапно — по мере того, как с ними приходится работать.** После перевода старый REST-маршрут удаляется. Пока миграция не завершена, оставшиеся эндпоинты сохраняются, но **новые не добавляются**.
- **Работа с JSON унифицирована на основе RS-JSON**: чтение — через `from_str_secure` или `parse_secure` (с ограничениями на размер, глубину вложенности и повторяющиеся ключи), запись — через `rust_json::fast`. `prost` в браузерный WASM не включается, поскольку это увеличило бы размер файла.
- **Исключения (интерфейсы, форму которых определяет чужой стандарт, а не наш собственный API)**: ACME, обратные вызовы OAuth/OIDC, вебхуки сторонних сервисов (например, GitHub), проверки работоспособности, раздача статических файлов, OTLP и тому подобное. Такие интерфейсы принимают обычный HTTP, как того требует соответствующий стандарт.
- Эталонные реализации: `RPoem` (`open_runo.admin.v1.Admin`) и `open-easy-web` (`server/src/connect.rs`, `proto/open_easy_web/admin/v1/admin.proto`).
- Примечание: соответствует ли код конкретного репозитория этой политике, зависит от самого репозитория. Данный раздел лишь фиксирует политику и не означает, что код уже изменён.

## API 方針の補足: 用語の整理と使い分け (2026-11-04)

### 日本語
**1つに統一するものではなく、別の層の話です。** 「REST の代わり」になるのは Connect・gRPC・GraphQL だけで、WASM は画面を作る技術です。

| 用語 | 何か | REST の代わりか |
|---|---|---|
| REST | URL と HTTP メソッドで操作を表す API の作り方 | 全廃する側 |
| **Connect** | `POST /サービス名/メソッド名` に JSON を送る形式。`curl` でもブラウザの `fetch` でも呼べる | はい(**採用**) |
| **gRPC** | 同じ「サービス/メソッド」の考え方を、バイナリ(protobuf)と HTTP/2 で行う形式。速く、ストリーミングも得意 | はい(**サービス同士に採用**) |
| gRPC-web | gRPC のブラウザ向けの変形版 | はい(必要なら) |
| GraphQL | 欲しい項目を問い合わせる形式 | 一部だけ(**問い合わせ(読み取り)専用**) |
| WASM | Rust をブラウザの中で動かす仕組み | いいえ(画面を作る技術) |

- **ブラウザの画面や `curl` から呼ぶ API は Connect**(POST、JSON を RS-JSON で読み書き)。ブラウザの WASM は素の gRPC を話せず、Connect なら `fetch` のままで、`prost` を足さずに済む(画面のサイズも増えない)。
- **サービス同士の通信(サーバー間、重い処理、ストリーミング)は gRPC。** 多くは Connect で足りるので、ストリーミングが必要になった所だけ gRPC に上げる。
- **GraphQL は、まとめて問い合わせたいときの読み取り専用。** 書き込み(操作)には使わない。
- **WASM は画面を作る技術として、そのまま使う。** 画面から呼ぶ API が Connect になっただけ。
- 外部の規格が形を決めるもの(ACME、OAuth のコールバック、第三者の Webhook、ヘルスチェック、静的ファイル、OTLP)は、規格どおりの HTTP のまま。
- **迷ったら Connect。**

### English
**These are not alternatives to unify; they sit at different layers.** Only Connect, gRPC and GraphQL can replace REST; WASM is a way to build the UI.

| Term | What it is | Replaces REST? |
|---|---|---|
| REST | API style that expresses operations through URLs and HTTP methods | The thing being abolished |
| **Connect** | `POST /Service/Method` with a JSON body; callable from `curl` and from a browser `fetch` | Yes (**adopted**) |
| **gRPC** | The same service/method idea over binary (protobuf) and HTTP/2; fast, good at streaming | Yes (**for service-to-service**) |
| gRPC-web | A browser-friendly variant of gRPC | Yes (if needed) |
| GraphQL | A query language: ask for exactly the fields you want | Partly (**read-only queries**) |
| WASM | Runs Rust inside the browser | No (a UI technology) |

- **APIs called from browser screens or `curl` use Connect** (POST, JSON read and written with RS-JSON). Browser WASM cannot speak plain gRPC; with Connect it stays a `fetch`, and `prost` is not needed (the binary does not grow).
- **Service-to-service calls (server to server, heavy work, streaming) use gRPC.** Connect is enough in most places; move a call to gRPC only where streaming is actually needed.
- **GraphQL is read-only**, for queries that gather several pieces of data. It is not used for writes (operations).
- **WASM stays as the way to build the UI.** The API it calls simply became Connect.
- Interfaces whose shape an outside standard dictates (ACME, OAuth callbacks, third-party webhooks, health checks, static files, OTLP) stay plain HTTP.
- **When in doubt, use Connect.**

### Deutsch (KI-Übersetzung, sprachlich überarbeitet; noch nicht von Muttersprachlern geprüft)
**Es geht nicht darum, eine einzige Technik auszuwählen – die Begriffe liegen auf unterschiedlichen Ebenen.** Als Ersatz für REST kommen nur Connect, gRPC und GraphQL in Frage; WASM dagegen ist eine Technik, mit der die Benutzeroberfläche gebaut wird.

| Begriff | Was ist das? | Ersatz für REST? |
|---|---|---|
| REST | Ein API-Stil, bei dem Operationen über URLs und HTTP-Methoden ausgedrückt werden | wird abgeschafft |
| **Connect** | `POST /Dienst/Methode` mit JSON im Body; aufrufbar mit `curl` ebenso wie mit `fetch` im Browser | ja (**gewählt**) |
| **gRPC** | Dasselbe Prinzip aus Dienst und Methode, aber über binäres protobuf und HTTP/2; schnell und gut für Streaming geeignet | ja (**zwischen Diensten**) |
| gRPC-web | Eine für den Browser angepasste Variante von gRPC | ja (bei Bedarf) |
| GraphQL | Abfragesprache, mit der man genau die benötigten Felder anfordert | teilweise (**nur für lesende Abfragen**) |
| WASM | Führt Rust-Code direkt im Browser aus | nein (Technik für die Oberfläche) |

- **APIs, die von Browseroberflächen oder per `curl` aufgerufen werden, verwenden Connect** (POST; JSON wird mit RS-JSON gelesen und geschrieben). WASM im Browser kann kein reines gRPC sprechen. Mit Connect bleibt es bei einem gewöhnlichen `fetch`, und `prost` ist nicht nötig – die WASM-Datei wird dadurch nicht größer.
- **Für die Kommunikation zwischen Diensten (Server zu Server, rechenintensive Aufgaben, Streaming) wird gRPC eingesetzt.** In den meisten Fällen reicht Connect aus; auf gRPC wird nur dort umgestellt, wo Streaming tatsächlich gebraucht wird.
- **GraphQL dient ausschließlich lesenden Abfragen**, wenn mehrere Informationen gebündelt abgefragt werden sollen. Für Schreibzugriffe (Operationen) wird es nicht verwendet.
- **WASM bleibt die Technik für die Oberfläche.** Geändert hat sich lediglich, dass die aufgerufene API nun auf Connect beruht.
- Schnittstellen, deren Form durch einen externen Standard festgelegt ist (ACME, OAuth-Callbacks, Webhooks von Drittanbietern, Health-Checks, statische Dateien, OTLP), bleiben gewöhnliches HTTP.
- **Im Zweifel: Connect.**

### Русский (перевод выполнен с помощью ИИ и литературно отредактирован; носителями языка пока не проверен)
**Это не варианты, из которых нужно выбрать один, а технологии разных уровней.** Заменить REST могут только Connect, gRPC и GraphQL; WASM же — это способ создания пользовательского интерфейса.

| Термин | Что это | Заменяет REST? |
|---|---|---|
| REST | Стиль построения API, при котором операции выражаются через URL и HTTP-методы | отменяется |
| **Connect** | `POST /Сервис/Метод` с телом в формате JSON; вызывается как из `curl`, так и из браузерного `fetch` | да (**выбран**) |
| **gRPC** | Тот же принцип «сервис — метод», но поверх двоичного формата protobuf и HTTP/2; работает быстро и хорошо подходит для потоковой передачи | да (**для связи между сервисами**) |
| gRPC-web | Адаптированный для браузера вариант gRPC | да (при необходимости) |
| GraphQL | Язык запросов: клиент запрашивает ровно те поля, которые ему нужны | частично (**только запросы на чтение**) |
| WASM | Позволяет выполнять код на Rust прямо в браузере | нет (технология для интерфейса) |

- **API, которые вызываются из браузерных интерфейсов или через `curl`, строятся на Connect** (POST; JSON читается и записывается через RS-JSON). Браузерный WASM не умеет работать с «чистым» gRPC. С Connect достаточно обычного `fetch`, а `prost` не требуется — размер WASM-файла не увеличивается.
- **Для обмена между сервисами (сервер — сервер, ресурсоёмкие задачи, потоковая передача) применяется gRPC.** В большинстве случаев достаточно Connect; на gRPC переходят только там, где потоковая передача действительно необходима.
- **GraphQL используется только для чтения**, когда нужно получить сразу несколько связанных данных. Для записи (операций) он не применяется.
- **WASM по-прежнему остаётся технологией для интерфейса.** Изменилось лишь то, что вызываемый им API теперь построен на Connect.
- Интерфейсы, форма которых задана внешним стандартом (ACME, обратные вызовы OAuth, вебхуки сторонних сервисов, проверки работоспособности, статические файлы, OTLP), остаются обычным HTTP.
- **Если есть сомнения — выбирайте Connect.**
