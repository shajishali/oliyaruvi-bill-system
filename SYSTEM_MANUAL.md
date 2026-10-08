# OLIYARUVI PRINTERS — system manual

This file explains how the billing system works. Read `FIX_IT_YOURSELF.md` in the same folder when something is broken and you need to repair it without Cursor.

The shop name on screen is **OLIYARUVI PRINTERS**. Do not rename it unless the shop itself changes.

---

## 1. What the program is

The program is a desktop billing system for the print shop. It is three programs working together:

| Part | Folder | Job |
| --- | --- | --- |
| Screen | `frontend` | React pages. This is what you click. |
| API | `backend` | Express server. This reads and writes the shop database. |
| Desktop window | `electron` | Opens the screen in its own window instead of a normal browser. |

The database is one SQLite file. There is no separate cloud database.

There are two different copies of the data. They are not the same file.

| How you opened the program | Database file | Screen address |
| --- | --- | --- |
| Development, from the project folder with `npm run dev` | `database\oliyaruvi.db` inside this project | `http://localhost:3000` |
| Installed setup (`Oliyaruvi Printers Setup 1.0.0.exe`) | `%APPDATA%\oliyaruvi-printers\oliyaruvi_clean.db` | A local file inside the installed app |

`%APPDATA%` on this PC is usually `C:\Users\Saji\AppData\Roaming`. If that database is not there, search the computer for `oliyaruvi_clean.db`. Do not delete either database to “clean” the system.

The development window and the installed app do not share login memory. Signing in on one does not sign in on the other. They also do not share the admin password if you changed it, because that password is saved in the browser storage of that window only.

---

## 2. How to start and stop it

From the project folder `d:\projects\Oliyaruvi_billing_system`:

```powershell
npm run dev
```

That starts three things:

1. The API on port **5000** (`backend`, command `node server.js`).
2. The screen on port **3000** (Vite). The screen sends `/api` calls to port 5000.
3. The Electron window, which loads `http://localhost:3000`.

Health check, in PowerShell, use `curl.exe` (plain `curl` is a different command):

```powershell
curl.exe http://127.0.0.1:5000/api/health
```

A healthy answer is `{"status":"ok","message":"Oliyaruvi Printers API"}`.

Stop the development program by closing the terminal that is running `npm run dev`, or press Ctrl+C in that terminal. Closing only the Electron window does not always stop the API.

The installed program starts its own API. You do not run `npm run dev` for the installed copy.

---

## 3. Folder map

```
Oliyaruvi_billing_system
  electron\main.js              desktop window, fresh-install signup, database path
  package.json                  version 1.0.0 and the setup-file settings
  frontend\src\pages            one file for each sidebar page
  frontend\src\components       pieces of those pages (bill form, stock tables, dashboard cards)
  frontend\src\api\client.ts    every call the screen makes to the API
  frontend\src\utils\shopReportPdf.ts   the PDF that is viewed, downloaded, and emailed
  backend\server.js             API entry. Port 5000.
  backend\routes                one file for each area (bills, stock, salary, ...)
  backend\config\database.js    opens the database and runs migrations
  backend\db\migrations         numbered SQL files. Each runs once.
  backend\db\setup-catalog.sql  first-install stock types and sizes only
  database\oliyaruvi.db         the live shop data while developing
  release\                      the setup .exe is stored here
```

Sidebar pages and the files behind them:

| Sidebar | Address | Main file |
| --- | --- | --- |
| Login / first account | `/` | `frontend\src\pages\Home.tsx` |
| Forgot admin password | `/forgot` | `frontend\src\pages\Forgot.tsx` |
| Dashboard | `/app` | `frontend\src\pages\Dashboard.tsx` |
| Billing | `/app/billing` | `frontend\src\pages\Billing.tsx` and `components\billing` |
| Day book | `/app/day-book` | `frontend\src\pages\DayBook.tsx` |
| Stock | `/app/stock` | `frontend\src\pages\StockManagement.tsx` |
| Prices | `/app/prices` | `frontend\src\pages\Prices.tsx` |
| Notifications | `/app/notifications` | `frontend\src\pages\Notifications.tsx` |
| Salary | `/app/salary` | `frontend\src\pages\Salary.tsx` |
| Settings | `/app/settings` | `frontend\src\pages\Settings.tsx` |

`Login.tsx` and `Register.tsx` exist, but the app sends those addresses back to `/`. The real login screen is `Home.tsx`.

