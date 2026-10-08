# Fix it yourself — OLIYARUVI PRINTERS

Use this when Cursor is not available. `SYSTEM_MANUAL.md` explains how the system is built. This file tells you how to find a fault and repair it on the PC.

Work in `d:\projects\Oliyaruvi_billing_system`. Edit with any editor (Cursor, VS Code, or Notepad). You do not need an AI subscription to change a file, restart the API, or build a new setup.

---

## 0. Do this before every repair

1. Copy the database to a safe folder before you change data or SQL.

Development database:

```powershell
Copy-Item "d:\projects\Oliyaruvi_billing_system\database\oliyaruvi.db" "d:\projects\Oliyaruvi_billing_system\database\oliyaruvi-backup.db"
```

Installed-app database, if the fault is in the setup program rather than in `npm run dev`:

```powershell
Copy-Item "$env:APPDATA\oliyaruvi-printers\oliyaruvi_clean.db" "$env:APPDATA\oliyaruvi-printers\oliyaruvi_clean-backup.db"
```

2. Never run `npm run reset-db` or `node backend\scripts\reset-db.js` on the shop PC. That deletes `database\oliyaruvi.db`.
3. Never delete `oliyaruvi.db` or `oliyaruvi_clean.db` to “start clean” if the shop already has bills.
4. Close `DATABASE_PATH` if a terminal still has it set. A leftover value sends the API at a different file and the screen looks empty.

```powershell
Remove-Item Env:DATABASE_PATH -ErrorAction SilentlyContinue
```

5. Change one thing, then check that one thing. Do not rewrite several pages at once.

---

## 1. See the error

| What you see | Where to look |
| --- | --- |
| Red message on a page | The text is the API `error` field. Search that sentence in `backend\routes`. |
| Blank dashboard, or “failed to fetch” | The API on port 5000 is stopped. Section 2. |
| Electron window opens and the page never loads | Frontend on port 3000 is stopped, or the installed app failed to start its own API. |
| A button does nothing | Open the page file from the table in section 4. Search for the button label. |
| The terminal running `npm run dev` | Scroll to the last lines. `ECONNREFUSED` means port 5000 is down. `EADDRINUSE` means two programs want port 5000. |

Check the API:

```powershell
curl.exe http://127.0.0.1:5000/api/health
```

`{"status":"ok"...}` means the API is up. Any other result means it is down or it is not this program.

Check which database that API is using. From `backend`:

```powershell
cd d:\projects\Oliyaruvi_billing_system\backend
node -e "const db=require('better-sqlite3')(require('./config/database') && '');"
```

Do not use that snippet. `database.js` opens the file as soon as it is loaded. Use this read-only check instead. Save it as `backend\scripts\peek.js`, run it, then you may delete it:

```javascript
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../database/oliyaruvi.db');
const db = new Database(dbPath, { readonly: true });
const bills = db.prepare('SELECT COUNT(*) AS c FROM bills').get();
const expenses = db.prepare('SELECT COUNT(*) AS c FROM daily_expenses').get();
console.log(dbPath);
console.log('bills', bills.c, 'expenses', expenses.c);
```

```powershell
cd d:\projects\Oliyaruvi_billing_system\backend
node scripts\peek.js
```

If `bills` is 0 but you know the shop has bills, the API is pointed at the wrong file. Unset `DATABASE_PATH` and restart (section 2).

---

## 2. Restart the API

The screen reloads by itself when you save a file under `frontend\src`. The API does **not**. After any change under `backend`, restart it.

If you only stop the process on port 5000, the `npm run dev` window will not start it again. Start it yourself:

```powershell
cd d:\projects\Oliyaruvi_billing_system\backend
Remove-Item Env:DATABASE_PATH -ErrorAction SilentlyContinue
powershell -NoProfile -ExecutionPolicy Bypass -File .\restart-backend.ps1
```

Leave that window open. It prints `Oliyaruvi Printers API running on http://localhost:5000`.

Only one of those windows should be running. If a second start says the port is in use, the first one is already the API. Do not start another.

The frontend is separate. If port 3000 is dead, in a second window:

```powershell
cd d:\projects\Oliyaruvi_billing_system\frontend
npm run dev
```

Full development start, when nothing is running:

```powershell
cd d:\projects\Oliyaruvi_billing_system
npm run dev
```

---

## 3. Screen change or API change

