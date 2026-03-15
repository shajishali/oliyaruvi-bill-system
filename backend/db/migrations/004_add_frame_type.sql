-- Add frame_type to frame_sizes (e.g. Wood, Metal, Plastic)
CREATE TABLE IF NOT EXISTS frame_sizes_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    size_name TEXT NOT NULL,
    frame_type TEXT NOT NULL DEFAULT 'Standard',
    stock_qty INTEGER NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(size_name, frame_type)
);
INSERT INTO frame_sizes_new (id, size_name, frame_type, stock_qty, unit_price, low_stock_threshold, updated_at)
SELECT id, size_name, 'Standard', stock_qty, unit_price, low_stock_threshold, updated_at
FROM frame_sizes;
DROP TABLE frame_sizes;
ALTER TABLE frame_sizes_new RENAME TO frame_sizes;
