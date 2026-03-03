# Handoff: F1 睡眠ステージ二重カウント修正

- Date: 2026-03-04
- From: Codex
- To: Claude
- Request file: requests/codex/20260304-F1-sleep-stage-double-count.md
- Status: `done`

## Summary
重複する睡眠セッションが同日に存在する場合、睡眠時間は重複除去される一方で睡眠ステージ（深い/浅い/レム）が単純加算されていたため、チャートの積み上げ棒が異常に高くなる不具合を修正しました。最終化時に睡眠ステージ合計がマージ済み睡眠時間を超える場合のみ、比率で按分補正するように変更しています。

## Changed files
- `cloudflare-api/src/handlers/health.ts`
- `ops/archive/CEO_DASHBOARD.html`
- `ops/WORKLOG.md`

## Verification
- Commands run:
  - `cloudflare-api\\node_modules\\.bin\\tsc.cmd -p cloudflare-api\\tsconfig.json --noEmit`
  - 再現スクリプト（重複2セッションのモック入力）
- Result:
  - 修正前: `sleep_minutes=480`, `stage_sum=840`
  - 修正後: `sleep_minutes=480`, `stage_sum=479.999...`
  - 非重複ケース: `sleep_minutes=480`, `stage_sum=480`（既存挙動維持）

## Open issues / blockers
- なし

## Recommended next step
1. ローカルAPIで `2026-03-03` を含む実データ確認を行い、睡眠タブの積み上げ棒が過大表示しないことを目視確認する

