CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY DEFAULT 'default',
  age INTEGER,
  gender TEXT,
  height_cm REAL,
  weight_goal TEXT,
  bp_goal_systolic INTEGER,
  bp_goal_diastolic INTEGER,
  lens_weight INTEGER DEFAULT 0,
  lens_bp INTEGER DEFAULT 0,
  lens_sleep INTEGER DEFAULT 0,
  lens_performance INTEGER DEFAULT 0,
  exercise_freq TEXT,
  exercise_type TEXT,
  exercise_intensity TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
