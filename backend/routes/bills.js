const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { log } = require('../lib/activityLog');

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
      `).run(bill.id, payAmount, today, method);
    } catch (_) { /* table may not exist yet */ }
    log('bill_balance_paid', 'bill', bill.id, { bill_number: bill.bill_number, amount: payAmount });
    const updated = db.prepare('SELECT * FROM bills WHERE id = ?').get(bill.id);
    const items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(bill.id);
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
    const { date, from, to, number, customer, pending_settlement } = req.query;
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
    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(bill.id);
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
    const { customer_id, customer_name, items, discount = 0, payment_method, notes, advance_amount = 0 } = req.body;
    if (!customer_name || !items?.length || !payment_method) {
      return res.status(400).json({ error: 'customer_name, items, and payment_method required' });
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
    const logStockTx = db.prepare(`
      INSERT INTO stock_transactions (item_type, item_id, transaction_type, quantity, previous_qty, new_qty, reason, user_action)
      VALUES (?, ?, 'reduce', ?, ?, ?, ?, 'billing')
    `);

    const createBill = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO bills (bill_number, bill_date, customer_id, customer_name, subtotal, discount, total, payment_method, notes, amount_paid)
        VALUES (?, ?, ?, ?, 0, ?, 0, ?, ?, 0)
      `).run(bill_number, bill_date, customer_id || null, customer_name, discount, payment_method, notes || null);

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
            reducePhotoStock.run(qty, item.photo_id);
            const updated = db.prepare('SELECT stock_qty FROM photo_sizes WHERE id = ?').get(item.photo_id);
            logStockTx.run('photo', item.photo_id, qty, photo.stock_qty, updated.stock_qty, `Bill #${bill_number}`);
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
            const sqft = parseFloat(item.quantity) || 0;
            const feetUsed = widthFt > 0 ? sqft / widthFt : 0;
            const banner = db.prepare('SELECT feet_remaining FROM banner_stock WHERE id = ?').get(bannerStockId);
            if (banner) {
              const prevFeet = banner.feet_remaining ?? 0;
              const newFeet = Math.max(0, prevFeet - feetUsed);
              db.prepare('UPDATE banner_stock SET feet_remaining = ?, stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newFeet, Math.ceil(newFeet / 150), bannerStockId);
              logStockTx.run('banner', bannerStockId, Math.round(feetUsed * 100) / 100, prevFeet, newFeet, `Bill #${bill_number}`);
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
              const newFeet = Math.max(0, prevFeet - feetUsed);
              db.prepare('UPDATE sticker_stock SET feet_remaining = ?, stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newFeet, Math.ceil(newFeet / 150), stickerStockId);
              logStockTx.run('sticker', stickerStockId, Math.round(feetUsed * 100) / 100, prevFeet, newFeet, `Bill #${bill_number}`);
            }
          }
        }
      }

      const total = Math.max(0, subtotal - discount);
      const advance = Math.min(total, Math.max(0, parseFloat(String(advance_amount)) || 0));
      db.prepare('UPDATE bills SET subtotal = ?, total = ?, amount_paid = ? WHERE id = ?').run(subtotal, total, advance, billId);

      if (advance > 0) {
        try {
          db.prepare(`
            INSERT INTO payment_transactions (bill_id, amount, paid_at, payment_method, payment_type)
            VALUES (?, ?, ?, ?, 'advance')
          `).run(billId, advance, bill_date, payment_method, 'advance');
        } catch (_) { /* table may not exist yet */ }
      }

      return { id: billId, bill_number, bill_date };
    });

    const created = createBill();
    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(created.id);
    log('bill_created', 'bill', created.id, { bill_number: created.bill_number, customer_name: customer_name, total: bill.total });
    const billItems = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(created.id);
    let payment_transactions = [];
    try {
      payment_transactions = db.prepare('SELECT amount, paid_at, payment_method, payment_type FROM payment_transactions WHERE bill_id = ? ORDER BY paid_at, id').all(created.id);
    } catch (_) { /* table may not exist */ }
    res.status(201).json({ ...bill, items: billItems, payment_transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
