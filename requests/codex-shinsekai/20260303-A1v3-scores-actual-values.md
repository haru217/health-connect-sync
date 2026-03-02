# Request: scores APIに実数値を追加（A1v3）

- Date: 2026-03-03
- Owner: Codex-shinsekai
- Status: `todo`
- Phase: A（基盤）
- Depends on: A1v2（完了済み）

## Background
B1ホーム画面のドメインカードにスコアだけでなく実数値（7.5h, 8200歩, 1850kcal, 120/80）を表示する必要がある。
現在これらはhome-summary APIから取得しているが、scores APIに含めればフロントが1つのAPIで完結する。

## 変更内容

`GET /api/scores` の各ドメインに `values` オブジェクトを追加する。

### レスポンス形式（変更後）
```json
{
  "date": "2026-03-03",
  "overall": { "score": 72, "color": "green" },
  "domains": {
    "sleep": {
      "score": 65,
      "color": "yellow",
      "summary": "睡眠時間がやや短め",
      "values": { "hours": 6.5, "label": "6h30m" }
    },
    "activity": {
      "score": 55,
      "color": "yellow",
      "summary": "歩数が目標の60%",
      "values": { "steps": 4800, "label": "4,800歩" }
    },
    "nutrition": {
      "score": 82,
      "color": "green",
      "summary": "カロリーバランスは良好です",
      "values": { "intake_kcal": 1850, "label": "1,850kcal" }
    },
    "condition": {
      "score": 78,
      "color": "green",
      "summary": "コンディションは良好です",
      "values": { "systolic": 125, "diastolic": 82, "label": "125/82" }
    }
  },
  "baseline": { ... },
  "insights": [ ... ]
}
```

### 各ドメインの values 定義

| ドメイン | values のキー | ソース | label フォーマット |
|---|---|---|---|
| sleep | `hours`: number, `label`: string | `sleep_hours` (daily_metrics) | `Xh XXm` (既存の formatSleepLabel を流用) |
| activity | `steps`: number, `label`: string | `steps` (daily_metrics) | `X,XXX歩` (3桁カンマ区切り + 歩) |
| nutrition | `intake_kcal`: number, `label`: string | `intake_kcal` (daily_metrics) | `X,XXXkcal` |
| condition | `systolic`: number, `diastolic`: number, `label`: string | `blood_systolic`, `blood_diastolic` (daily_metrics) | `XXX/XX` |

### データなしの場合
- ドメイン自体が null の場合はそのまま null（変更なし）
- ドメインにスコアはあるが値がない場合: `values` は null

### 実装場所
`getScores()` 関数内。`todayRow`（当日のdaily_metrics）は既に取得済みなので、そこから値を取り出して `values` オブジェクトを構築するだけ。

## Acceptance Criteria
1. 各ドメインに `values` オブジェクトが含まれる
2. `values.label` が人間が読めるフォーマットになっている
3. データなし時は `values: null`
4. 既存の score/color/summary/baseline/insights は一切変更しない
5. `values` のフォーマットに数値 + ラベル両方を含む（フロントの表示柔軟性のため）
