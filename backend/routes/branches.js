const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { log } = require('../lib/activityLog');

const STOCK_TABLES = {
  frame: 'frame_sizes',
  photo: 'photo_sizes',
  photocopy: 'photocopy_sizes',
  banner: 'banner_stock',
  sticker: 'sticker_stock',
  custom: 'custom_section_stock',
};

function isRollItem(itemType, row) {
  if (itemType === 'banner' || itemType === 'sticker') return true;
  if (itemType !== 'custom' || !row?.section_id) return false;
  const section = db.prepare('SELECT section_type FROM custom_sections WHERE section_id = ?').get(row.section_id);
  return section?.section_type === 'roll';
}

function findFrameStock(price) {
  const size = String(price.size_name || '').trim().toLowerCase();
  const wantType = String(price.frame_type || '').trim().toLowerCase();
  const wantSub = String(price.subitem_name || '').trim().toLowerCase();
  const rows = db.prepare('SELECT * FROM frame_sizes').all().filter((row) => String(row.size_name || '').trim().toLowerCase() === size);
  return rows.find((row) => {
    const frameType = String(row.frame_type || '').trim().toLowerCase();
    const subitem = String(row.subitem_name || '').trim().toLowerCase();
    return frameType === wantType || frameType === wantSub || subitem === wantSub || subitem === wantType;
  }) || null;
}

function resolveFrameStockId(pricingId, direction) {
  const price = db.prepare('SELECT * FROM frame_pricing WHERE id = ?').get(pricingId);
  if (!price) return null;
  const found = findFrameStock(price);
  if (found) return found.id;
  if (direction !== 'receive') return null;
  const created = db.prepare(`
    INSERT INTO frame_sizes (size_name, frame_type, subitem_name, stock_qty, unit_price, low_stock_threshold)
    VALUES (?, ?, ?, 0, ?, -1)
  `).run(price.size_name, price.frame_type || 'Duro', price.subitem_name || '', Number(price.unit_price) || 0);
  return created.lastInsertRowid;
}

function applyStockChange(direction, itemType, itemId, quantity, reason) {
  const table = STOCK_TABLES[itemType];
  if (!table || !itemId) return false;
  const item = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(itemId);
  if (!item) return false;

  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 1) return false;

  const current = Number(item.stock_qty) || 0;
  if (direction === 'send' && current < qty) return false;

  const roll = isRollItem(itemType, item);
  let previous = current;
  let next = direction === 'send' ? current - qty : current + qty;

  if (roll) {
    const feet = Number(item.feet_remaining ?? current * 150) || 0;
    const nextFeet = direction === 'send' ? Math.max(0, feet - qty * 150) : feet + qty * 150;
    previous = feet;
    next = nextFeet;
    db.prepare(`UPDATE ${table} SET stock_qty = ?, feet_remaining = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(direction === 'send' ? current - qty : current + qty, nextFeet, itemId);
  } else {
    db.prepare(`UPDATE ${table} SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(next, itemId);
  }

  db.prepare(`
    INSERT INTO stock_transactions (item_type, item_id, transaction_type, quantity, previous_qty, new_qty, reason, user_action)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')
  `).run(itemType, itemId, direction === 'send' ? 'reduce' : 'add', qty, previous, next, reason);

  return true;
}

