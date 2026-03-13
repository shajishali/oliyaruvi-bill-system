const express = require('express');
const router = express.Router();
const db = require('../config/database');

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

// Low stock
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
    res.json([...frames, ...photos]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
