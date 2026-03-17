# 月次レポート設計仕様（Phase 1）

## 概要

週次レポートと同じパターンで月次レポートを追加する。毎月1日に前月分を自動生成し、HomeScreenにカード表示する。

レポート履歴画面（日次/週次/月次タブ切り替え）はPhase 2で実装する。

## バックエンド

### DBスキーマ

`monthly_reports`テーブルを新設する。

| カラム | 型 | 説明 |
|---|---|---|
| `month` | TEXT PK | 対象月（YYYY-MM） |
| `headline` | TEXT | 見出し（最初の文から30文字抽出） |
| `report` | TEXT | レポート本文 |
| `model` | TEXT | 使用LLMモデル |
| `prompt_tokens` | INTEGER | LLM入力トークン数 |
| `completion_tokens` | INTEGER | LLM出力トークン数 |
| `generated_at` | TEXT | 生成日時（ISO 8601） |
| `created_at` | TEXT DEFAULT CURRENT_TIMESTAMP | DB作成日時 |

マイグレーションファイル: `cloudflare-api/migrations/0016_monthly_reports.sql`
（番号は既存マイグレーションと重複しないことを実装時に確認する）

### 生成ロジック

週次レポートのパターンを踏襲する。

**データ取得:**
- 対象月の全日（1日〜末日）の`daily_metrics`を取得
- 前月の全日も取得（比較用）
- `queryDailyReportTrendRows`を流用し、対象月末日を基準に前月1日からのデータを取得
- スコアは月を4分割（1-7日, 8-14日, 15-21日, 22-末日）して各区間の平均を算出

**プロンプトに含めるデータ:**
- 今月平均 vs 前月平均の比較テーブル（1行ずつ。週次と同じフォーマット）
- 日別データは含めない（トークンコスト削減）。代わりに上記4区間の平均推移テーブルを含める
- 各区間のスコア平均

**プロンプト構成:**
- システムプロンプト: 月次用の定数`MONTHLY_REPORT_SYSTEM_PROMPT`を新設
- ユーザープロンプト: 月平均比較 + 4区間推移 + スコア
- バリデーション定数: `MONTHLY_REPORT_MIN_CHARS = 800`, `MONTHLY_REPORT_MAX_CHARS = 2500`
- プロンプト内の文字数指示: 「800-2500文字」（バリデーション定数と一致させる）

**最低データ要件:**
- 月内にデータがある日が7日未満の場合は生成スキップ
- スキップ時は`{ generated: false, reason: 'insufficient_data' }`を返す

**不完全摂取データのマスク:**
- 週次と同じく`maskIncompleteIntake`を適用する

**Gemini使用量トラッキング:**
- 日次レポートと同様、Gemini使用時は`checkMonthlyLimit`と`recordGeminiUsage`を呼ぶ

### cron

`wrangler.toml`のcrons配列に追加する。

変更前: `crons = ["0 0 * * 1"]`
変更後: `crons = ["0 0 * * 1", "0 0 1 * *"]`

`index.ts`の`scheduled`ハンドラで日付判定により分岐する:
```typescript
async scheduled(event, env, ctx): Promise<void> {
  const now = new Date()
  const dayOfMonth = now.getUTCDate()

  // 週次レポート: 毎週月曜（cron式で制御）
  if (event.cron === '0 0 * * 1') {
    const weekStart = getLastCompletedWeekStart()
    ctx.waitUntil(generateWeeklyReport(env, weekStart).catch(() => undefined))
  }

  // 月次レポート: 毎月1日（cron式で制御）
  if (event.cron === '0 0 1 * *') {
    const lastMonth = getLastCompletedMonth()
    ctx.waitUntil(generateMonthlyReport(env, lastMonth).catch(() => undefined))
  }
}
```

`getLastCompletedMonth`ユーティリティ: 前月をYYYY-MM形式で返す。

### monthパラメータのバリデーション

`isValidMonth(value: string): boolean`を`utils.ts`に追加する。YYYY-MM形式で、月が01-12の範囲であることを確認する。

### APIエンドポイント

| エンドポイント | メソッド | 説明 |
|---|---|---|
| `/api/monthly-report` | GET | `month`パラメータ（YYYY-MM）で指定月のレポート取得 |
| `/api/monthly-reports` | GET | `limit`/`offset`で一覧取得（新しい順） |
| `/api/monthly-report/generate` | POST | オンデマンド生成（`month`パラメータ指定） |

