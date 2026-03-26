const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { log } = require('../lib/activityLog');

const ALLOWED_LOG_ACTIONS = ['password_changed', 'user_registered', 'user_login'];

// Helper: get actual received (income) for a date, including fallback for bills missing in payment_transactions
function getActualReceivedForDate(date) {
  let byCash = 0;
  let byBank = 0;
  try {
    const rows = db.prepare(`
      SELECT payment_method, SUM(amount) as amt
      FROM payment_transactions
      WHERE paid_at = ?
      GROUP BY payment_method
    `).all(date);
    for (const r of rows) {
      const amt = r.amt || 0;
      if (r.payment_method === 'Cash') byCash = amt;
      else if (r.payment_method === 'Bank') byBank = amt;
    }
  } catch (_) {}

  // Fallback: bills with amount_paid but missing/partial in payment_transactions
  const bills = db.prepare(`
    SELECT id, amount_paid, payment_method FROM bills
    WHERE bill_date = ? AND COALESCE(amount_paid, 0) > 0
  `).all(date);
  for (const b of bills) {
    let txSum = 0;
    try {
      const row = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM payment_transactions WHERE bill_id = ?
      `).get(b.id);
      txSum = row?.s || 0;
    } catch (_) {}
    const missing = (b.amount_paid || 0) - txSum;
    if (missing > 0) {
      const method = (b.payment_method || 'Cash').toString().toLowerCase() === 'bank' ? 'Bank' : 'Cash';
      if (method === 'Bank') byBank += missing;
      else byCash += missing;
    }
  }
  return { byCash, byBank, total: byCash + byBank };
}

// Helper: get actual received (income) for a date range [from, to] inclusive
function getActualReceivedForDateRange(from, to) {
  let total = 0;
  try {
    const row = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as amt
      FROM payment_transactions
      WHERE paid_at >= ? AND paid_at <= ?
    `).get(from, to);
    total = row?.amt || 0;
  } catch (_) {}

  // Fallback: bills in range with amount_paid not fully in payment_transactions
  const bills = db.prepare(`
    SELECT id, amount_paid, payment_method FROM bills
    WHERE bill_date >= ? AND bill_date <= ? AND COALESCE(amount_paid, 0) > 0
  `).all(from, to);
  for (const b of bills) {
    let txSum = 0;
    try {
      const row = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM payment_transactions WHERE bill_id = ?
      `).get(b.id);
      txSum = row?.s || 0;
    } catch (_) {}
    const missing = (b.amount_paid || 0) - txSum;
    if (missing > 0) total += missing;
  }
  return total;
}

// Helper: sum of expenses in date range [from, to] inclusive
function getExpensesForDateRange(from, to) {
  try {
    const row = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM daily_expenses
      WHERE expense_date >= ? AND expense_date <= ?
    `).get(from, to);
    return row?.total || 0;
  } catch (_) {
    return 0;
  }
}

