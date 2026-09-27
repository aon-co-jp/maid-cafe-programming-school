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
- **有料版のClaudeを組み込む**: ご自身がClaude(Anthropic)の有料版を契約されている場合、
  ご自身のAPIキーを入力して、AI応答・検索の両方にClaudeを組み込めます。組み込む際、
  「新規プロジェクトにしますか？」「どこのプロジェクト内の会話にしますか？」と尋ねられます
  (open-english web版と同じ設計)。

## 正直な開示(誇張しないこと)

- **AI推論・検索(aruaru-search)は、この拡張機能自体には一切実装されていません**——すべて
  お使いのローカル`aruaru-llm`インスタンス(既定`http://127.0.0.1:4600`)が行います。
  `aruaru-llm`が起動していない場合、この拡張機能は接続エラーを正直に表示するだけで、
  何らかの代替AI機能を独自に持つわけではありません。
- Claude(Anthropic)のAPIキーはVS Codeの`SecretStorage`(OSの資格情報ストアを利用する
  暗号化保存領域)に保存されますが、実際にAIへ問い合わせる際はお使いの`aruaru-llm`へ
  平文で送信されます(open-english web版の既存の設計・開示と同じ)。

## セットアップ

1. `npm install`
2. `npm run compile`
3. VS Codeで`F5`(拡張機能開発ホストの起動)、またはvsceでパッケージ化してインストール
4. 設定(`maidCafeSchool.aruaruLlmBaseUrl`)でご自身の`aruaru-llm`の接続先を確認(既定は
   `http://127.0.0.1:4600`)

## Honest disclosure (English)

This extension implements **no AI inference or search of its own** — it is a thin HTTP client
that forwards your question (plus any selected code) to your own locally running `aruaru-llm`
instance (`http://127.0.0.1:4600` by default), which already prioritizes aruaru-search
(unlimited, no API key needed) internally. If `aruaru-llm` isn't running, this extension shows
an honest connection error rather than pretending to answer on its own.
