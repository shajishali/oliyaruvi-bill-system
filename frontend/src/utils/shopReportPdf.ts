import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from '../api/client';
import type { ActivityLogEntry } from '../types';

const ACTION_LABELS: Record<string, string> = {
  bill_created: 'Bill Created',
  bill_edited: 'Bill Edited',
  bill_deleted: 'Bill Deleted',
  bill_balance_paid: 'Balance Paid',
  frame_created: 'Frame Added',
  photo_created: 'Photo Added',
  photocopy_created: 'Photocopy Size Added',
  banner_created: 'Banner Added',
  sticker_created: 'Sticker Added',
  frame_updated: 'Frame Updated',
  photo_updated: 'Photo Updated',
  photocopy_updated: 'Photocopy Size Updated',
  banner_updated: 'Banner Updated',
  sticker_updated: 'Sticker Updated',
  banner_deleted: 'Banner Removed',
  sticker_deleted: 'Sticker Removed',
  photocopy_deleted: 'Photocopy Removed',
  custom_section_item_created: 'Custom Stock Added',
  custom_section_item_updated: 'Custom Stock Updated',
  custom_section_item_deleted: 'Custom Stock Removed',
  custom_section_cleared: 'Custom Section Cleared',
  stock_transaction: 'Stock Transaction',
  price_added: 'Price Added',
  price_changed: 'Price Changed',
  price_removed: 'Price Removed',
  expense_updated: 'Expense Updated',
  expense_deleted: 'Expense Deleted',
  branch_created: 'Branch Added',
  branch_deleted: 'Branch Removed',
  branch_transfer: 'Branch Transfer',
  branch_transfer_edited: 'Transfer Edited',
  branch_transfer_undone: 'Transfer Undone',
  salary_person_added: 'Salary Person Added',
  salary_person_removed: 'Salary Person Removed',
  salary_paid: 'Salary Paid',
  salary_deleted: 'Salary Payment Removed',
  counter_started: 'Counter Started',
  counter_ended: 'Counter Ended',
  counter_staff_added: 'Counter Person Added',
  counter_staff_removed: 'Counter Person Removed',
};

