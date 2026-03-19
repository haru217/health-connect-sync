CREATE TABLE IF NOT EXISTS food_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  food_code TEXT NOT NULL UNIQUE,
  food_group TEXT NOT NULL,
  name TEXT NOT NULL,
  name_kana TEXT,
  amount TEXT NOT NULL DEFAULT '100g',
  amount_g REAL NOT NULL DEFAULT 100,
  kcal REAL,
  protein_g REAL,
  fat_g REAL,
  carbs_g REAL,
  micros_json TEXT,
  per100g_kcal REAL,
  per100g_protein_g REAL,
  per100g_fat_g REAL,
  per100g_carbs_g REAL,
  per100g_micros_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_food_master_name
ON food_master(name);

CREATE INDEX IF NOT EXISTS idx_food_master_group
ON food_master(food_group);
