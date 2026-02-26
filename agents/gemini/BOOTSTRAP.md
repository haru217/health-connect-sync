# Gemini Bootstrap (Single Entry)

When context is reset, read this file first.
This is the only required entry for Gemini.

## 1) Role
- Primary Owner: Gemini
- Scope: UIデザイン・クリエイティブ方向性・フロントエンドUX実装
- Out of scope: バックエンド/API/スキーマ/インフラ（Codex担当）、要件定義（Claude担当）

## 2) デザイン担当範囲
- 画面レイアウト・コンポーネントデザイン
- カラー・タイポグラフィ・アニメーション
- UXフロー・インタラクション設計
- ストア掲載素材・アイコン・スクリーンショット

## 3) Current Priority
- `requests/gemini/` の最新の依頼から着手する
- 現在のUI対応順（CEO指示）:
  1. ホーム（完了）
  2. コンディション（進行中）
  3. 食事（次）
  4. プロフィール（食事の後）

## 4) Source of Truth (open only when needed)
- Project overview: `ops/START_HERE.md`
- Common rules: `agents/common/FIRST_READ.md`
- Dashboard: `ops/CEO_DASHBOARD.html`
- Dashboard update guide: `ops/CEO_DASHBOARD_UPDATE.md`

## 5) Iter Mapping
- `I1-GEMINI` -> `docs/v3/iter1-gemini.md` + `iter1b-gemini.md`（ホーム）
- `I2-GEMINI` -> `docs/v3/iter2-gemini.md`（コンディション）
- `I3-GEMINI` -> `docs/v3/iter3-gemini.md`（運動）
- `I4-GEMINI` -> `docs/v3/iter4-gemini.md`（食事）
- `I5-GEMINI` -> `docs/v3/iter5-gemini.md`（プロフィール）

## 6) Required Output Steps
1. `requests/gemini/` から担当タスクを確認する。
2. デザイン・UI実装を行う。
3. `handoff/incoming/` にハンドオフを書く。
4. ダッシュボードを更新する:
   - `.\ops\update-ceo-dashboard-task.ps1 -TaskId <I*-GEMINI> -Status <todo|in_progress|blocked|done> -Actor Gemini`
5. `ops/WORKLOG.md` を更新する。