---

## 4. Login, admin, and what is saved only on the PC

Two different logins exist.

### System login (the billing screen)

Stored only in that window’s `localStorage`, not in SQLite.

| Key | Meaning |
| --- | --- |
| `oliyaruvi_auth` | `true` while someone is signed in |
| `oliyaruvi_users` | the accounts: name, username, password |

The first account is created on the login screen: Name, Branch name, Username, Password. Password must be at least 6 characters. Username is 2 to 40 characters. After the first account exists, the register form is locked. Another person uses the same username and password.

Sign-in accepts the username, the saved name, or an old email, so an account created before the username change can still enter.

Sign out clears the system session and also the admin session.

The branch name typed at signup is saved through the API into shop settings. It is the name of this shop’s branch, not a new empty database.

### Admin login (Settings, Salary, and dangerous edits)

| Item | Where |
| --- | --- |
| Username | always `admin` (`frontend\src\constants\adminAuth.ts`) |
| Password | `localStorage` key `admin_password`. If that key is empty, the password in `adminAuth.ts` is used (`ADMIN_DEFAULT_PASSWORD`). |
| “Already entered admin” flag | `sessionStorage` key `admin_authenticated` |

Settings and Salary ask for the admin password before the page opens (`AdminGate`).

These actions ask again even if Settings was already opened:

- Edit or delete stock
- Edit or delete a price
- Edit, undo, or remove a branch transfer
- Delete a bill

These actions do **not** ask for admin:

- Save a new bill
- Edit an existing bill
- Add stock
- Add a new price
- Add an expense
- Record a balance payment
- Start or end a counter shift

Forgot password (`/forgot`) resets the **admin** password only. It emails a one-time code to `oliyaruviprinters@gmail.com`. It does not reset the system username password.

---

## 5. Dashboard

File: `frontend\src\components\dashboard\DailyRevenueCard.tsx` plus the other files in `frontend\src\components\dashboard`.

Top cards:

- **Actual received today** — cash plus bank that actually came in today (advances and later balance payments), not just the bill total.
- **Today’s bill total** — the total of bills dated today.
- **Weekly revenue** and **Monthly revenue** — bill totals for those ranges.
- **Total orders** — how many bills were created today.

### Final Revenue

Formula on the card:

**Income (money actually received) − Expenses = Final revenue**

Salary is not part of this subtraction. The day-book money box is also not this number.

Period buttons:

- **Monthly** — the calendar month you pick, for example October 2026 is `2026-10-01` to `2026-10-31`.
- **Weekly** — the chosen end date and the six days before it.
- **Daily** — that one date.

The expense list under the card is the expenses inside that same period. Add, edit, and delete work on the `daily_expenses` table. Deleting an expense asks you to confirm. It does not ask for the admin password.

**View report** and **Download PDF** build the full shop PDF for the period selected on the card. That is the same kind of PDF that Gmail receives. On the dashboard the dates follow the month, week, or day you selected. In Settings, View, Download, and Send to mail always use the last 7 days.

---

## 6. The shop PDF

Built only in `frontend\src\utils\shopReportPdf.ts`. The email, the Settings buttons, and the dashboard buttons all call `buildShopReport`. If the PDF is missing a section, change that file, not three copies.

The PDF title is **Shop report**. Sections, in order:

1. Summary: bills still on record, deleted bills, balance paid, new stock, price changes, income, expenses, profit.
2. Sales still on record, with pending amount.
3. Deleted bills.
4. Balance payments.
5. Bills edited.
6. New stock.
7. Stock changes and removals.
8. Price changes, including the old price and the new price when the change was logged.
9. Expenses.
10. Expense edits and deletions.
11. Branch transfers.
12. Salary.
13. Counter (who started and ended a shift).
14. Other changes.
15. Stock on hand now (current quantities, not only the changes).

Empty sections say **None in this period**.

The PDF does not list these, on purpose: user login, user registered, password changed, settings updated, the bill-created line (the bill itself is already in the sales table), and the expense-added line (the expense itself is already in the expenses table).

Price history is recorded only for changes made after price logging was added. Older price edits may be missing from the activity list. Current prices still show in the Prices page.

Activity rows come from `GET /api/reports/activity`. The PDF asks for up to 2000 rows.

---

## 7. Weekly email

Settings → **Weekly report email**.

