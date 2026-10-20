-- Shop notes: plain info, dated reminders (notify from 3 days before), and money notes
-- (optional day-collection increase/decrease).

CREATE TABLE IF NOT EXISTS shop_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_type TEXT NOT NULL CHECK(note_type IN ('plain', 'reminder', 'money')),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  remind_on DATE,
  money_direction TEXT CHECK(money_direction IS NULL OR money_direction IN ('in', 'out')),
  amount REAL,
  affect_collection INTEGER NOT NULL DEFAULT 0,
  collection_date DATE,
  expense_id INTEGER,
  collection_add_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shop_notes_type ON shop_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_shop_notes_remind ON shop_notes(remind_on);

-- Money put into the day collection (increases actual received / money box)
CREATE TABLE IF NOT EXISTS daily_collection_adds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  add_date DATE NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  note_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_collection_adds_date ON daily_collection_adds(add_date);

CREATE TABLE IF NOT EXISTS shop_note_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id INTEGER NOT NULL,
  remind_date DATE NOT NULL,
  notification_id INTEGER,
  UNIQUE(note_id, remind_date)
);