// Actual amount received today (Cash + Bank) - advance + balance payments, with fallback for missing tx
router.get('/actual-received-today', (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { total, byCash, byBank } = getActualReceivedForDate(today);
    res.json({ total, byCash, byBank, date: today });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Revenue by period
router.get('/revenue', (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    let sql, params = [];
    const now = new Date();

    if (period === 'daily') {
      const today = now.toISOString().slice(0, 10);
      sql = "SELECT COALESCE(SUM(total), 0) as revenue FROM bills WHERE bill_date = ?";
      params = [today];
    } else if (period === 'weekly') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const from = weekAgo.toISOString().slice(0, 10);
      const to = now.toISOString().slice(0, 10);
      sql = "SELECT COALESCE(SUM(total), 0) as revenue FROM bills WHERE bill_date >= ? AND bill_date <= ?";
      params = [from, to];
    } else if (period === 'monthly') {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      sql = "SELECT COALESCE(SUM(total), 0) as revenue FROM bills WHERE bill_date >= ?";
      params = [monthStart];
    } else {
      return res.status(400).json({ error: 'Invalid period: daily, weekly, monthly' });
    }

    const result = db.prepare(sql).get(...params);
    res.json({ revenue: result.revenue || 0, period });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Revenue trend (last N days)
router.get('/revenue-trend', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const from = new Date();
    from.setDate(from.getDate() - days);
    const fromStr = from.toISOString().slice(0, 10);

    const rows = db.prepare(`
      SELECT bill_date as date, SUM(total) as revenue
      FROM bills
      WHERE bill_date >= ?
      GROUP BY bill_date
      ORDER BY bill_date
    `).all(fromStr);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Top selling services
router.get('/top-services', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const rows = db.prepare(`
      SELECT service_type, item_name, SUM(quantity) as total_qty, SUM(subtotal) as total_revenue
      FROM bill_items
      GROUP BY service_type, item_name
      ORDER BY total_revenue DESC
      LIMIT ?
    `).all(limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Daily revenue: income (actual received) - outcome (expenses) for a given date
router.get('/daily-revenue', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    // Income: actual received (Cash + Bank) for that date, with fallback for missing tx
    const { total: income } = getActualReceivedForDate(date);

    // Outcome: sum of daily_expenses for that date
    let outcome = 0;
    try {
      const expenseRow = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM daily_expenses
        WHERE expense_date = ?
      `).get(date);
      outcome = expenseRow?.total || 0;
    } catch (_) {}

    const finalRevenue = income - outcome;
    res.json({
      date,
      income,
      outcome,
      finalRevenue,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Final revenue for any period: daily (date), weekly (from, to), monthly (month=YYYY-MM)
router.get('/final-revenue', (req, res) => {
  try {
    const { period = 'monthly', date, from, to, month } = req.query;
    let fromStr, toStr;

    if (period === 'daily') {
      const d = date || new Date().toISOString().slice(0, 10);
      fromStr = toStr = d;
    } else if (period === 'weekly') {
      const end = to ? new Date(to) : new Date();
      const start = from ? new Date(from) : (() => { const x = new Date(end); x.setDate(x.getDate() - 6); return x; })();
      fromStr = start.toISOString().slice(0, 10);
      toStr = end.toISOString().slice(0, 10);
    } else if (period === 'monthly') {
      const m = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const [y, mo] = m.split('-').map(Number);
      const start = new Date(y, mo - 1, 1);
      const end = new Date(y, mo, 0);
      fromStr = start.toISOString().slice(0, 10);
      toStr = end.toISOString().slice(0, 10);
    } else {
      return res.status(400).json({ error: 'Invalid period: daily, weekly, monthly' });
    }

    const income = getActualReceivedForDateRange(fromStr, toStr);
    const outcome = getExpensesForDateRange(fromStr, toStr);
    const finalRevenue = income - outcome;

    res.json({
      period,
      from: fromStr,
      to: toStr,
      date: period === 'daily' ? fromStr : undefined,
      month: period === 'monthly' ? fromStr.slice(0, 7) : undefined,
      income,
      outcome,
      finalRevenue,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Orders today
router.get('/orders-today', (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const count = db.prepare('SELECT COUNT(*) as count FROM bills WHERE bill_date = ?').get(today);
    res.json({ count: count.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/log-activity - Log auth/system events (whitelisted actions only)
router.post('/log-activity', (req, res) => {
  try {
    const { action_type, details } = req.body || {};
    if (!action_type || !ALLOWED_LOG_ACTIONS.includes(action_type)) {
      return res.status(400).json({ error: 'Invalid action_type' });
    }
    log(action_type, 'auth', null, details || {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Activity log by date (for owner reports)
router.get('/activity', (req, res) => {
  try {
    const { date, from, to } = req.query;
    let sql = 'SELECT * FROM activity_log WHERE 1=1';
    const params = [];

    if (date) {
      sql += ' AND date(created_at) = ?';
      params.push(date);
    }
    if (from) {
      sql += ' AND date(created_at) >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND date(created_at) <= ?';
      params.push(to);
    }
    sql += ' ORDER BY created_at DESC LIMIT 500';

    const rows = db.prepare(sql).all(...params);
    const activities = rows.map((r) => ({
      id: r.id,
      action_type: r.action_type,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      details: r.details ? JSON.parse(r.details) : null,
      created_at: r.created_at,
    }));
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Low stock (banner: feet_remaining <= 5 ft; frame/photo: stock_qty <= threshold)
router.get('/low-stock', (req, res) => {
  try {
    const frames = db.prepare(`
      SELECT 'frame' as type, id, size_name as name, stock_qty, low_stock_threshold
      FROM frame_sizes WHERE low_stock_threshold >= 0 AND stock_qty <= low_stock_threshold
    `).all();
    const photos = db.prepare(`
      SELECT 'photo' as type, id, size_name as name, stock_qty, low_stock_threshold
      FROM photo_sizes WHERE low_stock_threshold >= 0 AND stock_qty <= low_stock_threshold
    `).all();
    const photocopies = db.prepare(`
      SELECT 'photocopy' as type, id, size_name as name, stock_qty, low_stock_threshold
      FROM photocopy_sizes WHERE low_stock_threshold >= 0 AND stock_qty <= low_stock_threshold
    `).all();
    let banners = [];
    try {
      banners = db.prepare(`
        SELECT 'banner' as type, id, size_name as name, stock_qty, feet_remaining, low_stock_threshold
        FROM banner_stock WHERE low_stock_threshold >= 0 AND COALESCE(feet_remaining, stock_qty * 150) <= low_stock_threshold
      `).all();
    } catch (_) {}
    let stickers = [];
    try {
      stickers = db.prepare(`
        SELECT 'sticker' as type, id, size_name as name, stock_qty, feet_remaining, low_stock_threshold
        FROM sticker_stock WHERE low_stock_threshold >= 0 AND COALESCE(feet_remaining, stock_qty * 150) <= low_stock_threshold
      `).all();
    } catch (_) {}
    // Custom stock sections (e.g. stamp/momento/clothes tabs)
    // - section_type='count'  -> stock_qty <= low_stock_threshold
    // - section_type='roll'   -> feet_remaining <= low_stock_threshold (feet threshold)
    const customCount = db.prepare(`
      SELECT
        COALESCE(NULLIF(css.item_type, ''), cs.label) as type,
        css.id,
        css.size_name as name,
        css.stock_qty,
        css.low_stock_threshold
      FROM custom_section_stock css
      JOIN custom_sections cs ON cs.section_id = css.section_id
      WHERE cs.section_type = 'count'
        AND css.low_stock_threshold >= 0
        AND css.stock_qty <= css.low_stock_threshold
    `).all();

    let customRoll = [];
    try {
      customRoll = db.prepare(`
        SELECT
          COALESCE(NULLIF(css.item_type, ''), cs.label) as type,
          css.id,
          css.size_name as name,
          css.stock_qty,
          COALESCE(css.feet_remaining, css.stock_qty * 150) as feet_remaining,
          css.low_stock_threshold
        FROM custom_section_stock css
        JOIN custom_sections cs ON cs.section_id = css.section_id
        WHERE cs.section_type = 'roll'
          AND css.low_stock_threshold >= 0
          AND COALESCE(css.feet_remaining, css.stock_qty * 150) <= css.low_stock_threshold
      `).all();
    } catch (_) {}

    res.json([...frames, ...photos, ...photocopies, ...banners, ...stickers, ...customCount, ...customRoll]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
