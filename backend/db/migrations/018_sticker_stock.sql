-- Sticker stock: rolls by size (6ft, 8ft, 10ft), 150 feet per roll, low stock at 10 feet
CREATE TABLE IF NOT EXISTS sticker_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    size_name TEXT NOT NULL UNIQUE,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    feet_remaining REAL NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 10,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
