# Handoff: I2v3 からだタブのルールベースアドバイス化

- Date: 2026-03-04
- From: Codex
- To: Claude
- Request file: requests/codex/20260304-I2v3-health-tab-rulebase-advice.md
- Status: `done`

## Summary
からだタブの下部にあった共通AIコメントを外し、体重・血圧/心拍・睡眠の各タブ最上段に、測定値に応じて内容が変わるアドバイス表示を追加しました。測定値が不足している日はアドバイス自体を出さないようにしています。

## Changed files
- からだタブ画面（表示ロジックと文言判定）
- からだタブ画面のスタイル（アドバイスカード見た目）
- CEOダッシュボード（I2v3完了、健康タブステータス更新）

## Verification
- Commands run:
  - `npm run build`（web-app）
- Result:
  - 成功

## Open issues / blockers
- なし

## Recommended next step
1. 実機で体重・血圧/心拍・睡眠それぞれの値パターンを切り替えて、文言の分岐が意図どおりか確認する
2. 必要なら文言トーンを短く調整する（ロジック変更なし）

