-- Oliyaruvi Printers - Seed Data
-- Run after migrations

-- Shop settings
INSERT OR IGNORE INTO shop_settings (id, shop_name, address, contact, gstin) VALUES
(1, 'Oliyaruvi Printers', 'Enter your shop address here', 'Enter contact number', NULL);

-- Banner materials
INSERT OR IGNORE INTO banner_materials (material_name, price_per_sqft) VALUES
('Flex', 25.00),
('Sticker', 35.00),
('Cloth', 45.00);

-- Frame sizes
INSERT OR IGNORE INTO frame_sizes (size_name, stock_qty, unit_price, low_stock_threshold) VALUES
('12x18', 0, 150.00, 5),
('18x24', 0, 250.00, 5),
('24x36', 0, 400.00, 3);

-- Photo sizes
INSERT OR IGNORE INTO photo_sizes (size_name, stock_qty, unit_price, low_stock_threshold) VALUES
('4x6', 0, 10.00, 50),
('5x7', 0, 15.00, 30),
('6x8', 0, 25.00, 20),
('8x12', 0, 45.00, 10);

-- Service charges
INSERT OR IGNORE INTO service_charges (charge_type, amount, description) VALUES
('design', 50.00, 'Design charge per job'),
('pocket', 10.00, 'Per pocket charge');
