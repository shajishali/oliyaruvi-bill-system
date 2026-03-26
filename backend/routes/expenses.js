const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { log } = require('../lib/activityLog');

// List expenses for a date (or date range)
router.get('/', (req, res) => {
  try {
    const { date, from, to } = req.query;
    let sql = 'SELECT * FROM daily_expenses WHERE 1=1';
    const params = [];

    if (date) {
      sql += ' AND expense_date = ?';
      params.push(date);
    }
    if (from) {
      sql += ' AND expense_date >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND expense_date <= ?';
      params.push(to);
    }
    sql += ' ORDER BY expense_date DESC, created_at DESC';

    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add expense
router.post('/', (req, res) => {
  try {
    const { expense_date, amount, description } = req.body || {};
    const date = expense_date || new Date().toISOString().slice(0, 10);
    const amt = parseFloat(amount) || 0;
    const desc = description ? String(description).trim() : null;

    if (amt <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const result = db.prepare(`
      INSERT INTO daily_expenses (expense_date, amount, description)
      VALUES (?, ?, ?)
    `).run(date, amt, desc);

    const created = db.prepare('SELECT * FROM daily_expenses WHERE id = ?').get(result.lastInsertRowid);
    log('expense_added', 'expense', created.id, {
      expense_date: date,
      amount: amt,
      description: desc || '',
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update expense
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { amount, description } = req.body || {};
    const existing = db.prepare('SELECT * FROM daily_expenses WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const amt = amount != null ? parseFloat(amount) : existing.amount;
    const desc = description !== undefined ? (description ? String(description).trim() : null) : existing.description;

    if (amt <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    db.prepare(`
      UPDATE daily_expenses SET amount = ?, description = ? WHERE id = ?
    `).run(amt, desc, id);

    const updated = db.prepare('SELECT * FROM daily_expenses WHERE id = ?').get(id);
    log('expense_updated', 'expense', id, {
      expense_date: existing.expense_date,
      amount: amt,
      description: desc || '',
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete expense
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM daily_expenses WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    db.prepare('DELETE FROM daily_expenses WHERE id = ?').run(id);
    log('expense_deleted', 'expense', id, {
      expense_date: existing.expense_date,
      amount: existing.amount,
      description: existing.description || '',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
