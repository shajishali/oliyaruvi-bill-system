-- Custom roll sale items (pricing subtypes under a custom section like cloth)
-- Stock roll sizes are kept in `custom_section_stock` (size_name + stock_qty).
-- These sale items store pricing for different printing qualities/types (e.g. Backlight print).
CREATE TABLE IF NOT EXISTS custom_section_sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id TEXT NOT NULL,
    item_name TEXT NOT NULL,          -- Subitem name (e.g. Backlight print)
    item_type TEXT NOT NULL DEFAULT '', -- Item Type category (e.g. Banner)
    qty_type TEXT NOT NULL DEFAULT 'per_sqft' CHECK(qty_type IN ('per_sqft', 'per_unit')),
    unit_price REAL NOT NULL DEFAULT 0, -- Rs per sqft or per unit depending on qty_type
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(section_id, item_name)
);

CREATE INDEX IF NOT EXISTS idx_custom_section_sale_items_section ON custom_section_sale_items(section_id);

