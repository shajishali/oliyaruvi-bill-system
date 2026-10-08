-- Gmail SMTP and the address that receives the weekly shop PDF.
ALTER TABLE shop_settings ADD COLUMN smtp_host TEXT NOT NULL DEFAULT '';
ALTER TABLE shop_settings ADD COLUMN smtp_port TEXT NOT NULL DEFAULT '587';
ALTER TABLE shop_settings ADD COLUMN smtp_user TEXT NOT NULL DEFAULT '';
ALTER TABLE shop_settings ADD COLUMN smtp_password TEXT NOT NULL DEFAULT '';
ALTER TABLE shop_settings ADD COLUMN report_receiver_email TEXT NOT NULL DEFAULT '';
