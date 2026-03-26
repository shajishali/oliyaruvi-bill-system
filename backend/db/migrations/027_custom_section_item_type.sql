-- Add item_type column for custom per-item type labels (e.g. "stamp printing", "Large")
ALTER TABLE custom_section_stock ADD COLUMN item_type TEXT DEFAULT '';
