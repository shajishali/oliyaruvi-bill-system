const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { log } = require('../lib/activityLog');

function insufficientStock(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function enrichItemsWithStockRefs(bill, items) {
  const txs = db.prepare(
    `SELECT item_type, item_id FROM stock_transactions
     WHERE reason = ?
       AND user_action = 'billing'
       AND transaction_type = 'reduce'
     ORDER BY id`
  ).all(`Bill #${bill.bill_number}`);
  const byType = txs.reduce((acc, tx) => {
    if (!acc[tx.item_type]) acc[tx.item_type] = [];
    acc[tx.item_type].push(tx.item_id);
    return acc;
  }, {});

  return items.map((item) => {
    let meta = {};
    if (item.metadata) {
      try { meta = JSON.parse(item.metadata); } catch (_) { meta = {}; }
    }
    if (item.service_type === 'frame' && meta.frame_id == null && byType.frame?.length) {
      meta.frame_id = byType.frame.shift();
    }
    if (item.service_type === 'photo' && meta.photo_id == null && byType.photo?.length) {
      meta.photo_id = byType.photo.shift();
    }
    if (item.service_type === 'photocopy' && meta.photocopy_id == null && byType.photocopy?.length) {
      meta.photocopy_id = byType.photocopy.shift();
    }
    return Object.keys(meta).length ? { ...item, metadata: JSON.stringify(meta) } : item;
  });
}

// PUT record balance payment
router.put('/:id/pay-balance', (req, res) => {
  try {
    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    const { amount, payment_method } = req.body;
    const payAmount = Math.max(0, parseFloat(String(amount)) || 0);
    const method = (payment_method === 'Cash' || payment_method === 'Bank') ? payment_method : (bill.payment_method || 'Cash');
    const newPaid = Math.min(bill.total, (bill.amount_paid || 0) + payAmount);
    if (payAmount <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });

    const today = new Date().toISOString().slice(0, 10);
    db.prepare('UPDATE bills SET amount_paid = ? WHERE id = ?').run(newPaid, bill.id);
    try {
      db.prepare(`
        INSERT INTO payment_transactions (bill_id, amount, paid_at, payment_method, payment_type)
        VALUES (?, ?, ?, ?, 'balance')
      `).run(bill.id, payAmount, today, method === 'Bank' ? 'Bank' : 'Cash');
    } catch (_) { /* table may not exist yet */ }
    log('bill_balance_paid', 'bill', bill.id, { bill_number: bill.bill_number, amount: payAmount });
    const updated = db.prepare('SELECT b.*, c.phone as customer_phone FROM bills b LEFT JOIN customers c ON b.customer_id = c.id WHERE b.id = ?').get(bill.id);
    const items = enrichItemsWithStockRefs(bill, db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(bill.id));
    let payment_transactions = [];
    try {
      payment_transactions = db.prepare('SELECT amount, paid_at, payment_method, payment_type FROM payment_transactions WHERE bill_id = ? ORDER BY paid_at, id').all(bill.id);
    } catch (_) { /* table may not exist */ }
    res.json({ ...updated, items, payment_transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all bills (with optional date filter)
router.get('/', (req, res) => {
  try {
    const { date, from, to, number, customer, phone, pending_settlement } = req.query;
    let sql = 'SELECT b.*, c.phone as customer_phone FROM bills b LEFT JOIN customers c ON b.customer_id = c.id WHERE 1=1';
    const params = [];

    if (date) {
      sql += ' AND b.bill_date = ?';
      params.push(date);
    }
    if (from) {
      sql += ' AND b.bill_date >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND b.bill_date <= ?';
      params.push(to);
    }
    if (number) {
      sql += ' AND b.bill_number LIKE ?';
      params.push(`%${number}%`);
    }
    if (customer) {
      sql += ' AND b.customer_name LIKE ?';
      params.push(`%${customer}%`);
    }
    if (phone) {
      sql += ' AND c.phone LIKE ?';
      params.push(`%${phone}%`);
    }
    if (pending_settlement === 'true' || pending_settlement === '1') {
      sql += ' AND COALESCE(b.amount_paid, 0) > 0 AND COALESCE(b.amount_paid, 0) < b.total';
    }
    sql += ' ORDER BY b.created_at DESC';

    const bills = db.prepare(sql).all(...params);
    res.json(bills);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single bill with items and payment history
router.get('/:id', (req, res) => {
  try {
    const bill = db.prepare('SELECT b.*, c.phone as customer_phone FROM bills b LEFT JOIN customers c ON b.customer_id = c.id WHERE b.id = ?').get(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const items = enrichItemsWithStockRefs(bill, db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(bill.id));
    let payment_transactions = [];
    try {
      payment_transactions = db.prepare('SELECT amount, paid_at, payment_method, payment_type FROM payment_transactions WHERE bill_id = ? ORDER BY paid_at, id').all(bill.id);
    } catch (_) { /* table may not exist */ }
    res.json({ ...bill, items, payment_transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate next bill number
function getNextBillNumber() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const last = db.prepare(
    "SELECT bill_number FROM bills WHERE bill_number LIKE ? ORDER BY id DESC LIMIT 1"
  ).get(`BILL-${today}-%`);

  if (!last) return `BILL-${today}-001`;
  const num = parseInt(last.bill_number.split('-').pop()) + 1;
  return `BILL-${today}-${String(num).padStart(3, '0')}`;
}

// POST create bill
router.post('/', (req, res) => {
  try {
    const { customer_id, customer_name, customer_phone, items, discount = 0, payment_method, notes, advance_amount = 0 } = req.body;
    if (!customer_name || !items?.length || !payment_method) {
      return res.status(400).json({ error: 'customer_name, items, and payment_method required' });
    }

    let finalCustomerId = customer_id || null;
    const cleanPhone = String(customer_phone || '').trim();
    if (!finalCustomerId && cleanPhone) {
      const existingCustomer = db.prepare('SELECT * FROM customers WHERE phone = ? ORDER BY id DESC LIMIT 1').get(cleanPhone);
      if (existingCustomer) {
        finalCustomerId = existingCustomer.id;
      } else {
        const customerResult = db.prepare(
          'INSERT INTO customers (name, phone) VALUES (?, ?)'
        ).run(customer_name, cleanPhone);
        finalCustomerId = customerResult.lastInsertRowid;
      }
    }

    const bill_number = getNextBillNumber();
    const bill_date = new Date().toISOString().slice(0, 10);

    let subtotal = 0;
    const insertItem = db.prepare(`
      INSERT INTO bill_items (bill_id, service_type, item_name, size, quantity, unit_price, item_discount, subtotal, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const reduceFrameStock = db.prepare('UPDATE frame_sizes SET stock_qty = stock_qty - ? WHERE id = ?');
    const reducePhotoStock = db.prepare('UPDATE photo_sizes SET stock_qty = stock_qty - ? WHERE id = ?');
    const reducePhotocopyStock = db.prepare('UPDATE photocopy_sizes SET stock_qty = stock_qty - ? WHERE id = ?');
    const logStockTx = db.prepare(`
      INSERT INTO stock_transactions (item_type, item_id, transaction_type, quantity, previous_qty, new_qty, reason, user_action)
      VALUES (?, ?, 'reduce', ?, ?, ?, ?, 'billing')
    `);

    const createBill = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO bills (bill_number, bill_date, customer_id, customer_name, subtotal, discount, total, payment_method, notes, amount_paid)
        VALUES (?, ?, ?, ?, 0, ?, 0, ?, ?, 0)
      `).run(bill_number, bill_date, finalCustomerId, customer_name, discount, payment_method, notes || null);

      const billId = result.lastInsertRowid;

      for (const item of items) {
        const st = item.subtotal ?? ((item.quantity || 1) * (item.unit_price || 0) - (item.discount || 0));
        subtotal += st;
        const itemDiscount = item.discount ?? 0;
        insertItem.run(billId, item.service_type, item.item_name, item.size || null, item.quantity || 1, item.unit_price, itemDiscount, st, item.metadata ? JSON.stringify(item.metadata) : null);

        // Stock reduction: prices come from Settings; billing decreases stock on save.
        // Frames: simple qty decrease
        if (item.service_type === 'frame' && item.frame_id) {
          const frame = db.prepare('SELECT stock_qty FROM frame_sizes WHERE id = ?').get(item.frame_id);
          if (frame) {
            const qty = item.quantity || 1;
            if (qty > (frame.stock_qty || 0)) {
              throw insufficientStock(`Not enough frame stock for ${item.item_name}`);
            }
            reduceFrameStock.run(qty, item.frame_id);
            const updated = db.prepare('SELECT stock_qty FROM frame_sizes WHERE id = ?').get(item.frame_id);
            logStockTx.run('frame', item.frame_id, qty, frame.stock_qty, updated.stock_qty, `Bill #${bill_number}`);
          }
        }
        // Photos: simple qty decrease
        if (item.service_type === 'photo' && item.photo_id) {
          const photo = db.prepare('SELECT stock_qty FROM photo_sizes WHERE id = ?').get(item.photo_id);
          if (photo) {
            const qty = item.quantity || 1;
            if (qty > (photo.stock_qty || 0)) {
              throw insufficientStock(`Not enough photo stock for ${item.item_name}`);
            }
            reducePhotoStock.run(qty, item.photo_id);
            const updated = db.prepare('SELECT stock_qty FROM photo_sizes WHERE id = ?').get(item.photo_id);
            logStockTx.run('photo', item.photo_id, qty, photo.stock_qty, updated.stock_qty, `Bill #${bill_number}`);
          }
        }
        // Photocopy: simple qty decrease
        if (item.service_type === 'photocopy' && item.photocopy_id) {
          const photocopy = db.prepare('SELECT stock_qty FROM photocopy_sizes WHERE id = ?').get(item.photocopy_id);
          if (photocopy) {
            const qty = item.quantity || 1;
            if (qty > (photocopy.stock_qty || 0)) {
              throw insufficientStock(`Not enough photocopy stock for ${item.item_name}`);
            }
            reducePhotocopyStock.run(qty, item.photocopy_id);
            const updated = db.prepare('SELECT stock_qty FROM photocopy_sizes WHERE id = ?').get(item.photocopy_id);
            logStockTx.run('photocopy', item.photocopy_id, qty, photocopy.stock_qty, updated.stock_qty, `Bill #${bill_number}`);
          }
        }
        // Banners: identify roll by first number (width ft, e.g. 6ft/8ft), decrease length by sqft/width
        if ((item.service_type === 'banner_roll' || item.service_type === 'banner') && item.metadata) {
          const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
          const bannerStockId = meta.banner_stock_id;
          let widthFt = meta.width_ft;
          if (widthFt == null || widthFt <= 0) {
            const sizeStr = String(item.size || '');
            const m = sizeStr.match(/(\d+(?:\.\d+)?)\s*ft/i) || sizeStr.match(/(\d+)/);
            widthFt = m ? parseFloat(m[1]) : 6;
          }
          widthFt = widthFt > 0 ? widthFt : 6;
          if (bannerStockId) {
            if (meta.pricing_unit === 'per_qty') {
              // Rs/unit line: do not deduct roll length from physical stock
            } else {
              const sqft = parseFloat(item.quantity) || 0;
              const feetUsed = widthFt > 0 ? sqft / widthFt : 0;
              const banner = db.prepare('SELECT feet_remaining FROM banner_stock WHERE id = ?').get(bannerStockId);
              if (banner) {
                const prevFeet = banner.feet_remaining ?? 0;
                const availableSqft = prevFeet * widthFt;
                if (sqft > availableSqft + 0.0001) {
                  throw insufficientStock(`Not enough banner stock for ${item.item_name}`);
                }
                const newFeet = prevFeet - feetUsed;
                db.prepare('UPDATE banner_stock SET feet_remaining = ?, stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newFeet, Math.ceil(newFeet / 150), bannerStockId);
                logStockTx.run('banner', bannerStockId, Math.round(feetUsed * 100) / 100, prevFeet, newFeet, `Bill #${bill_number}`);
              }
            }
          }
        }
        // Stickers: same as banners – identify roll by width, decrease length by sqft/width
        if (item.service_type === 'sticker_roll' && item.metadata) {
          const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
          const stickerStockId = meta.sticker_stock_id;
          let widthFt = meta.width_ft;
          if (widthFt == null || widthFt <= 0) {
            const sizeStr = String(item.size || '');
            const m = sizeStr.match(/(\d+(?:\.\d+)?)\s*ft/i) || sizeStr.match(/(\d+)/);
            widthFt = m ? parseFloat(m[1]) : 6;
          }
          widthFt = widthFt > 0 ? widthFt : 6;
          if (stickerStockId) {
            const sqft = parseFloat(item.quantity) || 0;
            const feetUsed = widthFt > 0 ? sqft / widthFt : 0;
            const sticker = db.prepare('SELECT feet_remaining FROM sticker_stock WHERE id = ?').get(stickerStockId);
            if (sticker) {
              const prevFeet = sticker.feet_remaining ?? 0;
              const availableSqft = prevFeet * widthFt;
              if (sqft > availableSqft + 0.0001) {
                throw insufficientStock(`Not enough sticker stock for ${item.item_name}`);
              }
              const newFeet = prevFeet - feetUsed;
              db.prepare('UPDATE sticker_stock SET feet_remaining = ?, stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newFeet, Math.ceil(newFeet / 150), stickerStockId);
              logStockTx.run('sticker', stickerStockId, Math.round(feetUsed * 100) / 100, prevFeet, newFeet, `Bill #${bill_number}`);
            }
          }
        }
        // Custom section items (e.g. stamp printing)
        // Only reduce stock if section affects_sales (maintenance sections like ink do not reduce on billing)
        if (item.service_type === 'custom' && item.metadata) {
          const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
          const customItemId = meta.custom_item_id;
          if (customItemId) {
            const customRow = db.prepare('SELECT css.*, cs.section_type, COALESCE(cs.affects_sales, 1) as affects_sales FROM custom_section_stock css JOIN custom_sections cs ON css.section_id = cs.section_id WHERE css.id = ?').get(customItemId);
            if (customRow && customRow.affects_sales) {
              const qty = item.quantity || 1;
              if (customRow.section_type === 'roll') {
                let widthFt = meta.width_ft;
                if (widthFt == null || widthFt <= 0) {
                  const sizeStr = String(item.size || customRow.size_name || '');
                  const m = sizeStr.match(/(\d+(?:\.\d+)?)\s*ft/i) || sizeStr.match(/(\d+)/);
                  widthFt = m ? parseFloat(m[1]) : 6;
                }
                widthFt = widthFt > 0 ? widthFt : 6;
                const sqft = parseFloat(item.quantity) || 0;
                const feetUsed = widthFt > 0 ? sqft / widthFt : 0;
                const feetRemaining = (customRow.feet_remaining ?? (customRow.stock_qty ?? 0) * 150);
                const availableSqft = feetRemaining * widthFt;
                if (sqft > availableSqft + 0.0001) {
                  throw insufficientStock(`Not enough stock for ${item.item_name}`);
                }
                const newFeet = feetRemaining - feetUsed;
                const newStockQty = Math.ceil(newFeet / 150);
                db.prepare('UPDATE custom_section_stock SET stock_qty = ?, feet_remaining = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStockQty, newFeet, customItemId);
                logStockTx.run('custom', customItemId, Math.round(feetUsed * 100) / 100, feetRemaining, newFeet, `Bill #${bill_number}`);
              } else {
                const prevQty = customRow.stock_qty ?? 0;
                if (qty > prevQty) {
                  throw insufficientStock(`Not enough stock for ${item.item_name}`);
                }
                const newQty = prevQty - qty;
                db.prepare('UPDATE custom_section_stock SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, customItemId);
                logStockTx.run('custom', customItemId, qty, prevQty, newQty, `Bill #${bill_number}`);
              }
            }
          }
        }
      }

      const total = Math.max(0, subtotal - discount);
      const advance = Math.min(total, Math.max(0, parseFloat(String(advance_amount)) || 0));
      db.prepare('UPDATE bills SET subtotal = ?, total = ?, amount_paid = ? WHERE id = ?').run(subtotal, total, advance, billId);

      if (advance > 0) {
        const method = (payment_method || 'Cash').toString().toLowerCase() === 'bank' ? 'Bank' : 'Cash';
        try {
          db.prepare(`
            INSERT INTO payment_transactions (bill_id, amount, paid_at, payment_method, payment_type)
            VALUES (?, ?, ?, ?, 'advance')
          `).run(billId, advance, bill_date, method, 'advance');
        } catch (err) {
          console.error('payment_transactions insert failed:', err.message);
        }
      }

      return { id: billId, bill_number, bill_date };
    });

    const created = createBill();
    const bill = db.prepare('SELECT b.*, c.phone as customer_phone FROM bills b LEFT JOIN customers c ON b.customer_id = c.id WHERE b.id = ?').get(created.id);
    log('bill_created', 'bill', created.id, { bill_number: created.bill_number, customer_name: customer_name, total: bill.total });
    const billItems = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(created.id);
    let payment_transactions = [];
    try {
      payment_transactions = db.prepare('SELECT amount, paid_at, payment_method, payment_type FROM payment_transactions WHERE bill_id = ? ORDER BY paid_at, id').all(created.id);
    } catch (_) { /* table may not exist */ }
    res.status(201).json({ ...bill, items: billItems, payment_transactions });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

function rollbackBillingStock(reason) {
  const reduceTx = db.prepare(
    `SELECT * FROM stock_transactions
     WHERE reason = ?
       AND user_action = 'billing'
       AND transaction_type = 'reduce'`
  ).all(reason);

  const logAddTx = db.prepare(`
    INSERT INTO stock_transactions (item_type, item_id, transaction_type, quantity, previous_qty, new_qty, reason, user_action)
    VALUES (?, ?, 'add', ?, ?, ?, ?, 'billing')
  `);

  for (const tx of reduceTx) {
    const itemType = tx.item_type;
    const itemId = tx.item_id;
    const delta = Number(tx.previous_qty ?? 0) - Number(tx.new_qty ?? 0);
    if (!Number.isFinite(delta) || delta === 0) continue;

    if (itemType === 'frame') {
      const row = db.prepare('SELECT stock_qty FROM frame_sizes WHERE id = ?').get(itemId);
      if (!row) continue;
      const prevQty = Number(row.stock_qty || 0);
      const newQty = prevQty + delta;
      db.prepare('UPDATE frame_sizes SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, itemId);
      logAddTx.run('frame', itemId, delta, prevQty, newQty, `Undo edit ${reason}`);
    }
    if (itemType === 'photo') {
      const row = db.prepare('SELECT stock_qty FROM photo_sizes WHERE id = ?').get(itemId);
      if (!row) continue;
      const prevQty = Number(row.stock_qty || 0);
      const newQty = prevQty + delta;
      db.prepare('UPDATE photo_sizes SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, itemId);
      logAddTx.run('photo', itemId, delta, prevQty, newQty, `Undo edit ${reason}`);
    }
    if (itemType === 'photocopy') {
      const row = db.prepare('SELECT stock_qty FROM photocopy_sizes WHERE id = ?').get(itemId);
      if (!row) continue;
      const prevQty = Number(row.stock_qty || 0);
      const newQty = prevQty + delta;
      db.prepare('UPDATE photocopy_sizes SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, itemId);
      logAddTx.run('photocopy', itemId, delta, prevQty, newQty, `Undo edit ${reason}`);
    }
    if (itemType === 'banner') {
      const row = db.prepare('SELECT feet_remaining FROM banner_stock WHERE id = ?').get(itemId);
      if (!row) continue;
      const prevFeet = Number(row.feet_remaining ?? 0);
      const newFeet = prevFeet + delta;
      db.prepare('UPDATE banner_stock SET feet_remaining = ?, stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newFeet, Math.ceil(newFeet / 150), itemId);
      logAddTx.run('banner', itemId, delta, prevFeet, newFeet, `Undo edit ${reason}`);
    }
    if (itemType === 'sticker') {
      const row = db.prepare('SELECT feet_remaining FROM sticker_stock WHERE id = ?').get(itemId);
      if (!row) continue;
      const prevFeet = Number(row.feet_remaining ?? 0);
      const newFeet = prevFeet + delta;
      db.prepare('UPDATE sticker_stock SET feet_remaining = ?, stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newFeet, Math.ceil(newFeet / 150), itemId);
      logAddTx.run('sticker', itemId, delta, prevFeet, newFeet, `Undo edit ${reason}`);
    }
    if (itemType === 'custom') {
      const row = db.prepare('SELECT stock_qty, feet_remaining FROM custom_section_stock WHERE id = ?').get(itemId);
      if (!row) continue;
      const isFeet = row.feet_remaining !== null && row.feet_remaining !== undefined;
      const prev = Number(isFeet ? row.feet_remaining : row.stock_qty || 0);
      const next = prev + delta;
      if (isFeet) {
        db.prepare('UPDATE custom_section_stock SET stock_qty = ?, feet_remaining = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(Math.ceil(next / 150), next, itemId);
      } else {
        db.prepare('UPDATE custom_section_stock SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(next, itemId);
      }
      logAddTx.run('custom', itemId, delta, prev, next, `Undo edit ${reason}`);
    }
  }

  db.prepare(
    `DELETE FROM stock_transactions
     WHERE reason = ?
       AND user_action = 'billing'
       AND transaction_type = 'reduce'`
  ).run(reason);
}

function parseItemMeta(item) {
  if (!item || item.metadata == null) return {};
  if (typeof item.metadata === 'string') {
    try { return JSON.parse(item.metadata); } catch (_) { return {}; }
  }
  return item.metadata || {};
}

function reduceEditedItemStock(item, billNumber) {
  const meta = parseItemMeta(item);
  const logStockTx = db.prepare(`
    INSERT INTO stock_transactions (item_type, item_id, transaction_type, quantity, previous_qty, new_qty, reason, user_action)
    VALUES (?, ?, 'reduce', ?, ?, ?, ?, 'billing')
  `);
  const qty = parseFloat(String(item.quantity)) || 0;

  if (item.service_type === 'frame' && meta.frame_id) {
    const row = db.prepare('SELECT stock_qty FROM frame_sizes WHERE id = ?').get(meta.frame_id);
    if (!row) return;
    const prevQty = Number(row.stock_qty || 0);
    if (qty > prevQty) throw insufficientStock(`Not enough frame stock for ${item.item_name}`);
    const newQty = prevQty - qty;
    db.prepare('UPDATE frame_sizes SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, meta.frame_id);
    logStockTx.run('frame', meta.frame_id, qty, prevQty, newQty, `Bill #${billNumber}`);
  }

  if (item.service_type === 'photo' && meta.photo_id) {
    const row = db.prepare('SELECT stock_qty FROM photo_sizes WHERE id = ?').get(meta.photo_id);
    if (!row) return;
    const prevQty = Number(row.stock_qty || 0);
    if (qty > prevQty) throw insufficientStock(`Not enough photo stock for ${item.item_name}`);
    const newQty = prevQty - qty;
    db.prepare('UPDATE photo_sizes SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, meta.photo_id);
    logStockTx.run('photo', meta.photo_id, qty, prevQty, newQty, `Bill #${billNumber}`);
  }

  if (item.service_type === 'photocopy' && meta.photocopy_id) {
    const row = db.prepare('SELECT stock_qty FROM photocopy_sizes WHERE id = ?').get(meta.photocopy_id);
    if (!row) return;
    const prevQty = Number(row.stock_qty || 0);
    if (qty > prevQty) throw insufficientStock(`Not enough photocopy stock for ${item.item_name}`);
    const newQty = prevQty - qty;
    db.prepare('UPDATE photocopy_sizes SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, meta.photocopy_id);
    logStockTx.run('photocopy', meta.photocopy_id, qty, prevQty, newQty, `Bill #${billNumber}`);
  }

  if ((item.service_type === 'banner_roll' || item.service_type === 'banner') && meta.banner_stock_id && meta.pricing_unit !== 'per_qty') {
    const widthFt = Math.max(0.01, parseFloat(String(meta.width_ft || '')) || 6);
    const feetUsed = qty / widthFt;
    const row = db.prepare('SELECT feet_remaining FROM banner_stock WHERE id = ?').get(meta.banner_stock_id);
    if (!row) return;
    const prevFeet = Number(row.feet_remaining ?? 0);
    if (qty > (prevFeet * widthFt) + 0.0001) throw insufficientStock(`Not enough banner stock for ${item.item_name}`);
    const newFeet = prevFeet - feetUsed;
    db.prepare('UPDATE banner_stock SET feet_remaining = ?, stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newFeet, Math.ceil(newFeet / 150), meta.banner_stock_id);
    logStockTx.run('banner', meta.banner_stock_id, Math.round(feetUsed * 100) / 100, prevFeet, newFeet, `Bill #${billNumber}`);
  }

  if (item.service_type === 'sticker_roll' && meta.sticker_stock_id) {
    const widthFt = Math.max(0.01, parseFloat(String(meta.width_ft || '')) || 6);
    const feetUsed = qty / widthFt;
    const row = db.prepare('SELECT feet_remaining FROM sticker_stock WHERE id = ?').get(meta.sticker_stock_id);
    if (!row) return;
    const prevFeet = Number(row.feet_remaining ?? 0);
    if (qty > (prevFeet * widthFt) + 0.0001) throw insufficientStock(`Not enough sticker stock for ${item.item_name}`);
    const newFeet = prevFeet - feetUsed;
    db.prepare('UPDATE sticker_stock SET feet_remaining = ?, stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newFeet, Math.ceil(newFeet / 150), meta.sticker_stock_id);
    logStockTx.run('sticker', meta.sticker_stock_id, Math.round(feetUsed * 100) / 100, prevFeet, newFeet, `Bill #${billNumber}`);
  }

  if (item.service_type === 'custom' && meta.custom_item_id) {
    const customRow = db.prepare('SELECT css.*, cs.section_type, COALESCE(cs.affects_sales, 1) as affects_sales FROM custom_section_stock css JOIN custom_sections cs ON css.section_id = cs.section_id WHERE css.id = ?').get(meta.custom_item_id);
    if (!customRow || !customRow.affects_sales) return;
    if (customRow.section_type === 'roll') {
      const widthFt = Math.max(0.01, parseFloat(String(meta.width_ft || '')) || 6);
      const feetUsed = qty / widthFt;
      const prevFeet = Number(customRow.feet_remaining ?? (customRow.stock_qty ?? 0) * 150);
      if (qty > (prevFeet * widthFt) + 0.0001) throw insufficientStock(`Not enough stock for ${item.item_name}`);
      const newFeet = prevFeet - feetUsed;
      db.prepare('UPDATE custom_section_stock SET stock_qty = ?, feet_remaining = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(Math.ceil(newFeet / 150), newFeet, meta.custom_item_id);
      logStockTx.run('custom', meta.custom_item_id, Math.round(feetUsed * 100) / 100, prevFeet, newFeet, `Bill #${billNumber}`);
    } else {
      const prevQty = Number(customRow.stock_qty || 0);
      if (qty > prevQty) throw insufficientStock(`Not enough stock for ${item.item_name}`);
      const newQty = prevQty - qty;
      db.prepare('UPDATE custom_section_stock SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, meta.custom_item_id);
      logStockTx.run('custom', meta.custom_item_id, qty, prevQty, newQty, `Bill #${billNumber}`);
    }
  }
}

// PUT edit bill: rolls back old billing stock movement, replaces items, applies new movement, and logs the edit.
router.put('/:id', (req, res) => {
  try {
    const billId = parseInt(req.params.id);
    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const { customer_id, customer_name, customer_phone, items, discount = 0, payment_method, notes } = req.body || {};
    if (!customer_name || !items?.length || !payment_method) {
      return res.status(400).json({ error: 'customer_name, items, and payment_method required' });
    }

    const updated = db.transaction(() => {
      let finalCustomerId = customer_id || bill.customer_id || null;
      const cleanPhone = String(customer_phone || '').trim();
      if (!finalCustomerId && cleanPhone) {
        const existingCustomer = db.prepare('SELECT * FROM customers WHERE phone = ? ORDER BY id DESC LIMIT 1').get(cleanPhone);
        if (existingCustomer) {
          finalCustomerId = existingCustomer.id;
        } else {
          const info = db.prepare('INSERT INTO customers (name, phone) VALUES (?, ?)').run(customer_name, cleanPhone);
          finalCustomerId = info.lastInsertRowid;
        }
      }

      const reason = `Bill #${bill.bill_number}`;
      const oldTotal = Number(bill.total || 0);
      rollbackBillingStock(reason);
      db.prepare('DELETE FROM bill_items WHERE bill_id = ?').run(billId);

      const insertItem = db.prepare(`
        INSERT INTO bill_items (bill_id, service_type, item_name, size, quantity, unit_price, item_discount, subtotal, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let subtotal = 0;
      for (const item of items) {
        const itemDiscount = Number(item.item_discount ?? item.discount ?? 0) || 0;
        const quantity = Number(item.quantity || 0) || 0;
        const unitPrice = Number(item.unit_price || 0) || 0;
        const lineSubtotal = Math.max(0, Number(item.subtotal ?? (quantity * unitPrice - itemDiscount)) || 0);
        subtotal += lineSubtotal;
        const serviceType = item.service_type || 'manual';
        const metadata = item.metadata ? (typeof item.metadata === 'string' ? item.metadata : JSON.stringify(item.metadata)) : null;
        insertItem.run(billId, serviceType, item.item_name, item.size || null, quantity || 1, unitPrice, itemDiscount, lineSubtotal, metadata);
        reduceEditedItemStock({ ...item, service_type: serviceType, quantity, unit_price: unitPrice, item_discount: itemDiscount, subtotal: lineSubtotal }, bill.bill_number);
      }

      const total = Math.max(0, subtotal - (Number(discount) || 0));
      const amountPaid = Math.min(Number(bill.amount_paid || 0), total);
      db.prepare(`
        UPDATE bills
        SET customer_id = ?, customer_name = ?, subtotal = ?, discount = ?, total = ?, payment_method = ?, notes = ?, amount_paid = ?
        WHERE id = ?
      `).run(finalCustomerId, customer_name, subtotal, Number(discount) || 0, total, payment_method, notes || null, amountPaid, billId);

      if (finalCustomerId && customer_phone !== undefined) {
        db.prepare('UPDATE customers SET name = ?, phone = ? WHERE id = ?').run(customer_name, cleanPhone || null, finalCustomerId);
      }

      log('bill_edited', 'bill', billId, {
        bill_number: bill.bill_number,
        customer_name,
        old_total: oldTotal,
        new_total: total,
        item_count: items.length,
      });

      const nextBill = db.prepare('SELECT b.*, c.phone as customer_phone FROM bills b LEFT JOIN customers c ON b.customer_id = c.id WHERE b.id = ?').get(billId);
      const nextItems = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(billId);
      let payment_transactions = [];
      try {
        payment_transactions = db.prepare('SELECT amount, paid_at, payment_method, payment_type FROM payment_transactions WHERE bill_id = ? ORDER BY paid_at, id').all(billId);
      } catch (_) {}
      return { ...nextBill, items: nextItems, payment_transactions };
    })();

    res.json(updated);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// DELETE bill with rollback (stock + payment records)
router.delete('/:id', (req, res) => {
  try {
    const billId = parseInt(req.params.id);
    if (!Number.isFinite(billId)) return res.status(400).json({ error: 'Invalid bill id' });

    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const billNumber = bill.bill_number;
    const reduceReason = `Bill #${billNumber}`;

    db.transaction(() => {
      // 1) Roll back stock using the original billing reductions
      const reduceTx = db.prepare(
        `SELECT * FROM stock_transactions
         WHERE reason = ?
           AND user_action = 'billing'
           AND transaction_type = 'reduce'
        `
      ).all(reduceReason);

      const logAddTx = db.prepare(`
        INSERT INTO stock_transactions (item_type, item_id, transaction_type, quantity, previous_qty, new_qty, reason, user_action)
        VALUES (?, ?, 'add', ?, ?, ?, ?, 'billing')
      `);

      for (const tx of reduceTx) {
        const itemType = tx.item_type;
        const itemId = tx.item_id;
        // For reduce tx rows, previous_qty/new_qty represent the exact change applied to stock.
        // Using their difference avoids drift from any rounding done when writing tx.quantity.
        const prevLogged = Number(tx.previous_qty ?? 0);
        const newLogged = Number(tx.new_qty ?? 0);
        const delta = prevLogged - newLogged;
        if (!Number.isFinite(delta) || delta === 0) continue;

        if (itemType === 'frame') {
          const row = db.prepare('SELECT stock_qty FROM frame_sizes WHERE id = ?').get(itemId);
          if (!row) continue;
          const prevQty = Number(row.stock_qty || 0);
          const newQty = prevQty + delta;
          db.prepare('UPDATE frame_sizes SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, itemId);
          logAddTx.run('frame', itemId, delta, prevQty, newQty, `Undo delete ${reduceReason}`);
        }

        if (itemType === 'photo') {
          const row = db.prepare('SELECT stock_qty FROM photo_sizes WHERE id = ?').get(itemId);
          if (!row) continue;
          const prevQty = Number(row.stock_qty || 0);
          const newQty = prevQty + delta;
          db.prepare('UPDATE photo_sizes SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, itemId);
          logAddTx.run('photo', itemId, delta, prevQty, newQty, `Undo delete ${reduceReason}`);
        }

        if (itemType === 'photocopy') {
          const row = db.prepare('SELECT stock_qty FROM photocopy_sizes WHERE id = ?').get(itemId);
          if (!row) continue;
          const prevQty = Number(row.stock_qty || 0);
          const newQty = prevQty + delta;
          db.prepare('UPDATE photocopy_sizes SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, itemId);
          logAddTx.run('photocopy', itemId, delta, prevQty, newQty, `Undo delete ${reduceReason}`);
        }

        if (itemType === 'banner') {
          const row = db.prepare('SELECT feet_remaining FROM banner_stock WHERE id = ?').get(itemId);
          if (!row) continue;
          const prevFeet = Number(row.feet_remaining ?? 0);
          const newFeet = prevFeet + delta;
          const newStockQty = Math.ceil(newFeet / 150);
          db.prepare('UPDATE banner_stock SET feet_remaining = ?, stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newFeet, newStockQty, itemId);
          logAddTx.run('banner', itemId, delta, prevFeet, newFeet, `Undo delete ${reduceReason}`);
        }

        if (itemType === 'sticker') {
          const row = db.prepare('SELECT feet_remaining FROM sticker_stock WHERE id = ?').get(itemId);
          if (!row) continue;
          const prevFeet = Number(row.feet_remaining ?? 0);
          const newFeet = prevFeet + delta;
          const newStockQty = Math.ceil(newFeet / 150);
          db.prepare('UPDATE sticker_stock SET feet_remaining = ?, stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newFeet, newStockQty, itemId);
          logAddTx.run('sticker', itemId, delta, prevFeet, newFeet, `Undo delete ${reduceReason}`);
        }
      }

      // 2) Remove payment records (payment_transactions references bills without ON DELETE CASCADE)
      db.prepare('DELETE FROM payment_transactions WHERE bill_id = ?').run(billId);

      // 3) Remove the original billing reduce stock logs for this bill
      db.prepare(
        `DELETE FROM stock_transactions
         WHERE reason = ?
           AND user_action = 'billing'
           AND transaction_type = 'reduce'
        `
      ).run(reduceReason);

      // 4) Delete the bill itself (bill_items will be removed via ON DELETE CASCADE)
      db.prepare('DELETE FROM bills WHERE id = ?').run(billId);

      log('bill_deleted', 'bill', billId, { bill_number: billNumber });
    })();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
