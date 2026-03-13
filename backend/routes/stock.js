const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET frame stock
router.get('/frames', (req, res) => {
  try {
    const frames = db.prepare('SELECT * FROM frame_sizes ORDER BY size_name').all();
    res.json(frames);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET photo stock
router.get('/photos', (req, res) => {
  try {
    const photos = db.prepare('SELECT * FROM photo_sizes ORDER BY size_name').all();
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update frame stock (manual)
router.put('/frames/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { stock_qty, unit_price, low_stock_threshold } = req.body;
    const frame = db.prepare('SELECT * FROM frame_sizes WHERE id = ?').get(id);
    if (!frame) return res.status(404).json({ error: 'Frame size not found' });

    const updates = [];
    const params = [];
    if (stock_qty !== undefined) { updates.push('stock_qty = ?'); params.push(stock_qty); }
    if (unit_price !== undefined) { updates.push('unit_price = ?'); params.push(unit_price); }
    if (low_stock_threshold !== undefined) { updates.push('low_stock_threshold = ?'); params.push(low_stock_threshold); }
    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

    params.push(id);
    db.prepare(`UPDATE frame_sizes SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT * FROM frame_sizes WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update photo stock (manual)
router.put('/photos/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { stock_qty, unit_price, low_stock_threshold } = req.body;
    const photo = db.prepare('SELECT * FROM photo_sizes WHERE id = ?').get(id);
    if (!photo) return res.status(404).json({ error: 'Photo size not found' });

    const updates = [];
    const params = [];
    if (stock_qty !== undefined) { updates.push('stock_qty = ?'); params.push(stock_qty); }
    if (unit_price !== undefined) { updates.push('unit_price = ?'); params.push(unit_price); }
    if (low_stock_threshold !== undefined) { updates.push('low_stock_threshold = ?'); params.push(low_stock_threshold); }
    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

    params.push(id);
    db.prepare(`UPDATE photo_sizes SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT * FROM photo_sizes WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST manual stock transaction (add/reduce/adjust)
router.post('/transactions', (req, res) => {
  try {
    const { item_type, item_id, transaction_type, quantity, reason } = req.body;
    if (!['frame', 'photo'].includes(item_type) || !item_id || !['add', 'reduce', 'adjust'].includes(transaction_type) || quantity == null) {
      return res.status(400).json({ error: 'Valid item_type, item_id, transaction_type, quantity required' });
    }

    const table = item_type === 'frame' ? 'frame_sizes' : 'photo_sizes';
    const item = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(item_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    let newQty = item.stock_qty;
    if (transaction_type === 'add') newQty += quantity;
    else if (transaction_type === 'reduce' || transaction_type === 'adjust') newQty -= quantity;
    if (newQty < 0) newQty = 0;

    db.prepare(`UPDATE ${table} SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(newQty, item_id);
    db.prepare(`
      INSERT INTO stock_transactions (item_type, item_id, transaction_type, quantity, previous_qty, new_qty, reason, user_action)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')
    `).run(item_type, item_id, transaction_type, quantity, item.stock_qty, newQty, reason || null);

    const updated = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(item_id);
    res.status(201).json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET stock transactions
router.get('/transactions', (req, res) => {
  try {
    const { item_type, item_id, limit = 100 } = req.query;
    let sql = 'SELECT * FROM stock_transactions WHERE 1=1';
    const params = [];
    if (item_type) { sql += ' AND item_type = ?'; params.push(item_type); }
    if (item_id) { sql += ' AND item_id = ?'; params.push(item_id); }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit) || 100);

    const transactions = db.prepare(sql).all(...params);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
