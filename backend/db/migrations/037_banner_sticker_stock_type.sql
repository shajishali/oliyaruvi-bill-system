-- Optional label for physical roll rows (e.g. vinyl, flex) — matches Stock table "Type" column
ALTER TABLE banner_stock ADD COLUMN stock_type TEXT DEFAULT '';
ALTER TABLE sticker_stock ADD COLUMN stock_type TEXT DEFAULT '';
