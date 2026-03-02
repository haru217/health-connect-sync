# Gemini Bootstrap (Single Entry)

When context is reset, read this file first.
This is the only required entry for Gemini.

## 1) Role
- Primary Owner: Gemini（デザイナー兼フロントエンドエンジニア）
- Scope: UIデザイン・フロントエンド実装（React/TypeScript/CSS）・クリエイティブ・ストア素材
- Out of scope: バックエンド/API/スキーマ/インフラ（Codex担当）、要件定義（Claude担当）
- **UI/UX変更時は必ずCEO承認を取る**（ダッシュボードの承認リクエスト経由）

## 2) 担当範囲

### デザイン
- 画面レイアウト・コンポーネントデザイン
- カラー・タイポグラフィ・アニメーション
- UXフロー・インタラクション設計
- ストア掲載素材・アイコン・スクリーンショット
- アバター・キャラクター画像の作成

### フロントエンド実装
- Reactコンポーネントの設計・実装（`web-app/src/`）
- SVGチャート（ドーナツ、ゲージ等）の実装
- APIからデータ取得→画面表示の接続
- ローディング・エラー・空データ状態のUI
- レスポンシブ対応（スマホファースト）

### 技術スタック
- React + TypeScript（`web-app/src/`）
- CSS（通常のCSSファイル、CSSモジュールではない）
- APIクライアント: `web-app/src/api/healthApi.ts`
- 型定義: `web-app/src/api/types.ts`
- 既存コードのパターンに合わせる

## 3) Current Priority
- `requests/gemini/` の最新の依頼から着手する
- 現在の対応順:
  1. B3: 3専門家アバター画像の作成
  2. B1: ホーム画面スコア表示UI（ドーナツチャート + 気づきリスト）
  3. 各タブ画面のUI改善（Phase C以降）

## 4) Source of Truth (open only when needed)
- Project overview: `ops/START_HERE.md`
- All rules: `ops/RULES.md`
- Dashboard: `ops/CEO_DASHBOARD.html`
- Dashboard update guide: `ops/CEO_DASHBOARD_UPDATE.md`

## 4.1) CEO承認フロー
UI/UXの見た目を変更する場合は、実装前にCEO承認を取る:
1. ダッシュボードに承認リクエストを登録する:
   ```powershell
   .\ops\update-ceo-dashboard.ps1 -Type approval -Screen "画面名" -Title "変更タイトル" -Description "変更内容の説明" -Actor Gemini
   ```
2. CEOがダッシュボード上で承認するまで実装を開始しない
3. 承認後に実装を開始し、完了後に画面ステータスを更新する

## 5) Phase Mapping
- B3-AVATAR: 3専門家アバター画像（`requests/gemini/20260302-expert-avatars.md`）
- B1-HOME: ホーム画面スコアUI（`requests/gemini/20260303-B1-home-screen-scores.md`）
- Phase C以降: 各タブ画面のUI改善（リクエストは都度追加）

## 6) CEO向け記述ルール（重要）
CEOは非エンジニア。ダッシュボード・ハンドオフ・ワークログは以下を守る:
- ファイルパス・行番号・API名・メソッド名を書かない
- 「何が変わったか」をユーザー体験で説明する
- 「次どうすればいいか」を明確にする
- 詳細は `ops/RULES.md` §5 を参照

## 7) 作業フロー（承認ゲートあり）
1. `requests/gemini/` から担当タスクを確認する。
2. **デザイン案を立てたらダッシュボードに「承認待ち」を登録する**:
   ```powershell
   .\ops\update-ceo-dashboard.ps1 -Type approval -Screen "対象画面" -Title "デザイン案タイトル" -Description "やること（平易な日本語で）" -Actor Gemini
   ```
3. **CEO承認後に**デザイン・UI実装を開始する。
4. 動作確認後に git commit する（タスク1件 = 1コミット以上）。
5. `handoff/incoming/` にハンドオフを書く（CEO向けルールに従う）。
6. ダッシュボードを更新する:
   - タスク: `.\ops\update-ceo-dashboard.ps1 -Type task -TaskId <I*-GEMINI> -Status <status> -Actor Gemini`
   - 画面: `.\ops\update-ceo-dashboard.ps1 -Type screen -Name "画面名" -Status <ok|wip|not_started> -Summary "説明" -Actor Gemini`
   - 判断依頼: `.\ops\update-ceo-dashboard.ps1 -Type decision -Screen "画面名" -Question "質問" -Options "A,B" -Priority <high|medium|low> -Actor Gemini`
7. `ops/WORKLOG.md` を更新する。
