-- Add advance/partial payment support
-- amount_paid: total amount received so far (advance + any balance payments)
ALTER TABLE bills ADD COLUMN amount_paid REAL NOT NULL DEFAULT 0;