| You changed | What to do next | Who sees it |
| --- | --- | --- |
| A file in `frontend\src` | Save. The dev window refreshes. If it does not, reload the Electron window. | Only `npm run dev`, until you build a new setup. |
| A file in `backend` | Restart the API (section 2). | Only the API that you restarted. The installed setup still has the old API inside it. |
| `electron\main.js` or `package.json` | Build a new setup (section 12) and install it. | The installed program. |
| A new file in `backend\db\migrations` | Restart the API. It runs the new file once. | The database that API opens. |

The installed program does not read the project folder. Customers using the setup file keep the old behaviour until you install a new setup. Their database in AppData stays.

---

## 4. Which file to open

Search the project for the words on the button (for example `Send to mail` or `Add Expense`). Then use this map.

| Fault | Open this file |
| --- | --- |
| Login, username, first account | `frontend\src\pages\Home.tsx` and `frontend\src\contexts\AuthContext.tsx` |
| Admin password prompt | `frontend\src\components\admin\AdminPermission.tsx` and `frontend\src\constants\adminAuth.ts` |
| Settings will not open | `frontend\src\components\settings\AdminGate.tsx` |
| Forgot admin password / OTP email | `frontend\src\pages\Forgot.tsx` and `backend\routes\auth.js` |
| Dashboard cards | `frontend\src\components\dashboard\RevenueCards.tsx` |
| Final revenue, expenses, view/download PDF | `frontend\src\components\dashboard\DailyRevenueCard.tsx` |
| PDF contents | `frontend\src\utils\shopReportPdf.ts` |
| Send to mail | `frontend\src\pages\Settings.tsx` (`sendWeeklyMail`) and `backend\routes\settings.js` |
| Bill form, customer popup, clear after save | `frontend\src\components\billing\BillForm.tsx` |
| Bill list, edit, delete, pay balance | `frontend\src\components\billing\BillList.tsx` and `PayBalanceModal.tsx` |
| Printed bill | `frontend\src\components\billing\PrintBill.tsx` |
| Stock goes down or not | `backend\routes\bills.js` (search `reduceFrameStock`) |
| Counter people and shifts | `frontend\src\components\billing\CounterDuty.tsx` and `backend\routes\counter.js` |
| Day book | `frontend\src\pages\DayBook.tsx` and `day-book` in `backend\routes\reports.js` |
| Stock page, chips, sections | `frontend\src\pages\StockManagement.tsx` |
| Previous type/size chips | `frontend\src\components\stock\previousChoices.tsx` |
| Branch transfer | `frontend\src\components\stock\BranchTransfers.tsx` and `backend\routes\branches.js` |
| Prices | `frontend\src\pages\Prices.tsx` and `backend\routes\services.js` |
| Low-stock mark as read | `frontend\src\utils\lowStockRead.ts` and `frontend\src\pages\Notifications.tsx` |
| Salary | `frontend\src\components\settings\SalaryManagement.tsx` and `backend\routes\salary.js` |
| Shop logo, SMTP, activity list | `frontend\src\pages\Settings.tsx` and `backend\routes\settings.js` |
| Income and expense maths | `final-revenue` and `getActualReceivedForDateRange` in `backend\routes\reports.js` |
| First-install sizes | `backend\db\setup-catalog.sql` |
| Signup on a new PC, keep data on update | `electron\main.js` (`clearAuthStorage`, `DATABASE_PATH`) |
| Setup file name and version | root `package.json` (`version`, `build`) |

The screen calls the API through `frontend\src\api\client.ts`. If a button calls the wrong address, fix it there and in the matching `backend\routes` file.

---

## 5. Fault → what to do

### The window says it cannot reach the server

Port 5000 is down. Do section 2. Then reload the window.

If `curl.exe http://127.0.0.1:5000/api/health` works in a terminal but the window still fails, the screen is not on port 3000. Restart `npm run dev` from the project root.

### The shop looks empty (no bills, income 0) but you did not delete anything

The API opened the wrong database. Run the peek script in section 1.

- Development must print `d:\projects\Oliyaruvi_billing_system\database\oliyaruvi.db`.
- The installed app must print the AppData `oliyaruvi_clean.db`.

If the path is `backend\scripts\_setup_test.db` or anything else, close that API, run `Remove-Item Env:DATABASE_PATH`, and start it again with the restart script. Do not copy the empty file over the real database.

### Login says no account, but the shop was already using the program

