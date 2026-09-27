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
