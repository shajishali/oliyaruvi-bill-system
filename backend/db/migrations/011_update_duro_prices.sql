-- Update Duro frame prices
-- 8x12=2000, 10x15=2800, 12x18=3500, 16x24=7500

UPDATE frame_sizes SET unit_price = 2000, updated_at = CURRENT_TIMESTAMP WHERE size_name = '8x12' AND frame_type = 'Duro';
UPDATE frame_sizes SET unit_price = 2800, updated_at = CURRENT_TIMESTAMP WHERE size_name = '10x15' AND frame_type = 'Duro';
UPDATE frame_sizes SET unit_price = 3500, updated_at = CURRENT_TIMESTAMP WHERE size_name = '12x18' AND frame_type = 'Duro';
UPDATE frame_sizes SET unit_price = 7500, updated_at = CURRENT_TIMESTAMP WHERE size_name = '16x24' AND frame_type = 'Duro';