System accounts live in `localStorage` of that window, key `oliyaruvi_users`. The development Electron window and the installed app do not share it.

On the affected window, open DevTools (View menu → Toggle Developer Tools), Console, and run:

```javascript
JSON.parse(localStorage.getItem('oliyaruvi_users'))
```

You will see the username and password. Sign in with the `username`, the `name`, or the old `email`.

If the list is `null`, this window never had an account. Create one on the signup screen only if this is a new PC. Do not create a second account on the PC that already has the shop database; the register form stays locked after the first account, which is correct.

### Admin password is rejected

Username is exactly `admin`.

The password is `localStorage.getItem('admin_password')`. If that is `null`, the password is `ADMIN_DEFAULT_PASSWORD` inside `frontend\src\constants\adminAuth.ts`.

To set a new one from DevTools on that same window:

```javascript
localStorage.setItem('admin_password', 'the-new-password')
```

Then open Settings again. This does not change the other window (dev versus installed).

Forgot password on `/forgot` only resets this admin password, and only if the OTP email to `oliyaruviprinters@gmail.com` is working (`backend\routes\auth.js`). If email is down, use the DevTools line above instead.

### Settings or Salary opens and immediately asks again

That is intended. `requestAdminPermission` asks every time for edits. `AdminGate` asks when the page opens. Enter `admin` and the admin password. Cancelling leaves the page locked. Nothing is broken.

### A bill is saved but stock does not go down

1. Confirm the bill exists in Billing. An unsaved form does not change stock.
2. Restart the API so `backend\routes\bills.js` is the file you think it is.
3. In `bills.js`, stock reduction is inside the `POST /` handler, after the comment `Stock reduction`. Frames, photos, and photocopy use quantity. Banner and sticker rolls use feet (`square feet / width`) only when the line is not priced per piece.
4. If the item has no `frame_id` / `banner` stock id, the line was saved as a plain charge and there is no stock row to reduce. Link the line to a stock item in `BillForm.tsx`.
5. If the API answered with an error such as not enough stock, the whole bill was refused. Read the red message.

Put stock back only by deleting the bill (admin password) or by editing the bill and saving. Do not also type a manual stock increase, or the quantity will be doubled.

### Two lines of the same item both use the full stock

The check is in `backend\routes\bills.js` while the bill is saved, and the form must subtract the quantity already typed on earlier lines before it allows another line. Search `BillForm.tsx` for the stock quantity of that item. The remaining amount shown to the user must be `stock on hand minus quantity already on this unsaved bill`.

### Edit bill succeeded but the old lines are still on screen

After a successful update, `BillForm.tsx` must clear the fields. Search for the success message. The clear must run after the API succeeds, not before.

### Balance paid on another day shows on the wrong day

Income uses `payment_transactions.paid_at`, not only `bills.bill_date`. The day book uses the same split: the original day keeps the bill, the later day receives the balance. Look at `getActualReceivedForDateRange` and the `day-book` handler in `backend\routes\reports.js`.

A date bug looks like October starting on 30 September. Dates must be the calendar day on this PC (`YYYY-MM-DD` from local year, month, and day). Do not use `toISOString().slice(0, 10)` for a month boundary. India is ahead of UTC, so that call moves the first of the month to the previous day. `localDay` in `reports.js` and in `DailyRevenueCard.tsx` is the correct helper.

### Final revenue does not match the PDF

They use the same income and expense functions when the dates match.

- Dashboard PDF dates = the period selected on the card (`report.from` and `report.to`).
- Email PDF dates = today and the previous 6 days (`thisWeekRange` in `shopReportPdf.ts`).

If you compare October’s card with the email, the numbers can differ. Compare the email with Settings → View report. Those two must match.

Salary is not inside Final Revenue. Do not add it unless the shop changes the rule in both `reports.js` and the PDF.

### PDF is missing a change you made

The PDF reads `activity_log`. The change must call `log(...)` from `backend\lib\activityLog.js`. Copy the pattern next to a similar action in that route file. Restart the API. Only changes made after the restart appear. Old rows cannot gain details that were not saved.

Then add the action name to `ACTION_LABELS` in `frontend\src\utils\shopReportPdf.ts`, and include those rows in the right section inside `buildShopReport`. If you only add the label, the row can fall into **Other changes**.

### View report does not open

