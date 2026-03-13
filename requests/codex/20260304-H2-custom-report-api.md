# Request: カスタムレポートAPI（H2）

- Date: 2026-03-04
- Owner: Codex
- Status: `done`
- Phase: H（ハルUX v2）
- Depends on: H1（ハルLLMプロンプト）
- Priority: 高

## 概要

ユーザーが固定テンプレートから質問を選び、ハルがデータを使って深く分析するカスタムレポート機能のAPIを実装する。

参照: `ops/HARU_UX_VISION.md` §2 レイヤー2

## テンプレート定義

```typescript
const REPORT_TEMPLATES = [
  { id: 'weight', label: '体重・体組成', prompt: '体重と体脂肪の推移を分析し、改善の具体策を提案してください' },
  { id: 'sleep', label: '睡眠', prompt: '睡眠の質と量を分析し、改善の具体策を提案してください' },
  { id: 'blood_pressure', label: '血圧', prompt: '血圧の推移を分析し、安定化のための具体策を提案してください' },
  { id: 'activity', label: '運動・活動', prompt: '活動量と消費カロリーを分析し、改善の具体策を提案してください' },
  { id: 'nutrition', label: '食事・栄養', prompt: '食事内容と栄養バランスを分析し、改善の具体策を提案してください' },
  { id: 'general', label: '総合分析', prompt: '最近の全体的な体調を分析し、最も重要な改善ポイントを提案してください' },
] as const
```

## API エンドポイント

### POST /api/custom-report

リクエスト:
```json
{
  "template_id": "weight"
}
```

レスポンス:
```json
{
  "id": 123,
  "template_id": "weight",
  "template_label": "体重・体組成",
  "report": "（800-1500文字のプレーンテキスト）",
  "created_at": "2026-03-04T10:00:00Z"
}
```

処理フロー:
1. テンプレートIDからプロンプトを取得
2. H1と同じデータ取得（14日分 + 食事詳細）
3. System prompt（ハルキャラ + テンプレート別フォーカス指示）+ User prompt（データ + テンプレートプロンプト）
4. LLM呼び出し → 800-1500文字のテキスト
5. `custom_reports` テーブルに保存
6. レスポンス返却

### GET /api/custom-reports

履歴取得:
```json
{
  "reports": [
    {
      "id": 123,
      "template_id": "weight",
      "template_label": "体重・体組成",
      "report": "...",
      "created_at": "2026-03-04T10:00:00Z"
    }
  ]
}
```

クエリパラメータ: `limit`（デフォルト20）、`offset`

### GET /api/custom-report-templates

テンプレート一覧取得:
```json
{
  "templates": [
    { "id": "weight", "label": "体重・体組成" },
    ...
  ]
}
```

## DBマイグレーション

```sql
CREATE TABLE custom_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id TEXT NOT NULL,
  report TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `cloudflare-api/migrations/XXXX_custom_reports.sql` | custom_reportsテーブル作成 |
| `cloudflare-api/src/handlers/custom-report.ts` | 新規: カスタムレポートハンドラ |
| `cloudflare-api/src/handlers/report.ts` | ハルのSystem promptを共通関数として切り出し（ブリーフィングと共用） |
| `cloudflare-api/src/index.ts` | ルーティング追加 |
| `cloudflare-api/src/types.ts` | 型定義追加 |

## 制約

1. LLMプロンプトのSystem prompt部分はH1のブリーフィングと共通化する
2. テンプレート定義は定数ファイルに置く（ハードコード禁止）
3. TypeScript ビルドが通ること

## Acceptance Criteria

1. POST /api/custom-report でテンプレートIDを指定してレポート生成できる
2. 800-1500文字のプレーンテキストが返る
3. GET /api/custom-reports で履歴が取得できる
4. GET /api/custom-report-templates でテンプレート一覧が取得できる
5. custom_reportsテーブルにレポートが保存される
6. TypeScript ビルドが通る
