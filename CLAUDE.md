# 開発方針・開発環境ルール(Maid Cafe Programming School)

作業ドライブは`F:\runo`。この節は
[`open-raid-z`](https://github.com/aon-co-jp/open-raid-z)の`CLAUDE.md`を
正本とし、各プロジェクトへコピーして同期する既存の運用ルール継承方針に
準じる(全リポジトリ共通ルールはここに複製せず`open-raid-z/CLAUDE.md`を
参照すること)。

## このリポジトリの役割

VS Code拡張機能。`open-english`/`aruaru-llm`の既存API
(`/v1/generate-with-search`・`/v1/chat-providers/complete-priority`)へ
エディタから直接質問を送るだけの薄いクライアント。AI推論・検索
(aruaru-search)は一切実装せず、既存の`aruaru-llm`サーバーが担う。

## 関連プロジェクト

- **open-english**(母体、質問応答API・AIプロバイダ優先順位選択の仕様の
  正本): https://github.com/aon-co-jp/open-english
- **aruaru-jobs**(フリーランス案件集約サイト、`vscode://`ディープリンク
  経由でこの拡張機能へ案件情報を渡す連携先):
  https://github.com/aon-co-jp/aruaru-jobs
- **aruaru-llm**(AI推論・検索エンジン本体、ローカル常駐サーバー):
  https://github.com/aon-co-jp/aruaru-llm

## 実装済み機能(2026-09-28時点)

1. **AI先生への質問**(`askTeacher`/`sendPromptToTeacher`): 選択中の
   コード・ファイルパスを添えてローカル`aruaru-llm`へ質問を送る。
2. **同時にプログラム学習**(`studyWhileDeveloping`設定): ONの場合、
   依頼文へ「関連する基礎知識も教えてください」を自動追記。
3. **AI先生プロバイダ選択**(`selectAiProvider`、`AiProvider`型):
   既定`aruaru`(aruaru-llm + 無料Google検索)、他に`chatgpt`/`gemini`/
   `deepseek`/`grok`/`claude`。クラウドプロバイダはご自身のAPIキーが
   必要(`context.secrets`に保存、プロバイダごとに別キー)。`claude`の
   みopen-english web版と同じ「新規/既存プロジェクト」導線を併用
   (`CLAUDE_COMBO_*`系のglobalState)。
4. **`aruaru-jobs`連携**(`registerJobImportUriHandler`):
   `vscode://aon-co-jp.maid-cafe-programming-school/import-job?
   title=...&url=...&snippet=...`を受け取り、案件情報を元に「一緒に
   学習しながら開発したい」という依頼文を自動生成してAI先生へ相談
   できる導線を提供する。
5. **メイドカフェ風TTS演出**(`speakText`設定、既定ON、
   `maidCafeSchool.speakText`):
   - 起動時の出迎え挨拶(`activate()`内、固定フレーズ)。
   - AI先生の回答の読み上げ(`sendPromptToTeacher`末尾の`speak()`
     呼び出し)。
   - 食べ物・飲み物の注文検知(`isOrderRequest`/`maybeCheerOnOrder`)
     →「おいしくなーれ、萌え萌えキューん。」。
   - 悩み相談検知(`isTroubledRequest`/`maybeCheerUpTroubled`)
     →「めっ！こらっ！いつまでも、くよくよ悩んでいちゃいけないんだぞ！
     萌え萌えキューン！」。
   - いずれも固定キーワードによるルールベース判定(AI推論を経由しない)。
   - 実装は`ensureTtsPanel`(非表示Webviewを1枚保持し、
     `postMessage`でテキストを送って`speechSynthesis`に発話させる
     ——VS Code拡張ホスト自体にはWeb Speech APIが存在しないため)。
     `pitch: 1.5`・`rate: 0.92`+日本語の女性寄りボイス優先選択で
     「アイドルの様で思わせぶりで小悪魔の様な怪しい声」に近づける
     調整をしている(ユーザー指示、正直な開示: 実際の声質はOS/
     ブラウザの提供する音声次第で保証はできない)。

## HANDOFF(2026-09-28 easy-web.tokyo紹介ページ+マーケットプレイス公開準備)

- **紹介ページ**: `webpage/index.html`(日英併記、`make-disk`の
  `make-disk-web.service`と同型の`python3 -m http.server`静的配信)を
  `https://easy-web.tokyo/maid-cafe-programming-school`で公開(VPS側
  `maid-cafe-programming-school-web.service`、ポート8109、
  `/root/open-web-server/domains.toml`に`path_prefix =
  "/maid-cafe-programming-school"`のエントリを追加、詳細は
  [`PORTING.md`](PORTING.md)の5番目のパターン参照)。内容は機能紹介+
  使い方+関連リンク(open-english・github.com/aon-co-jp)を日英併記。
- **VS Code Marketplace公開準備**: `package.json`に`icon`(`media/
  icon.png`、簡易生成)・`repository`/`bugs`/`homepage`/`galleryBanner`・
  `keywords`追加、`LICENSE`ファイル(MIT)を新規作成、`@vscode/vsce`を
  devDependenciesに追加(`npm run package`/`npm run publish`)。
  **正直な開示**: 実際にVS Code Marketplaceへ`vsce publish`するには
  Azure DevOpsのpublisher用PAT(このセッションには無い、ユーザー自身の
  資格情報が必要)が要るため、その最終ステップ自体はまだ実行していない
  ——メタデータ・アイコン・ライセンス等、公開に必要な準備のみ完了。
- **次回**: (1) `vsce publish`をユーザー自身のPATで実行してもらう(または
  それを依頼された場合に改めて対応)、(2) VS Code拡張機能開発ホストでの
  実クリック確認(このセッション環境では未実施のまま)。

## HANDOFF(2026-09-28 学習中BGM機能を追加、後にopen-music-llm→archive.orgへ切替)

- ユーザー提案(「学習中にBGMが選択出来るの良いね」)を受け、当初は
  [`open-music-llm`](https://github.com/aon-co-jp/open-music-llm)(MusicGen、
  CC-BY-NC 4.0=非商用限定)をサブプロセス呼び出しする「学習中BGM」機能を実装したが、
  ユーザー指示「実際に組み込むのはarchive.orgのライセンス確認済み音源なら商用化しても
  OKな方でお願いします」を受け、**同日中に実装を差し替え**、MusicGenのコードは
  この拡張機能からは削除した(`open-music-llm`リポジトリ自体はそのまま残す)。
- **現在の実装**: `aruaru-search`の`/v1/media-search`(archive.org横断検索、
  パブリックドメイン・CC0・CC-BY・CC-BY-SAのみ——CC-BY-NC等は`aruaru-search`側で
  既に除外済み)を、既存の唯一の接続先である`aruaru-llm`経由でプロキシする形で呼ぶ
  (`aruaru-llm`側に新規追加した`GET /v1/media-search`、`src/web_search.rs`の
  `media_search`関数、`src/main.rs`のルート登録、コミット待ち)。この拡張機能自体は
  検索・音楽生成AIを一切実装しない、という既存方針を維持。
- **ライセンス表示義務の通知**(ユーザー指示「商用化の際はそのライセンスを明示する
  義務がある事を英語と日本語を明示でリンクをクリックすると世界約130ケ国語で表示
  されるようにして」への対応): `STUDY_BGM_LICENSE_NOTICE`(英日併記、非ブロッキング
  ——archive.orgのPD/CC0/CC-BY/CC-BY-SAは商用利用そのものは許可されているため、
  MusicGenの時と違い機能自体は止めない)を初回有効化時・以後30日毎に表示し、
  「Open full notice」を押すと
  [`aruaru-search`の`ATTRIBUTION_NOTICE.md`](https://github.com/aon-co-jp/aruaru-search/blob/main/ATTRIBUTION_NOTICE.md)
  (日英正本+`open-english`の130言語登録簿と同じコード一覧を再利用したAI翻訳、
  ネイティブ検証前)を`vscode.env.openExternal`で開く。再生中の音源のクレジット
  (`creator`)・ライセンスURL(`licenseurl`)はBGMパネル内に常時表示する
  (`generateStudyBgm`→`ensureBgmPanel`の`postMessage`)。
- `npm run compile`(TypeScript型検査)のみ確認済み、VS Code拡張機能開発ホストでの
  実クリック確認・`aruaru-llm`/`aruaru-search`の実サーバー起動によるE2E確認は
  未実施(このセッション環境の制約、下記参照)。

## 正直な開示・既知の制約

- VS Code拡張機能のE2Eテスト(実際に拡張機能開発ホストを起動して
  ボタン操作を確認する類のテスト)は、この開発環境にVS Code GUIが
  無いため実施できない。検証は`npm run compile`(TypeScriptの型検査)
  までに留まる。
- `speechSynthesis`経由の発話は、実際にスピーカー付きの環境・音声
  エンジンが入ったOSでの動作確認ができていない(コードレビュー+
  型検査のみ)。

## 次にすべきこと

- 実際のVS Code環境(拡張機能開発ホスト)での動作確認(このセッション
  環境では未実施)。
- `aruaru-jobs`側の案件データ構造が変わった場合、`import-job`
  ハンドラのクエリパラメータ名(`title`/`url`/`snippet`)を両リポジトリで
  同期させること。

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
