# U11: 歩数ソース絞り込み + ブリーフィングプロンプト修正

## 背景
- 歩数データが5ソース（android, Fitbit, RingConn, Google Fit, source=null）から重複して記録されており、Google Fitの4,000歩に対しDB上は6,482歩と過大集計されている
- ブリーフィングプロンプトで「黒字」表現がまだ出る、太字ルールが守られないセクションがある

## 変更1: StepsRecord を Google Fit ソースのみに絞る

### ファイル: `cloudflare-api/src/handlers/sync-aggregate.ts`

StepsRecordの処理部分（`row.type === 'StepsRecord'`）で、`com.google.android.apps.fitness`以外のソースをスキップする。

```typescript
// 既存コード（WeightRecordと同じパターン）:
} else if (row.type === 'StepsRecord') {
  if (row.source !== 'com.google.android.apps.fitness') continue
  // ... 既存の処理
```

### 検証
- 変更後に `npx tsc --noEmit` が通ること
- `npx wrangler deploy` でデプロイ
- デプロイ後、集計タイムスタンプをリセットして再集計:
  ```sql
  DELETE FROM record_type_counts WHERE record_type='__meta__last_aggregated_at_ms'
  ```
- その後APIからsyncを叩くか、手動でdaily_metricsの3/5歩数を確認

## 変更2: ブリーフィングプロンプト修正

### ファイル: `cloudflare-api/src/handlers/report.ts`

#### 2a: カロリー収支ルール強化
既存の行:
```
'- 摂取カロリーが消費カロリーを上回る場合は「黒字」「しっかり摂れた」ではなく、改善の余地として前向きな提案につなげる',
```
を以下に変更:
```
'- カロリー収支: 摂取が消費を上回る場合は「黒字」「プラス」などポジティブに聞こえる表現は禁止。「消費を少し上回っています」と事実を述べ、具体的な改善提案（一品置き換え等）につなげる',
```

#### 2b: 太字ルール強化
既存の行:
```
'- 必須: 各【セクション】の中で、最も伝えたいポイント1箇所を必ず**太字**にする。太字がないセクションは不可',
```
を以下に変更:
```
'- 絶対ルール: 全ての【セクション】に必ず1箇所だけ**太字**を入れること。太字が0個のセクションがあった場合、出力をやり直すこと',
```

### 検証
- `npx tsc --noEmit` + `npx wrangler deploy`
- デプロイ後、`POST /api/report/generate?force=true` でレポート再生成
- 出力に「黒字」が含まれないこと
- 全セクションに太字があること
