CREATE TABLE IF NOT EXISTS shop_branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    place TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS branch_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    direction TEXT NOT NULL CHECK(direction IN ('send', 'receive')),
    branch_id INTEGER,
    branch_name TEXT NOT NULL,
    item_type TEXT NOT NULL DEFAULT '',
    item_id INTEGER,
    item_label TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    adjust_stock INTEGER NOT NULL DEFAULT 0,
    stock_adjusted INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_branch_transfers_created ON branch_transfers(created_at);
