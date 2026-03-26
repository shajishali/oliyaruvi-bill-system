-- Track exact roll length remaining (in feet) for custom roll sections (e.g. cloth)
-- Existing UI shows "Sqft available" immediately after billing, so we need feet_remaining.

ALTER TABLE custom_section_stock ADD COLUMN feet_remaining REAL;

-- Initialize: for roll sections, feet_remaining = stock_qty * 150
-- For count sections, keep it NULL (UI falls back to stock_qty for non-roll sections).
UPDATE custom_section_stock
SET feet_remaining = stock_qty * 150
WHERE section_id IN (
    SELECT section_id FROM custom_sections WHERE section_type = 'roll'
);

