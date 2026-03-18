-- サプリメントカタログをDB管理化
CREATE TABLE IF NOT EXISTS supplement_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alias TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  kcal REAL NOT NULL DEFAULT 0,
  protein_g REAL NOT NULL DEFAULT 0,
  fat_g REAL NOT NULL DEFAULT 0,
  carbs_g REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '錠',
  micros_json TEXT DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 既存ハードコードデータをシード
INSERT INTO supplement_catalog (alias, label, kcal, protein_g, fat_g, carbs_g, unit, micros_json, sort_order) VALUES
  ('protein', 'ミルクプロテイン', 107, 20, 0, 6.8, '本', '{}', 0),
  ('vitamin_d', 'ビタミンD', 0, 0, 0, 0, '錠', '{"vitamin_d3_mcg":50}', 1),
  ('multivitamin', 'マルチビタミン', 3.36, 0.1, 0.1, 0.656, '錠', '{"calcium_mg":200,"magnesium_mg":100,"zinc_mg":6,"vitamin_c_mg":125,"vitamin_e_mg":9,"folate_mcg":240}', 2),
  ('fish_oil', 'フィッシュオイル', 8.34, 0.222, 0.791, 0.1, '錠', '{"omega3_mg":270}', 3);
