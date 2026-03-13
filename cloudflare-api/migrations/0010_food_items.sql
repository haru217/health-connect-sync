CREATE TABLE IF NOT EXISTS food_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  brand TEXT,
  amount TEXT NOT NULL,
  kcal REAL,
  protein_g REAL,
  fat_g REAL,
  carbs_g REAL,
  micros_json TEXT,
  source TEXT NOT NULL DEFAULT 'gemini',
  verified INTEGER NOT NULL DEFAULT 0,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_food_items_name_brand
ON food_items(name, brand);

CREATE INDEX IF NOT EXISTS idx_food_items_use_count
ON food_items(use_count DESC, last_used_at DESC);
