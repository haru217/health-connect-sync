CREATE TABLE IF NOT EXISTS monthly_reports (
  month TEXT PRIMARY KEY,
  headline TEXT NOT NULL,
  report TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  generated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
