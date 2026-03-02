# Worklog (New Canonical)

Use this log for all new entries going forward.

Legacy note:
- `AGENT_WORKLOG.md` is preserved, but new entries should be recorded here.

## Entry format
### YYYY-MM-DD
- Owner:
- Scope:
- Result:
- Files:
- Risk/Follow-up:

### 2026-03-02 (3)
- Owner: Codex
- Scope: A3-PROFILE（ユーザープロフィール保存API）実装
- Result: `user_profiles` テーブルを追加し、`GET /api/profile` と `PUT /api/profile` を新スキーマへ切替。`PUT` は部分更新を維持し、列挙値・数値レンジ・レンズON/OFFのバリデーションで不正値を `400` 返却にした。ローカルでマイグレーション適用とAPI実リクエスト検証（正常系/異常系）を完了。
- Files: `cloudflare-api/migrations/0007_user_profiles.sql`, `cloudflare-api/src/index.ts`, `ops/archive/CEO_DASHBOARD.html`, `ops/WORKLOG.md`, `handoff/incoming/20260302-codex-a3-profile-api.md`
- Risk/Follow-up: 既存 `user_profile` テーブル参照ロジック（栄養目標・推定計算など）は温存しているため、今後 B2/B3 で新スキーマへ統合する場合は参照先統一タスクが必要。

### 2026-03-02 (2)
- Owner: Claude (CTO)
- Scope: 全エージェントBOOTSTRAPにCEO記述ルール・承認ゲートを追加
- Result: CEO向け記述ルール（技術用語禁止・ユーザー体験で説明）と承認ゲート付きワークフロー（計画→承認待ち登録→CEO承認→実装開始）を全エージェントのBOOTSTRAPに追加。ops/RULES.mdの§5・§6を各BOOTSTRAPから参照する形に統一。
- Files: `agents/codex/BOOTSTRAP.md`, `agents/gemini/BOOTSTRAP.md`, `agents/claude/BOOTSTRAP.md`, `agents/codex-shinsekai/BOOTSTRAP.md`（前セッション更新済み）, `ops/RULES.md`（前セッション更新済み）
- Risk/Follow-up: Claude-shinsekaiのBOOTSTRAPも同様の更新が必要（未作成の場合は作成時に反映）。

### 2026-03-02
- Owner: Claude (CTO)
- Scope: Codex-shinsekai向けタスク起票（本番デプロイ + APK権限拡張 + 同期ロジック安定化）
- Result: 本番Vercelが3コミット遅れ→デプロイ依頼。Android APKの権限を全種に拡張する依頼。旧APK（android-app）の時間窓チャンク・自動再キュー・窓ごとカーソル保存を現APK（android-sync）に移植する依頼。CEOダッシュボード改善+5エージェント体制+ドキュメント一元化を前セッションで完了しコミット済み。
- Files: `requests/codex-shinsekai/20260302-prod-deploy-and-apk-update.md`, `ops/WORKLOG.md`
- Risk/Follow-up: 同期ロジック移植はコア機能のため、Codex-shinsekaiの成果物をCTO（Claude）がレビューする。

### 2026-02-27
- Owner: Claude (CTO)
- Scope: ローカルAPI廃止後の運用ポリシー CTO決裁（Codex-1依頼への回答）
- Result: 3点の方針を決裁。①URL設定はC案（本番固定/開発のみ可変）採用。②文言整理はA案（アクティブ文書削除、履歴は維持）採用。③担当はCodex-2（android-app URL制御+APIKey対処+UI文言）、Codex-1（Vercel環境変数確認+docs整理）に分担。`DEFAULT_API_KEY="test12345"` のセキュリティリスクを追加指摘し対処をCodex-2タスクに含めた。
- Files: `requests/shared/20260227-cto-direction-local-api-retirement.md`, `requests/codex/20260227-cto-local-api-retire-codex2.md`, `requests/codex/20260227-cto-local-api-retire-codex1.md`, `ops/WORKLOG.md`
- Risk/Follow-up: `DEFAULT_API_KEY` 対処は本番ビルドのセキュリティに直結するため、Codex-2は優先して対応すること。Vercel環境変数の設定漏れがある場合はCEOに確認を仰ぐ。

