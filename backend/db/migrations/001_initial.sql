-- Oliyaruvi Printers - Initial Database Schema
-- Phase 1: Database Design

-- Shop settings (editable by owner)
CREATE TABLE IF NOT EXISTS shop_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_name TEXT NOT NULL DEFAULT 'Oliyaruvi Printers',
    address TEXT,
    contact TEXT,
    gstin TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bills
CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number TEXT UNIQUE NOT NULL,
    bill_date DATE NOT NULL,
    customer_id INTEGER,
    customer_name TEXT NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('Cash', 'Bank')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON bills(bill_number);
CREATE INDEX IF NOT EXISTS idx_bills_bill_date ON bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON bills(customer_id);

-- Bill items
CREATE TABLE IF NOT EXISTS bill_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL,
    service_type TEXT NOT NULL CHECK(service_type IN ('banner', 'frame', 'photo')),
    item_name TEXT NOT NULL,
    size TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL,
    metadata TEXT,
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);

-- Banner materials (Flex, Sticker, Cloth)
CREATE TABLE IF NOT EXISTS banner_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_name TEXT NOT NULL UNIQUE,
    price_per_sqft REAL NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Frame sizes
CREATE TABLE IF NOT EXISTS frame_sizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    size_name TEXT NOT NULL UNIQUE,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Photo sizes
CREATE TABLE IF NOT EXISTS photo_sizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    size_name TEXT NOT NULL UNIQUE,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL,
    low_stock_threshold INTEGER NOT NULL DEFAULT 10,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service charges (design, pocket)
CREATE TABLE IF NOT EXISTS service_charges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    charge_type TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL DEFAULT 0,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Stock transaction audit log
CREATE TABLE IF NOT EXISTS stock_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type TEXT NOT NULL CHECK(item_type IN ('frame', 'photo')),
    item_id INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('add', 'reduce', 'adjust')),
    quantity INTEGER NOT NULL,
    previous_qty INTEGER NOT NULL,
    new_qty INTEGER NOT NULL,
    reason TEXT,
    user_action TEXT NOT NULL DEFAULT 'manual' CHECK(user_action IN ('manual', 'billing')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_transactions_item ON stock_transactions(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_created ON stock_transactions(created_at);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
