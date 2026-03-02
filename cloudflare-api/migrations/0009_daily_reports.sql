CREATE TABLE IF NOT EXISTS daily_reports (
  date TEXT PRIMARY KEY,
  headline TEXT NOT NULL,
  yu_comment TEXT NOT NULL,
  saki_comment TEXT NOT NULL,
  mai_comment TEXT NOT NULL,
  condition_comment TEXT NOT NULL,
  activity_comment TEXT NOT NULL,
  meal_comment TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  generated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
