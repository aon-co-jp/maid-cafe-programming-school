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
- **学習中BGM(MusicGen、非商用限定)**: コマンドパレット「学習中BGMを今すぐ生成・再生」、
  または`maidCafeSchool.studyBgm.enabled`設定から、[`open-music-llm`](https://github.com/aon-co-jp/open-music-llm)
  (MusicGen)でBGMをローカル生成して再生できます。**ライセンスに関する重要な注意
  (Important license notice)**: MusicGenの学習済み重み(`facebook/musicgen-*`)は
  **CC-BY-NC 4.0(非商用利用限定)** です。この機能は初回有効化時、および30日ごとに、
  英語・日本語併記のライセンス通知を表示し、明示的な確認を求めます——**この拡張機能自体、
  またはご自身のプロジェクトが将来商用化(有料化・広告付与等)された場合は、生成した音声の
  利用を中止してください**。実際の商用/非商用利用をコードから技術的に検出する手段は
  無いため、あくまで利用者自身の申告・確認に基づく仕組みです(詳細は
  [open-music-llmのCLAUDE.md](https://github.com/aon-co-jp/open-music-llm/blob/main/CLAUDE.md)
  も参照)。
  *(EN) The MusicGen weights (`facebook/musicgen-*`) are CC-BY-NC 4.0 — non-commercial use
  only. This feature shows a bilingual license notice and requires explicit confirmation on
  first enable and again every 30 days. If this extension, or your own project, ever becomes
  commercial, stop using MusicGen-generated audio in it. There is no technical way to detect
  actual commercial use from code — this is a self-attestation mechanism, not enforcement.*
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
- **学習中BGM機能は、この拡張機能自体には音楽生成AIを一切実装していません**——お使いの
  ローカル`open-music-llm`(MusicGen、`python/generate.py`)をサブプロセスとして呼び出す
  だけの薄いラッパーです。`open-music-llm`が未セットアップの場合、この拡張機能は設定を
  促すエラーを表示するだけです。**ライセンス警告(CC-BY-NC 4.0の確認)は自己申告制であり、
  実際の商用/非商用利用をコードから検出する技術的な手段はありません。**
  *(EN) The Study BGM feature implements no music-generation AI of its own — it is a thin
  wrapper that shells out to your local `open-music-llm` (MusicGen). The CC-BY-NC 4.0 license
  warning is a self-attestation mechanism only; there is no technical way to detect actual
  commercial use from code.*

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
