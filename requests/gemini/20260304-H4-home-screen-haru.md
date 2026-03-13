# Request: ホーム画面UI — ハル + タブ構成変更（H4）

- Date: 2026-03-04
- Owner: Gemini
- Status: `todo`
- Phase: H（ハルUX v2）
- Depends on: H1（バックエンドAPI）
- Priority: 高

## 概要

ホーム画面を「朝のブリーフィング」に全面刷新し、タブ構成をMVP（ホーム + 食事の2タブ）に変更する。

参照: `ops/HARU_UX_VISION.md` §3, §8

## 変更1: ホーム画面レイアウト

### 構成（上から順に）

1. **ハルのブリーフィング** — メインコンテンツ
   - プレーンテキスト（400-800文字）
   - APIレスポンスの `briefing` フィールドを表示
   - `briefing` がなく旧 `yu/saki/mai` がある場合は旧形式で表示（後方互換）
   - 「。」で改行（既存ExpertCardと同じ手法）

2. **昨日のハイライト** — 全ドメインの実数値 + トレンド
   - 睡眠: X時間XX分（▲▼→ vs 14日平均）
   - 歩数: X,XXX歩（▲▼→）
   - 体重: XX.Xkg（▲▼→）
   - 血圧: XXX/XX（▲▼→）
   - 消費カロリー: X,XXXkcal（▲▼→）
   - 摂取カロリー: X,XXXkcal（データがある場合のみ）
   - トレンド矢印は14日平均比: ▲（+10%以上）、▼（-10%以下）、→（±10%以内）

3. **ハルに聞く** — カスタムレポート導線
   - テンプレート6種のボタン/カード
   - タップ → POST /api/custom-report → 結果表示

4. **レポート履歴** — 過去のカスタムレポート
   - GET /api/custom-reports で取得
   - カード形式で一覧（テンプレートラベル + 日付 + 冒頭テキスト）

### 旧コンポーネントの扱い
- ExpertSection（3AIカード）→ 非表示（コード削除しない）
- StatusCards（スコア表示）→ ハイライトに置き換え
- 目標プログレスバー → 削除（トレンド矢印に置換）

## 変更2: タブ構成変更

### MVP: 2タブのみ
```
[ホーム] [食事]
```

### 非表示にするタブ（コードは保持）
- からだ（HealthScreen）
- アクティビティ（ActivityScreen）
- マイページ（MyPageScreen）

### 実装方法
ナビゲーション設定（`App.tsx` or ルーター）でタブを2つに絞る。
旧スクリーンファイルは `web-app/src/screens/` に残す。

## API依存

ホームサマリーAPIレスポンス（H1完了後に確定）:
```json
{
  "briefing": "ハルのブリーフィングテキスト...",
  "yu": null,
  "saki": null,
  "mai": null,
  "metrics": {
    "steps": 2296,
    "sleep_hours": 7.65,
    "weight_kg": 83.8,
    "body_fat_pct": 28.3,
    "blood_systolic": 130,
    "blood_diastolic": 78,
    "active_kcal": 495,
    "total_kcal": 2180,
    "intake_kcal": null
  },
  "averages": {
    "steps": 4851,
    "sleep_hours": 6.33,
    "weight_kg": 83.3,
    ...
  }
}
```

※ averagesフィールドはH1のAPI改修で追加される想定。なければフロントで計算も可。

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `web-app/src/screens/HomeScreen.tsx` | ブリーフィング表示、ハイライト、カスタムレポート導線 |
| `web-app/src/App.tsx` or ルーター | タブ構成を2タブに変更 |
| `web-app/src/api/types.ts` | レスポンス型にbriefing, averages追加 |
| `web-app/src/components/` | 必要に応じて新コンポーネント |

## 制約

1. 旧スクリーン・コンポーネントのファイルは削除しない（非表示のみ）
2. 見た目の完成度は後回し。レイアウトと情報の配置が正しければOK
3. UIの最終デザインはCEO承認が必要（まず機能を動かす）
4. TypeScript ビルドが通ること

## Acceptance Criteria

1. ホーム画面にハルのブリーフィングテキストが表示される
2. briefingがない旧レポートは旧形式（yu/saki/mai）で表示される
3. 全ドメインのハイライト（実数値 + トレンド矢印）が表示される
4. カスタムレポートのテンプレート選択 → 生成 → 表示ができる
5. カスタムレポートの履歴が閲覧できる
6. タブがホームと食事の2つのみ表示される
7. 旧スクリーンのコードが保持されている
8. TypeScript ビルドが通る
