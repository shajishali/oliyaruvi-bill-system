-- Banner stock: track banner rolls by size (e.g. 6 feet, 8 feet, 10 feet) and quantity
CREATE TABLE IF NOT EXISTS banner_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    size_name TEXT NOT NULL UNIQUE,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
