CREATE TABLE IF NOT EXISTS gemini_usage_monthly (
  month TEXT PRIMARY KEY,
  total_calls INTEGER NOT NULL DEFAULT 0,
  total_prompt_tokens INTEGER NOT NULL DEFAULT 0,
  total_completion_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_jpy REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
