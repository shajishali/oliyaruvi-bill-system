-- Separate SMTP mailbox for forgot-password / system mail (not the weekly report Gmail).
ALTER TABLE shop_settings ADD COLUMN auth_smtp_host TEXT NOT NULL DEFAULT 'smtp.gmail.com';
ALTER TABLE shop_settings ADD COLUMN auth_smtp_port TEXT NOT NULL DEFAULT '587';
ALTER TABLE shop_settings ADD COLUMN auth_smtp_user TEXT NOT NULL DEFAULT '';
ALTER TABLE shop_settings ADD COLUMN auth_smtp_password TEXT NOT NULL DEFAULT '';
