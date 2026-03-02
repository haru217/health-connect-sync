ALTER TABLE user_profiles ADD COLUMN goal_weight_kg REAL;
ALTER TABLE user_profiles ADD COLUMN sleep_goal_minutes INTEGER DEFAULT 420;
ALTER TABLE user_profiles ADD COLUMN steps_goal INTEGER DEFAULT 8000;

INSERT INTO user_profiles(
  user_id,
  age,
  gender,
  height_cm,
  goal_weight_kg,
  sleep_goal_minutes,
  steps_goal,
  updated_at
)
SELECT
  'default',
  CASE
    WHEN birth_year IS NOT NULL THEN CAST(strftime('%Y', 'now') AS INTEGER) - birth_year
    ELSE NULL
  END,
  sex,
  height_cm,
  goal_weight_kg,
  sleep_goal_minutes,
  steps_goal,
  updated_at
FROM user_profile
WHERE id = 1
ON CONFLICT(user_id) DO UPDATE SET
  goal_weight_kg = COALESCE(excluded.goal_weight_kg, user_profiles.goal_weight_kg),
  sleep_goal_minutes = COALESCE(excluded.sleep_goal_minutes, user_profiles.sleep_goal_minutes),
  steps_goal = COALESCE(excluded.steps_goal, user_profiles.steps_goal),
  height_cm = COALESCE(user_profiles.height_cm, excluded.height_cm),
  gender = COALESCE(user_profiles.gender, excluded.gender),
  age = COALESCE(user_profiles.age, excluded.age);