### 2026-02-27
- Owner: Codex2
- Scope: `P1-1-5` E2E最終確認（ローカルUI × local Cloudflare API :8787）
- Result: 主要5画面＋Condition内3タブを自動巡回し、API失敗0・コンソールエラー0を確認。`P1-1-5` を `done` に更新。
- Files: `ops/CEO_DASHBOARD.html`, `ops/WORKLOG.md`, `handoff/incoming/20260227-codex2-p1-1-5-e2e-complete.md`, `web-app/qa/20260227-p1-1-5/*`
- Risk/Follow-up: この確認はローカル接続（`.env.local` = `127.0.0.1:8787`）での完了。Vercel本番画面の最終確認は別途実施可能。

### 2026-02-27
- Owner: Codex2
- Scope: `P1-1-4` 本番Cloudflare API反映（`/api/home-summary`, `/api/sleep-data` 404解消）
- Result: `cloudflare-api` を本番デプロイし、`/api/summary`, `/api/home-summary`, `/api/sleep-data` の本番200を確認。`P1-1-4` を `done` へ更新。
- Files: `ops/CEO_DASHBOARD.html`, `ops/WORKLOG.md`, `handoff/incoming/20260227-codex2-p1-1-4-production-reflect.md`
- Risk/Follow-up: `P1-1-5`（画面最終決裁）は別途継続。Vercel画面の最終確認で完了判断が必要。

### 2026-02-27
- Owner: Codex2
- Scope: `P1-1-4` 優先度を `mid` から `high` に引き上げ
- Result: 本番API未反映（`/api/home-summary`, `/api/sleep-data`）を主要ブロッカーとして扱うため、ダッシュボードの `TASK_PRIORITY` を更新。
- Files: `ops/CEO_DASHBOARD.html`, `ops/WORKLOG.md`
- Risk/Follow-up: `P1-1-4` と `P1-1-5` がともに `high` となるため、同時並行時は担当分離（Codex-2=API本番反映、Codex-1=画面確認）を維持する。

### 2026-02-27
- Owner: Codex2
- Scope: `P1-1-4` ステータス見直し（done → in_progress）
- Result: CEO判断に基づき `ops/update-ceo-dashboard-task.ps1` で `P1-1-4` を `in_progress` へ更新。`defaultStamp` も `Codex2 (in_progress)` に更新されたことを確認。
- Files: `ops/CEO_DASHBOARD.html`, `ops/WORKLOG.md`
- Risk/Follow-up: 本番Cloudflare APIで `/api/home-summary` と `/api/sleep-data` が404のため、反映完了まで `P1-1-4` は継続管理が必要。

### 2026-02-27
- Owner: Codex2
- Scope: CEO_DASHBOARDへ「同一DB/同一API窓口」前提と本番API未反映ギャップ（`/api/home-summary`, `/api/sleep-data` 404）を明記
- Result: `P1-1-5` の質問・回答に、運用前提（Android→Cloudflare DB、Vercel/ローカル同一API参照）と本番反映優先方針を追記。
- Files: `ops/CEO_DASHBOARD.html`, `ops/WORKLOG.md`
- Risk/Follow-up: `P1-1-4` が `done` のままでも本番API未反映なら、状態の見直し（`in_progress` or `blocked`）が必要。

### 2026-02-27
- Owner: Codex2
- Scope: CEO決裁のHome/Condition表示ポリシー反映（タグ非表示・3人分離・睡眠詳細の条件表示）
- Result: Homeの専門家コメントでマーカー形式（`<!--DOCTOR-->` など）の分離ロジックを強化し、タグ表示を抑止。睡眠タブで就寝/起床・ステージは取得時のみ表示し、未取得時は睡眠時間のみ表示に変更。
- Files: `web-app/src/screens/HomeScreen.tsx`, `web-app/src/screens/HealthScreen.tsx`, `handoff/incoming/20260227-codex2-home-sleep-policy-reflect.md`
- Risk/Follow-up: `npm run lint` は既存違反で失敗（今回変更外を含む）。必要時は lint 方針に沿って別タスクで一括解消。

