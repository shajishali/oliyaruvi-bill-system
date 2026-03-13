# Oliyaruvi Printers - Billing System Development Plan

## Project Overview

| Item | Value |
|------|-------|
| **Application** | Local Desktop Billing System (POS) |
| **Client** | Oliyaruvi Printers |
| **Environment** | Offline-first, shop PC without internet |
| **Tech Stack** | React + TailwindCSS \| Node.js + Express \| SQLite \| Electron |

---

## System Architecture (Reference)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ELECTRON DESKTOP WRAPPER                          │
├─────────────────────────────────────────────────────────────────────────┤
│  REACT FRONTEND  →  NODE.JS + EXPRESS BACKEND  →  SQLite DATABASE        │
│  (Dashboard | Billing | Stock | Notifications | Reports)                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Reference)

| Table | Purpose |
|-------|---------|
| shop_settings | Shop name, address, contact |
| customers | Customer records |
| bills | Bill headers |
| bill_items | Bill line items |
| banner_materials | Flex, Sticker, Cloth + price per sqft |
| frame_sizes | 12x18, 18x24, 24x36 + stock + price |
| photo_sizes | 4x6, 5x7, 6x8, 8x12 + stock + price |
| service_charges | Design charge, pocket charge |
| stock_transactions | Audit log for stock changes |
| notifications | Low stock, etc. |

---

## Project Folder Structure (Reference)

```
billingSystem/
├── package.json
├── phases.md
├── electron/          # Electron main, preload
├── frontend/         # React + TailwindCSS
├── backend/           # Node.js + Express
└── database/          # SQLite + migrations + seed
```

---

# PHASES AND SUBPHASES

---

## Phase 1: Database Design & Setup

**Goal:** SQLite schema, migrations, seed data.

| Subphase | Description |
|----------|-------------|
| **1.1** | Create `database/` folder and `.gitignore` for `*.db` |
| **1.2** | Create migration `001_initial.sql` with all tables (shop_settings, customers, bills, bill_items, banner_materials, frame_sizes, photo_sizes, service_charges, stock_transactions, notifications) |
| **1.3** | Add indexes on bills.bill_number, bills.bill_date, bill_items.bill_id, stock_transactions |
| **1.4** | Create `database/seed.sql` with default shop settings, banner materials, frame sizes, photo sizes, service charges |
| **1.5** | Create `backend/config/database.js` using better-sqlite3, run migrations and seed on init |

---

## Phase 2: Backend API

**Goal:** REST API for all modules.

| Subphase | Description |
|----------|-------------|
| **2.1** | Initialize Express, CORS, JSON parser, error handler, `GET /api/health` |
| **2.2** | Bills: `GET /api/bills`, `GET /api/bills/:id`, `POST /api/bills` (with bill items, stock reduction) |
| **2.3** | Customers: `GET /api/customers`, `GET /api/customers/search?q=`, `POST /api/customers`, `PUT /api/customers/:id` |
| **2.4** | Stock: `GET /api/stock/frames`, `GET /api/stock/photos`, `PUT /api/stock/frames/:id`, `PUT /api/stock/photos/:id`, `POST /api/stock/transactions`, `GET /api/stock/transactions` |
| **2.5** | Services: `GET /api/services/banner-materials`, `GET /api/services/frame-sizes`, `GET /api/services/photo-sizes`, `GET /api/services/charges`, `PUT` for updates |
| **2.6** | Settings: `GET /api/settings`, `PUT /api/settings` |
| **2.7** | Reports: `GET /api/reports/revenue?period=`, `GET /api/reports/revenue-trend`, `GET /api/reports/top-services`, `GET /api/reports/orders-today`, `GET /api/reports/low-stock` |
| **2.8** | Notifications: `GET /api/notifications`, `PUT /api/notifications/:id/read` |

---

## Phase 3: Billing UI

**Goal:** Full billing flow with printable bills.

| Subphase | Description |
|----------|-------------|
| **3.1** | Layout: Sidebar (Dashboard, Billing, Stock, Reports, Settings), Header, React Router |
| **3.2** | Billing form: Customer select/quick-add, service type (Banner / Frame / Photo) |
| **3.3** | Banner: Material, width, height (sqft calc), design charge, pocket count, pocket charge |
| **3.4** | Frame: Size dropdown, quantity, auto price |
| **3.5** | Photo: Size dropdown, quantity, auto price |
| **3.6** | Bill items table: Add/remove rows, subtotal, discount, total, payment method (Cash/Bank) |
| **3.7** | Bill template: Header (shop name, address, contact), bill info, items table, footer |
| **3.8** | Print: Print button, `@media print` CSS |
| **3.9** | Bill list: Search by number, customer, date; view/print existing bill |

---

## Phase 4: Stock Management UI

**Goal:** Owner manually adds, updates, reduces stock.

| Subphase | Description |
|----------|-------------|
| **4.1** | Stock page: Tabs for Frames, Photos, Banner Materials |
| **4.2** | Frames/Photos table: Size, stock, price, low-stock threshold, actions |
| **4.3** | Add stock: Modal with quantity, reason |
| **4.4** | Update stock: Edit quantity (direct or modal) |
| **4.5** | Reduce stock: Modal with quantity, reason (manual) |
| **4.6** | Banner materials: Edit price per sqft only |
| **4.7** | Stock transaction log: Date, item, type, qty, previous, new, reason, source |
| **4.8** | Low stock alerts: Badge/card, link to Stock |

---

## Phase 5: Dashboard Analytics

**Goal:** Revenue and order analytics with charts.

| Subphase | Description |
|----------|-------------|
| **5.1** | Revenue cards: Daily, weekly, monthly |
| **5.2** | Revenue trend chart: Line/bar for last 7 or 30 days |
| **5.3** | Top selling services chart: Pie or bar |
| **5.4** | Orders today count |
| **5.5** | Recent orders list (last 5–10) |
| **5.6** | Low stock alerts card with link to Stock |
| **5.7** | Notifications panel (optional) |

---

## Phase 6: Printing System

**Goal:** Reliable bill printing.

| Subphase | Description |
|----------|-------------|
| **6.1** | Print template: A4 layout, margins, typography |
| **6.2** | Print preview before print |
| **6.3** | Print flow: `window.print()` or Electron `webContents.print()` |
| **6.4** | Optional: Thermal receipt layout (80mm) |

---

## Phase 7: Electron Packaging

**Goal:** Standalone Windows desktop app.

| Subphase | Description |
|----------|-------------|
| **7.1** | Electron main process: Load React app, single window |
| **7.2** | Start backend from main process (child process or bundled) |
| **7.3** | DB path: `app.getPath('userData')/oliyaruvi.db` |
| **7.4** | First-run: Run migrations and seed if DB missing |
| **7.5** | electron-builder: Windows `.exe` installer, app name "Oliyaruvi Printers" |
| **7.6** | Scripts: `dev`, `build`, `dist` |

---

## Phase Dependencies

| Phase | Depends On |
|-------|------------|
| 1 | — |
| 2 | 1 |
| 3 | 2 |
| 4 | 2 |
| 5 | 2 |
| 6 | 3 |
| 7 | 1, 2, 3, 4, 5, 6 |

---

## Stock Management – Owner Responsibility

- **Add Stock:** Owner enters quantity to add (frames/photos)
- **Update Stock:** Owner corrects quantity
- **Reduce Stock:** Automatic on billing; manual for damage/wastage
- **Banner materials:** No stock; only price per sqft

---

*Document Version: 1.0*
