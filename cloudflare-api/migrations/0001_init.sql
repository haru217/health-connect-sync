CREATE TABLE IF NOT EXISTS daily_metrics (
  date TEXT PRIMARY KEY,
  steps REAL,
  distance_km REAL,
  active_kcal REAL,
  total_kcal REAL,
  intake_kcal REAL,
  sleep_hours REAL,
  weight_kg REAL,
  body_fat_pct REAL,
  resting_bpm REAL,
  heart_bpm REAL,
  spo2_pct REAL,
  blood_systolic REAL,
  blood_diastolic REAL,
  bmr_kcal REAL,
  record_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS nutrition_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consumed_at TEXT NOT NULL,
  local_date TEXT NOT NULL,
  alias TEXT,
  label TEXT NOT NULL,
  count REAL NOT NULL DEFAULT 1,
  unit TEXT,
  kcal REAL,
  protein_g REAL,
  fat_g REAL,
  carbs_g REAL,
  micros_json TEXT,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_nutrition_events_local_date
ON nutrition_events(local_date);

CREATE INDEX IF NOT EXISTS idx_nutrition_events_consumed_at
ON nutrition_events(consumed_at);

CREATE TABLE IF NOT EXISTS user_profile (
  id INTEGER PRIMARY KEY,
  name TEXT,
  height_cm REAL,
  birth_year INTEGER,
  sex TEXT,
  goal_weight_kg REAL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  report_type TEXT NOT NULL,
  prompt_used TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_reports_type
ON ai_reports(report_type);

CREATE INDEX IF NOT EXISTS idx_ai_reports_date
ON ai_reports(report_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_reports_date_type_unique
ON ai_reports(report_date, report_type);

CREATE TABLE IF NOT EXISTS record_type_counts (
  record_type TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
