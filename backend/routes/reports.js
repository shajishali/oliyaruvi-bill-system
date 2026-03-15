const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Actual amount received today (Cash + Bank) - for advance payments, only amount_paid counts
router.get('/actual-received-today', (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    let total = 0;
    let byCash = 0;
    let byBank = 0;
    try {
      const rows = db.prepare(`
        SELECT payment_method, SUM(amount) as amt
        FROM payment_transactions
        WHERE paid_at = ?
        GROUP BY payment_method
      `).all(today);
      for (const r of rows) {
        const amt = r.amt || 0;
        total += amt;
        if (r.payment_method === 'Cash') byCash = amt;
        else if (r.payment_method === 'Bank') byBank = amt;
      }
    } catch (_) {
      // Fallback: use amount_paid from bills created today (no payment_transactions table)
      const bills = db.prepare('SELECT amount_paid, payment_method FROM bills WHERE bill_date = ? AND COALESCE(amount_paid, 0) > 0').all(today);
      for (const b of bills) {
        const amt = b.amount_paid || 0;
        total += amt;
        if (b.payment_method === 'Cash') byCash += amt;
        else if (b.payment_method === 'Bank') byBank += amt;
      }
    }
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
      FROM frame_sizes WHERE stock_qty <= low_stock_threshold
    `).all();
    const photos = db.prepare(`
      SELECT 'photo' as type, id, size_name as name, stock_qty, low_stock_threshold
      FROM photo_sizes WHERE stock_qty <= low_stock_threshold
    `).all();
    let banners = [];
    try {
      banners = db.prepare(`
        SELECT 'banner' as type, id, size_name as name, stock_qty, feet_remaining, low_stock_threshold
        FROM banner_stock WHERE COALESCE(feet_remaining, stock_qty * 150) <= COALESCE(low_stock_threshold, 10)
      `).all();
    } catch (_) {}
    let stickers = [];
    try {
      stickers = db.prepare(`
        SELECT 'sticker' as type, id, size_name as name, stock_qty, feet_remaining, low_stock_threshold
        FROM sticker_stock WHERE COALESCE(feet_remaining, stock_qty * 150) <= COALESCE(low_stock_threshold, 10)
      `).all();
    } catch (_) {}
    res.json([...frames, ...photos, ...banners, ...stickers]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
