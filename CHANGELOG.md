# Changelog (health-connect-sync)

## 2026-02-22 (UI updates + nutrient UX fixes)
- Added global period switch (`日 / 週 / 月`) to the UI and wired it across major views:
  - Home summary labels and aggregates (daily/weekly/monthly).
  - Health charts window lengths now change by period.
  - AI tab behavior now follows selected period (`daily/weekly/monthly`) for prompt and history filtering.
- Added a quick advice card (`ひとことアドバイス`) on Home:
  - Generates short guidance from sleep, steps, calorie balance, and weight trend.
- Improved nutrient target graph behavior:
  - UI now passes selected date to `/api/nutrients/targets?date=YYYY-MM-DD`.
  - Added date normalization (`YYYY-MM-DD`) and safe fallback when input is invalid.
  - API error detail (`detail`) is now surfaced in UI error text.
- Updated nutrient targets API behavior:
  - `GET /api/nutrients/targets` now accepts optional `date`.
  - Endpoint no longer hard-fails when profile is missing; uses defaults for better first-run UX.
  - `calc_nutrient_targets(...)` now supports date-specific aggregation via `local_date`.
- Supplement display labels are now Japanese-first:
  - `protein`, `vitamin_d`, `multivitamin`, `fish_oil` labels are shown in Japanese.
  - UI includes alias-based JP label mapping to normalize legacy/English labels.
  - Day event rendering normalizes supplement labels by alias to current catalog names.
- Typography update:
  - Switched primary JP UI font to `Noto Sans JP`.
- Added UI change summary doc:
  - `UI_CHANGES.md`
## 2026-02-18
- 繝ｭ繝ｼ繧ｫ繝ｫPC繧ｵ繝ｼ繝舌↓縲碁｣滉ｺ・繧ｵ繝励Μ縲肴焔蜈･蜉帙Ο繧ｰ讖溯・繧定ｿｽ蜉
  - DB: `nutrition_events`
  - API:
    - `POST /api/nutrition/log`
    - `GET /api/nutrition/day?date=YYYY-MM-DD`
- 蜑肴律繝ｬ繝昴・繝・PI繧定ｿｽ蜉
  - `GET /api/report/yesterday`
- 12:00 JST 縺ｫ Discord #菴楢ｪｿ邂｡逅・縺ｸ蜑肴律繝ｬ繝昴・繝医ｒ謚慕ｨｿ縺吶ｋcron繧定ｿｽ蜉
- 繧ｨ繧､繝ｪ繧｢繧ｹ螳夂ｾｩ繧定ｿｽ蜉・・UTRITION_RULES.md・・
  - protein = ZAVAS MILK PROTEIN 閼りが0 繧ｭ繝｣繝ｩ繝｡繝ｫ鬚ｨ蜻ｳ 200ml・・07kcal / P20g / F0g / C6.8g・・
  - vitamin_d・・itamin_d3_iu=2000 / vitamin_d3_mcg=50・・
  - multivitamin・医ン繧ｿ繝溘Φ12遞ｮ+繝溘ロ繝ｩ繝ｫ7遞ｮ繧知icros縺ｫ逋ｻ骭ｲ・・
  - fish_oil・・pa_mg=190 / dha_mg=80 / omega3_mg=270・・
- nutrition_events 縺ｫ PFC + micros_json 繧定ｿｽ蜉・医し繝励Μ鬆・岼縺ｮ髮・ｨ医・蝨溷床・・
- 譬・､顔ｴ繧偵げ繝ｩ繝募喧縺励ｄ縺吶＞繧医≧縲∵ｭ｣隕丞喧繝・・繝悶Ν繧定ｿｽ蜉・・ual-write・・
  - nutrient_keys / nutrition_nutrients
  - 譌｢蟄倥・ micros_json 縺ｯ蠖馴擇邯ｭ謖・ｼ亥ｮ牙・・・

NOTE:
- API縺ｯ `X-Api-Key` 蠢・茨ｼ・C蜀・・ `.env` 縺ｫ菫晏ｭ假ｼ峨ゅメ繝｣繝・ヨ縺ｫ雋ｼ繧句ｿ・ｦ√↑縺励・

## 2026-02-18 (OpenClaw ingest)
- Added idempotent OpenClaw ingest endpoint: `POST /api/openclaw/ingest` (keyed by `event_id`).
- Added ingest ledger table: `openclaw_ingest_events`.
- Added new service module: `pc-server/app/openclaw_ingest.py`.
- Added pending importer automation:
  - `pc-server/import_pending.py`
  - `pc-server/import-pending.ps1`
  - `pc-server/watch-pending.ps1`
  - `pc-server/run.ps1 -WatchPending`
- Added docs:
  - `docs/openclaw-ingest-schema.md`
  - `docs/openclaw-handoff-runbook.md`
- Updated API docs:
  - `pc-server/NUTRITION_API.md`
  - `openapi-local.yaml`
- Added tests:
  - `pc-server/tests/test_openclaw_ingest.py`
  - `pc-server/tests/test_pending_importer.py`


