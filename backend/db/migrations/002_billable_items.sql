-- Add designforBanner, designforPhoto and new size formats
-- Frame: 12+8, 12+18 (inches) - fixed price
-- Banner: 5+3, 5+8 (feet) - sqft * price_per_sqft

-- Design for Banner sizes (feet: W+H)
CREATE TABLE IF NOT EXISTS design_for_banner_sizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    size_name TEXT NOT NULL UNIQUE,
    width_ft REAL NOT NULL,
    height_ft REAL NOT NULL,
    unit_price REAL NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Design for Photo sizes (inches: W+H)
CREATE TABLE IF NOT EXISTS design_for_photo_sizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    size_name TEXT NOT NULL UNIQUE,
    unit_price REAL NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Banner sizes (feet: 5+3 = 5ft x 3ft)
CREATE TABLE IF NOT EXISTS banner_sizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    size_name TEXT NOT NULL,
    width_ft REAL NOT NULL,
    height_ft REAL NOT NULL,
    material_id INTEGER NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES banner_materials(id),
    UNIQUE(material_id, size_name)
);

-- Expand bill_items service_type to include designforBanner, designforPhoto
-- SQLite: recreate table to change CHECK
CREATE TABLE IF NOT EXISTS bill_items_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL,
    service_type TEXT NOT NULL,
    item_name TEXT NOT NULL,
    size TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL,
    metadata TEXT,
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);
INSERT INTO bill_items_new SELECT * FROM bill_items;
DROP TABLE bill_items;
ALTER TABLE bill_items_new RENAME TO bill_items;
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);

-- Seed designforBanner sizes
INSERT OR IGNORE INTO design_for_banner_sizes (size_name, width_ft, height_ft, unit_price) VALUES
('5+3', 5, 3, 50.00),
('5+8', 5, 8, 80.00),
('8+4', 8, 4, 70.00);

-- Seed designforPhoto sizes
INSERT OR IGNORE INTO design_for_photo_sizes (size_name, unit_price) VALUES
('4+6', 25.00),
('5+7', 35.00),
('6+8', 50.00),
('8+12', 75.00);

-- Add new frame sizes (inches: 12+8 = 12" x 8")
INSERT OR IGNORE INTO frame_sizes (size_name, stock_qty, unit_price, low_stock_threshold) VALUES
('12+8', 0, 120.00, 5),
('12+18', 0, 150.00, 5),
('12+10', 0, 130.00, 5),
('18+24', 0, 250.00, 5),
('24+36', 0, 400.00, 3);

-- Add new photo sizes (inches: 4+6 = 4" x 6")
INSERT OR IGNORE INTO photo_sizes (size_name, stock_qty, unit_price, low_stock_threshold) VALUES
('4+6', 0, 10.00, 50),
('5+7', 0, 15.00, 30),
('6+8', 0, 25.00, 20),
('8+12', 0, 45.00, 10);

-- Seed banner sizes per material (Flex, Sticker, Cloth)
INSERT OR IGNORE INTO banner_sizes (size_name, width_ft, height_ft, material_id)
SELECT '5+3', 5, 3, id FROM banner_materials WHERE material_name = 'Flex'
UNION ALL SELECT '5+8', 5, 8, id FROM banner_materials WHERE material_name = 'Flex'
UNION ALL SELECT '5+3', 5, 3, id FROM banner_materials WHERE material_name = 'Sticker'
UNION ALL SELECT '5+8', 5, 8, id FROM banner_materials WHERE material_name = 'Sticker'
UNION ALL SELECT '5+3', 5, 3, id FROM banner_materials WHERE material_name = 'Cloth'
UNION ALL SELECT '5+8', 5, 8, id FROM banner_materials WHERE material_name = 'Cloth';
