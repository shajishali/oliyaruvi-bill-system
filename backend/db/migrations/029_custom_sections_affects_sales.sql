-- Custom sections: affects_sales = 1 means items sold to customers (reduce stock on billing)
-- affects_sales = 0 means maintenance only (e.g. ink, supplies) - stock tracked but not reduced on billing
ALTER TABLE custom_sections ADD COLUMN affects_sales INTEGER NOT NULL DEFAULT 1;
