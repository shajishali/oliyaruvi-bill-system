-- Custom section sold item base price (per section, not per stock size)
-- For roll sections: used as Rs./sqft for all roll widths under this section.
-- For count sections: can also be used later, but currently pricing remains per custom_section_stock row.
ALTER TABLE custom_sections ADD COLUMN unit_price REAL NOT NULL DEFAULT 0;

