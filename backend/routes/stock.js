const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { log } = require('../lib/activityLog');

// POST create new frame size
router.post('/frames', (req, res) => {
  try {
    const { size_name, frame_type = 'Standard', stock_qty = 0, unit_price = 0, low_stock_threshold = 5 } = req.body;
    if (!size_name || !size_name.trim()) return res.status(400).json({ error: 'size_name required' });
    const result = db.prepare(`
      INSERT INTO frame_sizes (size_name, frame_type, stock_qty, unit_price, low_stock_threshold)
      VALUES (?, ?, ?, ?, ?)
    `).run(size_name.trim(), (frame_type || 'Standard').trim(), stock_qty || 0, unit_price || 0, low_stock_threshold || 5);
    const created = db.prepare('SELECT * FROM frame_sizes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create new photo size
router.post('/photos', (req, res) => {
  try {
    const { size_name, stock_qty = 0, unit_price = 0, low_stock_threshold = 5 } = req.body;
    if (!size_name || !size_name.trim()) return res.status(400).json({ error: 'size_name required' });
    const result = db.prepare(`
      INSERT INTO photo_sizes (size_name, stock_qty, unit_price, low_stock_threshold)
      VALUES (?, ?, ?, ?)
    `).run(size_name.trim(), stock_qty || 0, unit_price || 0, low_stock_threshold || 5);
    const created = db.prepare('SELECT * FROM photo_sizes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET frame stock
router.get('/frames', (req, res) => {
  try {
    const frames = db.prepare('SELECT * FROM frame_sizes ORDER BY frame_type, size_name').all();
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

// GET banner stock
router.get('/banners', (req, res) => {
  try {
    const banners = db.prepare('SELECT * FROM banner_stock ORDER BY size_name').all();
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const FEET_PER_ROLL = 150;

// POST create banner stock (stock_qty = rolls, feet_remaining = rolls * 150)
router.post('/banners', (req, res) => {
  try {
    const { size_name, stock_qty = 0, low_stock_threshold = 10 } = req.body;
    if (!size_name || !size_name.trim()) return res.status(400).json({ error: 'size_name required' });
    const rolls = Math.max(0, parseInt(stock_qty) || 0);
    const feetRemaining = rolls * FEET_PER_ROLL;
    const result = db.prepare(`
      INSERT INTO banner_stock (size_name, stock_qty, feet_remaining, low_stock_threshold)
      VALUES (?, ?, ?, ?)
    `).run(size_name.trim(), rolls, feetRemaining, low_stock_threshold || 10);
    const created = db.prepare('SELECT * FROM banner_stock WHERE id = ?').get(result.lastInsertRowid);
    log('banner_created', 'banner', created.id, { size_name: created.size_name });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET sticker stock
router.get('/stickers', (req, res) => {
  try {
    const stickers = db.prepare('SELECT * FROM sticker_stock ORDER BY size_name').all();
    res.json(stickers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create sticker stock (rolls, 150 ft each)
router.post('/stickers', (req, res) => {
  try {
    const { size_name, stock_qty = 0, low_stock_threshold = 10 } = req.body;
    if (!size_name || !size_name.trim()) return res.status(400).json({ error: 'size_name required' });
    const rolls = Math.max(0, parseInt(stock_qty) || 0);
    const feetRemaining = rolls * FEET_PER_ROLL;
    const result = db.prepare(`
      INSERT INTO sticker_stock (size_name, stock_qty, feet_remaining, low_stock_threshold)
      VALUES (?, ?, ?, ?)
    `).run(size_name.trim(), rolls, feetRemaining, low_stock_threshold || 10);
    const created = db.prepare('SELECT * FROM sticker_stock WHERE id = ?').get(result.lastInsertRowid);
    log('sticker_created', 'sticker', created.id, { size_name: created.size_name });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update sticker stock
router.put('/stickers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { stock_qty, feet_remaining, low_stock_threshold } = req.body;
    const sticker = db.prepare('SELECT * FROM sticker_stock WHERE id = ?').get(id);
    if (!sticker) return res.status(404).json({ error: 'Sticker not found' });

    const updates = [];
    const params = [];
    if (stock_qty !== undefined) { updates.push('stock_qty = ?'); params.push(stock_qty); }
    if (feet_remaining !== undefined) { updates.push('feet_remaining = ?'); params.push(feet_remaining); }
    if (low_stock_threshold !== undefined) { updates.push('low_stock_threshold = ?'); params.push(low_stock_threshold); }
    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

    params.push(id);
    db.prepare(`UPDATE sticker_stock SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT * FROM sticker_stock WHERE id = ?').get(id);
    log('sticker_updated', 'sticker', parseInt(id), { size_name: sticker.size_name });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update banner stock
router.put('/banners/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { stock_qty, feet_remaining, low_stock_threshold } = req.body;
    const banner = db.prepare('SELECT * FROM banner_stock WHERE id = ?').get(id);
    if (!banner) return res.status(404).json({ error: 'Banner not found' });

    const updates = [];
    const params = [];
    if (stock_qty !== undefined) { updates.push('stock_qty = ?'); params.push(stock_qty); }
    if (feet_remaining !== undefined) { updates.push('feet_remaining = ?'); params.push(feet_remaining); }
    if (low_stock_threshold !== undefined) { updates.push('low_stock_threshold = ?'); params.push(low_stock_threshold); }
    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

    params.push(id);
    db.prepare(`UPDATE banner_stock SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT * FROM banner_stock WHERE id = ?').get(id);
    log('banner_updated', 'banner', parseInt(id), { size_name: banner.size_name });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE frame size
router.delete('/frames/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM frame_sizes WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update frame stock (manual)
router.put('/frames/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { stock_qty, unit_price, low_stock_threshold, frame_type } = req.body;
    const frame = db.prepare('SELECT * FROM frame_sizes WHERE id = ?').get(id);
    if (!frame) return res.status(404).json({ error: 'Frame size not found' });

    const updates = [];
    const params = [];
    if (stock_qty !== undefined) { updates.push('stock_qty = ?'); params.push(stock_qty); }
    if (unit_price !== undefined) { updates.push('unit_price = ?'); params.push(unit_price); }
    if (low_stock_threshold !== undefined) { updates.push('low_stock_threshold = ?'); params.push(low_stock_threshold); }
    if (frame_type !== undefined) { updates.push('frame_type = ?'); params.push((frame_type || 'Standard').trim()); }
    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

    params.push(id);
    db.prepare(`UPDATE frame_sizes SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT * FROM frame_sizes WHERE id = ?').get(id);
    log('frame_updated', 'frame', parseInt(id), { size_name: frame.size_name, updates: { stock_qty, unit_price, low_stock_threshold, frame_type } });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE photo size
router.delete('/photos/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM photo_sizes WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
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
    log('photo_updated', 'photo', parseInt(id), { size_name: photo.size_name, updates: { stock_qty, unit_price, low_stock_threshold } });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST manual stock transaction (add/reduce/adjust)
router.post('/transactions', (req, res) => {
  try {
    const { item_type, item_id, transaction_type, quantity, reason } = req.body;
    if (!['frame', 'photo', 'banner', 'sticker'].includes(item_type) || !item_id || !['add', 'reduce', 'adjust'].includes(transaction_type) || quantity == null) {
      return res.status(400).json({ error: 'Valid item_type, item_id, transaction_type, quantity required' });
    }

    const table = item_type === 'frame' ? 'frame_sizes' : item_type === 'photo' ? 'photo_sizes' : item_type === 'sticker' ? 'sticker_stock' : 'banner_stock';
    const item = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(item_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    let newQty, prevQty;
    const isFeetBased = item_type === 'banner' || item_type === 'sticker';
    const stockTable = item_type === 'sticker' ? 'sticker_stock' : 'banner_stock';
    if (isFeetBased) {
      const feetRemaining = item.feet_remaining ?? (item.stock_qty * 150);
      if (transaction_type === 'add') {
        const addedFeet = quantity * 150;
        newQty = feetRemaining + addedFeet;
        prevQty = feetRemaining;
        db.prepare(`UPDATE ${stockTable} SET stock_qty = stock_qty + ?, feet_remaining = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(quantity, newQty, item_id);
      } else {
        newQty = Math.max(0, feetRemaining - quantity);
        prevQty = feetRemaining;
        db.prepare(`UPDATE ${stockTable} SET stock_qty = ?, feet_remaining = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(Math.ceil(newQty / 150), newQty, item_id);
      }
    } else {
      prevQty = item.stock_qty;
      newQty = item.stock_qty;
      if (transaction_type === 'add') newQty += quantity;
      else if (transaction_type === 'reduce' || transaction_type === 'adjust') newQty -= quantity;
      if (newQty < 0) newQty = 0;
      db.prepare(`UPDATE ${table} SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(newQty, item_id);
    }
    db.prepare(`
      INSERT INTO stock_transactions (item_type, item_id, transaction_type, quantity, previous_qty, new_qty, reason, user_action)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')
    `).run(item_type, item_id, transaction_type, quantity, prevQty, newQty, reason || null);

    const itemName = item.size_name || item.material_name;
    log('stock_transaction', item_type, parseInt(item_id), { transaction_type, quantity, previous_qty: prevQty, new_qty: newQty, item_name: itemName, reason });
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
