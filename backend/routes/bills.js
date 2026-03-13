const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET all bills (with optional date filter)
router.get('/', (req, res) => {
  try {
    const { date, from, to, number, customer } = req.query;
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
    sql += ' ORDER BY b.created_at DESC';

    const bills = db.prepare(sql).all(...params);
    res.json(bills);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single bill with items
router.get('/:id', (req, res) => {
  try {
    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(bill.id);
    res.json({ ...bill, items });
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
    const { customer_id, customer_name, items, discount = 0, payment_method, notes } = req.body;
    if (!customer_name || !items?.length || !payment_method) {
      return res.status(400).json({ error: 'customer_name, items, and payment_method required' });
    }

    const bill_number = getNextBillNumber();
    const bill_date = new Date().toISOString().slice(0, 10);

    let subtotal = 0;
    const insertItem = db.prepare(`
      INSERT INTO bill_items (bill_id, service_type, item_name, size, quantity, unit_price, subtotal, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const reduceFrameStock = db.prepare('UPDATE frame_sizes SET stock_qty = stock_qty - ? WHERE id = ?');
    const reducePhotoStock = db.prepare('UPDATE photo_sizes SET stock_qty = stock_qty - ? WHERE id = ?');
    const logStockTx = db.prepare(`
      INSERT INTO stock_transactions (item_type, item_id, transaction_type, quantity, previous_qty, new_qty, reason, user_action)
      VALUES (?, ?, 'reduce', ?, ?, ?, ?, 'billing')
    `);

    const createBill = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO bills (bill_number, bill_date, customer_id, customer_name, subtotal, discount, total, payment_method, notes)
        VALUES (?, ?, ?, ?, 0, ?, 0, ?, ?)
      `).run(bill_number, bill_date, customer_id || null, customer_name, discount, payment_method, notes || null);

      const billId = result.lastInsertRowid;

      for (const item of items) {
        const st = (item.quantity || 1) * (item.unit_price || 0);
        subtotal += st;
        insertItem.run(billId, item.service_type, item.item_name, item.size || null, item.quantity || 1, item.unit_price, st, item.metadata ? JSON.stringify(item.metadata) : null);

        // Reduce stock for frame/photo
        if (item.service_type === 'frame' && item.frame_id) {
          const frame = db.prepare('SELECT stock_qty FROM frame_sizes WHERE id = ?').get(item.frame_id);
          if (frame) {
            const qty = item.quantity || 1;
            reduceFrameStock.run(qty, item.frame_id);
            const updated = db.prepare('SELECT stock_qty FROM frame_sizes WHERE id = ?').get(item.frame_id);
            logStockTx.run('frame', item.frame_id, qty, frame.stock_qty, updated.stock_qty, `Bill #${bill_number}`);
          }
        }
        if (item.service_type === 'photo' && item.photo_id) {
          const photo = db.prepare('SELECT stock_qty FROM photo_sizes WHERE id = ?').get(item.photo_id);
          if (photo) {
            const qty = item.quantity || 1;
            reducePhotoStock.run(qty, item.photo_id);
            const updated = db.prepare('SELECT stock_qty FROM photo_sizes WHERE id = ?').get(item.photo_id);
            logStockTx.run('photo', item.photo_id, qty, photo.stock_qty, updated.stock_qty, `Bill #${bill_number}`);
          }
        }
      }

      const total = subtotal - discount;
      db.prepare('UPDATE bills SET subtotal = ?, total = ? WHERE id = ?').run(subtotal, total, billId);

      return { id: billId, bill_number, bill_date };
    });

    const created = createBill();
    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(created.id);
    const billItems = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(created.id);
    res.status(201).json({ ...bill, items: billItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
