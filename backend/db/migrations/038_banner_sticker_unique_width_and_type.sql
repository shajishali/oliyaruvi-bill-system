-- Allow the same roll width for different physical stock types (e.g. 4 ft flex vs 4 ft sticker).
-- Replaces UNIQUE(size_name) with UNIQUE(size_name, stock_type).

BEGIN TRANSACTION;

CREATE TABLE banner_stock_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  size_name TEXT NOT NULL,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  feet_remaining REAL NOT NULL DEFAULT 0,
  stock_type TEXT NOT NULL DEFAULT '',
  UNIQUE(size_name, stock_type)
);

INSERT INTO banner_stock_new (id, size_name, stock_qty, low_stock_threshold, updated_at, feet_remaining, stock_type)
SELECT id, size_name, stock_qty, low_stock_threshold, updated_at, feet_remaining, COALESCE(stock_type, '')
FROM banner_stock;

DROP TABLE banner_stock;
ALTER TABLE banner_stock_new RENAME TO banner_stock;

CREATE TABLE sticker_stock_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  size_name TEXT NOT NULL,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  feet_remaining REAL NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  stock_type TEXT NOT NULL DEFAULT '',
  UNIQUE(size_name, stock_type)
);

INSERT INTO sticker_stock_new (id, size_name, stock_qty, feet_remaining, low_stock_threshold, updated_at, stock_type)
SELECT id, size_name, stock_qty, feet_remaining, low_stock_threshold, updated_at, COALESCE(stock_type, '')
FROM sticker_stock;

DROP TABLE sticker_stock;
ALTER TABLE sticker_stock_new RENAME TO sticker_stock;

COMMIT;
