const db = require('../config/database');
const { log } = require('./activityLog');

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Insert a daily expense (reduces day money box / final revenue). */
function addDailyExpense(expenseDate, amount, description) {
  const date = String(expenseDate || '').slice(0, 10);
  const amt = roundMoney(amount);
  if (!date || amt <= 0) return null;
  const desc = description ? String(description).trim() : null;
  const result = db.prepare(`
    INSERT INTO daily_expenses (expense_date, amount, description)
    VALUES (?, ?, ?)
  `).run(date, amt, desc);
  const created = db.prepare('SELECT * FROM daily_expenses WHERE id = ?').get(result.lastInsertRowid);
  log('expense_added', 'expense', created.id, {
    expense_date: date,
    amount: amt,
    description: desc || '',
  });
  return created;
}

function wantsFromCollection(body) {
  const v = body?.from_collection;
  return v === true || v === 1 || v === '1' || v === 'true';
}

module.exports = { addDailyExpense, wantsFromCollection, roundMoney };
