# Request: index.ts モジュール分割リファクタリング（D2）

- Date: 2026-03-03
- Owner: Codex-shinsekai
- Status: `todo`
- Phase: D（品質改善）
- Depends on: なし（他タスクと独立）

## Background
`cloudflare-api/src/index.ts` が **5607行** に膨らんでいる。コーディングルールの上限は800行/ファイル。
全ての機能（ルーティング、スコアリング、LLMレポート、同期、栄養、体組成、睡眠、バイタル、プロフィール、ホームサマリー）が1ファイルに集約されており、保守性が著しく低下している。

## 目標
機能別にファイル分割し、各ファイルを800行以下にする。
**外部仕様（API入出力）は一切変更しない。純粋なリファクタリング。**

## モジュール構成

```
cloudflare-api/src/
├── index.ts              # エントリポイント（ルーティングのみ、100行以下）
├── types.ts              # 共有型定義（Env, DailyMetricsRow 等）
├── utils.ts              # 共有ユーティリティ（jsonResponse, toIsoDate, parseDate 等）
├── handlers/
│   ├── sync.ts           # handleSync, upsertDailyMetrics
│   ├── scores.ts         # getScores, 各ドメインスコア計算, generateInsights
│   ├── report.ts         # handleDailyReportGenerate, buildDailyReportPrompt, callLlm*, generateDailyReportIfNeeded
│   ├── nutrition.ts      # 栄養系ハンドラー（nutrition/day, nutrition/log, nutrients/targets, supplements）
│   ├── health.ts         # body-data, sleep-data, vitals-data ハンドラー
│   ├── profile.ts        # GET/PUT /api/profile
│   └── home-summary.ts   # handleHomeSummary, attentionPoints, statusItems
└── constants.ts          # DEFAULT_BMR_KCAL, LLM_TIMEOUT_MS, DEFAULT_LLM_* 等
```

## ルーティング（index.ts の最終形）

```typescript
import { handleSync } from './handlers/sync'
import { handleGetScores } from './handlers/scores'
import { handleDailyReportGenerate, handleGetDailyReport } from './handlers/report'
// ... 他のハンドラー

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // 認証チェック
    if (!isAuthenticated(request, env)) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    // ルーティング
    if (path === '/api/sync' && request.method === 'POST') return handleSync(request, env, ctx)
    if (path === '/api/scores') return handleGetScores(request, env)
    // ... 他のルート

    return jsonResponse({ error: 'Not Found' }, 404)
  }
}
```

## 移動ルール

### 型定義（types.ts）
- `Env` interface
- `DailyMetricsRow`, `DailyReportRow` 等のDB行型
- `InsightDomain`, `ScoreColor` 等の共有型

### ユーティリティ（utils.ts）
- `jsonResponse(data, status)`
- `toIsoDate(date)`
- `parseDate(str)`
- `weightedAverage(items)`
- `clamp(val, min, max)`
- `formatSleepLabel(hours)`
- 認証チェック関数

### 定数（constants.ts）
- `DEFAULT_BMR_KCAL`
- `LLM_TIMEOUT_MS`
- `DEFAULT_LLM_PROVIDER`, `DEFAULT_LLM_MODEL`
- スコアリング閾値定数

### ハンドラー（handlers/*.ts）
各ハンドラーは `(request: Request, env: Env, ctx?: ExecutionContext) => Promise<Response>` 形式。
必要な型・ユーティリティは `../types`, `../utils`, `../constants` からインポートする。

## 制約
1. **APIの入出力は一切変更しない**（純粋リファクタリング）
2. **Cloudflare Workers のモジュールワーカー形式を維持**（`export default { fetch }` パターン）
3. 各ファイル800行以下
4. 関数50行以下（既存の超過は許容するが、新規超過は禁止）
5. 循環参照を作らない（依存方向: handlers → utils/types/constants）
6. テストが存在しないため、動作確認は `wrangler dev` でのローカル実行で行う
7. `wrangler.toml` の `main` 設定が `src/index.ts` のままで動くことを確認

## 作業手順
1. `types.ts`, `utils.ts`, `constants.ts` を先に作成
2. 各ハンドラーファイルを作成し、関数を移動
3. `index.ts` をルーティングのみに縮小
4. `wrangler dev` でローカル動作確認
5. 全エンドポイントの疎通テスト

## Acceptance Criteria
1. `index.ts` が100行以下
2. 全ファイルが800行以下
3. `wrangler dev` でローカル起動できる
4. 全APIエンドポイントが従来と同じレスポンスを返す
5. `wrangler deploy` でデプロイ可能
6. 循環参照がない
