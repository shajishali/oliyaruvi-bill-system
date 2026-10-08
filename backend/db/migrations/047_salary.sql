CREATE TABLE IF NOT EXISTS salary_people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS salary_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL,
    person_name TEXT NOT NULL,
    pay_kind TEXT NOT NULL CHECK(pay_kind IN ('monthly', 'project')),
    pay_month TEXT,
    project_name TEXT,
    started_on TEXT,
    ended_on TEXT,
    paid_on TEXT NOT NULL,
    amount REAL NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES salary_people(id)
);

CREATE INDEX IF NOT EXISTS idx_salary_payments_month ON salary_payments(pay_month);
CREATE INDEX IF NOT EXISTS idx_salary_payments_paid_on ON salary_payments(paid_on);
