-- Remove all example data - user will add their own original data

-- Clear in order (respect foreign keys)
DELETE FROM bill_items;
DELETE FROM bills;
DELETE FROM stock_transactions;
DELETE FROM notifications;
DELETE FROM design_for_banner_sizes;
DELETE FROM design_for_photo_sizes;
DELETE FROM banner_sizes;
DELETE FROM banner_materials;
DELETE FROM service_charges;
DELETE FROM frame_sizes;
DELETE FROM photo_sizes;
DELETE FROM customers;
