# Request: ホーム画面 — スコア表示UI

- Date: 2026-03-02
- Owner: Gemini
- Status: `superseded`
- Superseded by: `requests/gemini/20260303-B1-home-screen-scores.md`
- Phase: B（ホーム画面）
- Design ref: `docs/plans/2026-03-02-health-os-design.md` §5, §9, §10
- Depends on: A1（スコア算出API）— 完了済み

## Background
ホーム画面を Health OS 設計に基づいてリニューアルする。
スコアAPIは完成済み（`GET /api/scores?date=YYYY-MM-DD`）なので、それを画面に表示するUIを実装する。

## APIレスポンス（実装済み）
```json
{
  "date": "2026-03-02",
  "overall": { "score": 72, "color": "green" },
  "domains": {
    "sleep":    { "score": 65, "color": "yellow", "summary": "睡眠時間が短め" },
    "body":     { "score": 78, "color": "green",  "summary": "体重は目標付近で安定" },
    "bp":       { "score": 70, "color": "green",  "summary": "血圧は正常範囲" },
    "activity": { "score": 55, "color": "yellow", "summary": "歩数が目標未達" }
  },
  "baseline": { "sleep": 70, "body": 75, "bp": 72, "activity": 60 }
}
```
※ データがないドメインは `null` が返る

## Scope
- `web-app/src/screens/HomeScreen.tsx` の改修
- 新コンポーネント: ScoreCircle（ドーナツチャート/ゲージ円）
- `/api/scores` からデータ取得して表示
- CSS/アニメーションを含む高品質なUI

## UI構成

### 上部: 総合スコア
- 大きなドーナツ円（色で状態を表現: 緑/黄/赤）
- 数字は円の中央に表示
- スコア下に1行テキスト（例: 「今日のコンディションは良好です」）
- 円のアニメーション（0→実際のスコアまでスムーズに）

### 中部: ドメイン別スコア（横並び4つ）
- 小さなドーナツ円 x 4（睡眠・身体・血圧・活動）
- 各円の下にドメイン名
- 色で状態を伝える（green=#4ba585系, yellow=#f59e0b系, red=#ef4444系）
- **データがないドメインは非表示**（Health Connect準拠: データがあれば表示、なければ表示しない）

### 下部: 気づきセクション
- カード形式で最大5件
- ポジティブ（緑）/ 注意（黄）/ 閾値（赤）で色分け
- タップで詳細なし（v1はテキストのみ）

## デザイン要件
- 既存アプリのデザイン言語を踏襲（CSS変数: `--accent-color`, `--surface-color`, `--text-primary`等）
- 絵文字は使わない
- 「警告」ではなく「気づき」のトーン
- ネガティブワード（「低下」「注意」等）は使わない。色で伝える
- ドーナツチャートはSVGで実装（ライブラリ不要、CSS＋SVGで表現）
- スマホファースト（max-width: 480px を基準）
- 参考: 日本のヘルスケアアプリ（あすけん、FiNC、dヘルスケア等）のスコア画面

## 技術スタック（既存に合わせる）
- React + TypeScript（`web-app/src/`）
- CSS（CSSモジュールではなく、通常のCSSファイル）
- APIクライアント: `web-app/src/api/healthApi.ts` に追加
- 型定義: `web-app/src/api/types.ts` に追加

## 既存コードの参考
- `web-app/src/screens/HomeScreen.tsx` — 現在のホーム画面
- `web-app/src/screens/SetupScreen.tsx` — 最新のコンポーネント構成の参考
- `web-app/src/screens/SetupScreen.css` — 最新のCSSスタイルの参考
- `web-app/src/api/healthApi.ts` — API呼び出しパターン

## Acceptance Criteria
1. ホーム画面に総合スコア円が表示される
2. ドメイン別スコア円が横並び表示される
3. データのないドメインは非表示になる
4. 気づきリストがカード形式で表示される
5. 色が3段階（緑70+/黄50-69/赤50未満）で正しく反映される
6. 既存の専門家セクション・レポートセクションは一旦残す（Phase C以降で改修）
7. ローディング中はスケルトン表示
8. APIエラー時は「データを読み込めませんでした」と表示
9. ドーナツチャートにスコアアニメーションがある
