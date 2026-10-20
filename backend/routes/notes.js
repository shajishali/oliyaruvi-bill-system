const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { log } = require('../lib/activityLog');
const { addDailyExpense, roundMoney } = require('../lib/dailyExpense');
const { syncNoteReminders } = require('../lib/noteReminders');

function clean(value) {
  return String(value || '').trim();
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getNote(id) {
  return db.prepare('SELECT * FROM shop_notes WHERE id = ?').get(id);
}

function boolish(v) {
  return v === true || v === 1 || v === '1' || v === 'true';
}

function applyCollection(noteId, moneyDirection, amount, collectionDate, description) {
  const date = collectionDate || today();
  const amt = roundMoney(amount);
  if (!(amt > 0)) return { expense_id: null, collection_add_id: null };

  if (moneyDirection === 'out') {
    const expense = addDailyExpense(date, amt, description || 'Note: money out');
    return { expense_id: expense?.id || null, collection_add_id: null };
  }

  if (moneyDirection === 'in') {
    const result = db.prepare(`
      INSERT INTO daily_collection_adds (add_date, amount, description, note_id)
      VALUES (?, ?, ?, ?)
    `).run(date, amt, description || 'Note: money in', noteId);
    log('collection_add', 'collection_add', result.lastInsertRowid, {
      add_date: date,
      amount: amt,
      description: description || '',
      note_id: noteId,
    });
    return { expense_id: null, collection_add_id: result.lastInsertRowid };
  }

  return { expense_id: null, collection_add_id: null };
}

function clearCollectionLinks(note) {
  if (note.expense_id) {
    try {
      db.prepare('DELETE FROM daily_expenses WHERE id = ?').run(note.expense_id);
    } catch (_) { /* ignore */ }
  }
  if (note.collection_add_id) {
    try {
      db.prepare('DELETE FROM daily_collection_adds WHERE id = ?').run(note.collection_add_id);
    } catch (_) { /* ignore */ }
  }
}

router.get('/', (req, res) => {
  try {
    try { syncNoteReminders(); } catch (_) { /* ignore */ }
    const { type, q } = req.query;
    let sql = 'SELECT * FROM shop_notes WHERE 1=1';
    const params = [];
    if (type === 'plain' || type === 'reminder' || type === 'money') {
      sql += ' AND note_type = ?';
      params.push(type);
    }
    if (q) {
      sql += ' AND (title LIKE ? OR body LIKE ?)';
      const like = `%${clean(q)}%`;
      params.push(like, like);
    }
    sql += ' ORDER BY updated_at DESC, id DESC';
    res.json(db.prepare(sql).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const note = getNote(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const noteType = clean(req.body?.note_type) || 'plain';
    if (!['plain', 'reminder', 'money'].includes(noteType)) {
      return res.status(400).json({ error: 'note_type must be plain, reminder, or money' });
    }
    const title = clean(req.body?.title);
    const body = clean(req.body?.body);
    if (!title && !body) {
      return res.status(400).json({ error: 'Enter a title or details' });
    }

    let remindOn = null;
    let moneyDirection = null;
    let amount = null;
    let affectCollection = 0;
    let collectionDate = null;
    let expenseId = null;
    let collectionAddId = null;

    if (noteType === 'reminder') {
      remindOn = clean(req.body?.remind_on);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(remindOn || '')) {
        return res.status(400).json({ error: 'Reminder needs a date (YYYY-MM-DD)' });
      }
    }

    if (noteType === 'money') {
      moneyDirection = clean(req.body?.money_direction);
      if (moneyDirection !== 'in' && moneyDirection !== 'out') {
        return res.status(400).json({ error: 'Choose money in or money out' });
      }
      amount = roundMoney(req.body?.amount);
      if (!(amount > 0)) return res.status(400).json({ error: 'Enter a valid amount' });
      affectCollection = boolish(req.body?.affect_collection) ? 1 : 0;
      collectionDate = clean(req.body?.collection_date) || today();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(collectionDate)) {
        return res.status(400).json({ error: 'collection_date must be YYYY-MM-DD' });
      }
    }

    const insert = db.prepare(`
      INSERT INTO shop_notes
        (note_type, title, body, remind_on, money_direction, amount, affect_collection,
         collection_date, expense_id, collection_add_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
    `);
    const result = insert.run(
      noteType,
      title || (noteType === 'money' ? 'Money note' : noteType === 'reminder' ? 'Reminder' : 'Note'),
      body,
      remindOn,
      moneyDirection,
      amount,
      affectCollection,
      collectionDate
    );
    const noteId = result.lastInsertRowid;

    if (noteType === 'money' && affectCollection) {
      const desc = title || body || 'Shop note';
      const links = applyCollection(noteId, moneyDirection, amount, collectionDate, desc);
      expenseId = links.expense_id;
      collectionAddId = links.collection_add_id;
      db.prepare(`
        UPDATE shop_notes
        SET expense_id = ?, collection_add_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(expenseId, collectionAddId, noteId);
    }

    const created = getNote(noteId);
    log('shop_note_created', 'shop_note', created.id, {
      note_type: created.note_type,
      title: created.title,
      amount: created.amount,
      affect_collection: created.affect_collection,
    });
    if (noteType === 'reminder') {
      try { syncNoteReminders(); } catch (_) { /* ignore */ }
    }
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const existing = getNote(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Note not found' });

    const noteType = clean(req.body?.note_type) || existing.note_type;
    if (!['plain', 'reminder', 'money'].includes(noteType)) {
      return res.status(400).json({ error: 'note_type must be plain, reminder, or money' });
    }
    const title = req.body?.title != null ? clean(req.body.title) : existing.title;
    const body = req.body?.body != null ? clean(req.body.body) : existing.body;
    if (!title && !body) {
      return res.status(400).json({ error: 'Enter a title or details' });
    }

    let remindOn = existing.remind_on;
    let moneyDirection = existing.money_direction;
    let amount = existing.amount;
    let affectCollection = existing.affect_collection ? 1 : 0;
    let collectionDate = existing.collection_date;

    if (noteType === 'reminder') {
      remindOn = clean(req.body?.remind_on != null ? req.body.remind_on : existing.remind_on);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(remindOn || '')) {
        return res.status(400).json({ error: 'Reminder needs a date' });
      }
      moneyDirection = null;
      amount = null;
      affectCollection = 0;
      collectionDate = null;
    } else if (noteType === 'money') {
      moneyDirection = clean(req.body?.money_direction != null ? req.body.money_direction : existing.money_direction);
      if (moneyDirection !== 'in' && moneyDirection !== 'out') {
        return res.status(400).json({ error: 'Choose money in or money out' });
      }
      amount = req.body?.amount != null ? roundMoney(req.body.amount) : roundMoney(existing.amount);
      if (!(amount > 0)) return res.status(400).json({ error: 'Enter a valid amount' });
      affectCollection = req.body?.affect_collection != null
        ? (boolish(req.body.affect_collection) ? 1 : 0)
        : (existing.affect_collection ? 1 : 0);
      collectionDate = clean(req.body?.collection_date != null ? req.body.collection_date : existing.collection_date) || today();
      remindOn = null;
    } else {
      remindOn = null;
      moneyDirection = null;
      amount = null;
      affectCollection = 0;
      collectionDate = null;
    }

    // Rebuild collection links when money settings change
    clearCollectionLinks(existing);
    let expenseId = null;
    let collectionAddId = null;
    if (noteType === 'money' && affectCollection) {
      const desc = title || body || 'Shop note';
      const links = applyCollection(existing.id, moneyDirection, amount, collectionDate, desc);
      expenseId = links.expense_id;
      collectionAddId = links.collection_add_id;
    }

    db.prepare(`
      UPDATE shop_notes
      SET note_type = ?, title = ?, body = ?, remind_on = ?, money_direction = ?, amount = ?,
          affect_collection = ?, collection_date = ?, expense_id = ?, collection_add_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      noteType, title, body, remindOn, moneyDirection, amount,
      affectCollection, collectionDate, expenseId, collectionAddId,
      existing.id
    );

    // Clear old reminder rows if type/date changed away from reminder
    if (noteType !== 'reminder' || remindOn !== existing.remind_on) {
      db.prepare('DELETE FROM shop_note_reminders WHERE note_id = ?').run(existing.id);
    }

    const updated = getNote(existing.id);
    log('shop_note_updated', 'shop_note', updated.id, {
      note_type: updated.note_type,
      title: updated.title,
    });
    if (noteType === 'reminder') {
      try { syncNoteReminders(); } catch (_) { /* ignore */ }
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const existing = getNote(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Note not found' });
    clearCollectionLinks(existing);
    db.prepare('DELETE FROM shop_note_reminders WHERE note_id = ?').run(existing.id);
    db.prepare('DELETE FROM shop_notes WHERE id = ?').run(existing.id);
    log('shop_note_deleted', 'shop_note', existing.id, {
      note_type: existing.note_type,
      title: existing.title,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
