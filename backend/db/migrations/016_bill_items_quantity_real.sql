-- Allow decimal quantity for banner sqft
CREATE TABLE IF NOT EXISTS bill_items_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL,
    service_type TEXT NOT NULL,
    item_name TEXT NOT NULL,
    size TEXT,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    item_discount REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL,
    metadata TEXT,
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);
INSERT INTO bill_items_new (id, bill_id, service_type, item_name, size, quantity, unit_price, item_discount, subtotal, metadata)
SELECT id, bill_id, service_type, item_name, size, CAST(quantity AS REAL), unit_price, COALESCE(item_discount, 0), subtotal, metadata FROM bill_items;
DROP TABLE bill_items;
ALTER TABLE bill_items_new RENAME TO bill_items;
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);
