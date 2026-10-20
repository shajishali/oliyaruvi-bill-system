-- Keep deleted programs for history / reports (hidden from calendar list)
ALTER TABLE programs ADD COLUMN deleted_at TEXT;
