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
- **メイドカフェ風のしゃべり演出**(`speakText`設定、既定ON): 起動時に出迎えの挨拶
  (「おかえりなさいませ！ご主人様！良い子のみんな元気〜！…」)、AI先生の回答の読み上げ、
  コーヒー・オムライス等の注文を検知すると「おいしくなーれ、萌え萌えキューん。」、
  悩み相談的な発言を検知すると「めっ！こらっ！いつまでも、くよくよ悩んでいちゃいけないん
  だぞ！萌え萌えキューン！」を、幼稚園の先生風・メイドカフェの女の子風の声色
  (高めのpitch・やや遅めのrate・可能なら女性寄りの日本語音声を自動選択)で読み上げます。
  チェックの状態はVS Codeの設定に記憶されるため、一度ONにすれば次回以降も引き継がれます。

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

## セットアップ

1. `npm install`
2. `npm run compile`
3. VS Codeで`F5`(拡張機能開発ホストの起動)、またはvsceでパッケージ化してインストール
4. 設定(`maidCafeSchool.aruaruLlmBaseUrl`)でご自身の`aruaru-llm`の接続先を確認(既定は
   `http://127.0.0.1:4600`)
5. 「テキスト内容をしゃべる」(`maidCafeSchool.speakText`)は既定ONです。オフにしたい
   場合はコマンドパレットから「Maid Cafe School: Toggle "Speak Text"」を実行してください。

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