| Field | Meaning |
| --- | --- |
| SMTP host | `smtp.gmail.com` |
| SMTP port | `587` |
| SMTP email | the Gmail address that sends |
| SMTP app password | a Google App Password, not the normal Gmail password |
| Receiver email | who receives the PDF |

The app password is created at `https://myaccount.google.com/apppasswords` after 2-Step Verification is on. It is stored in the database table `shop_settings`, columns `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password`, `report_receiver_email`. Do not copy that password into git, into a chat, or into this manual.

Buttons:

- **Save email settings** — writes the fields to `shop_settings`.
- **View report** — opens this week’s PDF inside the window. This week is today and the previous 6 days, using the PC’s local date.
- **Download report** — saves `shop-report-<from>-to-<to>.pdf`.
- **Send to mail** — saves the settings, builds that same PDF, and emails it. Nothing is sent on a timer. Monday sending is not automatic.

If Gmail is slow, the server waits up to 60 seconds to connect, 60 seconds for the greeting, and 120 seconds for the socket. It tries port 587, then port 465. It uses IPv4. A failed attempt does not mean the internet cable is unplugged.

Code: `backend\routes\settings.js` function for `POST /api/settings/send-report`.

---

## 8. Billing

Files: `frontend\src\components\billing\BillForm.tsx`, `BillList.tsx`, `PrintBill.tsx`, `PayBalanceModal.tsx`, `CounterDuty.tsx`. API: `backend\routes\bills.js`.

### Writing a bill

1. Type the customer name or phone. Matching customers pop up. Picking one fills the other field. Clearing the name clears the phone that belonged to it.
2. Add lines. Each line is a stock item or a priced service. Size text is stored as typed. `10+15` stays `10+15`. Do not change `+` into `x`.
3. Set discount, payment method (Cash or Bank), and advance if the customer is not paying the full amount.
4. **Save** creates the bill. Only then does stock go down.
5. If you leave the form without saving, stock does not change.

Bill numbers look like `BILL-20261008-001` (date plus a sequence for that day).

After a successful save or update, the form clears itself, including placeholders.

### Stock rules when a bill is saved

All of this is one database transaction in `backend\routes\bills.js`. If any line does not have enough stock, the whole bill is rejected and nothing is reduced.

| Line type | What goes down |
| --- | --- |
| Frame | `frame_sizes.stock_qty` by the quantity |
| Photo | `photo_sizes.stock_qty` by the quantity |
| Photocopy | `photocopy_sizes.stock_qty` by the quantity |
| Banner roll, priced per square foot | `banner_stock.feet_remaining`. Feet used is square feet divided by the roll width. A line priced per piece does not reduce the roll. |
| Sticker roll | same feet rule on `sticker_stock` |
| Custom count item | `custom_section_stock.stock_qty` |
| Custom roll item | feet remaining, same idea as banner |

Banner and sticker `stock_qty` is then set to the remaining feet divided by 150, rounded up. That number is a roll count for display. The feet column is the real remaining length.

Two lines of the same item on one unsaved bill are checked against the stock that would remain after the earlier line. The screen must not keep offering the original quantity after the first line has already used it.

### Edit, delete, print, balance

- **Edit** loads the bill back into the form. Saving puts the old stock back and then reduces stock for the new lines. Edit does not ask for the admin password.
- **Delete** asks for the admin password, then puts stock back using the original stock-transaction rows, removes the payment rows, and writes a `bill_deleted` activity line.
- **Print** uses `PrintBill.tsx` and the shop name, address, phone, GSTIN, and logo from Settings.
- **Pay balance** can be opened from the bill list or by searching the customer name or phone. The payment is stored in `payment_transactions` with type `balance`. The bill’s `amount_paid` increases. Pending is `total - amount_paid`. The payment is counted as income on the day it was paid, not on the original bill date.

The person at the counter is copied onto the bill from the open counter shift (`counter_staff_name`, `counter_shift_id`).

---

## 9. Counter

Shown on the billing page. API: `backend\routes\counter.js`. Tables: `counter_staff`, `counter_shifts`.

- Add the people who can stand at the counter.
- **Start** opens one shift for one person for today.
- **End** closes that shift.
- Bills saved while a shift is open store that person’s name.
- The PDF and the activity log can show who was at the counter.

Only one shift is active at a time. Starting another person ends the need to end the current one first if the API rejects a second open shift.

---

## 10. Day book

File: `frontend\src\pages\DayBook.tsx`. API: `GET /api/reports/day-book?date=YYYY-MM-DD`.