`viewShopReport` in `shopReportPdf.ts` adds a full-screen layer (`shop-report-preview`) with the PDF inside. If the layer is missing, the browser blocked nothing; the function did not run. Check the red error under the button. A common cause is the API being down, because the PDF first calls `/api/reports/activity`, bills, stock, and expenses.

### Send to mail fails

Read the red text under the button.

| Message idea | Fix |
| --- | --- |
| Enter the Gmail address / receiver / app password | Fill Settings and click Save email settings. The password is an App Password, not the normal Gmail password. |
| Gmail was too slow / could not reach Gmail | Internet works, but Gmail did not answer in time. Click Send to mail again. The server already tries port 587 and then 465. |
| Username and Password not accepted | The app password was revoked. Create a new one at https://myaccount.google.com/apppasswords and paste it into SMTP app password. |
| The report could not be prepared | The PDF was empty. Open View report first. If View also fails, the API is down. |

The server log line starts with `[weekly-report]`. Look at the API terminal. It prints the port and the error code. It must not print the password. Do not add a `console.log` of `smtp_password`.

### Low stock will not go away, or came back

Mark as read stores a fingerprint of the current quantity in `localStorage` (`oliyaruvi_low_stock_read`). It does not change stock. If someone changes the quantity, the alert returns. That is correct.

To show every alert again, in DevTools:

```javascript
localStorage.removeItem('oliyaruvi_low_stock_read')
```

This memory is per window. Marking as read in the browser does not mark it read in Electron.

### Stock tabs disappeared

The visible tabs are `localStorage` key `stock-enabled-sections` (`STOCK_SECTIONS_KEY` in `frontend\src\constants\stockSections.ts`). Custom tab names are `stock-custom-labels`. If `stock-enabled-sections` was saved as an empty list, the page will not turn the tabs back on by itself. Remove it and reload Stock:

```javascript
localStorage.removeItem('stock-enabled-sections')
```

### Size `10+15` became `10x15` or `10X15`

Something formatted the size for display and then saved the formatted text. The value stored in the database and the chip must be the original string. `formatSizeDisplay` is for printing only. Search the file you just edited for `replace` on `+` or `toUpperCase` and remove that from the save path.

### Prices chips do not list the type you added in Stock

Frame chips are built from frame price rows plus `api.stock.frames()`. Reload Prices. If the type is only in stock, it still should appear. The code is in `Prices.tsx` (`framePriceChoices`). An empty type must not highlight every size chip; `previousChoices.tsx` ignores an empty selection.

### Day book letters are hard to read, or a click does nothing

Layout and links are in `frontend\src\pages\DayBook.tsx`. A click should navigate to Billing for a bill, or change the selected date. Do not add input boxes. This page is read-only.

### Expense saved on the wrong day

On the dashboard, Monthly and Weekly show a date field. That date must fall inside the period. The default date must be the period start in local time (`2026-10-01` for October), not the previous day. If it shows `2026-09-30`, the date helper used UTC. Use `localDay` in `DailyRevenueCard.tsx`.

### Logo does not change

The file is uploaded to `POST /api/settings/logo`. The screen caches it with `localStorage` key `shop-logo-v`. After a successful upload that number must change. The image address is built in `shopLogoUrl` in `frontend\src\api\client.ts`.

### New PC opens inside the old shop instead of signup

`electron\main.js` clears `localStorage` only when `oliyaruvi_clean.db` does not exist yet. If a previous install left that file in `%APPDATA%\oliyaruvi-printers`, the app correctly keeps it. To test signup you need a PC (or a Windows user) that does not already have that file. Do not delete it on the real shop PC.

### Update deleted the shop data

The installer must keep `deleteAppDataOnUninstall` false, and `runSeed` must return when `_migrations` already exists. If a bad build deleted the file, restore the backup from section 0. There is no cloud copy.

### `npm run dist` says app.asar is in use

Close Electron and the installed Oliyaruvi Printers. If it is still locked, build beside it:

```powershell
cd d:\projects\Oliyaruvi_billing_system
npx.cmd electron-builder --win "--config.directories.output=release-build"
```

