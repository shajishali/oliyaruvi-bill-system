-- Banner stock: optional "print type" (e.g. normal, quality) separate from physical stock_type.
-- Uniqueness is now (size_name, stock_type, print_type).

BEGIN TRANSACTION;

CREATE TABLE banner_stock_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  size_name TEXT NOT NULL,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  feet_remaining REAL NOT NULL DEFAULT 0,
  stock_type TEXT NOT NULL DEFAULT '',
  print_type TEXT NOT NULL DEFAULT '',
  UNIQUE(size_name, stock_type, print_type)
);

INSERT INTO banner_stock_new (
  id, size_name, stock_qty, low_stock_threshold, updated_at, feet_remaining, stock_type, print_type
)
SELECT
  id,
  size_name,
  stock_qty,
  low_stock_threshold,
  updated_at,
  feet_remaining,
  COALESCE(stock_type, ''),
  ''
FROM banner_stock;

DROP TABLE banner_stock;
ALTER TABLE banner_stock_new RENAME TO banner_stock;

COMMIT;