This page is for looking, not for typing new bills. Pick a date.

For that date it shows:

- Orders: each bill, with cash, bank, and pending.
- Money received that day, including a balance that was billed on an earlier day and paid today.
- Expenses for that day.
- **Money box** = cash and bank collected that day, minus that day’s expenses.

The money box is the cash drawer for the day. It is not profit. Salary is not inside the money box.

If a balance is paid on a later day:

- The original bill’s pending amount goes down.
- The paid amount is added on the payment date, with the reason that it is a later balance payment.
- It is not added again on the original bill date.

Clicking a bill or a date jumps to the related screen so the row is not only text.

---

## 11. Stock

File: `frontend\src\pages\StockManagement.tsx` and `frontend\src\components\stock`.

Sections that can appear:

| Section | Table | What you store |
| --- | --- | --- |
| Frames | `frame_sizes` | type (`frame_type`), size (`size_name`), quantity, unit price |
| Photos | `photo_sizes` | size, quantity, unit price |
| Photocopy | `photocopy_sizes` | size, quantity, unit price |
| Banner | `banner_stock` | type, width in feet (`size_name` such as `6` or `8`), feet remaining |
| Sticker | `sticker_stock` | type, width, feet remaining |
| Custom | `custom_sections` and `custom_section_stock` | a section you name, then count items or roll items |

Which tabs are visible is saved in `localStorage` key `STOCK_SECTIONS_KEY` (`frontend\src\constants\stockSections.ts`). On a brand-new install that key is empty, so the stock page turns on every section that already has rows. The first-install catalog has frame rows and banner rows, so Frames and Banner appear. Photos, photocopy, and sticker appear after you add a row there.

Adding an item shows previous types and sizes as chips. You can still type a new type or size. The chip value is the real stored text, not a reformatted size.

Low stock uses `low_stock_threshold`. A threshold of `-1` means “do not warn”. The first-install catalog uses `-1` so empty starter rows do not shout.

**Add** does not need admin. **Edit** and **Remove** do.

A stock transaction log records add, reduce, and billing reductions (`stock_transactions`).

### First-install catalog only

`backend\db\setup-catalog.sql` runs only when the database file is new (no `_migrations` table yet). It inserts:

- Frames: duro `10+15`, class `10+15`, class `10+8`, class degital `12 + 18`, duro `12 + 18`. Quantity 0, price 0.
- Banner type `banner`, widths `6` and `8`. Feet 0.

It does not insert bills, customers, salary, expenses, or prices. An update of the program must not run this file again. `runSeed` in `backend\config\database.js` returns immediately when the database already exists.

---

## 12. Branches and transfers

API: `backend\routes\branches.js`. UI: `frontend\src\components\stock\BranchTransfers.tsx`, opened from Stock.

A branch has a name, a place, and a phone. This shop’s own branch name is also in shop settings.

A transfer moves quantity from one branch record to another. Edit and Undo ask for the admin password. Undo puts the quantity back. The activity types are `branch_transfer`, `branch_transfer_edited`, and `branch_transfer_undone`.

---

## 13. Prices

File: `frontend\src\pages\Prices.tsx`. API: `backend\routes\services.js`.

Prices are separate from the stock quantity. Stock says how many pieces or feet you have. Prices say what to charge.

Main groups:

- Frame prices in `frame_pricing`. Audience is `st` (shown as ST) or local. The same size can have both an ST price and a local price.
- Banner materials and design banner sizes.
- Photo sizes and design photo sizes.
- Service items and sticker materials.
- Custom-section sale items.

When Frames is selected, previous types and sizes appear as chips, taken from existing prices and from frame stock. Typing a new type or size is still allowed.

Edit and delete ask for the admin password. The API writes `price_added`, `price_changed` (old price, new price, audience), or `price_removed` into the activity log. Those lines are what the PDF uses for “old price to new price”.

---

## 14. Notifications

File: `frontend\src\pages\Notifications.tsx`.

Two kinds:

1. **Low stock** — computed from current quantities (`GET /api/reports/low-stock`). Mark as read hides that alert until the quantity changes. The quantity itself is not changed. The memory is `localStorage` key `oliyaruvi_low_stock_read` (`frontend\src\utils\lowStockRead.ts`). The dashboard toast uses the same memory.
2. **System notifications** — rows from `GET /api/notifications`. Mark as read calls the API and sets them read in the database.

Mark all as read appears when more than one low-stock line is visible.

