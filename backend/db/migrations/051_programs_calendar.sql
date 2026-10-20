-- Shop programs / live events on the calendar
CREATE TABLE IF NOT EXISTS programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_type TEXT NOT NULL,
    location TEXT,
    customer_id INTEGER,
    customer_name TEXT NOT NULL DEFAULT '',
    phone TEXT,
    event_date TEXT NOT NULL,
    end_date TEXT,
    event_time TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_programs_event_date ON programs(event_date);
CREATE INDEX IF NOT EXISTS idx_programs_end_date ON programs(end_date);

-- Field-level edit history shown under the calendar
CREATE TABLE IF NOT EXISTS program_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER NOT NULL,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    summary TEXT NOT NULL,
    changes_json TEXT,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_program_history_program ON program_history(program_id);

-- One reminder notification per program per calendar day
CREATE TABLE IF NOT EXISTS program_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER NOT NULL,
    remind_date TEXT NOT NULL,
    notification_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(program_id, remind_date),
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
);