### プロンプト仕様

システムプロンプト（`constants/monthly-report-prompt.ts`に新設）:

```
あなたは「ハル」。ユーザーの健康データを毎日見ている、友人の医師。

# 共通ルール
- 存在するデータだけを語る。記録がない項目には一切触れない
- 月平均で比較する。日別の数値は列挙しない
- 推測禁止。診断・処方もNG

# 構造
- 最初の段落: 今月の一言サマリ（見出しなし）
- 【今月のハイライト】
- 【からだの変化】
- 【活動と栄養のバランス】（データがある場合のみ）
- 【来月に向けて】
- セクション見出しは必ず【】で囲む

# スタイル
- 友人の医師として話す。です/ます調だけど堅くない
- 全ての【セクション】に必ず1箇所だけ**太字**を入れること
- 箇条書きは使わない。文章で自然に書く
- 段落は適宜分ける

# 内容ルール
- 前月との比較を中心に、改善点と課題を伝える
- データが悪い月でも否定的な表現は避ける。改善の余地として前向きに伝える
- カロリー収支: 摂取が消費を上回る場合、ポジティブに聞こえる表現は禁止

# 出力
- 800-2500文字
```

ユーザープロンプト構成:
```
# 月次レポート: YYYY年M月

# 月平均の比較（レポートではこの平均値を使って語ること）
| period | steps | sleep_h | weight | fat% | active_burn_kcal | total_burn_kcal | intake_kcal | protein | fat | carbs |
| 今月 | ... |
| 前月 | ... |

# 月内の推移（4区間平均。月の前半→後半の傾向を把握する用途）
| period | steps | sleep_h | weight | fat% | active_burn_kcal | total_burn_kcal | intake_kcal | protein | fat | carbs |
| 1-7日 | ... |
| 8-14日 | ... |
| 15-21日 | ... |
| 22-末日 | ... |

# 月内のスコア推移（4区間平均）
| period | overall | sleep | activity | nutrition | condition |
| 1-7日 | ... |
| 8-14日 | ... |
| 15-21日 | ... |
| 22-末日 | ... |
```

## フロントエンド

### HomeScreen変更

**月次レポートカード追加:**
- 週次レポートカードの下に配置
- 週次カードと同じデザイン（アイコン+見出し+期間表示）
- アイコン: `date_range`
- 期間表示: `month`フィールド（YYYY-MM）からフロント側で「YYYY年M月」にフォーマット
- タップで月次レポートの本文詳細を表示（週次カードと同じ挙動）
- レポートがない場合: 「月次レポートはまだありません」

### API関数追加

`web-app/src/api/reports.ts`に追加:
- `fetchMonthlyReports(limit, offset)` -- 一覧取得
- `fetchMonthlyReportByMonth(month)` -- 単体取得

### 型定義追加

`web-app/src/api/types.ts`に追加:
```typescript
export interface MonthlyReportItem {
  month: string
  headline: string
  report: string
  model: string
  generated_at: string
  created_at: string
}
```

## 影響範囲

### 新規ファイル
- `cloudflare-api/migrations/0016_monthly_reports.sql`
- `cloudflare-api/src/handlers/monthly-report.ts`
- `cloudflare-api/src/constants/monthly-report-prompt.ts`

### 変更ファイル
- `cloudflare-api/wrangler.toml` -- cron追加
- `cloudflare-api/src/index.ts` -- ルーティング追加、scheduledハンドラ拡張（event.cronで分岐）
- `cloudflare-api/src/types.ts` -- MonthlyReportRow型追加
- `cloudflare-api/src/utils.ts` -- isValidMonth, getLastCompletedMonth追加
- `web-app/src/screens/HomeScreen.tsx` -- 月次カード追加
- `web-app/src/api/reports.ts` -- API関数追加
- `web-app/src/api/types.ts` -- MonthlyReportItem型追加

### 変更しないもの
- 週次レポートのロジック -- 変更なし
- 日次ブリーフィング生成ロジック -- 変更なし
- HaruBriefingコンポーネント -- 変更なし
- カスタムレポート -- 変更なし（Phase 2で履歴画面に統合）

## Phase 2（別スペック）

- レポート履歴画面の新設（日次/週次/月次タブ切り替え）
- HomeScreenの「過去のレポート」セクションの履歴画面への統合
- 日次ブリーフィング一覧API（`GET /api/daily-reports`）の追加
