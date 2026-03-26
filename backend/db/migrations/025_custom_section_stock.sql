-- Per-custom-tab stock (e.g. "clothes") — Size / Qty / Low stock only
CREATE TABLE IF NOT EXISTS custom_section_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id TEXT NOT NULL,
    size_name TEXT NOT NULL,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(section_id, size_name)
);
CREATE INDEX IF NOT EXISTS idx_custom_section_stock_section ON custom_section_stock(section_id);

-- Allow 'custom' in stock_transactions item_type
DROP TABLE IF EXISTS stock_transactions_new;
CREATE TABLE stock_transactions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type TEXT NOT NULL CHECK(item_type IN ('frame', 'photo', 'photocopy', 'banner', 'sticker', 'custom')),
    item_id INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('add', 'reduce', 'adjust')),
    quantity INTEGER NOT NULL,
    previous_qty INTEGER NOT NULL,
    new_qty INTEGER NOT NULL,
    reason TEXT,
    user_action TEXT NOT NULL DEFAULT 'manual' CHECK(user_action IN ('manual', 'billing')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO stock_transactions_new SELECT * FROM stock_transactions;
DROP TABLE stock_transactions;
ALTER TABLE stock_transactions_new RENAME TO stock_transactions;
CREATE INDEX IF NOT EXISTS idx_stock_transactions_item ON stock_transactions(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_created ON stock_transactions(created_at);
