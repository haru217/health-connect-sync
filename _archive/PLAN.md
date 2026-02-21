# PLAN（ローカル版）

## ゴール
- Health Connect のデータを Android で全取得 → PCに毎日同期 → ダッシュボードで減量トレンドが見える。

## 進め方（実機同期は最後）
1) 実装を完成に寄せる（Android/PC/ドキュメント）
2) 実機で初回同期→取りこぼしの調整→安定化

## MVPのDefinition of Done
- PCサーバ：run.ps1 で起動し /ui が開ける
- Android：Discover PC → 権限付与 → Sync now でPCにデータが入る
- /ui に体重・歩数・（あれば）消費カロリー・睡眠が出る
- 日次の体重差分から「停滞/進捗」の判定が出る
