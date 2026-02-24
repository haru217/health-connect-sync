DELETE FROM nutrition_events;
DELETE FROM ai_reports;
DELETE FROM daily_metrics;
DELETE FROM user_profile;
DELETE FROM record_type_counts;

INSERT INTO user_profile(id, name, height_cm, birth_year, sex, goal_weight_kg, updated_at)
VALUES (1, 'user', 172, 1988, 'male', 72, CURRENT_TIMESTAMP);

WITH RECURSIVE seq(n) AS (
  SELECT 0
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 29
)
INSERT INTO daily_metrics(
  date, steps, distance_km, active_kcal, total_kcal, intake_kcal,
  sleep_hours, weight_kg, body_fat_pct, resting_bpm, heart_bpm, spo2_pct,
  blood_systolic, blood_diastolic, bmr_kcal, record_count
)
SELECT
  DATE('now', printf('-%d day', 29 - n)) AS date,
  7000 + ((n * 311) % 3600) AS steps,
  ROUND((7000 + ((n * 311) % 3600)) * 0.00075, 2) AS distance_km,
  280 + ((n * 17) % 210) AS active_kcal,
  1670 + (280 + ((n * 17) % 210)) AS total_kcal,
  1780 + ((n * 29) % 240) AS intake_kcal,
  CASE WHEN n = 29 THEN 6.12 ELSE ROUND(6.4 + ((n % 4) * 0.25), 2) END AS sleep_hours,
  ROUND(76 - (n * 0.04) + (((n % 3) - 1) * 0.05), 2) AS weight_kg,
  ROUND(22 - (n * 0.03), 2) AS body_fat_pct,
  61 + (n % 5) AS resting_bpm,
  76 + (n % 9) AS heart_bpm,
  ROUND(97 + ((n % 2) * 0.4), 1) AS spo2_pct,
  116 + (n % 8) AS blood_systolic,
  75 + (n % 6) AS blood_diastolic,
  1670 AS bmr_kcal,
  12 AS record_count
FROM seq;

INSERT INTO record_type_counts(record_type, count)
VALUES ('DailyMetricRecord', 360);

INSERT INTO nutrition_events(
  consumed_at, local_date, alias, label, count, unit, kcal, protein_g, fat_g, carbs_g, micros_json, note
)
VALUES
  (
    DATETIME('now', 'start of day', '+7 hours', '+30 minutes'),
    DATE('now'),
    'protein',
    'ミルクプロテイン',
    1,
    '本',
    107,
    20,
    0,
    6.8,
    '{}',
    NULL
  ),
  (
    DATETIME('now', 'start of day', '+8 hours'),
    DATE('now'),
    'vitamin_d',
    'ビタミンD',
    2,
    '錠',
    0,
    0,
    0,
    0,
    '{"vitamin_d3_mcg":50}',
    NULL
  ),
  (
    DATETIME('now', 'start of day', '+12 hours', '+20 minutes'),
    DATE('now'),
    NULL,
    'チキンサラダボウル',
    1,
    NULL,
    620,
    35,
    20,
    70,
    '{"vitamin_c_mg":35,"calcium_mg":120}',
    NULL
  );

INSERT INTO ai_reports(report_date, report_type, prompt_used, content, created_at)
VALUES
  (
    DATE('now'),
    'daily',
    '# daily prompt',
    '<!--DOCTOR-->睡眠を7時間に近づけてください。<!--TRAINER-->夜に10分の散歩を追加しましょう。<!--NUTRITIONIST-->野菜と水分を増やしましょう。<!--END-->',
    CURRENT_TIMESTAMP
  ),
  (
    DATE('now'),
    'weekly',
    '# weekly prompt',
    '<!--DOCTOR-->血圧と睡眠を継続確認しましょう。<!--TRAINER-->有酸素運動を週3回で維持しましょう。<!--NUTRITIONIST-->タンパク質と微量栄養素のバランスを保ちましょう。<!--END-->',
    CURRENT_TIMESTAMP
  ),
  (
    DATE('now'),
    'monthly',
    '# monthly prompt',
    '<!--DOCTOR-->月次で体調変動を確認しましょう。<!--TRAINER-->活動量の底上げを続けましょう。<!--NUTRITIONIST-->食事記録を維持して改善点を可視化しましょう。<!--END-->',
    CURRENT_TIMESTAMP
  );
