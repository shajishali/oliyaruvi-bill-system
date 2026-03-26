const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { log } = require('../lib/activityLog');

// POST create new frame size
router.post('/frames', (req, res) => {
  try {
    const { size_name, frame_type = 'Standard', subitem_name = '', stock_qty = 0, unit_price = 0, low_stock_threshold } = req.body;
    if (!size_name || !size_name.trim()) return res.status(400).json({ error: 'size_name required' });
    const thresh = low_stock_threshold === -1 ? -1 : (low_stock_threshold >= 0 ? low_stock_threshold : 5);
    const sub = String(subitem_name || '').trim();
    const result = db.prepare(`
      INSERT INTO frame_sizes (size_name, frame_type, subitem_name, stock_qty, unit_price, low_stock_threshold)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(size_name.trim(), (frame_type || 'Standard').trim(), sub, stock_qty || 0, unit_price || 0, thresh);
    const created = db.prepare('SELECT * FROM frame_sizes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create new photo size
router.post('/photos', (req, res) => {
  try {
    const { size_name, stock_qty = 0, unit_price = 0, low_stock_threshold } = req.body;
    if (!size_name || !size_name.trim()) return res.status(400).json({ error: 'size_name required' });
    const thresh = low_stock_threshold === -1 ? -1 : (low_stock_threshold >= 0 ? low_stock_threshold : 5);
    const result = db.prepare(`
      INSERT INTO photo_sizes (size_name, stock_qty, unit_price, low_stock_threshold)
      VALUES (?, ?, ?, ?)
    `).run(size_name.trim(), stock_qty || 0, unit_price || 0, thresh);
    const created = db.prepare('SELECT * FROM photo_sizes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create new photocopy size
router.post('/photocopy', (req, res) => {
  try {
    const { size_name, stock_qty = 0, unit_price = 0, low_stock_threshold } = req.body;
    if (!size_name || !size_name.trim()) return res.status(400).json({ error: 'size_name required' });
    const thresh = low_stock_threshold === -1 ? -1 : (low_stock_threshold >= 0 ? low_stock_threshold : 5);
    const result = db.prepare(`
      INSERT INTO photocopy_sizes (size_name, stock_qty, unit_price, low_stock_threshold)
      VALUES (?, ?, ?, ?)
    `).run(size_name.trim(), stock_qty || 0, unit_price || 0, thresh);
    const created = db.prepare('SELECT * FROM photocopy_sizes WHERE id = ?').get(result.lastInsertRowid);
    log('photocopy_created', 'photocopy', created.id, { size_name: created.size_name });
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

// GET photocopy stock
router.get('/photocopy', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM photocopy_sizes ORDER BY size_name').all();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all custom-section stock rows (group by section_id on the client)
router.get('/custom-items', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM custom_section_stock ORDER BY section_id, size_name').all();
    res.json(rows);
  } catch (err) {
    if (err.message && err.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

// Custom section metadata
router.get('/custom-sections', (req, res) => {
  try {
    const sections = db.prepare(`
      SELECT section_id, label, section_type,
             COALESCE(affects_sales, 1) as affects_sales,
             COALESCE(unit_price, 0) as unit_price
      FROM custom_sections
      ORDER BY created_at DESC
    `).all();
    res.json(sections);
  } catch (err) {
    // Table may not exist yet (during first migration runs)
    if (err.message && err.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

router.post('/custom-sections', (req, res) => {
  try {
    const { section_id, label, section_type, affects_sales, unit_price } = req.body;
    const sid = String(section_id || '').trim();
    const lab = String(label || '').trim();
    const stype = String(section_type || '').trim();
    const affectsSales = affects_sales === false || affects_sales === 0 ? 0 : 1;
    const price = parseFloat(String(unit_price ?? 0)) || 0;

    if (!sid) return res.status(400).json({ error: 'section_id required' });
    if (!lab) return res.status(400).json({ error: 'label required' });
    if (!['count', 'roll'].includes(stype)) return res.status(400).json({ error: 'section_type must be count or roll' });

    db.prepare(`
      INSERT INTO custom_sections (section_id, label, section_type, affects_sales, unit_price)
      VALUES (?, ?, ?, ?, ?)
    `).run(sid, lab, stype, affectsSales, price);

    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/custom-sections/:sectionId', (req, res) => {
  try {
    const sectionId = decodeURIComponent(String(req.params.sectionId || '').trim());
    const { section_type, affects_sales, unit_price } = req.body;
    if (!sectionId) return res.status(400).json({ error: 'section_id required' });
    if (section_type !== undefined && !['count', 'roll'].includes(String(section_type || ''))) return res.status(400).json({ error: 'section_type must be count or roll' });
    if (section_type !== undefined) db.prepare('UPDATE custom_sections SET section_type = ? WHERE section_id = ?').run(section_type, sectionId);
    if (affects_sales !== undefined) db.prepare('UPDATE custom_sections SET affects_sales = ? WHERE section_id = ?').run(affects_sales === false || affects_sales === 0 ? 0 : 1, sectionId);
    if (unit_price !== undefined) {
      const price = parseFloat(String(unit_price)) || 0;
      db.prepare('UPDATE custom_sections SET unit_price = ? WHERE section_id = ?').run(price, sectionId);
    }
    const updated = db.prepare('SELECT * FROM custom_sections WHERE section_id = ?').get(sectionId);
    res.json(updated || { success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/custom-sections/:sectionId', (req, res) => {
  try {
    const sectionId = decodeURIComponent(String(req.params.sectionId || '').trim());
    if (!sectionId) return res.status(400).json({ error: 'section_id required' });

    // Remove stock rows too (so Settings + Stock stay consistent)
    try {
      db.prepare('DELETE FROM custom_section_stock WHERE section_id = ?').run(sectionId);
    } catch (_) { /* ignore missing */ }

    // Remove roll-sale subtype rows too (otherwise Settings can show stale pricing).
    try {
      db.prepare('DELETE FROM custom_section_sale_items WHERE section_id = ?').run(sectionId);
    } catch (_) { /* ignore missing */ }

    try {
      db.prepare('DELETE FROM custom_sections WHERE section_id = ?').run(sectionId);
    } catch (_) { /* ignore missing */ }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create row for a custom tab (e.g. section_id = "custom-173...")
router.post('/custom-items', (req, res) => {
  try {
    const { section_id, size_name, stock_qty = 0, low_stock_threshold, unit_price = 0, item_type = '' } = req.body;
    if (!section_id || !String(section_id).trim()) return res.status(400).json({ error: 'section_id required' });
    if (!size_name || !String(size_name).trim()) return res.status(400).json({ error: 'size_name required' });
    const sectionIdTrim = String(section_id).trim();
    const sizeTrim = String(size_name).trim();
    const itype = String(item_type || '').trim();
    const dup = db.prepare(
      `SELECT id FROM custom_section_stock WHERE section_id = ? AND size_name = ? AND COALESCE(item_type, '') = ?`
    ).get(sectionIdTrim, sizeTrim, itype);
    if (dup) {
      return res.status(400).json({
        error: 'A row with this size and type already exists in this section. Change type or size, or edit the existing row.',
      });
    }
    const thresh = low_stock_threshold === -1 ? -1 : (low_stock_threshold >= 0 ? low_stock_threshold : 5);
    const result = db.prepare(`
      INSERT INTO custom_section_stock (section_id, size_name, stock_qty, unit_price, low_stock_threshold, item_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sectionIdTrim, sizeTrim, stock_qty || 0, unit_price || 0, thresh, itype);
    const created = db.prepare('SELECT * FROM custom_section_stock WHERE id = ?').get(result.lastInsertRowid);
    // Keep feet_remaining in sync for roll sections.
    const section = db.prepare('SELECT section_type FROM custom_sections WHERE section_id = ?').get(String(section_id).trim());
    if (section?.section_type === 'roll') {
      const feet = (Number(created.stock_qty) || 0) * 150;
      db.prepare('UPDATE custom_section_stock SET feet_remaining = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(feet, created.id);
      created.feet_remaining = feet;
    }
    log('custom_section_item_created', 'custom_stock', created.id, { section_id: created.section_id, size_name: created.size_name });
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({
        error: 'A row with this size and type already exists in this section. Change type or size, or edit the existing row.',
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT update custom-section row
router.put('/custom-items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { stock_qty, unit_price, low_stock_threshold, size_name, item_type } = req.body;
    const row = db.prepare('SELECT * FROM custom_section_stock WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Item not found' });

    if (size_name !== undefined || item_type !== undefined) {
      const nextSize = size_name !== undefined ? String(size_name).trim() : row.size_name;
      const nextType = item_type !== undefined ? String(item_type || '').trim() : String(row.item_type || '').trim();
      if (size_name !== undefined && !nextSize) return res.status(400).json({ error: 'size_name required' });
      const clash = db.prepare(
        `SELECT id FROM custom_section_stock WHERE section_id = ? AND size_name = ? AND COALESCE(item_type, '') = ? AND id != ?`
      ).get(row.section_id, nextSize, nextType, id);
      if (clash) {
        return res.status(400).json({
          error: 'A row with this size and type already exists in this section. Change type or size, or edit the existing row.',
        });
      }
    }

    const updates = [];
    const params = [];
    const updatingStockQty = stock_qty !== undefined;
    if (stock_qty !== undefined) { updates.push('stock_qty = ?'); params.push(stock_qty); }
    if (unit_price !== undefined) { updates.push('unit_price = ?'); params.push(unit_price); }
    if (low_stock_threshold !== undefined) { updates.push('low_stock_threshold = ?'); params.push(low_stock_threshold); }
    if (size_name !== undefined && String(size_name).trim()) { updates.push('size_name = ?'); params.push(String(size_name).trim()); }
    if (item_type !== undefined) { updates.push('item_type = ?'); params.push(String(item_type || '').trim()); }
    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

    params.push(id);
    db.prepare(`UPDATE custom_section_stock SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT * FROM custom_section_stock WHERE id = ?').get(id);
    // Keep feet_remaining consistent when stock_qty changes for roll sections.
    if (updatingStockQty) {
      const section = db.prepare('SELECT section_type FROM custom_sections WHERE section_id = ?').get(updated.section_id);
      if (section?.section_type === 'roll') {
        const feet = (Number(updated.stock_qty) || 0) * 150;
        db.prepare('UPDATE custom_section_stock SET feet_remaining = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(feet, id);
        updated.feet_remaining = feet;
      } else {
        db.prepare('UPDATE custom_section_stock SET feet_remaining = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
        updated.feet_remaining = null;
      }
    }
    log('custom_section_item_updated', 'custom_stock', parseInt(id), { section_id: updated.section_id, size_name: updated.size_name });
    res.json(updated);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({
        error: 'A row with this size and type already exists in this section. Change type or size, or edit the existing row.',
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE custom-section row
router.delete('/custom-items/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM custom_section_stock WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Item not found' });
    db.prepare('DELETE FROM custom_section_stock WHERE id = ?').run(req.params.id);
    log('custom_section_item_deleted', 'custom_stock', parseInt(req.params.id), { section_id: row.section_id, size_name: row.size_name });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Custom roll sale items (subtypes under a custom section like cloth)
// Example: section_id="custom-123" items like "Backlight print" (Banner), priced per sqft.
router.get('/custom-sale-items', (req, res) => {
  try {
    const { section_id } = req.query;
    let sql = 'SELECT * FROM custom_section_sale_items';
    const params = [];
    if (section_id) {
      sql += ' WHERE section_id = ?';
      params.push(String(section_id));
    }
    sql += ' ORDER BY section_id, item_name, size_name';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    if (err.message && err.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

router.post('/custom-sale-items', (req, res) => {
  try {
    const { section_id, item_name, item_type = '', qty_type = 'per_sqft', unit_price = 0, size_name = '' } = req.body;
    if (!section_id || !String(section_id).trim()) return res.status(400).json({ error: 'section_id required' });
    if (!item_name || !String(item_name).trim()) return res.status(400).json({ error: 'item_name required' });
    const it = String(item_type || '').trim();
    const qty = (qty_type === 'per_unit') ? 'per_unit' : 'per_sqft';
    const price = parseFloat(String(unit_price)) || 0;
    const sz = String(size_name || '').trim();

    const result = db.prepare(`
      INSERT INTO custom_section_sale_items (section_id, item_name, item_type, qty_type, unit_price, size_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(String(section_id).trim(), String(item_name).trim(), it, qty, price, sz);

    const created = db.prepare('SELECT * FROM custom_section_sale_items WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'This sale item already exists in this section.' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/custom-sale-items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM custom_section_sale_items WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Sale item not found' });

    const { item_name, item_type, qty_type, unit_price, size_name } = req.body;
    const updates = [];
    const params = [];
    if (item_name !== undefined && String(item_name).trim()) { updates.push('item_name = ?'); params.push(String(item_name).trim()); }
    if (item_type !== undefined) { updates.push('item_type = ?'); params.push(String(item_type || '').trim()); }
    if (qty_type !== undefined) { updates.push('qty_type = ?'); params.push(qty_type === 'per_unit' ? 'per_unit' : 'per_sqft'); }
    if (unit_price !== undefined) { updates.push('unit_price = ?'); params.push(parseFloat(String(unit_price)) || 0); }
    if (size_name !== undefined) { updates.push('size_name = ?'); params.push(String(size_name || '').trim()); }
    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

    params.push(id);
    db.prepare(`UPDATE custom_section_sale_items SET ${updates.join(', ')}, created_at = created_at WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT * FROM custom_section_sale_items WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/custom-sale-items/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM custom_section_sale_items WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Sale item not found' });
    db.prepare('DELETE FROM custom_section_sale_items WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE all stock rows for a custom tab (when user removes section from UI)
router.delete('/custom-section/:sectionId', (req, res) => {
  try {
    const sectionId = decodeURIComponent(String(req.params.sectionId || '').trim());
    if (!sectionId) return res.status(400).json({ error: 'section_id required' });
    let removed = 0;
    try {
      const row = db.prepare('SELECT COUNT(*) as c FROM custom_section_stock WHERE section_id = ?').get(sectionId);
      removed = row?.c ?? 0;
      db.prepare('DELETE FROM custom_section_stock WHERE section_id = ?').run(sectionId);
    } catch (e) {
      if (!e.message || !e.message.includes('no such table')) throw e;
    }
    log('custom_section_cleared', 'custom_stock', 0, { section_id: sectionId, rows_removed: removed });
    res.json({ success: true, rows_removed: removed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET banner stock
router.get('/banners', (req, res) => {
  try {
    // Order numerically so 6 ft < 8 ft < 10 ft (CAST handles pure-numeric names; non-numeric fall last)
    const banners = db.prepare(
      `SELECT * FROM banner_stock ORDER BY COALESCE(stock_type, ''), COALESCE(print_type, ''), CAST(size_name AS REAL), size_name`
    ).all();
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const FEET_PER_ROLL = 150;

/** Normalize a roll-width value: strip "feet"/"ft"/" " so we always store bare numbers ("6", "8", "10"). */
function normalizeRollWidth(raw) {
  const s = String(raw || '').trim().replace(/\s*feet?\s*/gi, '').replace(/\s*ft\s*/gi, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? s : String(n);
}

function normalizeStockType(raw) {
  return String(raw ?? '').trim();
}

function normalizePrintType(raw) {
  return String(raw ?? '').trim();
}

function normalizeBannerPriceUnit(raw) {
  const s = String(raw ?? 'per_sqft').trim().toLowerCase();
  return s === 'per_qty' ? 'per_qty' : 'per_sqft';
}

function parseOptionalUnitPrice(body) {
  if (!Object.prototype.hasOwnProperty.call(body || {}, 'unit_price')) return undefined;
  const v = body.unit_price;
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// POST create banner stock (stock_qty = rolls, feet_remaining = rolls * 150)
router.post('/banners', (req, res) => {
  try {
    const body = req.body || {};
    const { size_name, stock_qty = 0, low_stock_threshold, stock_type = '', print_type = '' } = body;
    if (!size_name || !size_name.trim()) return res.status(400).json({ error: 'size_name required' });
    const normalized = normalizeRollWidth(size_name);
    if (!normalized) return res.status(400).json({ error: 'size_name required' });
    const rolls = Math.max(0, parseInt(stock_qty) || 0);
    const feetRemaining = rolls * FEET_PER_ROLL;
    const thresh = low_stock_threshold === -1 ? -1 : (low_stock_threshold >= 0 ? low_stock_threshold : 10);
    const stype = normalizeStockType(stock_type);
    const ptype = normalizePrintType(print_type);
    const unitPrice = parseOptionalUnitPrice(body);
    const priceUnit = normalizeBannerPriceUnit(body.price_unit);
    const dup = db.prepare(
      `SELECT id FROM banner_stock WHERE size_name = ? AND COALESCE(stock_type, '') = ? AND COALESCE(print_type, '') = ?`
    ).get(normalized, stype, ptype);
    if (dup) {
      return res.status(400).json({
        error: 'A row with this roll width, type, and print type already exists. Edit that row or change a field.',
      });
    }
    const result = db.prepare(`
      INSERT INTO banner_stock (size_name, stock_qty, feet_remaining, low_stock_threshold, stock_type, print_type, unit_price, price_unit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(normalized, rolls, feetRemaining, thresh, stype, ptype, unitPrice === undefined ? null : unitPrice, priceUnit);
    const created = db.prepare('SELECT * FROM banner_stock WHERE id = ?').get(result.lastInsertRowid);
    log('banner_created', 'banner', created.id, { size_name: created.size_name });
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({
        error: 'A row with this roll width, type, and print type already exists. Edit that row or change a field.',
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET sticker stock
router.get('/stickers', (req, res) => {
  try {
    const stickers = db.prepare(
      `SELECT * FROM sticker_stock ORDER BY COALESCE(stock_type, ''), CAST(size_name AS REAL), size_name`
    ).all();
    res.json(stickers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create sticker stock (rolls, 150 ft each)
router.post('/stickers', (req, res) => {
  try {
    const { size_name, stock_qty = 0, low_stock_threshold, stock_type = '' } = req.body;
    if (!size_name || !size_name.trim()) return res.status(400).json({ error: 'size_name required' });
    const normalized = normalizeRollWidth(size_name);
    if (!normalized) return res.status(400).json({ error: 'size_name required' });
    const rolls = Math.max(0, parseInt(stock_qty) || 0);
    const feetRemaining = rolls * FEET_PER_ROLL;
    const thresh = low_stock_threshold === -1 ? -1 : (low_stock_threshold >= 0 ? low_stock_threshold : 10);
    const stype = normalizeStockType(stock_type);
    const dup = db.prepare(
      `SELECT id FROM sticker_stock WHERE size_name = ? AND COALESCE(stock_type, '') = ?`
    ).get(normalized, stype);
    if (dup) {
      return res.status(400).json({
        error: 'A row with this roll width and type already exists. Edit that row or use a different type.',
      });
    }
    const result = db.prepare(`
      INSERT INTO sticker_stock (size_name, stock_qty, feet_remaining, low_stock_threshold, stock_type)
      VALUES (?, ?, ?, ?, ?)
    `).run(normalized, rolls, feetRemaining, thresh, stype);
    const created = db.prepare('SELECT * FROM sticker_stock WHERE id = ?').get(result.lastInsertRowid);
    log('sticker_created', 'sticker', created.id, { size_name: created.size_name });
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({
        error: 'A row with this roll width and type already exists. Edit that row or use a different type.',
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT update sticker stock
router.put('/stickers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { stock_qty, feet_remaining, low_stock_threshold, size_name, stock_type } = req.body;
    const sticker = db.prepare('SELECT * FROM sticker_stock WHERE id = ?').get(id);
    if (!sticker) return res.status(404).json({ error: 'Sticker not found' });

    const updates = [];
    const params = [];
    if (size_name !== undefined || stock_type !== undefined) {
      const nextSize = size_name !== undefined ? normalizeRollWidth(size_name) : sticker.size_name;
      const nextType = stock_type !== undefined ? normalizeStockType(stock_type) : normalizeStockType(sticker.stock_type);
      if (size_name !== undefined && !nextSize) return res.status(400).json({ error: 'size_name required' });
      const clash = db.prepare(
        `SELECT id FROM sticker_stock WHERE size_name = ? AND COALESCE(stock_type, '') = ? AND id != ?`
      ).get(nextSize, nextType, id);
      if (clash) {
        return res.status(400).json({
          error: 'A row with this roll width and type already exists. Edit that row or use a different type.',
        });
      }
    }
    if (size_name !== undefined) {
      const normalized = normalizeRollWidth(size_name);
      if (!normalized) return res.status(400).json({ error: 'size_name required' });
      updates.push('size_name = ?');
      params.push(normalized);
    }
    if (stock_qty !== undefined) { updates.push('stock_qty = ?'); params.push(stock_qty); }
    if (feet_remaining !== undefined) { updates.push('feet_remaining = ?'); params.push(feet_remaining); }
    if (low_stock_threshold !== undefined) { updates.push('low_stock_threshold = ?'); params.push(low_stock_threshold); }
    if (stock_type !== undefined) { updates.push('stock_type = ?'); params.push(normalizeStockType(stock_type)); }
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
    const body = req.body || {};
    const hasPrintType = Object.prototype.hasOwnProperty.call(body, 'print_type');
    const { stock_qty, feet_remaining, low_stock_threshold, size_name, stock_type } = body;
    const banner = db.prepare('SELECT * FROM banner_stock WHERE id = ?').get(id);
    if (!banner) return res.status(404).json({ error: 'Banner not found' });

    const updates = [];
    const params = [];
    if (size_name !== undefined || stock_type !== undefined || hasPrintType) {
      const nextSize = size_name !== undefined ? normalizeRollWidth(size_name) : banner.size_name;
      const nextType = stock_type !== undefined ? normalizeStockType(stock_type) : normalizeStockType(banner.stock_type);
      const nextPrint = hasPrintType ? normalizePrintType(body.print_type) : normalizePrintType(banner.print_type);
      if (size_name !== undefined && !nextSize) return res.status(400).json({ error: 'size_name required' });
      const clash = db.prepare(
        `SELECT id FROM banner_stock WHERE size_name = ? AND COALESCE(stock_type, '') = ? AND COALESCE(print_type, '') = ? AND id != ?`
      ).get(nextSize, nextType, nextPrint, id);
      if (clash) {
        return res.status(400).json({
          error: 'A row with this roll width, type, and print type already exists. Edit that row or change a field.',
        });
      }
    }
    if (size_name !== undefined) {
      const normalized = normalizeRollWidth(size_name);
      if (!normalized) return res.status(400).json({ error: 'size_name required' });
      updates.push('size_name = ?');
      params.push(normalized);
    }
    if (stock_qty !== undefined) { updates.push('stock_qty = ?'); params.push(stock_qty); }
    if (feet_remaining !== undefined) { updates.push('feet_remaining = ?'); params.push(feet_remaining); }
    if (low_stock_threshold !== undefined) { updates.push('low_stock_threshold = ?'); params.push(low_stock_threshold); }
    if (stock_type !== undefined) { updates.push('stock_type = ?'); params.push(normalizeStockType(stock_type)); }
    if (hasPrintType) {
      updates.push('print_type = ?');
      params.push(normalizePrintType(body.print_type));
    }
    const hasUnitPrice = Object.prototype.hasOwnProperty.call(body, 'unit_price');
    const hasPriceUnit = Object.prototype.hasOwnProperty.call(body, 'price_unit');
    if (hasUnitPrice) {
      const u = parseOptionalUnitPrice(body);
      updates.push('unit_price = ?');
      params.push(u === undefined ? null : u);
    }
    if (hasPriceUnit) {
      updates.push('price_unit = ?');
      params.push(normalizeBannerPriceUnit(body.price_unit));
    }
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

// DELETE banner stock size
router.delete('/banners/:id', (req, res) => {
  try {
    const banner = db.prepare('SELECT * FROM banner_stock WHERE id = ?').get(req.params.id);
    if (!banner) return res.status(404).json({ error: 'Banner not found' });
    db.prepare('DELETE FROM banner_stock WHERE id = ?').run(req.params.id);
    log('banner_deleted', 'banner', parseInt(req.params.id), { size_name: banner.size_name });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE sticker stock size
router.delete('/stickers/:id', (req, res) => {
  try {
    const sticker = db.prepare('SELECT * FROM sticker_stock WHERE id = ?').get(req.params.id);
    if (!sticker) return res.status(404).json({ error: 'Sticker not found' });
    db.prepare('DELETE FROM sticker_stock WHERE id = ?').run(req.params.id);
    log('sticker_deleted', 'sticker', parseInt(req.params.id), { size_name: sticker.size_name });
    res.json({ deleted: true });
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
    const { stock_qty, unit_price, low_stock_threshold, frame_type, size_name, subitem_name } = req.body;
    const frame = db.prepare('SELECT * FROM frame_sizes WHERE id = ?').get(id);
    if (!frame) return res.status(404).json({ error: 'Frame size not found' });

    const updates = [];
    const params = [];
    if (stock_qty !== undefined) { updates.push('stock_qty = ?'); params.push(stock_qty); }
    if (unit_price !== undefined) { updates.push('unit_price = ?'); params.push(unit_price); }
    if (low_stock_threshold !== undefined) { updates.push('low_stock_threshold = ?'); params.push(low_stock_threshold); }
    if (frame_type !== undefined) { updates.push('frame_type = ?'); params.push((frame_type || 'Standard').trim()); }
    if (size_name !== undefined && String(size_name).trim()) { updates.push('size_name = ?'); params.push(String(size_name).trim()); }
    if (subitem_name !== undefined) { updates.push('subitem_name = ?'); params.push(String(subitem_name || '').trim()); }
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

// DELETE photocopy size
router.delete('/photocopy/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM photocopy_sizes WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Photocopy size not found' });
    db.prepare('DELETE FROM photocopy_sizes WHERE id = ?').run(req.params.id);
    log('photocopy_deleted', 'photocopy', parseInt(req.params.id), { size_name: item.size_name });
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

// PUT update photocopy stock (manual)
router.put('/photocopy/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { stock_qty, unit_price, low_stock_threshold } = req.body;
    const item = db.prepare('SELECT * FROM photocopy_sizes WHERE id = ?').get(id);
    if (!item) return res.status(404).json({ error: 'Photocopy size not found' });

    const updates = [];
    const params = [];
    if (stock_qty !== undefined) { updates.push('stock_qty = ?'); params.push(stock_qty); }
    if (unit_price !== undefined) { updates.push('unit_price = ?'); params.push(unit_price); }
    if (low_stock_threshold !== undefined) { updates.push('low_stock_threshold = ?'); params.push(low_stock_threshold); }
    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

    params.push(id);
    db.prepare(`UPDATE photocopy_sizes SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT * FROM photocopy_sizes WHERE id = ?').get(id);
    log('photocopy_updated', 'photocopy', parseInt(id), { size_name: item.size_name, updates: { stock_qty, unit_price, low_stock_threshold } });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST manual stock transaction (add/reduce/adjust)
router.post('/transactions', (req, res) => {
  try {
    const { item_type, item_id, transaction_type, quantity, reason } = req.body;
    if (!['frame', 'photo', 'photocopy', 'banner', 'sticker', 'custom'].includes(item_type) || !item_id || !['add', 'reduce', 'adjust'].includes(transaction_type) || quantity == null) {
      return res.status(400).json({ error: 'Valid item_type, item_id, transaction_type, quantity required' });
    }

    const table = item_type === 'frame'
      ? 'frame_sizes'
      : item_type === 'photo'
      ? 'photo_sizes'
      : item_type === 'photocopy'
      ? 'photocopy_sizes'
      : item_type === 'custom'
      ? 'custom_section_stock'
      : item_type === 'sticker'
      ? 'sticker_stock'
      : 'banner_stock';
    const item = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(item_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    let newQty, prevQty;
    let isFeetBased = item_type === 'banner' || item_type === 'sticker';
    let customSectionType = null;

    if (item_type === 'custom') {
      // Determine count/roll behavior from metadata
      const section = db.prepare('SELECT section_type FROM custom_sections WHERE section_id = ?').get(item.section_id);
      customSectionType = section?.section_type ?? null;
      isFeetBased = customSectionType === 'roll';
    }

    if (isFeetBased) {
      const feetRemaining = (item.feet_remaining ?? (item.stock_qty * 150));

      if (item_type === 'custom') {
        // Custom roll stock: quantity means rolls when adding, and feet when reducing (same as banner/sticker)
        if (transaction_type === 'add') {
          const addedFeet = quantity * 150;
          newQty = feetRemaining + addedFeet; // previous/new qty in feet (used for stock_transactions rollback math)
          prevQty = feetRemaining;
          db.prepare('UPDATE custom_section_stock SET stock_qty = ?, feet_remaining = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(Math.ceil(newQty / 150), newQty, item_id);
        } else {
          newQty = Math.max(0, feetRemaining - quantity); // store feet
          prevQty = feetRemaining;
          db.prepare('UPDATE custom_section_stock SET stock_qty = ?, feet_remaining = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(Math.ceil(newQty / 150), newQty, item_id);
        }
      } else {
        const stockTable = item_type === 'sticker' ? 'sticker_stock' : 'banner_stock';
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
