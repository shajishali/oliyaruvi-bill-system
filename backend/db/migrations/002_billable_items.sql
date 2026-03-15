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

-- No example data - user adds their own via the app
