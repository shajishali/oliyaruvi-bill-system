-- Normalize banner_stock and sticker_stock size_name values:
-- strip "feet"/"ft" suffixes so they are stored as plain numbers ("6", "8", "10").
-- This ensures Stock page and Billing dropdown always agree on roll widths.

UPDATE banner_stock
SET size_name = TRIM(
  REPLACE(REPLACE(REPLACE(REPLACE(
    LOWER(TRIM(size_name)),
  ' feet', ''), 'feet', ''), ' ft', ''), 'ft', '')
)
WHERE LOWER(size_name) GLOB '*feet*' OR LOWER(size_name) GLOB '*ft*';

UPDATE sticker_stock
SET size_name = TRIM(
  REPLACE(REPLACE(REPLACE(REPLACE(
    LOWER(TRIM(size_name)),
  ' feet', ''), 'feet', ''), ' ft', ''), 'ft', '')
)
WHERE LOWER(size_name) GLOB '*feet*' OR LOWER(size_name) GLOB '*ft*';
