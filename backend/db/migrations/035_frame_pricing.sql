-- Catalog pricing for frames (Settings + billing). Stock rows live in frame_sizes only.
CREATE TABLE IF NOT EXISTS frame_pricing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    size_name TEXT NOT NULL,
    frame_type TEXT NOT NULL DEFAULT 'Duro',
    subitem_name TEXT NOT NULL DEFAULT '',
    unit_price REAL NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(size_name, frame_type, subitem_name)
);

INSERT INTO frame_pricing (size_name, frame_type, subitem_name, unit_price, updated_at)
SELECT size_name, frame_type, subitem_name, unit_price, updated_at FROM frame_sizes;
