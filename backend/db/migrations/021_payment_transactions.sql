-- Track when money was actually received (for "actual amount received today")
-- Each payment (advance on bill create, or balance payment later) is recorded with date and method
CREATE TABLE IF NOT EXISTS payment_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    paid_at DATE NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('Cash', 'Bank')),
    payment_type TEXT NOT NULL CHECK(payment_type IN ('advance', 'balance')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES bills(id)
);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_paid_at ON payment_transactions(paid_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_bill_id ON payment_transactions(bill_id);

-- Backfill: existing bills with amount_paid > 0 (assume received on bill_date)
INSERT INTO payment_transactions (bill_id, amount, paid_at, payment_method, payment_type)
SELECT id, amount_paid, bill_date, COALESCE(payment_method, 'Cash'), 'advance'
FROM bills WHERE COALESCE(amount_paid, 0) > 0;
