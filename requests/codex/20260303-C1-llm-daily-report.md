# Request: AIレポート — 日次3専門家コメント生成API

- Date: 2026-03-03
- Owner: Codex-shinsekai
- Status: `todo`
- Phase: C（AIレポート）
- Design ref: `docs/plans/2026-03-02-health-os-design.md` §7, §8
- Depends on: A1（スコア算出）✅, A2（インサイト）✅, A3（プロフィール）✅

## Background

ルールエンジン（A1/A2）で事実を整理した後、LLMで3専門家の統合判断コメントを生成する。
1日1回の生成でD1にキャッシュし、画面表示時は即座に返す。
これがプロダクトのコア価値（「かかりつけAI」）。

## Scope

- `cloudflare-api/src/` にLLMレポート生成ロジックを追加
- 新エンドポイント: `POST /api/report/generate` — レポート生成トリガー
- 新エンドポイント: `GET /api/report?date=YYYY-MM-DD` — キャッシュ済みレポート取得
- D1に `daily_reports` テーブルを追加（キャッシュ用）

## アーキテクチャ

```
[GET /api/scores] → スコア + インサイト取得
        ↓
[GET /api/profile] → ユーザープロフィール取得
        ↓
[過去14日のdaily_metrics] → トレンドサマリー構築
        ↓
[LLMプロンプト構築]
  - ユーザープロフィール
  - 今日のスコア・インサイト
  - 過去14日トレンド
  - 日付・季節情報
        ↓
[LLM API呼び出し（1回）]
        ↓
[3専門家コメント + ホーム統合判断をパース]
        ↓
[D1にキャッシュ保存]
```

## 3専門家キャラ定義

### ユウ先生（医師・男性）
- 担当: ホーム総合判断 + コンディション
- トーン: 穏やか・安心感・データを丁寧に噛み砕く
- 口癖: 「焦らなくて大丈夫ですよ」
- 季節の健康ネタを自然に織り込む

### サキさん（管理栄養士・女性）
- 担当: ホーム栄養判断 + 食事
- トーン: 明るく親しみやすい・旬の食材が好き
- 信条: 「美味しく続ける」
- 無理な制限より楽しめる食事改善

### マイコーチ（トレーナー・女性）
- 担当: ホーム運動判断 + 運動
- トーン: ポジティブ・励まし上手・小さな進歩を褒める
- 運動習慣に合わせてトーンを変える

### トーン共通原則
- 敬語だが堅すぎない
- 否定しない（「ダメ」「やめて」は使わない）
- 理由を必ず添える
- データの裏付けを自然に織り込む
- 絵文字は一切使用しない
- 1コメント80〜150文字程度

## レスポンス形式

### GET /api/report?date=YYYY-MM-DD
```json
{
  "date": "2026-03-03",
  "generated_at": "2026-03-03T07:30:00Z",
  "home": {
    "headline": "今日のコンディションは良好です",
    "yu": "睡眠の質が安定してきていますね。この調子なら血圧も落ち着いてくるはずです。花粉の季節は水分をこまめに摂ると体調維持に効きますよ。",
    "saki": "昨日のたんぱく質摂取量がしっかり取れていました。今の時期は新玉ねぎがおすすめです。スライスしてポン酢で食べると血液サラサラ効果も期待できますよ。",
    "mai": "歩数目標を達成できていますね。この1週間で活動量が安定してきました。今日は少しペースを上げてみても良いタイミングです。"
  },
  "tabs": {
    "condition": "体重は目標に近い位置で安定しています。血圧も正常範囲ですが、朝の測定を続けていきましょう。",
    "activity": "今週の運動量は先週を上回っています。筋トレの日にはたんぱく質を意識して摂りましょう。",
    "meal": "カロリーバランスは良好です。ビタミンDが不足気味なので、鮭やきのこ類を取り入れてみてください。"
  },
  "cached": true
}
```

### POST /api/report/generate
```json
{
  "date": "2026-03-03",
  "generated": true,
  "cached": false
}
```

## D1スキーマ

```sql
CREATE TABLE IF NOT EXISTS daily_reports (
  date TEXT PRIMARY KEY,
  headline TEXT NOT NULL,
  yu_comment TEXT NOT NULL,
  saki_comment TEXT NOT NULL,
  mai_comment TEXT NOT NULL,
  condition_comment TEXT NOT NULL,
  activity_comment TEXT NOT NULL,
  meal_comment TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  generated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## LLM設定

- モデル: 環境変数 `LLM_MODEL` で指定（デフォルト: `claude-haiku-4-5-20251001`）
- APIキー: 環境変数 `LLM_API_KEY`
- プロバイダー: 環境変数 `LLM_PROVIDER`（`anthropic` / `openai` / `google`）
- 初期実装は Anthropic SDK（Claude Haiku）で、後から切り替え可能にする
- タイムアウト: 30秒
- 1日1回のみ生成。同日に再度 POST した場合はキャッシュを返す（force=true で再生成可）

## キャッシュ戦略

- `GET /api/report` はまず D1 を参照。キャッシュがあれば即返却（`cached: true`）
- キャッシュがなければ `404` を返す（自動生成はしない）
- `POST /api/report/generate` でのみ生成を実行
- 将来的に Cron Trigger で毎朝自動生成する想定

## 実装上の注意

- LLM呼び出しは1回で全コメント（home + tabs）を生成する。個別呼び出しはしない
- LLMレスポンスはJSON形式で返させ、パースして各フィールドに分割保存する
- LLMが不正なJSONを返した場合のフォールバック: パースエラー時はエラーログを残し 500 を返す
- API_KEY認証は既存の仕組みを使う
- console.log は入れない
- Immutability: spread演算子で新規作成

## Acceptance Criteria

1. `POST /api/report/generate` で3専門家コメントが生成される
2. `GET /api/report?date=YYYY-MM-DD` でキャッシュ済みレポートが返る
3. レポートがない日は `404` を返す
4. 同日の再生成リクエストはキャッシュを返す（force=true 除く）
5. コメントに絵文字が含まれない
6. コメントが80〜150文字程度で、各キャラの口調が区別できる
7. LLM APIキーが未設定の場合は `503` を返す
8. daily_reports テーブルにトークン使用量が記録される
