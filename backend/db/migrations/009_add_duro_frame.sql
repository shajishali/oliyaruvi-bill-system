-- Add Duro frame type with sizes and prices
-- 8x12=2000, 10x15=2800, 12x18=3500, 16x24=7500
-- Stock: 7, Min stock: 3 for each

INSERT INTO frame_sizes (size_name, frame_type, stock_qty, unit_price, low_stock_threshold) VALUES
('8x12', 'Duro', 7, 2000, 3),
('10x15', 'Duro', 7, 2800, 3),
('12x18', 'Duro', 7, 3500, 3),
('16x24', 'Duro', 7, 7500, 3)
ON CONFLICT(size_name, frame_type) DO UPDATE SET
  stock_qty = 7,
  unit_price = excluded.unit_price,
  low_stock_threshold = 3,
  updated_at = CURRENT_TIMESTAMP;