---

## 15. Salary

File: `frontend\src\pages\Salary.tsx` and `frontend\src\components\settings\SalaryManagement.tsx`. API: `backend\routes\salary.js`.

The page asks for the admin password first.

- People live in `salary_people`.
- A payment is either **monthly** (a month such as `2026-10`) or **project** (project name, start date, end date).
- Every payment has a paid-on date, an amount, and optional notes.
- The month summary lists each person, and the screen includes a date column.
- Deleting a person or a payment is logged.

Salary is not subtracted in Final Revenue and not subtracted in the day-book money box. It appears in the shop PDF under Salary.

---

## 16. Settings

File: `frontend\src\pages\Settings.tsx`. Admin password required.

- **Admin password** — saved on this PC only (`localStorage` `admin_password`).
- **System password** — changes the password inside `oliyaruvi_users` for an existing account. It does not create the first account. The first account is created on the login screen.
- **Shop details** — name, branch name, address, contact, GSTIN. These print on the bill.
- **Logo** — JPEG or PNG, stored by the API and shown with `ShopLogo`. Uploading uses a larger JSON limit (6 MB), same as sending the report.
- **Activity report** — pick a date and view what was logged that day. This is the short on-screen activity list, not the emailed PDF.
- **Weekly report email** — section 7 above.

Shop details and SMTP columns are on the single row `shop_settings` where `id = 1`.

---

## 17. Activity log

Table: `activity_log`. Writer: `backend\lib\activityLog.js`.

Every important change should call `log(action, entity, id, details)`. The PDF and the Settings activity list read this table. If a new button changes money or stock and does not call `log`, the PDF will not mention it.

Useful action names already used:

`bill_created`, `bill_edited`, `bill_deleted`, `bill_balance_paid`, `frame_created`, `frame_updated`, `photo_created`, `photo_updated`, `banner_created`, `banner_updated`, `banner_deleted`, `sticker_created`, `sticker_updated`, `sticker_deleted`, `stock_transaction`, `price_added`, `price_changed`, `price_removed`, `expense_added`, `expense_updated`, `expense_deleted`, `branch_created`, `branch_deleted`, `branch_transfer`, `branch_transfer_edited`, `branch_transfer_undone`, `salary_paid`, `salary_deleted`, `salary_person_added`, `salary_person_removed`, `counter_started`, `counter_ended`, `counter_staff_added`, `counter_staff_removed`.

---

## 18. Database rules

- Migrations are the files in `backend\db\migrations`. Names start with a number. `database.js` runs each file once and records the name in `_migrations`.
- Do not edit a migration that has already run on the shop database. Add a new file with the next number, for example `048_something.sql`.
- `backend\scripts\reset-db.js` deletes `database\oliyaruvi.db`. Do not run it on the shop computer. It destroys bills, stock, salary, and customers.
- A new database gets the migrations, then `setup-catalog.sql`. An existing database is left alone.
- `better-sqlite3` is a native module. The development API uses the copy built for Node. The setup file uses a copy rebuilt for Electron. `npm run dist` does that rebuild. Do not copy `node_modules` from a random folder over the top.

Tables you will meet most often:

`shop_settings`, `customers`, `bills`, `bill_items`, `payment_transactions`, `frame_sizes`, `frame_pricing`, `photo_sizes`, `photocopy_sizes`, `banner_stock`, `sticker_stock`, `custom_sections`, `custom_section_stock`, `custom_section_sale_items`, `daily_expenses`, `activity_log`, `stock_transactions`, `shop_branches`, `branch_transfers`, `counter_staff`, `counter_shifts`, `salary_people`, `salary_payments`, `notifications`, `_migrations`.

---

## 19. The setup file

Current installer:

`release\Oliyaruvi Printers Setup 1.0.0.exe`

Version number: `"version"` in the root `package.json`. The file name follows that version.

What the installer does:

- First run on a PC with no `oliyaruvi_clean.db`: Electron clears `localStorage`, the database is created, the catalog of frame and banner sizes is inserted, and the window opens on signup.
- A later install on a PC that already has `oliyaruvi_clean.db`: the database is not deleted, signup is not forced, and the catalog is not inserted again.
- Uninstall is set with `deleteAppDataOnUninstall: false`, so removing the program does not wipe the shop database.
- The live `database\oliyaruvi.db` is excluded from the installer (`!**/*.db` in `package.json`). Shop bills are not inside the setup file.
- `backend\.env` is excluded. Do not put real passwords in `.env.example`.