Copy `release-build\Oliyaruvi Printers Setup <version>.exe` to `release\`.

### `better-sqlite3` fails after `npm install`

The native module was built for the wrong Node. From `backend`:

```powershell
npm rebuild better-sqlite3
```

Packaging rebuilds it again for Electron. A failure there is printed by `electron-builder` under `installing native dependencies`. Do not copy `better-sqlite3` from another project.

---

## 6. Safe database checks

Run from `backend`, read only. Replace the SQL with one question.

```powershell
cd d:\projects\Oliyaruvi_billing_system\backend
node -e "const Database=require('better-sqlite3'); const db=new Database('d:/projects/Oliyaruvi_billing_system/database/oliyaruvi.db',{readonly:true}); console.log(db.prepare('SELECT id, bill_number, bill_date, customer_name, total, amount_paid FROM bills ORDER BY id DESC LIMIT 10').all());"
```

PowerShell eats quotes inside `node -e` when the SQL is long. For anything longer, write `backend\scripts\peek.js` as in section 1, run `node scripts\peek.js`, and delete the script when you are finished. Do not leave a script that writes.

Useful reads:

```sql
SELECT id, bill_number, bill_date, customer_name, total, amount_paid FROM bills ORDER BY id DESC LIMIT 20;
SELECT id, expense_date, amount, description FROM daily_expenses ORDER BY expense_date DESC;
SELECT id, size_name, frame_type, stock_qty FROM frame_sizes;
SELECT id, size_name, stock_type, feet_remaining FROM banner_stock;
SELECT id, action_type, created_at FROM activity_log ORDER BY id DESC LIMIT 30;
SELECT name FROM _migrations ORDER BY name;
```

Changing a row by hand:

1. Backup first (section 0).
2. Stop the API so two programs are not writing.
3. Open the file with DB Browser for SQLite, or a short node script that is **not** `readonly`.
4. Change one row.
5. Start the API again.
6. Check the screen.

Do not `DELETE FROM bills` or `UPDATE frame_sizes SET stock_qty = 0` as a test. Stock and bills are the shop.

---

## 7. How to change a behaviour safely

Example: the PDF should show one more column.

1. Backup the database only if you will also touch SQL. A PDF text change does not need a backup, but a migration does.
2. Open `frontend\src\utils\shopReportPdf.ts`.
3. Find the `paint(...)` call for that section.
4. Add the column to the header array and to each body row.
5. Save. Reload the window. Click View report. Do not click Send to mail until the preview is right.
6. If the number comes from the API and the API does not send it, add it in the route, restart the API, then read it in the PDF file.

Example: stock edit should keep asking for admin.

The call is already `requestAdminPermission()` in `StockManagement.tsx`. If a new button must ask too, copy those two lines:

```javascript
if (!(await requestAdminPermission())) return;
```

Put them at the start of the click handler, before the API call. `AdminPermissionHost` must stay mounted in the layout. It is already included for the running app. Do not create a second password check with a different password.

Example: a new column in the database.

1. Add `backend\db\migrations\048_short_name.sql` (use the next free number).
2. Use `ALTER TABLE ... ADD COLUMN ...` or `CREATE TABLE IF NOT EXISTS`.
3. Do not change `001_initial.sql` or any file already listed in `_migrations`.
4. Restart the API.
5. Confirm with `SELECT name FROM _migrations ORDER BY name`.

---

## 8. Make a new setup after the fix

1. Raise `"version"` in the root `package.json` (`1.0.1`, then `1.0.2`). The setup file name uses that number.
2. From the project root:

```powershell
npm run dist
```

3. The installer is `release\Oliyaruvi Printers Setup <version>.exe`.
4. Install it on the shop PC over the old one. The AppData database stays. Signup does not appear again.
5. Check one bill you already know, one stock quantity, and Settings. If those three match the backup, the update kept the data.

A first install on a PC that has never had the app still starts at signup and loads only the frame and banner catalog from `setup-catalog.sql`.

---

## 9. What not to do when you are in a hurry

- Do not commit `backend\.env`, `database\oliyaruvi.db`, or a Gmail app password.
- Do not print `smtp_password` in a log.
- Do not run two APIs.
- Do not point `DATABASE_PATH` at a test file and then keep working.
- Do not “fix” a wrong total by editing the PDF text. Fix the number in `reports.js`, then let the PDF read it.
- Do not decrease stock in the form’s `onChange`. Decrease it only in `bills.js` when the bill is saved.
- Do not convert `10+15` while saving.
- Do not add salary into Final Revenue or the day-book money box as part of an unrelated fix.

If a repair is larger than one file, write down the file names before you edit. When the screen matches that note, stop.

---

## 10. Put the project back on a PC

```powershell
node -v
```

If this fails, install Node.js 20 or newer from https://nodejs.org and open a new PowerShell.

```powershell
cd d:\projects\Oliyaruvi_billing_system
npm install
cd frontend
npm install
cd ..\backend
npm install
cd ..
npm run dev
```

If `better-sqlite3` fails to compile:

```powershell
cd d:\projects\Oliyaruvi_billing_system\backend
npm rebuild better-sqlite3
```

You need the Visual Studio C++ build tools only if the rebuild says it cannot find a compiler. The usual case is a module built for another Node. Rebuild first.

---

## 11. Restore a backup

Stop the API (section 2) so the file is not open.

Development:

```powershell
Copy-Item "d:\projects\Oliyaruvi_billing_system\database\oliyaruvi-backup.db" "d:\projects\Oliyaruvi_billing_system\database\oliyaruvi.db" -Force
```

Installed app:

```powershell
Copy-Item "$env:APPDATA\oliyaruvi-printers\oliyaruvi_clean-backup.db" "$env:APPDATA\oliyaruvi-printers\oliyaruvi_clean.db" -Force
```

Start the API again. Open a bill you remember. If it is there, the restore worked. Do not restore a development backup over the AppData file, or the other way around. They are different copies when both have been used.

---

## 12. Free a stuck port

See what owns port 5000:

```powershell
Get-NetTCPConnection -LocalPort 5000 -State Listen | Select-Object OwningProcess
```

The restart script in section 2 already stops that process and starts one clean API. Use it. Do not leave two `node server.js` windows open.

Port 3000 is the screen:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess
```

