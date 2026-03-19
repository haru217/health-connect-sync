DELETE FROM food_items;

CREATE TABLE IF NOT EXISTS food_custom (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  brand TEXT,
  amount TEXT NOT NULL,
  amount_g REAL,
  kcal REAL,
  protein_g REAL,
  fat_g REAL,
  carbs_g REAL,
  micros_json TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  food_master_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (food_master_id) REFERENCES food_master(id)
);

CREATE INDEX IF NOT EXISTS idx_food_custom_name
ON food_custom(name, brand);

CREATE INDEX IF NOT EXISTS idx_food_custom_use
ON food_custom(use_count DESC);
