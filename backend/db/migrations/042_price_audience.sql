-- Studio (st) vs local customer price on each catalog row.
-- Existing prices stay Local. The same item can be added again for the other audience.

PRAGMA foreign_keys=OFF;

CREATE TABLE banner_materials_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_name TEXT NOT NULL,
    price_per_sqft REAL NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    pricing_type TEXT DEFAULT 'per_sqft',
    price_audience TEXT NOT NULL DEFAULT 'local' CHECK(price_audience IN ('st', 'local')),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(material_name, price_audience)
);
INSERT INTO banner_materials_new (id, material_name, price_per_sqft, is_active, pricing_type, price_audience, updated_at)
SELECT id, material_name, price_per_sqft, is_active, COALESCE(pricing_type, 'per_sqft'), 'local', updated_at
FROM banner_materials;
DROP TABLE banner_materials;
ALTER TABLE banner_materials_new RENAME TO banner_materials;

CREATE TABLE sticker_materials_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_name TEXT NOT NULL,
    price_per_sqft REAL NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    pricing_type TEXT DEFAULT 'per_sqft',
    price_audience TEXT NOT NULL DEFAULT 'local' CHECK(price_audience IN ('st', 'local')),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(material_name, price_audience)
);
INSERT INTO sticker_materials_new (id, material_name, price_per_sqft, is_active, pricing_type, price_audience, updated_at)
SELECT id, material_name, price_per_sqft, is_active, COALESCE(pricing_type, 'per_sqft'), 'local', updated_at
FROM sticker_materials;
DROP TABLE sticker_materials;
ALTER TABLE sticker_materials_new RENAME TO sticker_materials;

CREATE TABLE frame_pricing_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    size_name TEXT NOT NULL,
    frame_type TEXT NOT NULL DEFAULT 'Duro',
    subitem_name TEXT NOT NULL DEFAULT '',
    unit_price REAL NOT NULL DEFAULT 0,
    price_audience TEXT NOT NULL DEFAULT 'local' CHECK(price_audience IN ('st', 'local')),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(size_name, frame_type, subitem_name, price_audience)
);
INSERT INTO frame_pricing_new (id, size_name, frame_type, subitem_name, unit_price, price_audience, updated_at)
SELECT id, size_name, frame_type, subitem_name, unit_price, 'local', updated_at
FROM frame_pricing;
DROP TABLE frame_pricing;
ALTER TABLE frame_pricing_new RENAME TO frame_pricing;

CREATE TABLE custom_section_sale_items_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    item_type TEXT NOT NULL DEFAULT '',
    qty_type TEXT NOT NULL DEFAULT 'per_sqft' CHECK(qty_type IN ('per_sqft', 'per_unit')),
    unit_price REAL NOT NULL DEFAULT 0,
    size_name TEXT NOT NULL DEFAULT '',
    price_audience TEXT NOT NULL DEFAULT 'local' CHECK(price_audience IN ('st', 'local')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(section_id, item_name, size_name, price_audience)
);
INSERT INTO custom_section_sale_items_new (id, section_id, item_name, item_type, qty_type, unit_price, size_name, price_audience, created_at)
SELECT id, section_id, item_name, item_type, qty_type, unit_price, size_name, 'local', created_at
FROM custom_section_sale_items;
DROP TABLE custom_section_sale_items;
ALTER TABLE custom_section_sale_items_new RENAME TO custom_section_sale_items;
CREATE INDEX IF NOT EXISTS idx_custom_section_sale_items_section ON custom_section_sale_items(section_id);

CREATE TABLE design_for_banner_sizes_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    size_name TEXT NOT NULL,
    width_ft REAL NOT NULL,
    height_ft REAL NOT NULL,
    unit_price REAL NOT NULL,
    price_audience TEXT NOT NULL DEFAULT 'local' CHECK(price_audience IN ('st', 'local')),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(size_name, price_audience)
);
INSERT INTO design_for_banner_sizes_new (id, size_name, width_ft, height_ft, unit_price, price_audience, updated_at)
SELECT id, size_name, width_ft, height_ft, unit_price, 'local', updated_at
FROM design_for_banner_sizes;
DROP TABLE design_for_banner_sizes;
ALTER TABLE design_for_banner_sizes_new RENAME TO design_for_banner_sizes;

CREATE TABLE design_for_photo_sizes_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    size_name TEXT NOT NULL,
    unit_price REAL NOT NULL,
    price_audience TEXT NOT NULL DEFAULT 'local' CHECK(price_audience IN ('st', 'local')),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(size_name, price_audience)
);
INSERT INTO design_for_photo_sizes_new (id, size_name, unit_price, price_audience, updated_at)
SELECT id, size_name, unit_price, 'local', updated_at
FROM design_for_photo_sizes;
DROP TABLE design_for_photo_sizes;
ALTER TABLE design_for_photo_sizes_new RENAME TO design_for_photo_sizes;

ALTER TABLE service_items ADD COLUMN price_audience TEXT NOT NULL DEFAULT 'local';

PRAGMA foreign_keys=ON;
