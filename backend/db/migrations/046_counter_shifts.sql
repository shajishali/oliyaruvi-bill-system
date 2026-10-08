-- Who is at the counter, and for which part of the day.
CREATE TABLE IF NOT EXISTS counter_staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS counter_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    staff_name TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    work_date TEXT NOT NULL,
    FOREIGN KEY (staff_id) REFERENCES counter_staff(id)
);

CREATE INDEX IF NOT EXISTS idx_counter_shifts_date ON counter_shifts(work_date);

ALTER TABLE bills ADD COLUMN counter_staff_name TEXT;
ALTER TABLE bills ADD COLUMN counter_shift_id INTEGER;
