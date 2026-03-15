-- Add per-item discount column
ALTER TABLE bill_items ADD COLUMN item_discount REAL NOT NULL DEFAULT 0;
