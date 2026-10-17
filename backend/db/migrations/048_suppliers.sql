-- Supplier companies and purchase bills (materials bought for product making)
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

CREATE TABLE IF NOT EXISTS supplier_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    bill_number TEXT NOT NULL,
    bill_date DATE NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK(payment_method IN ('Cash', 'Bank', 'Credit')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_bills_number ON supplier_bills(bill_number);
CREATE INDEX IF NOT EXISTS idx_supplier_bills_date ON supplier_bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_supplier_bills_supplier ON supplier_bills(supplier_id);

CREATE TABLE IF NOT EXISTS supplier_bill_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT,
    unit_price REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (bill_id) REFERENCES supplier_bills(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_supplier_bill_items_bill ON supplier_bill_items(bill_id);
