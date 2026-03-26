-- Allow same size_name in a section when item_type differs (e.g. A4 + Normal vs A4 + Color).
-- Replaces UNIQUE(section_id, size_name) with UNIQUE(section_id, size_name, item_type).

BEGIN TRANSACTION;

CREATE TABLE custom_section_stock_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id TEXT NOT NULL,
  size_name TEXT NOT NULL,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  unit_price REAL NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  item_type TEXT NOT NULL DEFAULT '',
  feet_remaining REAL,
  UNIQUE(section_id, size_name, item_type)
);

INSERT INTO custom_section_stock_new (
  id, section_id, size_name, stock_qty, unit_price, low_stock_threshold, updated_at, item_type, feet_remaining
)
SELECT
  id,
  section_id,
  size_name,
  stock_qty,
  unit_price,
  low_stock_threshold,
  updated_at,
  COALESCE(item_type, ''),
  feet_remaining
FROM custom_section_stock;

DROP TABLE custom_section_stock;
ALTER TABLE custom_section_stock_new RENAME TO custom_section_stock;

CREATE INDEX IF NOT EXISTS idx_custom_section_stock_section ON custom_section_stock(section_id);

COMMIT;
