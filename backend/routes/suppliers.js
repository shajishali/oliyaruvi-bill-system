const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../config/database');
const { log } = require('../lib/activityLog');
const { addDailyExpense, wantsFromCollection } = require('../lib/dailyExpense');

const PAY_METHODS = ['Cash', 'Bank', 'Card', 'Credit'];
const MAX_ATTACH_BYTES = 5 * 1024 * 1024;

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function clean(value) {
  const s = String(value || '').trim();
  return s || null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function payMethod(value, fallback = 'Cash') {
  return PAY_METHODS.includes(value) ? value : fallback;
}

function nextBillNumber(billDate) {
  const day = String(billDate || today()).replace(/-/g, '');
  const prefix = `PUR-${day}-`;
  const row = db.prepare(`
    SELECT bill_number FROM supplier_bills
    WHERE bill_number LIKE ?
    ORDER BY bill_number DESC LIMIT 1
  `).get(prefix + '%');
  let n = 1;
  if (row?.bill_number) {
    const last = parseInt(String(row.bill_number).slice(prefix.length), 10);
    if (!Number.isNaN(last)) n = last + 1;
  }
  return prefix + String(n).padStart(3, '0');
}

function attachDir() {
  const dir = path.join(db.dbDir, 'supplier-bill-attachments');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function attachPath(billId, ext) {
  return path.join(attachDir(), `${billId}.${ext}`);
}

function removeAttachmentFiles(billId) {
  const dir = attachDir();
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(`${billId}.`)) {
      try { fs.unlinkSync(path.join(dir, name)); } catch (_) { /* ignore */ }
    }
  }
}