If 3000 is stuck and the window is blank, stop that process from Task Manager (match the PID) and run `npm run dev` again from the project root.

`EADDRINUSE` means the port is taken. `ECONNREFUSED` means nothing is listening. They are opposite problems.

---

## 13. White or empty window

1. `curl.exe http://127.0.0.1:5000/api/health` must say `ok`.
2. Open `http://localhost:3000` in Chrome. If Chrome works and Electron does not, quit every Electron process and start `npm run dev` again.
3. If Chrome is also blank, read the last lines of the `npm run dev` terminal. A red Vite error names the file and the line. Open that file and fix the syntax you just typed. Save. Vite reloads.
4. Installed app blank, development app fine: the last `npm run dist` did not finish, or `vite.config.js` `base` was changed away from `'./'`. Put `base: './'` back, build again, reinstall.
5. Installed app says the backend failed: the native `better-sqlite3` inside the setup does not match Electron. Build again with `npm run dist` from the project root. Do not copy `node_modules` into `release` by hand.

View → Toggle Developer Tools shows the red line in the Console. That line is the real error. A message in the Console that names a file is more useful than the white page.

---

## 14. Read and write memory from Developer Tools

On the running window: View menu → Toggle Developer Tools → Console.

Read:

```javascript
JSON.parse(localStorage.getItem('oliyaruvi_users'))
localStorage.getItem('admin_password')
localStorage.getItem('stock-enabled-sections')
```

Set the admin password on this window only:

```javascript
localStorage.setItem('admin_password', 'the-new-password')
```

Sign out the system user without deleting the database:

```javascript
localStorage.removeItem('oliyaruvi_auth')
location.reload()
```

File → Reset Account does the same kind of clear for all `localStorage`. Use it when login memory is corrupt. You will have to sign in again. Bills stay.

---

## 15. Bill will not save

| Exact message | What to do |
| --- | --- |
| Choose who is at the counter before saving the bill. | On Billing, add the person if needed, click Start, then save again. The API refuses the bill with no open row in `counter_shifts`. |
| customer_name, items, and payment_method required | The form sent an empty name, no lines, or no Cash/Bank. |
| Not enough frame stock / banner stock / sticker stock | The line asks for more than `stock_qty` or remaining feet. Lower the quantity or add stock first. Nothing in that save was kept. |
| UNIQUE constraint failed: bills.bill_number | Two saves took the same number. Restart the API and save once. Do not insert a bill number by hand. |

A bill dated yesterday that was saved just after midnight in India is the UTC date bug in `backend\routes\bills.js` (`toISOString`). Replace that date with the local calendar day and restart the API. Do not “fix” it by editing every old bill.

---

## 16. OTP email and the weekly PDF are different

Weekly PDF broken, OTP fine: fix Settings SMTP and `backend\routes\settings.js`. Ignore `.env`.

OTP broken, weekly PDF fine: fix `backend\.env`.

