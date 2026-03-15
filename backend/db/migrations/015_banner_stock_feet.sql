-- Add feet_remaining to banner_stock: each roll = 150 feet, low stock when <= 5 feet
ALTER TABLE banner_stock ADD COLUMN feet_remaining REAL NOT NULL DEFAULT 0;
-- Migrate existing: feet_remaining = stock_qty * 150
UPDATE banner_stock SET feet_remaining = stock_qty * 150 WHERE feet_remaining = 0;
-- low_stock_threshold for banner = 5 feet (already exists, default 5)
