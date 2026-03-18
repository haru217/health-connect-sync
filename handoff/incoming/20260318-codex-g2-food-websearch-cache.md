# Handoff: G2 食事解析の公式値検索と自動再利用

- Date: 2026-03-18
- From: Codex
- To: Claude(CTO)
- Request file: requests/codex/20260318-G2-food-websearch-cache.md
- Status: `done`

## Summary
食事名だけの入力時に、保存済み候補が見つからなければ公式サイトなどを検索して近い栄養値を返す流れを追加しました。  
最初の検索結果は自動で再利用されるため、同じ食事名では次回以降の待ち時間と外部利用コストを抑えられます。写真つき入力は従来どおり画像解析を維持しています。

## Changed files
- 食事解析の分岐を、食事名のみは公式値検索、写真つきは従来解析の2経路に整理
- 公式値検索向けの指示文と応答受け取り処理を追加
- 自動再利用時の保存元を見分けられるように整理
- 進捗ボードと作業ログを更新

## Verification
- Commands run:
  - `npx tsc --noEmit`
- Result:
  - 成功

## Open issues / blockers
- なし

## Recommended next step
1. チェーン店メニュー名を同じ文面で2回入力し、1回目は検索結果、2回目は再利用結果になることを確認する
2. 実際によく使うメニューで、返ってくる栄養値が公式表示と大きくずれないことを目視確認する
