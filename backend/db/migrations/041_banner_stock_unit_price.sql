-- Optional per–roll-row price override for billing (Rs/sqft or Rs/unit). NULL = use material catalog price.

ALTER TABLE banner_stock ADD COLUMN unit_price REAL;
ALTER TABLE banner_stock ADD COLUMN price_unit TEXT DEFAULT 'per_sqft';