function money(value: number) {
  return `Rs.${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function stockName(row: Record<string, unknown>) {
  const type = String(row.frame_type || row.stock_type || row.item_type || '').trim();
  const size = String(row.size_name || row.name || '').trim();
  return [type, size].filter(Boolean).join(' · ') || 'Item';
}

function stockLeft(row: Record<string, unknown>) {
  if (row.feet_remaining != null && row.feet_remaining !== '') {
    return `${Number(row.feet_remaining).toFixed(0)} ft`;
  }
  return String(row.stock_qty ?? 0);
}

function stampDay(value: unknown) {
  return String(value || '').slice(0, 10);
}

function inRange(value: unknown, from: string, to: string) {
  const day = stampDay(value);
  return day >= from && day <= to;
}

function whenLabel(value: unknown) {
  const raw = String(value || '');
  if (!raw) return '';
  const parsed = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 16);
  return parsed.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function reportDetail(entry: ActivityLogEntry): string {
  const details = (entry.details || {}) as Record<string, unknown>;
  const bits: string[] = [];
  if (details.bill_number) bits.push(String(details.bill_number));
  if (details.customer_name) bits.push(String(details.customer_name));
  if (details.staff_name) bits.push(`counter ${details.staff_name}`);
  if (details.amount != null) bits.push(money(Number(details.amount)));
  if (details.payment_method) bits.push(String(details.payment_method));
  if (details.old_total != null && details.new_total != null) {
    bits.push(`${money(Number(details.old_total))} to ${money(Number(details.new_total))}`);
  } else if (details.total != null) {
    bits.push(money(Number(details.total)));
  }
  if (details.amount_paid != null && entry.action_type === 'bill_deleted') bits.push(`paid ${money(Number(details.amount_paid))}`);
  if (details.item_name) bits.push(String(details.item_name));
  if (details.name && !details.item_name) bits.push(String(details.name));
  if (details.size_name) bits.push(String(details.size_name));
  if (details.frame_type) bits.push(String(details.frame_type));
  if (details.item) bits.push(String(details.item));
  if (details.branch) bits.push(String(details.branch));
  if (details.direction) bits.push(String(details.direction));
  if (details.quantity != null) bits.push(`qty ${details.quantity}`);
  if (details.previous_qty != null && details.new_qty != null) bits.push(`${details.previous_qty} to ${details.new_qty}`);
  if (details.transaction_type) bits.push(String(details.transaction_type));
  if (details.reason) bits.push(String(details.reason));
  if (details.old_price != null || details.new_price != null) {
    const fromPrice = details.old_price != null ? money(Number(details.old_price)) : 'new';
    const toPrice = details.new_price != null ? money(Number(details.new_price)) : 'removed';
    bits.push(`${fromPrice} to ${toPrice}`);
  }
  if (details.price_audience) bits.push(String(details.price_audience) === 'st' ? 'ST' : 'Local');
  if (details.description) bits.push(String(details.description));
  if (details.project_name) bits.push(String(details.project_name));
  if (details.pay_kind) bits.push(String(details.pay_kind));
  if (details.pay_month) bits.push(String(details.pay_month));
  if (details.rows_removed != null) bits.push(`${details.rows_removed} rows`);
  if (details.updates && typeof details.updates === 'object') {
    const updates = details.updates as Record<string, unknown>;
    if (updates.stock_qty != null) bits.push(`stock ${updates.stock_qty}`);
    if (updates.unit_price != null) bits.push(`price ${money(Number(updates.unit_price))}`);
    if (updates.frame_type) bits.push(String(updates.frame_type));
  }
  return bits.filter(Boolean).join(' · ') || ACTION_LABELS[entry.action_type] || entry.action_type;
}

function activityRows(entries: ActivityLogEntry[]) {
  return entries
    .slice()
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map((entry) => [whenLabel(entry.created_at), ACTION_LABELS[entry.action_type] || entry.action_type, reportDetail(entry)]);
}

export function localDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function thisWeekRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return { from: localDate(start), to: localDate(end) };
}

export function shopReportFileName(from: string, to: string) {
  return `shop-report-${from}-to-${to}.pdf`;
}

export function shopReportBase64(doc: jsPDF) {
  const dataUri = doc.output('datauristring');
  const comma = dataUri.indexOf(',');
  return comma >= 0 ? dataUri.slice(comma + 1) : dataUri;
}

export function viewShopReport(doc: jsPDF) {
  const url = String(doc.output('bloburl'));
  document.getElementById('shop-report-preview')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'shop-report-preview';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.72);display:flex;flex-direction:column;padding:16px;';
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
  const title = document.createElement('p');
  title.textContent = 'Shop report';
  title.style.cssText = 'color:white;font-weight:600;margin:0;';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.style.cssText = 'background:#b91c1c;color:white;border:0;border-radius:8px;padding:8px 16px;font-weight:600;cursor:pointer;';
  close.onclick = () => {
    URL.revokeObjectURL(url);
    wrap.remove();
  };
  const frame = document.createElement('iframe');
  frame.src = url;
  frame.title = 'Shop report';
  frame.style.cssText = 'flex:1;width:100%;border:0;border-radius:8px;background:white;';
  bar.append(title, close);
  wrap.append(bar, frame);
  document.body.appendChild(wrap);
}

export function downloadShopReport(doc: jsPDF, from: string, to: string) {
  doc.save(shopReportFileName(from, to));
}

export async function buildShopReport(from: string, to: string) {
  const [report, expenses, bills, activities, framePrices, frames, photos, photocopy, banners, stickers, custom] = await Promise.all([
    api.reports.finalRevenue({ period: 'weekly', from, to }),
    api.expenses.list({ from, to }),
    api.bills.list({ from, to }),
    api.reports.activity({ from, to, limit: '2000' }),
    api.services.framePricing() as Promise<Record<string, unknown>[]>,
    api.stock.frames() as Promise<Record<string, unknown>[]>,
    api.stock.photos() as Promise<Record<string, unknown>[]>,
    api.stock.photocopy() as Promise<Record<string, unknown>[]>,
    api.stock.banners() as Promise<Record<string, unknown>[]>,
    api.stock.stickers() as Promise<Record<string, unknown>[]>,
    api.stock.customItems() as Promise<Record<string, unknown>[]>,
  ]);

  const ofType = (...types: string[]) => activities.filter((entry) => types.includes(entry.action_type));
  const deletedBills = ofType('bill_deleted');
  const balancePayments = ofType('bill_balance_paid');
  const editedBills = ofType('bill_edited');
  const newStock = ofType('frame_created', 'photo_created', 'photocopy_created', 'banner_created', 'sticker_created', 'custom_section_item_created');
  const stockChanges = ofType(
    'stock_transaction', 'frame_updated', 'photo_updated', 'photocopy_updated', 'banner_updated', 'sticker_updated',
    'custom_section_item_updated', 'banner_deleted', 'sticker_deleted', 'photocopy_deleted', 'custom_section_item_deleted', 'custom_section_cleared'
  );
  const priceChanges = ofType('price_added', 'price_changed', 'price_removed');
  const transfers = ofType('branch_transfer', 'branch_transfer_edited', 'branch_transfer_undone', 'branch_created', 'branch_deleted');
  const salary = ofType('salary_paid', 'salary_deleted', 'salary_person_added', 'salary_person_removed');
  const counter = ofType('counter_started', 'counter_ended', 'counter_staff_added', 'counter_staff_removed');
  const expenseChanges = ofType('expense_updated', 'expense_deleted');
  const used = new Set([
    ...deletedBills, ...balancePayments, ...editedBills, ...newStock, ...stockChanges, ...priceChanges,
    ...transfers, ...salary, ...counter, ...expenseChanges,
  ].map((entry) => entry.id));
  const skipped = new Set(['user_login', 'user_registered', 'password_changed', 'settings_updated', 'bill_created', 'expense_added']);
  const other = activities.filter((entry) => !used.has(entry.id) && !skipped.has(entry.action_type));
  const balanceTotal = balancePayments.reduce((sum, entry) => sum + Number((entry.details || {}).amount || 0), 0);
  const pending = bills.reduce((sum, bill) => sum + Math.max(0, Number(bill.total || 0) - Number(bill.amount_paid || 0)), 0);
  const pricesOnFile = framePrices
    .filter((row) => inRange(row.updated_at, from, to))
    .map((row) => [
      whenLabel(row.updated_at),
      'Price on file',
      `${[row.subitem_name || row.frame_type, row.size_name].filter(Boolean).join(' ')} · ${String(row.price_audience) === 'st' ? 'ST' : 'Local'} · ${money(Number(row.unit_price || 0))}`,
    ]);

  const doc = new jsPDF();
  const paint = (title: string, head: string[], body: string[][]) => {
    let y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 36;
    y += 10;
    if (y > 250) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(title, 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [head],
      body: body.length ? body : [head.map((_, index) => (index === 0 ? 'None in this period' : '—'))],
      theme: 'grid',
      styles: { fontSize: 8, overflow: 'linebreak' },
      headStyles: { fillColor: [75, 25, 25] },
    });
  };

  doc.setFontSize(16);
  doc.text('OLIYARUVI PRINTERS', 14, 16);
  doc.setFontSize(12);
  doc.text('Shop report', 14, 24);
  doc.setFontSize(10);
  doc.text(`${from} to ${to}`, 14, 30);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 36);

  autoTable(doc, {
    startY: 42,
    head: [['Bills', 'Deleted', 'Balance paid', 'New stock', 'Price changes', 'Income', 'Expenses', 'Profit']],
    body: [[
      String(bills.length),
      String(deletedBills.length),
      money(balanceTotal),
      String(newStock.length),
      String(priceChanges.length + pricesOnFile.length),
      money(report.income),
      money(report.outcome),
      money(report.finalRevenue),
    ]],
    theme: 'grid',
    styles: { fontSize: 7 },
    headStyles: { fillColor: [75, 25, 25] },
  });

  paint(
    `Sales still on record · pending ${money(pending)}`,
    ['Date', 'Bill', 'Customer', 'Total', 'Paid', 'Pending'],
    bills.map((bill) => {
      const total = Number(bill.total || 0);
      const paid = Number(bill.amount_paid || 0);
      return [bill.bill_date, bill.bill_number, bill.customer_name || '', money(total), money(paid), money(Math.max(0, total - paid))];
    })
  );
  paint('Deleted bills', ['When', 'What', 'Details'], activityRows(deletedBills));
  paint('Balance payments', ['When', 'What', 'Details'], activityRows(balancePayments));
  paint('Bills edited', ['When', 'What', 'Details'], activityRows(editedBills));
  paint('New stock', ['When', 'What', 'Details'], activityRows(newStock));
  paint('Stock changes and removals', ['When', 'What', 'Details'], activityRows(stockChanges));
  paint('Price changes', ['When', 'What', 'Details'], [...activityRows(priceChanges), ...pricesOnFile]);
  paint(
    'Expenses',
    ['Date', 'Amount', 'Description'],
    expenses.map((expense) => [expense.expense_date, money(expense.amount), expense.description || ''])
  );
  paint('Expense edits and deletions', ['When', 'What', 'Details'], activityRows(expenseChanges));
  paint('Branch transfers', ['When', 'What', 'Details'], activityRows(transfers));
  paint('Salary', ['When', 'What', 'Details'], activityRows(salary));
  paint('Counter', ['When', 'What', 'Details'], activityRows(counter));
  paint('Other changes', ['When', 'What', 'Details'], activityRows(other));

  const stockRows = [
    ...frames.map((row) => ['Frames', stockName(row), stockLeft(row)]),
    ...photos.map((row) => ['Photo', stockName(row), stockLeft(row)]),
    ...photocopy.map((row) => ['Photocopy', stockName(row), stockLeft(row)]),
    ...banners.map((row) => ['Banner', stockName(row), stockLeft(row)]),
    ...stickers.map((row) => ['Sticker', stockName(row), stockLeft(row)]),
    ...custom.map((row) => [String(row.item_type || 'Custom'), stockName(row), stockLeft(row)]),
  ];
  paint('Stock on hand now', ['Section', 'Item', 'Left'], stockRows);
  return doc;
}
