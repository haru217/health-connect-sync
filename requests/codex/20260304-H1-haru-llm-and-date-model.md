# Request: ハルLLMプロンプト + 日付モデル修正（H1）

- Date: 2026-03-04
- Owner: Codex
- Status: `done`
- Phase: H（ハルUX v2）
- Depends on: なし
- Priority: 最高（Phase 1 の根幹）

## 概要

3AI（ユウ先生/サキさん/マイコーチ）→ 1AI（ハル）への移行。LLMプロンプトを全面書き換えし、日付モデルを修正する。

参照: `ops/HARU_UX_VISION.md`

## 変更1: DBマイグレーション

### ai_reports テーブル

```sql
ALTER TABLE ai_reports ADD COLUMN briefing TEXT;
```

既存のyu/saki/maiカラムは残す。新規レポートは `briefing` のみ使用。

### 既存データ移行

```sql
-- 表示日(3/4)で保存された3/3分析のレポートを正しいdateに移動
DELETE FROM daily_reports WHERE date = '2026-03-03';
UPDATE daily_reports SET date = '2026-03-03' WHERE date = '2026-03-04';
```

※ daily_reportsテーブルがある場合。ai_reportsテーブル名の場合は適宜読み替え。

## 変更2: 日付モデル修正

### sync.ts

`generateDailyReportIfNeeded` の呼び出しを `today` → `yesterday` に戻す:

```typescript
// cloudflare-api/src/handlers/sync.ts L190付近
const yesterday = toIsoDate(new Date(Date.now() - 86400000))
// ...
ctx.waitUntil(
  generateDailyReportIfNeeded(env, yesterday).catch(...)
)
```

### report.ts

`dataDate` 計算を削除し、`date` をそのまま使用:

```typescript
// cloudflare-api/src/handlers/report.ts L668付近
// 削除: const dataDate = shiftIsoDateByDays(date, -1)
// date をそのままデータ取得に使用
const [profile, scores, trendRows] = await Promise.all([
  getUserProfile(env.DB),
  getScores(env.DB, date),       // date直接
  queryDailyReportTrendRows(env.DB, date),  // date直接
])
```

### home-summary.ts

```typescript
// cloudflare-api/src/handlers/home-summary.ts L116-121
// 変更前: WHERE date = ?
// 変更後:
WHERE date <= ?
ORDER BY date DESC
LIMIT 1
```

## 変更3: LLMプロンプト全面書き換え

### System prompt

```
あなたは「ハル」です。予防医学に詳しい健康アドバイザーで、ユーザーの健康データを毎日分析しているパートナーです。

# 話し方
- です/ます調だが堅すぎない
- データにない事実の推測は絶対にしない（例: 歩数が多い理由を勝手に推測しない）
- 抽象的な励まし禁止（「頑張りましょう」等）。数値と具体的な根拠で語る
- 全ての文が「だからなに？」テストに通ること

# 分析手順
1. 14日間のデータからパターンや変化を探す
2. ドメイン間の相関を探す（睡眠→血圧、活動→体重など）
3. ユーザーが気にしているであろう「暗黙の問い」を特定する
4. その問いに対して、データを根拠に分析する
5. 具体的な提案を1つだけ提示する

# トピック選択
毎日全領域に触れる必要はない。以下から2-3トピックを選ぶ:
- 大きく変化したもの
- 注意が必要なもの（3日連続の傾向変化など）
- ドメイン間の因果関係
- ユーザーが気にしているはずのこと

# 時制ルール
- ユーザーはこのレポートを翌朝に読みます
- 「今日」は絶対に使わない。「昨日」「前日」「X月X日」を使う
- 提案のみ「今日」OK: 「今日は〜してみると良いかもしれません」

# 医療助言ガイドライン
- OK: 「あなたのデータではこう出ています」（データ分析）
- NG: 「〜の疑いがあります」「〜すべきです」（診断・処方）
- 深刻な異常値 → 「医療機関への相談をお勧めします」で止める

# 出力
- プレーンテキストのみ（JSON不要、マークダウン不要）
- 400-800文字
```

### User prompt

```
# 対象日: ${date}（ユーザーは翌朝に読みます）

# 14日間のデータ
| date | steps | sleep_h | weight | fat% | BP | active_kcal | total_kcal | intake_kcal | protein | fat | carbs |
${14日分のデータ行}

# 対象日の食事詳細（あれば）
${対象日のnutrition_events}
```

### データ取得

`queryDailyReportTrendRows` を改修し、14日分の以下カラムを取得:
- steps, sleep_hours, weight_kg, body_fat_pct, blood_systolic, blood_diastolic
- active_kcal, total_kcal, intake_kcal
- 食事データは `nutrition_events` テーブルから対象日分を取得

### 出力形式の変更

現在の `buildDailyReportPrompt` は JSON出力（yu/saki/mai 各80-150文字）を要求。
変更後はプレーンテキスト出力のみ。

レスポンスの保存:
```typescript
// 新規レポート保存時
{
  briefing: llmResponse,  // プレーンテキスト
  yu: null,
  saki: null,
  mai: null,
}
```

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `cloudflare-api/migrations/XXXX_add_briefing.sql` | ai_reportsにbriefingカラム追加 |
| `cloudflare-api/src/handlers/sync.ts` | L190: today → yesterday に戻す |
| `cloudflare-api/src/handlers/report.ts` | dataDate削除、LLMプロンプト全面書き換え、出力パース変更 |
| `cloudflare-api/src/handlers/home-summary.ts` | L116: WHERE date = ? → WHERE date <= ? ORDER BY date DESC LIMIT 1 |
| `cloudflare-api/src/types.ts` | レポート型にbriefingフィールド追加 |

## 制約

1. 旧yu/saki/maiカラムは削除しない（旧データ表示用に残す）
2. TypeScript ビルドが通ること
3. 本番デプロイはしない

## Acceptance Criteria

1. `ai_reports` テーブルに `briefing` カラムが追加されている
2. `daily_reports.date` = 分析対象データの日付で保存される
3. sync時に前日のレポートが自動生成される
4. LLMコメントに「今日」が含まれず、400-800文字のプレーンテキストで出力される
5. ホーム画面クエリが `WHERE date <= ?` で最新レポートを取得する
6. 14日分の実データがLLMプロンプトに渡されている
7. TypeScript ビルドが通る