function detectAttachment(buffer, mime, fileName) {
  const lowerMime = String(mime || '').toLowerCase();
  const lowerName = String(fileName || '').toLowerCase();
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return { ext: 'png', mime: 'image/png' };
  if (buffer.slice(0, 4).toString() === '%PDF') return { ext: 'pdf', mime: 'application/pdf' };
  if (lowerMime.includes('jpeg') || lowerMime.includes('jpg') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (lowerMime.includes('png') || lowerName.endsWith('.png')) return { ext: 'png', mime: 'image/png' };
  if (lowerMime.includes('pdf') || lowerName.endsWith('.pdf')) return { ext: 'pdf', mime: 'application/pdf' };
  return null;
}

function saveAttachment(billId, body) {
  const fileName = clean(body?.file_name) || clean(body?.attachment_name) || 'bill';
  const mime = String(body?.mime || body?.attachment_mime || '');
  const raw = String(body?.data || body?.attachment_data || '').replace(/^data:[^;]+;base64,/, '');
  if (!raw) return null;
  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length) throw new Error('Attachment file is empty');
  if (buffer.length > MAX_ATTACH_BYTES) throw new Error('Attachment must be under 5 MB');
  const kind = detectAttachment(buffer, mime, fileName);
  if (!kind) throw new Error('Only JPEG, PNG, or PDF bills can be uploaded');
  removeAttachmentFiles(billId);
  fs.writeFileSync(attachPath(billId, kind.ext), buffer);
  db.prepare(`
    UPDATE supplier_bills
    SET attachment_name = ?, attachment_ext = ?, attachment_mime = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(fileName, kind.ext, kind.mime, billId);
  return { attachment_name: fileName, attachment_ext: kind.ext, attachment_mime: kind.mime };
}

function getBill(id) {
  const bill = db.prepare(`
    SELECT b.*, s.name AS supplier_name, s.phone AS supplier_phone, s.address AS supplier_address
    FROM supplier_bills b
    JOIN suppliers s ON s.id = b.supplier_id
    WHERE b.id = ?
  `).get(id);
  if (!bill) return null;
  const items = db.prepare('SELECT * FROM supplier_bill_items WHERE bill_id = ? ORDER BY id').all(id);
  let payments = [];
  try {
    payments = db.prepare(`
      SELECT * FROM supplier_bill_payments WHERE bill_id = ? ORDER BY paid_on ASC, id ASC
    `).all(id);
  } catch (_) { /* migration may not have run */ }
  const amountPaid = roundMoney(bill.amount_paid || 0);
  const total = roundMoney(bill.total || 0);
  return {
    ...bill,
    total,
    subtotal: roundMoney(bill.subtotal || 0),
    amount_paid: amountPaid,
    balance: roundMoney(Math.max(0, total - amountPaid)),
    has_attachment: !!(bill.attachment_ext && bill.attachment_name),
    items: items.map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      unit_price: roundMoney(i.unit_price),
      line_total: roundMoney(i.line_total),
    })),
    payments: payments.map((p) => ({
      ...p,
      amount: roundMoney(p.amount),
    })),
  };
}

function normalizeItems(rawItems) {
  return (Array.isArray(rawItems) ? rawItems : [])
    .map((row) => {
      const item_name = clean(row?.item_name);
      const quantity = Math.max(0, Number(row?.quantity) || 0);
      const unit_price = roundMoney(row?.unit_price);
      const unit = clean(row?.unit);
      if (!item_name || quantity <= 0) return null;
      return {
        item_name,
        quantity,
        unit,
        unit_price,
        line_total: roundMoney(quantity * unit_price),
      };
    })
    .filter(Boolean);
}

function insertPayment(billId, amount, method, paidOn, notes) {
  if (amount <= 0) return;
  db.prepare(`
    INSERT INTO supplier_bill_payments (bill_id, amount, payment_method, paid_on, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(billId, amount, method, paidOn || today(), notes || null);
}

// List companies
router.get('/', (req, res) => {
  try {
    const q = clean(req.query.q);
    let sql = `
      SELECT s.*,
        (SELECT COUNT(*) FROM supplier_bills b WHERE b.supplier_id = s.id) AS bill_count,
        (SELECT COALESCE(SUM(b.total), 0) FROM supplier_bills b WHERE b.supplier_id = s.id) AS total_spent,
        (SELECT COALESCE(SUM(b.amount_paid), 0) FROM supplier_bills b WHERE b.supplier_id = s.id) AS total_paid
      FROM suppliers s
      WHERE 1=1
    `;
    const params = [];
    if (q) {
      sql += ' AND (s.name LIKE ? OR IFNULL(s.phone, \'\') LIKE ? OR IFNULL(s.address, \'\') LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    sql += ' ORDER BY s.name COLLATE NOCASE';
    const rows = db.prepare(sql).all(...params).map((r) => ({
      ...r,
      total_spent: roundMoney(r.total_spent),
      total_paid: roundMoney(r.total_paid),
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/bills/list', (req, res) => {
  try {
    const { date, from, to, supplier_id, q } = req.query;
    let sql = `
      SELECT b.*, s.name AS supplier_name, s.phone AS supplier_phone,
        (SELECT COUNT(*) FROM supplier_bill_items i WHERE i.bill_id = b.id) AS item_count
      FROM supplier_bills b
      JOIN suppliers s ON s.id = b.supplier_id
      WHERE 1=1
    `;
    const params = [];
    if (date) { sql += ' AND b.bill_date = ?'; params.push(date); }
    if (from) { sql += ' AND b.bill_date >= ?'; params.push(from); }
    if (to) { sql += ' AND b.bill_date <= ?'; params.push(to); }
    if (supplier_id) { sql += ' AND b.supplier_id = ?'; params.push(Number(supplier_id)); }
    if (q) {
      sql += ' AND (b.bill_number LIKE ? OR s.name LIKE ? OR IFNULL(b.notes, \'\') LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    sql += ' ORDER BY b.bill_date DESC, b.id DESC';
    const rows = db.prepare(sql).all(...params).map((r) => {
      const total = roundMoney(r.total);
      const amount_paid = roundMoney(r.amount_paid || 0);
      return {
        ...r,
        total,
        subtotal: roundMoney(r.subtotal),
        amount_paid,
        balance: roundMoney(Math.max(0, total - amount_paid)),
        has_attachment: !!(r.attachment_ext && r.attachment_name),
      };
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/bills/:id', (req, res) => {
  try {
    const bill = getBill(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    res.json(bill);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/bills/:id/attachment', (req, res) => {
  try {
    const bill = db.prepare('SELECT * FROM supplier_bills WHERE id = ?').get(req.params.id);
    if (!bill || !bill.attachment_ext) return res.status(404).json({ error: 'No bill file uploaded' });
    const file = attachPath(bill.id, bill.attachment_ext);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Bill file missing' });
    res.setHeader('Content-Type', bill.attachment_mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${(bill.attachment_name || 'bill').replace(/"/g, '')}"`);
    res.sendFile(file);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bills/:id/attachment', (req, res) => {
  try {
    const bill = db.prepare('SELECT * FROM supplier_bills WHERE id = ?').get(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    const saved = saveAttachment(bill.id, req.body || {});
    if (!saved) return res.status(400).json({ error: 'Choose a bill image or PDF' });
    log('supplier_bill_attachment', 'supplier_bill', bill.id, { bill_number: bill.bill_number, ...saved });
    res.json(getBill(bill.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/bills/:id/attachment', (req, res) => {
  try {
    const bill = db.prepare('SELECT * FROM supplier_bills WHERE id = ?').get(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    removeAttachmentFiles(bill.id);
    db.prepare(`
      UPDATE supplier_bills
      SET attachment_name = NULL, attachment_ext = NULL, attachment_mime = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(bill.id);
    res.json(getBill(bill.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bills/:id/payments', (req, res) => {
  try {
    const bill = db.prepare('SELECT * FROM supplier_bills WHERE id = ?').get(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    const amount = roundMoney(req.body?.amount);
    if (amount <= 0) return res.status(400).json({ error: 'Enter an amount greater than 0' });
    const balance = roundMoney(Math.max(0, (bill.total || 0) - (bill.amount_paid || 0)));
    if (balance <= 0) return res.status(400).json({ error: 'This bill is already fully paid' });
    const payAmount = Math.min(amount, balance);
    const method = payMethod(req.body?.payment_method, 'Cash');
    if (method === 'Credit') return res.status(400).json({ error: 'Choose Cash, Bank, or Card for a payment' });
    const paidOn = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.paid_on || ''))
      ? String(req.body.paid_on)
      : today();
    const notes = clean(req.body?.notes);
    const newPaid = roundMoney((bill.amount_paid || 0) + payAmount);
    const fromCollection = wantsFromCollection(req.body);
    const supplier = db.prepare('SELECT name FROM suppliers WHERE id = ?').get(bill.supplier_id);

    db.transaction(() => {
      insertPayment(bill.id, payAmount, method, paidOn, notes);
      db.prepare(`
        UPDATE supplier_bills
        SET amount_paid = ?, payment_method = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newPaid, method, bill.id);
      if (fromCollection) {
        addDailyExpense(
          paidOn,
          payAmount,
          `Supplier payment: ${supplier?.name || 'Supplier'} · ${bill.bill_number} (${method})`
        );
      }
    })();

    log('supplier_bill_payment', 'supplier_bill', bill.id, {
      bill_number: bill.bill_number,
      amount: payAmount,
      payment_method: method,
      from_collection: fromCollection,
    });
    res.status(201).json(getBill(bill.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bills', (req, res) => {
  try {
    const supplierId = Number(req.body?.supplier_id);
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
    if (!supplier) return res.status(400).json({ error: 'Choose a company' });

    const billDate = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.bill_date || ''))
      ? String(req.body.bill_date)
      : today();
    let billNumber = clean(req.body?.bill_number);
    if (!billNumber) billNumber = nextBillNumber(billDate);
    else if (db.prepare('SELECT id FROM supplier_bills WHERE bill_number = ?').get(billNumber)) {
      return res.status(400).json({ error: 'Bill number already exists' });
    }

    const items = normalizeItems(req.body?.items);
    const subtotal = roundMoney(items.reduce((sum, i) => sum + i.line_total, 0));
    const total = req.body?.total != null && req.body.total !== ''
      ? roundMoney(req.body.total)
      : subtotal;
    if (!(total > 0)) {
      return res.status(400).json({ error: 'Enter the total bill amount (or item prices)' });
    }
    const payment = payMethod(req.body?.payment_method, 'Cash');
    let amountPaid = req.body?.amount_paid != null && req.body.amount_paid !== ''
      ? roundMoney(req.body.amount_paid)
      : (payment === 'Credit' ? 0 : total);
    if (amountPaid < 0) amountPaid = 0;
    if (amountPaid > total) amountPaid = total;
    const notes = clean(req.body?.notes);

    const insertBill = db.prepare(`
      INSERT INTO supplier_bills (supplier_id, bill_number, bill_date, subtotal, total, amount_paid, payment_method, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertItem = db.prepare(`
      INSERT INTO supplier_bill_items (bill_id, item_name, quantity, unit, unit_price, line_total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const fromCollection = wantsFromCollection(req.body) && amountPaid > 0 && payment !== 'Credit';

    const billId = db.transaction(() => {
      const result = insertBill.run(supplierId, billNumber, billDate, subtotal, total, amountPaid, payment, notes);
      const id = result.lastInsertRowid;
      for (const item of items) {
        insertItem.run(id, item.item_name, item.quantity, item.unit, item.unit_price, item.line_total);
      }
      if (amountPaid > 0 && payment !== 'Credit') {
        insertPayment(id, amountPaid, payment, billDate, 'Paid when bill was recorded');
        if (fromCollection) {
          addDailyExpense(
            billDate,
            amountPaid,
            `Supplier payment: ${supplier.name} · ${billNumber} (${payment})`
          );
        }
      }
      return id;
    })();

    if (req.body?.attachment_data || req.body?.data) {
      try { saveAttachment(billId, req.body); } catch (attachErr) {
        return res.status(400).json({ error: attachErr.message });
      }
    }

    const created = getBill(billId);
    log('supplier_bill_created', 'supplier_bill', billId, {
      bill_number: billNumber,
      supplier_id: supplierId,
      supplier_name: supplier.name,
      total,
      amount_paid: amountPaid,
      item_count: items.length,
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/bills/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM supplier_bills WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Bill not found' });

    const supplierId = req.body?.supplier_id != null ? Number(req.body.supplier_id) : existing.supplier_id;
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
    if (!supplier) return res.status(400).json({ error: 'Choose a company' });

    const billDate = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.bill_date || ''))
      ? String(req.body.bill_date)
      : existing.bill_date;
    let billNumber = req.body?.bill_number !== undefined ? clean(req.body.bill_number) : existing.bill_number;
    if (!billNumber) billNumber = existing.bill_number;
    const clash = db.prepare('SELECT id FROM supplier_bills WHERE bill_number = ? AND id != ?').get(billNumber, existing.id);
    if (clash) return res.status(400).json({ error: 'Bill number already exists' });

    const rawItems = Array.isArray(req.body?.items) ? req.body.items : null;
    let items = null;
    let subtotal = existing.subtotal;
    let total = existing.total;

    if (rawItems) {
      items = normalizeItems(rawItems);
      subtotal = roundMoney(items.reduce((sum, i) => sum + i.line_total, 0));
      total = req.body?.total != null && req.body.total !== '' ? roundMoney(req.body.total) : subtotal;
    } else if (req.body?.total != null && req.body.total !== '') {
      total = roundMoney(req.body.total);
    }
    if (!(total > 0)) {
      return res.status(400).json({ error: 'Enter the total bill amount (or item prices)' });
    }

    const payment = payMethod(req.body?.payment_method, existing.payment_method);
    const notes = req.body?.notes !== undefined ? clean(req.body.notes) : existing.notes;
    let amountPaid = existing.amount_paid || 0;
    if (req.body?.amount_paid != null && req.body.amount_paid !== '') {
      amountPaid = roundMoney(req.body.amount_paid);
    }
    if (amountPaid < 0) amountPaid = 0;
    if (amountPaid > total) amountPaid = total;

    db.transaction(() => {
      db.prepare(`
        UPDATE supplier_bills
        SET supplier_id = ?, bill_number = ?, bill_date = ?, subtotal = ?, total = ?,
            amount_paid = ?, payment_method = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(supplierId, billNumber, billDate, subtotal, total, amountPaid, payment, notes, existing.id);

      if (items) {
        db.prepare('DELETE FROM supplier_bill_items WHERE bill_id = ?').run(existing.id);
        const insertItem = db.prepare(`
          INSERT INTO supplier_bill_items (bill_id, item_name, quantity, unit, unit_price, line_total)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const item of items) {
          insertItem.run(existing.id, item.item_name, item.quantity, item.unit, item.unit_price, item.line_total);
        }
      }
    })();

    if (req.body?.attachment_data || req.body?.data) {
      try { saveAttachment(existing.id, req.body); } catch (attachErr) {
        return res.status(400).json({ error: attachErr.message });
      }
    }

    const updated = getBill(existing.id);
    log('supplier_bill_updated', 'supplier_bill', existing.id, {
      bill_number: billNumber,
      supplier_name: supplier.name,
      total,
      amount_paid: amountPaid,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/bills/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM supplier_bills WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Bill not found' });
    removeAttachmentFiles(existing.id);
    db.transaction(() => {
      try { db.prepare('DELETE FROM supplier_bill_payments WHERE bill_id = ?').run(existing.id); } catch (_) { /* ignore */ }
      db.prepare('DELETE FROM supplier_bill_items WHERE bill_id = ?').run(existing.id);
      db.prepare('DELETE FROM supplier_bills WHERE id = ?').run(existing.id);
    })();
    log('supplier_bill_deleted', 'supplier_bill', existing.id, { bill_number: existing.bill_number });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    if (!/^\d+$/.test(String(req.params.id))) {
      return res.status(404).json({ error: 'Company not found' });
    }
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Company not found' });
    const bills = db.prepare(`
      SELECT b.*,
        (SELECT COUNT(*) FROM supplier_bill_items i WHERE i.bill_id = b.id) AS item_count
      FROM supplier_bills b
      WHERE b.supplier_id = ?
      ORDER BY b.bill_date DESC, b.id DESC
    `).all(supplier.id).map((b) => {
      const total = roundMoney(b.total);
      const amount_paid = roundMoney(b.amount_paid || 0);
      return {
        ...b,
        total,
        subtotal: roundMoney(b.subtotal),
        amount_paid,
        balance: roundMoney(Math.max(0, total - amount_paid)),
        has_attachment: !!(b.attachment_ext && b.attachment_name),
      };
    });
    res.json({
      ...supplier,
      bills,
      bill_count: bills.length,
      total_spent: roundMoney(bills.reduce((sum, b) => sum + (b.total || 0), 0)),
      total_paid: roundMoney(bills.reduce((sum, b) => sum + (b.amount_paid || 0), 0)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const name = clean(req.body?.name);
    if (!name) return res.status(400).json({ error: 'Company name is required' });
    const result = db.prepare(`
      INSERT INTO suppliers (name, phone, email, address, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      name,
      clean(req.body?.phone),
      clean(req.body?.email),
      clean(req.body?.address),
      clean(req.body?.notes)
    );
    const created = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);
    log('supplier_created', 'supplier', created.id, { name: created.name });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Company not found' });
    const name = req.body?.name !== undefined ? clean(req.body.name) : existing.name;
    if (!name) return res.status(400).json({ error: 'Company name is required' });
    db.prepare(`
      UPDATE suppliers
      SET name = ?, phone = ?, email = ?, address = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      req.body?.phone !== undefined ? clean(req.body.phone) : existing.phone,
      req.body?.email !== undefined ? clean(req.body.email) : existing.email,
      req.body?.address !== undefined ? clean(req.body.address) : existing.address,
      req.body?.notes !== undefined ? clean(req.body.notes) : existing.notes,
      existing.id
    );
    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(existing.id);
    log('supplier_updated', 'supplier', updated.id, { name: updated.name });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Company not found' });
    db.transaction(() => {
      const billIds = db.prepare('SELECT id FROM supplier_bills WHERE supplier_id = ?').all(existing.id).map((r) => r.id);
      for (const billId of billIds) {
        removeAttachmentFiles(billId);
        try { db.prepare('DELETE FROM supplier_bill_payments WHERE bill_id = ?').run(billId); } catch (_) { /* ignore */ }
        db.prepare('DELETE FROM supplier_bill_items WHERE bill_id = ?').run(billId);
      }
      db.prepare('DELETE FROM supplier_bills WHERE supplier_id = ?').run(existing.id);
      db.prepare('DELETE FROM suppliers WHERE id = ?').run(existing.id);
    })();
    log('supplier_deleted', 'supplier', existing.id, { name: existing.name });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
