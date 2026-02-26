# 優先順位確定: Home/Condition 先行（Cloudflare連結最優先）

- 日付: 2026-02-26
- 決定者: CEO
- 記録者: Codex（CTO代行）

## 決定事項

1. `pc-server/` は legacy 扱いのまま。新規作業では使用しない。
2. 最優先はローカル UI の `cloudflare-api` 連結確認と品質確定。
3. 最終決裁待ちは `Home` と `Condition` の2タブ。
4. 実装・仕上げ順は以下で固定する。
   - 1) Home
   - 2) Condition
   - 3) Activity
   - 4) Meal
   - 5) Profile（最後）

## 実行ルール

- `Home/Condition` の決裁完了までは、`Profile` の優先度を上げない。
- API接続の検証対象は `cloudflare-api/` のみとし、`pc-server/` の確認は行わない。
