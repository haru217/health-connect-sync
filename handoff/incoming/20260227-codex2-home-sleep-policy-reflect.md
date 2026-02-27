# Handoff: Home/Sleep 表示ポリシー反映（CEO決裁）

- Date: 2026-02-27
- From: Codex2
- To: CEO / Claude / Codex-1
- Request file: なし（CEOチャット決裁: 「今日固定」「タグ非表示+3人切り分け」「睡眠詳細は取得時のみ表示」）
- Status: `done`

## Summary
CEO決裁内容を画面表示へ反映。  
1) Homeの専門家コメントで `<!--DOCTOR-->` 等のタグが見えないように修正。  
2) マーカー形式（開始タグのみ）でも3人コメントを正しく分離。  
3) 睡眠詳細（就寝/起床・ステージ）は取得できる場合のみ表示。未取得時は詳細を非表示にし、睡眠時間バーのみ表示。

## Changed files
- `web-app/src/screens/HomeScreen.tsx`
- `web-app/src/screens/HealthScreen.tsx`

## Verification
- Commands run:
  - `npm run build` (`web-app/`)
  - `npm run lint` (`web-app/`)
- Result:
  - build: `OK`
  - lint: `NG`（既存のプロジェクト全体lint違反が残存。今回変更点に限定した新規lintエラーは未確認）

## Open issues / blockers
- `npm run lint` は既存違反で失敗（`react-hooks/set-state-in-effect` ほか、複数ファイル）。

## Recommended next step
1. Codex-1で Home の実機確認（タグ非表示・3人分離表示）。
2. 睡眠詳細未取得データ日で Condition睡眠タブを目視確認（詳細行が非表示になること）。