Rebuild after you change code:

```powershell
cd d:\projects\Oliyaruvi_billing_system
npm run dist
```

If Windows says `app.asar` is in use, close the installed app and any Electron window, then build into another folder and copy the exe back:

```powershell
npx.cmd electron-builder --win "--config.directories.output=release-build"
```

Copy `release-build\Oliyaruvi Printers Setup 1.0.0.exe` into `release`. Raise the version in `package.json` before an update so the file name changes and the old installer is not overwritten by mistake.

The development command `npm run dev` does not use the installed database. Testing a code change with `npm run dev` changes `database\oliyaruvi.db`. Testing the setup file changes `%APPDATA%\oliyaruvi-printers\oliyaruvi_clean.db`.

---

## 20. Small rules that are easy to break

- Keep size text exactly as the shop types it (`10+15`, `12 + 18`).
- Do not decrease stock while the bill is only being typed. Decrease on save. Put stock back on delete, and on edit before applying the new lines.
- Final revenue and the day-book money box are different numbers. Do not add salary into either one unless the shop explicitly changes that rule.
- The dashboard PDF follows the selected month, week, or day. The email PDF is always the last 7 local days.
- Admin username is `admin`. The system username is whatever was typed at signup. They are not the same account.
- Mark as read on low stock does not change the quantity.
- One API only should listen on port 5000. A second `node server.js` fails with `EADDRINUSE`, or worse, talks to the wrong database if `DATABASE_PATH` is set.

---

## 21. Set the project up on a PC that has no copy yet

You need Node.js 20 or newer (this shop has used Node 22). Check with:

```powershell
node -v
npm -v
```

From `d:\projects\Oliyaruvi_billing_system` install three places. `npm run dev` will not start if any one of them was skipped.

```powershell
npm install
cd frontend
npm install
cd ..\backend
npm install
cd ..
npm run dev
```

`backend\.env` is optional. It is only for the forgot-admin-password email. The weekly shop PDF does not read `.env`. It reads `shop_settings` in the database. Copy `backend\.env.example` to `backend\.env` only when OTP email must work. Do not commit `.env`.