router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM shop_branches ORDER BY name COLLATE NOCASE').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const place = String(req.body?.place || '').trim();
    const phone = String(req.body?.phone || '').trim();
    if (!name) return res.status(400).json({ error: 'Branch name is required.' });
    const existing = db.prepare('SELECT id FROM shop_branches WHERE lower(name) = lower(?)').get(name);
    if (existing) return res.status(400).json({ error: 'That branch is already added.' });
    const result = db.prepare('INSERT INTO shop_branches (name, place, phone) VALUES (?, ?, ?)').run(name, place, phone);
    const created = db.prepare('SELECT * FROM shop_branches WHERE id = ?').get(result.lastInsertRowid);
    log('branch_created', 'branch', created.id, { name });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = db.prepare('SELECT * FROM shop_branches WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Branch not found.' });
    const name = String(req.body?.name || '').trim();
    const place = String(req.body?.place || '').trim();
    const phone = String(req.body?.phone || '').trim();
    if (!name) return res.status(400).json({ error: 'Branch name is required.' });
    const clash = db.prepare('SELECT id FROM shop_branches WHERE lower(name) = lower(?) AND id != ?').get(name, id);
    if (clash) return res.status(400).json({ error: 'That branch is already added.' });
    db.prepare('UPDATE shop_branches SET name = ?, place = ?, phone = ? WHERE id = ?').run(name, place, phone, id);
    res.json(db.prepare('SELECT * FROM shop_branches WHERE id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = db.prepare('SELECT * FROM shop_branches WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Branch not found.' });
    db.prepare('DELETE FROM shop_branches WHERE id = ?').run(id);
    log('branch_deleted', 'branch', id, { name: row.name });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function reverseStockChange(row) {
  if (!row?.stock_adjusted) return true;
  const opposite = row.direction === 'send' ? 'receive' : 'send';
  return applyStockChange(opposite, row.item_type, row.item_id, row.quantity, `Undo ${row.direction} ${row.branch_name}`);
}

router.get('/transfers', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM branch_transfers ORDER BY created_at DESC, id DESC').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/transfers', (req, res) => {
  try {
    const direction = req.body?.direction === 'receive' ? 'receive' : req.body?.direction === 'send' ? 'send' : '';
    if (!direction) return res.status(400).json({ error: 'Choose send or receive.' });

    const branchId = parseInt(req.body?.branch_id, 10);
    const branch = db.prepare('SELECT * FROM shop_branches WHERE id = ?').get(branchId);
    if (!branch) return res.status(400).json({ error: 'Choose a branch.' });

    let itemType = STOCK_TABLES[req.body?.item_type] ? req.body.item_type : '';
    let itemId = itemType ? parseInt(req.body?.item_id, 10) : null;
    const pricingId = parseInt(req.body?.frame_pricing_id, 10);
    if ((!itemType || !itemId) && pricingId) {
      const resolved = resolveFrameStockId(pricingId, direction);
      if (resolved) {
        itemType = 'frame';
        itemId = resolved;
      }
    }
    const itemLabel = String(req.body?.item_label || '').trim();
    const quantity = Math.floor(Number(req.body?.quantity));
    const adjustStock = req.body?.adjust_stock === true || req.body?.adjust_stock === 1;
    const note = String(req.body?.note || '').trim().slice(0, 500);

    if (!itemLabel) return res.status(400).json({ error: 'Enter the item you are moving.' });
    if (!Number.isFinite(quantity) || quantity < 1) return res.status(400).json({ error: 'Quantity must be at least 1.' });

    const reason = direction === 'send'
      ? `Sent to ${branch.name}`
      : `Received from ${branch.name}`;

    const saved = db.transaction(() => {
      const adjusted = adjustStock ? applyStockChange(direction, itemType, itemId, quantity, reason) : false;
      const result = db.prepare(`
        INSERT INTO branch_transfers (
          direction, branch_id, branch_name, item_type, item_id, item_label,
          quantity, adjust_stock, stock_adjusted, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        direction,
        branch.id,
        branch.name,
        itemType,
        Number.isFinite(itemId) ? itemId : null,
        itemLabel,
        quantity,
        adjustStock ? 1 : 0,
        adjusted ? 1 : 0,
        note
      );
      return {
        transfer: db.prepare('SELECT * FROM branch_transfers WHERE id = ?').get(result.lastInsertRowid),
        stock_adjusted: adjusted,
      };
    })();

    log('branch_transfer', 'branch', branch.id, {
      direction,
      branch: branch.name,
      item: itemLabel,
      quantity,
      stock_adjusted: saved.stock_adjusted,
    });

    const message = saved.stock_adjusted
      ? (direction === 'send'
        ? 'Sent. This shop’s stock was decreased.'
        : 'Received. This shop’s stock was increased.')
      : 'Saved. This shop’s stock was not changed.';

    res.status(201).json({ ...saved, message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/transfers/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = db.prepare('SELECT * FROM branch_transfers WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Transfer not found.' });

    const branchId = parseInt(req.body?.branch_id, 10);
    const branch = db.prepare('SELECT * FROM shop_branches WHERE id = ?').get(branchId);
    if (!branch) return res.status(400).json({ error: 'Choose a branch.' });

    const itemLabel = String(req.body?.item_label || '').trim();
    const quantity = Math.floor(Number(req.body?.quantity));
    const note = String(req.body?.note || '').trim().slice(0, 500);
    const adjustStock = req.body?.adjust_stock === true || req.body?.adjust_stock === 1;
    const itemType = STOCK_TABLES[req.body?.item_type] ? req.body.item_type : (row.item_type || '');
    const itemId = req.body?.item_id != null && req.body?.item_id !== ''
      ? parseInt(req.body.item_id, 10)
      : row.item_id;
    if (!itemLabel) return res.status(400).json({ error: 'Enter the item you are moving.' });
    if (!Number.isFinite(quantity) || quantity < 1) return res.status(400).json({ error: 'Quantity must be at least 1.' });

    const sameItem = itemType === row.item_type && Number(itemId) === Number(row.item_id);
    const reason = row.direction === 'send' ? `Sent to ${branch.name}` : `Received from ${branch.name}`;

    const saved = db.transaction(() => {
      if (row.stock_adjusted && !reverseStockChange(row)) {
        throw new Error('Could not put the earlier stock back, so this transfer was left as it is.');
      }
      const adjusted = adjustStock && sameItem
        ? applyStockChange(row.direction, itemType, itemId, quantity, reason)
        : false;
      db.prepare(`
        UPDATE branch_transfers
        SET branch_id = ?, branch_name = ?, item_label = ?, quantity = ?, note = ?,
            adjust_stock = ?, stock_adjusted = ?, item_type = ?, item_id = ?
        WHERE id = ?
      `).run(
        branch.id,
        branch.name,
        itemLabel,
        quantity,
        note,
        adjustStock ? 1 : 0,
        adjusted ? 1 : 0,
        sameItem ? itemType : '',
        sameItem && Number.isFinite(Number(itemId)) ? itemId : null,
        id
      );
      return db.prepare('SELECT * FROM branch_transfers WHERE id = ?').get(id);
    })();

    log('branch_transfer_edited', 'branch', branch.id, { id, item: itemLabel, quantity });
    res.json({ transfer: saved, message: 'Transfer updated.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/transfers/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = db.prepare('SELECT * FROM branch_transfers WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Transfer not found.' });

    const saved = db.transaction(() => {
      const restored = reverseStockChange(row);
      db.prepare('DELETE FROM branch_transfers WHERE id = ?').run(id);
      return restored;
    })();

    log('branch_transfer_undone', 'branch', row.branch_id, { id, item: row.item_label, quantity: row.quantity });
    res.json({
      deleted: true,
      stock_restored: Boolean(row.stock_adjusted && saved),
      message: row.stock_adjusted && saved
        ? 'Transfer removed and this shop’s stock was put back.'
        : 'Transfer removed.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
