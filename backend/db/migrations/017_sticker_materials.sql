-- Sticker materials: same structure as banner (sqft pricing, different material)
CREATE TABLE IF NOT EXISTS sticker_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_name TEXT NOT NULL UNIQUE,
    price_per_sqft REAL NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    pricing_type TEXT DEFAULT 'per_sqft',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