```
GMAIL_USER=the-gmail-that-sends-the-code
GMAIL_APP_PWD=the-16-character-app-password
RESET_EMAIL=oliyaruviprinters@gmail.com
```

`RESET_EMAIL` must be the same address as `FORGOT_PASSWORD_EMAIL` in `frontend\src\constants\adminAuth.ts`. Restart the API after changing `.env`. The code is kept in memory. Restarting throws away a code that was already sent. Ask for a new code.

`backend\.env.example` must not contain `<<<<<<<` or `>>>>>>>`. Those are a broken merge. If you see them, the example file was not cleaned. Real values belong only in `.env`, never in git.

There is no Resend key required. Leave `RESEND_KEY` unset unless Gmail OTP is blocked and you have a Resend account.

---

## 17. SQLite errors you can hit

| Message | Meaning | Repair |
| --- | --- | --- |
| `SQLITE_BUSY` / database is locked | Two programs have the file open | Stop the extra `node server.js`. Close DB Browser if it is open. |
| `no such column` | The API is newer than the database | Restart the API so migrations run. If the column is in a new file you added, check the file name starts with the next number and ends in `.sql`. |
| `duplicate column name` | An old migration ran twice or you edited one that already ran | Do not re-run it. Add a new migration, or restore the backup if you edited an applied file. |
| `FOREIGN KEY constraint failed` | You deleted a parent the children still point at | Put the parent back from the backup, or delete the children first. Do not turn foreign keys off. |
| `CHECK constraint failed` | Payment method was not `Cash` or `Bank`, or salary `pay_kind` was not `monthly` or `project` | Send only those values. |

See which migrations ran:

```sql
SELECT name FROM _migrations ORDER BY name;
```

---

## 18. Day book or Final Revenue looks one day off

India is UTC+5:30. `toISOString().slice(0, 10)` moves local midnight to the previous UTC date.

Correct pattern, already used for Final Revenue:

```javascript
function localDay(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

Use that anywhere you turn “today” or “the first of the month” into text. After editing `backend\routes\reports.js` or `bills.js`, restart the API. After editing `DailyRevenueCard.tsx` only, reload the window.

Money box for a day is `cash + bank − expenses` for payments whose `paid_at` is that day. Salary is not in it. A balance paid today is in today’s money box even when the bill date is older.

---

## 19. Git, without Cursor

From the project folder:

```powershell
git status
git diff -- frontend/src/utils/shopReportPdf.ts
git log -5 --oneline
```

Commit only when you mean to keep a fix:

```powershell
git add frontend/src/utils/shopReportPdf.ts backend/routes/reports.js
git commit -m "Describe why the change was made"
```

Do not `git add database` or `backend\.env`. Do not `git push --force`. Do not `git reset --hard` unless you have a backup and you are sure the uncommitted work can be lost.

The GitHub copy does not contain the shop database. Pushing code does not back up bills. Copy `oliyaruvi.db` to another folder for that.

---

## 20. Check this after every repair

1. `curl.exe http://127.0.0.1:5000/api/health` returns `ok`.
2. The peek script prints the real database path and a bill count you recognise.
3. Sign in.
4. Open the page you changed. Do the one action. Confirm the number or the stock.
5. Open one page you did not change (Billing, or Stock) and confirm it still loads.
6. If you changed the PDF, use View report. Do not send mail until the preview is right.
7. If the shop uses the installed setup, this check on `npm run dev` is not enough. Build and install, then check the same bill on the installed window.

Stop when those pass. A second change in the same hour is how a working shop gets broken.

---

## 21. Quick card

| I need to… | Do this |
| --- | --- |
| Start work | `npm run dev` in the project folder |
| Apply a backend edit | `backend\restart-backend.ps1` with `DATABASE_PATH` unset |
| See why a button failed | DevTools Console, and the API terminal |
| See the shop data | `database\oliyaruvi.db` while developing |
| See the installed shop | `%APPDATA%\oliyaruvi-printers\oliyaruvi_clean.db` |
| Change what the PDF says | `frontend\src\utils\shopReportPdf.ts` |
| Change income maths | `backend\routes\reports.js` |
| Change stock on save | `backend\routes\bills.js` |
| Change who may click Edit or Delete | `requestAdminPermission()` in that component |
| Ship the fix to the shop PC | raise `version`, `npm run dist`, install the new setup |
| Undo a bad database edit | stop the API, copy the backup over the db, start the API |
