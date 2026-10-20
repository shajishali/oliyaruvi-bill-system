-- Inter-branch work ledger (not shop income/profit).
-- Used to compare branch accounts at month-end and settle money between branches.

CREATE TABLE IF NOT EXISTS branch_work_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_date DATE NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('for_them', 'for_us')),
  branch_id INTEGER,
  branch_name TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'settled')),
  settled_on DATE,
  settlement_note TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_branch_work_date ON branch_work_entries(work_date);
CREATE INDEX IF NOT EXISTS idx_branch_work_branch ON branch_work_entries(branch_name);
CREATE INDEX IF NOT EXISTS idx_branch_work_status ON branch_work_entries(status);