### 2026-02-27
- Owner: Codex-1
- Scope: ローカルAPI（旧 `pc-server`）資産のアーカイブ移行と Cloudflare API 前提の導線更新
- Result: `pc-server/`・`openapi-local.yaml`・`TROUBLESHOOT.md` を `_archive/` へ移動。`web-app/src/api/client.ts` のデフォルト接続先を `127.0.0.1:8787` へ切替。`ops/START_HERE.md` / `ops/FILE_MAP.md` / `ops/PROJECT_STATE.md` / `docs/index.md` / `agents/codex/BOOTSTRAP.md` をアーカイブ参照に更新。残存する `pc-server` / `localhost:8765` 文言はダッシュボード運用で順次整理する方針。
- Files: `_archive/pc-server/**`, `_archive/openapi-local.yaml`, `_archive/TROUBLESHOOT_local_pc_server.md`, `web-app/src/api/client.ts`, `ops/START_HERE.md`, `ops/FILE_MAP.md`, `ops/PROJECT_STATE.md`, `docs/index.md`, `agents/codex/BOOTSTRAP.md`
- Risk/Follow-up: 履歴系ドキュメント（`docs/v3/*`, `CHANGELOG.md`, `IMPLEMENT.md` など）に旧文言が残存。必要なら別タスクで「履歴を保持したまま注記追加」方針で段階整理する。

### 2026-02-27
- Owner: Codex-1
- Scope: ローカルAPI廃止後の最終運用方針を CTO へ確認依頼
- Result: 方針確認はファイル起票ではなく `ops/CEO_DASHBOARD.html` のスレッドで継続する運用に切り替え。任意URL設定の扱い・旧文言整理方針・担当分担の3点をダッシュボードで確認する。
- Files: `ops/CEO_DASHBOARD.html`, `ops/WORKLOG.md`
- Risk/Follow-up: CTO決定が出るまで、`android-app` の任意URL入力可否と旧文言削除は未確定。

### 2026-02-27
- Owner: Codex-1
- Scope: AIレポート入力データ拡張（就寝/起床・日中平均心拍・運動セッション）の実装依頼を整理
- Result: 要求仕様（就寝/起床、日中平均心拍、運動セッション詳細）はダッシュボードの対象スレッドに集約して CTO/Codex-2 と調整する方針に変更。
- Files: `ops/CEO_DASHBOARD.html`, `ops/WORKLOG.md`
- Risk/Follow-up: 本件は backendロジック追加が中心のため、CTO判断後に Codex-2 で実装着手が必要。

### 2026-02-26
- Owner: Codex (CTO代行)
- Scope: ダッシュボードをAPI連結集中モードへ再更新
- Result: `P1-2-*` を `todo` に戻し、`in_progress` を `P1-1-5` + `I1` + `I2` のみに限定。優先バッジも Home/Condition 関連のみを最優先表示へ統一。
- Files: `ops/CEO_DASHBOARD.html`
- Risk/Follow-up: Home/Condition の最終決裁前に他タスクへ拡散しない運用を継続する。

### 2026-02-26
- Owner: Codex (CTO代行)
- Scope: 優先順位の再定義（Cloudflare連結最優先、Home/Condition決裁待ち、Profile後回し）
- Result: CEO指示に合わせてダッシュボードの順序を更新。`P1-1-5` を in_progress に戻し、`I1/I2` を最優先 in_progress、`I3/I4` を次フェーズ todo、`I5`（プロフィール）を後順位 todo に調整。
- Files: `ops/CEO_DASHBOARD.html`
- Risk/Follow-up: Home/Condition の最終決裁後に `I3`（アクティビティ）→`I4`（食事）へ進み、最後に `I5` を再開する。

### 2026-02-26
- Owner: Claude (PMO)
- Scope: ホームタブ改修の実装状況調査
- Result: cloudflare-api に /api/home-summary（注目ポイント・数値付き充足度）が未実装であることを発見。pc-server には実装済み。CEO の認識と実態にギャップあり。Codex 向けタスクとハンドオフを作成した。
- Files: `requests/codex/20260226-home-summary-cloudflare-api.md`, `handoff/incoming/20260226-claude-home-summary-gap.md`
- Risk/Follow-up: フロントエンドが cloudflare-api を向いている場合、ホームタブの主要機能が現在未動作の可能性あり。早急に Codex が対応する必要がある。

