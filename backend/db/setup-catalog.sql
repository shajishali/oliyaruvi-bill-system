-- First-install stock catalog only. Quantities, prices, bills, and customers are not included.
-- Later app updates must not run this file again.

INSERT INTO frame_sizes (size_name, frame_type, subitem_name, stock_qty, unit_price, low_stock_threshold)
VALUES
  ('10+15', 'duro', '', 0, 0, -1),
  ('10+15', 'class', '', 0, 0, -1),
  ('10+8', 'class', '', 0, 0, -1),
  ('12 + 18', 'class degital', '', 0, 0, -1),
  ('12 + 18', 'duro', '', 0, 0, -1);

INSERT INTO banner_stock (size_name, stock_type, print_type, stock_qty, feet_remaining, low_stock_threshold)
VALUES
  ('6', 'banner', '', 0, 0, -1),
  ('8', 'banner', '', 0, 0, -1);