Git remote for this project: `https://github.com/shajishali/oliyaruvi-bill-system.git`. The database, `node_modules`, `release\`, and `.env` are ignored. They are not on GitHub. Copying the GitHub folder onto a new PC does not bring the shop bills. Copy `database\oliyaruvi.db` yourself if that PC should see the same shop.

---

## 22. Memory keys on the PC

These are not in SQLite. Clearing site data or the File → Reset Account menu removes them. The installed app and the development window each have their own copy.

| Key | Storage | Holds |
| --- | --- | --- |
| `oliyaruvi_auth` | localStorage | `true` while the system user is signed in |
| `oliyaruvi_users` | localStorage | name, username, password of system accounts |
| `admin_password` | localStorage | admin password, if it was changed |
| `admin_authenticated` | sessionStorage | admin already accepted in this window session |
| `otp_pending` | localStorage | forgot-password step in progress |
| `stock-enabled-sections` | localStorage | which stock tabs are switched on |
| `stock-custom-labels` | localStorage | names of custom stock tabs |
| `price-manual-categories` | localStorage | extra price groups that are not stock sections |
| `oliyaruvi_low_stock_read` | localStorage | which low-stock alerts were marked read, and at which quantity |
| `shop-logo-v` | localStorage | cache-buster so a new logo shows immediately |

File menu → **Reset Account (Sign Out)** clears `localStorage` and reloads. The message on that menu is correct: billing data and prices in the database stay. Only the login memory on that window is removed. The shortcut is Ctrl+Shift+Delete.

---

## 23. Bill money, in order

A bill cannot be saved until a counter shift is open. The API answers `Choose who is at the counter before saving the bill.` Start the person on the billing page first.

For each line:

`line amount = quantity × unit price − line discount`

The bill then does:

`subtotal = sum of line amounts`

`total = subtotal − bill discount` (never below 0)

`amount_paid` starts as the advance, and cannot be more than the total.

`pending = total − amount_paid`

Payment method is only `Cash` or `Bank`.

A later balance payment adds to `amount_paid` and inserts a row in `payment_transactions` with `payment_type = balance` and `paid_at` equal to that day. Pending on the original bill goes down. Income on the payment day goes up.

If the phone matches a customer already in `customers`, that customer is reused (the newest row with that phone). If the phone is new, a customer row is created. If there is no phone, the bill can be saved with no customer id.

Service types you will see on `bill_items.service_type`: `frame`, `photo`, `photocopy`, `banner`, `banner_roll`, `sticker_roll`, `custom`, and older rows may still say values allowed by the first migration. The stock effect depends on the type plus the id inside `metadata` (`frame_id`, `banner_stock_id`, and so on). A line with no stock id is only a charge. Stock does not move.

The bill date is the server’s date at save time. The code uses `toISOString()`, which is UTC. Between midnight and about 5:30 in the morning in India, that UTC date is still the previous day. If a bill lands on yesterday only in the early morning, that is why. The fix is in `backend\routes\bills.js` where `bill_date` is set: use the local calendar day, the same way `localDay` works in `backend\routes\reports.js`.

Bill numbers: `BILL-` + `YYYYMMDD` + `-` + a three-digit sequence for that date.

---

## 24. Roll stock, with numbers

Frames, photos, and photocopy use a piece count. Quantity 2 removes 2 from `stock_qty`.

Banner, sticker, and custom **roll** sections store length in `feet_remaining`. The width is the size (`6` means 6 feet wide).

Example: a banner is 6 feet wide and 100 feet long. The bill line is 30 square feet, priced per square foot.

`feet used = 30 / 6 = 5`

`feet remaining = 100 − 5 = 95`

The screen’s roll count is `ceil(feet remaining / 150)`. 95 feet shows as 1 roll. 150 is only the display divisor. It is not a second stock pile.

A banner line with `pricing_unit = per_qty` does **not** reduce feet. Sticker lines do reduce feet. A custom section reduces stock only when `affects_sales` is on. A maintenance section such as ink can be off so billing does not consume it.

Not enough stock rejects the whole bill. No line is saved and no earlier line in that same save is kept.

---

## 25. Low stock

An item warns only when `low_stock_threshold` is 0 or more.

| Kind | Warns when |
| --- | --- |
| Frame, photo, photocopy, custom count | `stock_qty <= low_stock_threshold` |
| Banner, sticker, custom roll | `feet_remaining <= low_stock_threshold` |

Threshold `-1` means never warn. The first-install catalog uses `-1`.

Mark as read remembers `type:id` and the current amount (`qty:4` or `ft:10`). The toast and the Notifications page both hide it. Change the amount and the alert comes back. Mark as read does not write the database.

---

## 26. Dashboard charts and the printed bill

Besides Final Revenue, the dashboard shows:

- **Sales Revenue** — `RevenueChart.tsx`, from `GET /api/reports/revenue-trend`.
- **Service Breakdown** — `TopServicesChart.tsx`, from `GET /api/reports/top-services`.
- **Latest Orders** — `RecentOrders.tsx`.

The printed bill (`PrintBill.tsx`) uses shop name, address, contact, GSTIN, and logo from `shop_settings`, then the bill number, date, customer, lines, discount, total, paid, and pending. Change shop text in Settings, not inside the print file, unless the layout itself is wrong.

---

## 27. Two different emails

| Email | Purpose | Where the password lives |
| --- | --- | --- |
| Weekly shop PDF | Settings → Send to mail | Database `shop_settings.smtp_password` |
| Admin forgot-password OTP | `/forgot` | `backend\.env` keys `GMAIL_USER` and `GMAIL_APP_PWD` |

They can be the same Gmail account, but they are not the same setting. Filling SMTP on the Settings page does not make OTP work. Filling `.env` does not make Send to mail work.

OTP is accepted only for `RESET_EMAIL` (default `oliyaruviprinters@gmail.com`, also `FORGOT_PASSWORD_EMAIL` in `frontend\src\constants\adminAuth.ts`). The code must match on both sides. The one-time code lives in the API process memory for a short time. Restarting the API cancels a code that was just sent. Resend is a fallback only if `RESEND_KEY` is set and Gmail fails.

---

## 28. Every API

Base address in development: `http://127.0.0.1:5000/api`. The screen calls `/api/...` and Vite forwards it. The installed app calls `http://127.0.0.1:<apiPort>/api` because the page is a file, not port 3000. `apiPort` is chosen when Electron starts the API (`PORT=0` means “pick a free port”).