### 2026-02-26
- Owner: Codex
- Scope: Condition tab data-completion (backend derivation + frontend rendering hookup)
- Result: Added derivation/fallback logic for sleep stages, bedtime/wake time, BMR, and resting HR; enabled aggregate refresh on condition endpoints; updated HealthScreen to render BMR, resting HR chart line, high BP count, stage ratios, and goal-day rate. Fixed body current-value lookup to avoid blank weight/body-fat when selected day has only BMR. Added BMR sanity filter to reject invalid observed values (e.g. 35 kcal/day) and fallback to estimate.
- Files: `cloudflare-api/src/index.ts`, `web-app/src/screens/HealthScreen.tsx`, `web-app/src/api/types.ts`, `requests/codex/20260226-condition-backend-null-fill.md`, `handoff/incoming/20260226-codex-condition-backend-null-fill.md`
- Risk/Follow-up: Validate with real user data for year-period aggregation semantics (monthly bucket + daily-derived ratios).
### 2026-02-26
- Owner: Codex
- Scope: Home API completion (`/api/home-summary`) and local D1 dev stabilization
- Result: Added `GET /api/home-summary?date=YYYY-MM-DD` to `cloudflare-api` with `sufficiency`, `statusItems`, `attentionPoints`, `report`, and `previousReport`. Fixed local dev `500` (`D1_ERROR: Failed to parse body as JSON, error code: 1031`) by switching D1 binding from remote proxy mode to local mode in `wrangler.toml`. Verified previously failing endpoints now return `200`.
- Files: `cloudflare-api/src/index.ts`, `cloudflare-api/wrangler.toml`, `handoff/incoming/20260226-codex-home-summary-and-d1-dev-fix.md`, `ops/CEO_DASHBOARD.html`
- Risk/Follow-up: Local dev now uses local D1 by default. If remote data is needed for validation, run explicit `wrangler d1 execute --remote` or introduce a dedicated remote-dev profile.
### 2026-02-26
- Owner: Codex
- Scope: HealthScreen Recharts chart-size warning fix
- Result: Removed chart container sizing warning risk by adding `minWidth/minHeight` to all `ResponsiveContainer` in Health tabs and enforcing `min-width: 0` on chart wrappers.
- Files: `web-app/src/screens/HealthScreen.tsx`, `web-app/src/screens/HealthScreen.css`, `handoff/incoming/20260226-codex-healthscreen-chart-size-warning.md`
- Risk/Follow-up: Re-check browser console after hot reload to ensure warning is fully gone in `composition`, `circulation`, and `sleep` tabs.

### 2026-02-26
- Owner: Codex-1
- Scope: P1-1-5 Web app Cloudflare API connection completion
- Result: Removed frontend fallback/mock returns in `web-app/src/api/healthApi.ts` for `home-summary/body/sleep/vitals` and made Cloudflare API the single source. Updated HealthScreen chart containers to numeric height to avoid `width(-1)/height(-1)` warning condition. Local smoke run (`wrangler dev`) confirmed all required endpoints return `200`.
- Files: `web-app/src/api/healthApi.ts`, `web-app/src/screens/HealthScreen.tsx`, `ops/CEO_DASHBOARD.html`, `handoff/incoming/20260226-codex-web-app-cloudflare-connect.md`
- Risk/Follow-up: `ops/update-ceo-dashboard-task.ps1` is currently broken (mojibake parse error), so dashboard update was applied directly to HTML. Repair script before next status update.

### 2026-02-26
- Owner: Codex-1
- Scope: Home / Condition ローカル最終確認（Cloudflare API 接続）
- Result: `wrangler dev` + `web-app` 環境で Home/Condition の画面表示・API反映を再確認。Playwrightでスクリーンショットと console/network ログを採取し、決裁用チェックリストと未解決事項を handoff に整理。`P1-1-5` は指示どおり `in_progress` 維持。
- Files: `handoff/incoming/20260226-codex1-home-condition-final-check.md`, `web-app/qa/20260226-home-condition/*`
- Risk/Follow-up: Home初期日付とseed日付のズレ時に一部 `-` 表示。専門家セクションのタグ表示（`<!--DOCTOR-->` 等）は別途仕様判断が必要。

### 2026-02-26
- Owner: Codex2
- Scope: Home/Condition向け Cloudflare API 契約の確定（レスポンス項目・エラー挙動・サンプル・ギャップ整理）
- Result: `/api/home-summary`, `/api/body-data`, `/api/sleep-data`, `/api/vitals-data` の契約をコード実装と実レスポンス採取で確定し、`/api/summary` 依存有無を明記。主要エラー（400/404/500、認証条件）とギャップ一覧を handoff に整理。`P1-1-5` は in_progress 維持で、ダッシュボード状態は変更していない。
- Files: `handoff/incoming/20260226-codex2-home-condition-api-contract.md`, `ops/WORKLOG.md`
- Risk/Follow-up: `latestSleepDate` が API 実レスポンスに存在する一方で `web-app/src/api/types.ts` の `SleepDataResponse` に未定義。必要なら型へ追随させる。
