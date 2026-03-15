-- Add pricing type: per_sqft (banner, sticker, backlight) or per_qty (fixed price per unit)
ALTER TABLE banner_materials ADD COLUMN pricing_type TEXT DEFAULT 'per_sqft';
