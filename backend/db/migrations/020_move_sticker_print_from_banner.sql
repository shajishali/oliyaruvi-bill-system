-- Move Sticker print from banner_materials to sticker_materials, then remove from banner
-- This removes Sticker print from the Banner section (it belongs in Sticker)
INSERT OR IGNORE INTO sticker_materials (material_name, price_per_sqft, pricing_type)
SELECT material_name, price_per_sqft, COALESCE(pricing_type, 'per_sqft')
FROM banner_materials
WHERE LOWER(TRIM(material_name)) = 'sticker print';

-- Remove banner_sizes that reference Sticker print (if any)
DELETE FROM banner_sizes WHERE material_id IN (
  SELECT id FROM banner_materials WHERE LOWER(TRIM(material_name)) = 'sticker print'
);

DELETE FROM banner_materials WHERE LOWER(TRIM(material_name)) = 'sticker print';
