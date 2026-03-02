# Handoff: Home/Condition ローカル最終確認（Cloudflare API 接続）

- Date: 2026-02-26
- From: Codex-1
- To: CEO / Claude
- Scope: Home / Condition のみ（Activity / Meal / Profile は対象外）
- Task: P1-1-5（`in_progress` 維持）

## 決裁用チェックリスト

- [x] Home画面表示確認（2026-02-26）
  - ステータスカード、注目ポイント、今日のまとめを表示
  - `/api/home-summary?date=2026-02-26` が `200`
- [x] Condition画面表示確認（体組成）
  - 体重・体脂肪・BMI・基礎代謝と推移チャート表示
  - `/api/body-data?date=2026-02-26&period=week` が `200`
- [x] Condition画面表示確認（バイタル）
  - 血圧・安静時心拍・高血圧判定日と推移チャート表示
  - `/api/vitals-data?date=2026-02-26&period=week` が `200`
- [x] Condition画面表示確認（睡眠）
  - 睡眠時間、血中酸素、推移チャート、達成率表示
  - `/api/sleep-data?date=2026-02-26&period=week` が `200`
- [x] ブラウザコンソール重大エラー確認
  - `Errors: 0, Warnings: 0`
- [x] APIエラー確認
  - Playwright採取のネットワークログ上、対象APIはすべて `200`

## 差分スクショ

- Home（2026-02-26）:
  - `web-app/qa/20260226-home-condition/health-connect-home-2026-02-26.png`
- Condition（体組成）:
  - `web-app/qa/20260226-home-condition/health-connect-condition-composition-2026-02-26.png`
- Condition（バイタル）:
  - `web-app/qa/20260226-home-condition/health-connect-condition-vital-2026-02-26.png`
- Condition（睡眠）:
  - `web-app/qa/20260226-home-condition/health-connect-condition-sleep-2026-02-26.png`

補助ログ:
- Console:
  - `web-app/qa/20260226-home-condition/playwright-console-info.txt`
- Network:
  - `web-app/qa/20260226-home-condition/playwright-network.txt`

## 未解決事項一覧

1. Homeの初期日付が `2026-02-27` の場合、seedデータ日（`2026-02-26`）との差で睡眠/歩数/食事が `-` 表示になる。  
   - 仕様として許容か、初期日付の扱いを調整するか要判断。
2. Homeの「3人の専門家から」に `<!--DOCTOR-->` などのタグ文字列がそのまま表示される。  
   - 表示整形（タグ除去またはパース）の要否判断が必要。
3. Condition睡眠タブのステージ（深い/浅い/REM）と就寝/起床は `null` データ時に `-` 表示。  
   - 現状は仕様内だが、データ取得元で stage/time を補完するかは別途検討。

## 実行記録（抜粋）

- `GET /healthz` -> `200 {"ok":true}`
- `POST /api/dev/seed-mock` -> `200 {"ok":true,...}`
- `GET /api/home-summary?date=2026-02-26` -> `200`
- `GET /api/body-data?date=2026-02-26&period=week` -> `200`
- `GET /api/vitals-data?date=2026-02-26&period=week` -> `200`
- `GET /api/sleep-data?date=2026-02-26&period=week` -> `200`

## 注意

- 指示どおり `P1-1-5` は `done` に変更していません（`in_progress` 維持）。
