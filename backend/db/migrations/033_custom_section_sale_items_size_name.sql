-- Separate subitem label (item_name) from stock key (size_name) for count-type custom sections.
-- Billing matches custom_section_stock.size_name to sale.size_name when set; otherwise falls back to item_name (legacy).

CREATE TABLE IF NOT EXISTS custom_section_sale_items_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    item_type TEXT NOT NULL DEFAULT '',
    qty_type TEXT NOT NULL DEFAULT 'per_sqft' CHECK(qty_type IN ('per_sqft', 'per_unit')),
    unit_price REAL NOT NULL DEFAULT 0,
    size_name TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(section_id, item_name, size_name)
);

INSERT INTO custom_section_sale_items_new (id, section_id, item_name, item_type, qty_type, unit_price, size_name, created_at)
SELECT id, section_id, item_name, item_type, qty_type, unit_price, '', created_at
FROM custom_section_sale_items;

DROP TABLE custom_section_sale_items;
ALTER TABLE custom_section_sale_items_new RENAME TO custom_section_sale_items;

CREATE INDEX IF NOT EXISTS idx_custom_section_sale_items_section ON custom_section_sale_items(section_id);
