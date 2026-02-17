# Health Connect Sync → PC (Local) — TASKS

## 方針
- 実機同期の検証は最後にまとめて実施（認識合わせのフェーズ）
- それまでは「仕様・実装・運用手順・ダッシュボード」を完成に寄せる

---

## A. 実機なしで進められる（今やる）
### A1. Androidアプリ（ビルド可能な雛形の完成度UP）
- [~] RecordTypeRegistry を「全部読む」方針で拡張しつつ、SDK差分で落ちないよう整理（FQCN動的ロード化済み / 追加Recordは今後拡張）
- [x] 同期の catch-up 設計（PCオフラインでも、復帰時に日次ウィンドウで少しずつ追いつく）
- [x] 送信前のpayloadサイズ制御（chunksize + “期間を刻む”）
- [x] 境界取りこぼし対策（lastSyncから5分重ねて再同期→upsertで重複排除）
- [~] エラー表示の改善（ネット/401/権限不足/HC未導入の判定）※Test/Discovery/Syncでメッセージ改善済み（HC_UNAVAILABLE/UPDATE_REQUIREDも追加）
- [ ] 原因ヒントのしきい値チューニング（歩数/睡眠/消費kcal）※デフォルト値は実装済み
- [~] 設定画面のUX：Discover→候補表示→選択（実装済み）、API_KEYの保存確認（OK表示あり、改善余地）

### A2. PCサーバ
- [x] /api/summary の拡張（体重・歩数・消費カロリー・睡眠の「日次」系列）
- [~] /ui のダッシュボードを減量主軸に調整（MA7ベースの停滞判定・原因ヒント：実装済み / しきい値調整はあり得る）
- [x] Windows運用手順：タスクスケジューラでログオン時起動（ドキュメント）
- [x] ログ/DBバックアップ方針（SQLiteファイル退避）

### A3. ドキュメント
- [x] QUICKSTART を「PC→Android」順に統一
- [x] トラブルシュート（Firewall/AP isolation/PC名解決/HTTP cleartext）

---

## B. 実機同期フェーズ（最後にまとめて）
- [ ] Health Connect権限付与→全Record type取得の実測
- [ ] WeightRecord/SkinTemperatureRecord 等の実データが入ってくるか確認
- [ ] 取れないtypeがあれば原因切り分け（提供元/権限/SDK型名）
- [ ] 同期パフォーマンス（初回90日バックフィル時間、chunkサイズ調整）

---

## C. その後（任意）
- [ ] 食事入力→推定カロリー→体重変化との整合
- [ ] "readiness" 的なコンディション指標（自作）