| Method and path | Use |
| --- | --- |
| GET `/health` | API is up |
| GET/POST `/bills`, GET/PUT/DELETE `/bills/:id` | list, create, read, edit, delete |
| PUT `/bills/:id/pay-balance` | record a later payment |
| GET/POST `/customers`, GET `/customers/search`, PUT `/customers/:id` | customers |
| GET `/counter`, POST `/counter/staff`, DELETE `/counter/staff/:id`, POST `/counter/start`, POST `/counter/end` | counter |
| GET/POST `/stock/frames`, `/photos`, `/photocopy`, `/banners`, `/stickers` | stock rows |
| PUT/DELETE `/stock/frames/:id` and the same for photos, photocopy, banners, stickers | edit or remove one row |
| GET/POST `/stock/transactions` | stock log and manual adjustments |
| GET/POST `/stock/custom-sections`, PUT/DELETE `/stock/custom-sections/:sectionId` | custom tabs |
| GET/POST/PUT/DELETE `/stock/custom-items` and `/stock/custom-sale-items` | custom stock and its prices |
| GET/POST `/services/frame-pricing`, PUT/DELETE `/services/frame-pricing/:id` | frame prices |
| GET/POST/PUT/DELETE `/services/service-items` and banner, sticker, design size routes | other prices |
| GET `/services/billable-items` | what the bill form is allowed to sell |
| GET/PUT `/settings`, PUT `/settings/branch-name`, GET/POST `/settings/logo` | shop card and logo |
| POST `/settings/send-report` | email the PDF |
| GET `/reports/final-revenue`, `/day-book`, `/activity`, `/low-stock`, `/revenue-trend`, `/top-services`, `/orders-today`, `/actual-received-today` | dashboard, day book, PDF, alerts |
| POST `/reports/log-activity` | extra activity line from the screen |
| GET/POST `/expenses`, PUT/DELETE `/expenses/:id` | expenses |
| GET/PUT `/notifications`, PUT `/notifications/:id/read`, PUT `/notifications/read-all` | system notifications |
| POST `/auth/request-otp`, POST `/auth/verify-otp` | admin password reset |
| GET/POST/PUT/DELETE `/branches` and `/branches/transfers` | branches |
| GET `/salary`, POST `/salary/people`, DELETE `/salary/people/:id`, POST `/salary/payments`, DELETE `/salary/payments/:id` | salary |

Frame create is also registered in `backend\server.js` (`POST /api/stock/frames`) so a trailing slash still hits it. If you change frame creation, change it in `server.js` and check `routes\stock.js` so the two do not disagree.

---

## 29. Migrations, short list

Each file in `backend\db\migrations` runs once. The number is the order. Do not edit a file that is already in the `_migrations` table.

| Files | What they added |
| --- | --- |
| 001–002 | shop, customers, bills, bill lines, frame and photo stock, banner materials |
| 003, 005, 010 | old sample-data cleanup. Already applied. Do not copy those deletes into a new file. |
| 004, 009, 011, 034, 035 | frame type, old Duro rows, frame prices |
| 006–007, 016, 021, 023 | advance, line discount, decimal quantity, payment rows |
| 008 | activity log |
| 012, 017, 028, 031, 033 | service items, sticker materials, custom sale prices |
| 013–015, 018–020, 036–038, 040–041 | banner and sticker stock, feet, width, type, price |
| 022 | daily expenses |
| 024 | photocopy stock |
| 025–027, 029–030, 032, 039 | custom sections, count versus roll, affects_sales |
| 042 | price audience ST or local |
| 043 | weekly report SMTP columns |
| 044–045 | branches and this shop’s branch name |
| 046 | counter staff and shifts, columns on bills |
| 047 | salary people and payments |

The next change is `048_something.sql`.

---

## 30. Installed window versus development window

| | Development | Installed setup |
| --- | --- | --- |
| Start | `npm run dev` | the Start menu shortcut |
| Screen | `http://localhost:3000` | `frontend\dist` inside the install, with `#/` |
| API | always port 5000 | a free port, passed as `apiPort` |
| Database | `database\oliyaruvi.db` | `%APPDATA%\oliyaruvi-printers\oliyaruvi_clean.db` |
| Code you edit | seen after save (screen) or API restart (backend) | seen only after a new setup is installed |

Electron allows one window. A second launch focuses the first. That lock is `requestSingleInstanceLock` in `electron\main.js`.

The installed page uses `base: './'` in `frontend\vite.config.js` so images and scripts load from the file path. Do not change that to `/` or the installed window goes blank.
