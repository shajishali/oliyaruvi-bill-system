-- Partial payments + bill attachment for supplier purchase bills
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS supplier_bills_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    bill_number TEXT NOT NULL,
    bill_date DATE NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    amount_paid REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    notes TEXT,
    attachment_name TEXT,
    attachment_ext TEXT,
    attachment_mime TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

INSERT INTO supplier_bills_new (
  id, supplier_id, bill_number, bill_date, subtotal, total, amount_paid,
  payment_method, notes, created_at, updated_at
)
SELECT
  id, supplier_id, bill_number, bill_date, subtotal, total,
  CASE WHEN payment_method = 'Credit' THEN 0 ELSE COALESCE(total, 0) END,
  payment_method, notes, created_at, updated_at
FROM supplier_bills;

DROP TABLE supplier_bills;
ALTER TABLE supplier_bills_new RENAME TO supplier_bills;

CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_bills_number ON supplier_bills(bill_number);
CREATE INDEX IF NOT EXISTS idx_supplier_bills_date ON supplier_bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_supplier_bills_supplier ON supplier_bills(supplier_id);

CREATE TABLE IF NOT EXISTS supplier_bill_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    paid_on DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES supplier_bills(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_supplier_bill_payments_bill ON supplier_bill_payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_supplier_bill_payments_paid_on ON supplier_bill_payments(paid_on);

INSERT INTO supplier_bill_payments (bill_id, amount, payment_method, paid_on, notes)
SELECT id, amount_paid, payment_method, bill_date, 'Initial payment'
FROM supplier_bills
WHERE amount_paid > 0
  AND NOT EXISTS (
    SELECT 1 FROM supplier_bill_payments p WHERE p.bill_id = supplier_bills.id
  );

PRAGMA foreign_keys = ON;
