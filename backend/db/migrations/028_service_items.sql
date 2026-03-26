-- Service-only items (no stock): e.g. passport print, shop copy, etc.
-- These are billable but never reduce stock.
CREATE TABLE IF NOT EXISTS service_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    item_type TEXT DEFAULT '',
    qty_type TEXT NOT NULL DEFAULT 'per_unit' CHECK(qty_type IN ('per_unit', 'per_sqft')),
    unit_price REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_service_items_name ON service_items(name);
