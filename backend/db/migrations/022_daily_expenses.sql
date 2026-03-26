-- Daily expenses for manual expense tracking (income - outcome = final revenue)
CREATE TABLE IF NOT EXISTS daily_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_date DATE NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_expenses_date ON daily_expenses(expense_date);
