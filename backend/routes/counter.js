const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { log } = require('../lib/activityLog');

function localStamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function localDate(d = new Date()) {
  return localStamp(d).slice(0, 10);
}

function openShift() {
  return db.prepare('SELECT * FROM counter_shifts WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1').get() || null;
}

router.get('/', (req, res) => {
  try {
    const today = localDate();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? String(req.query.date) : today;
    const staff = db.prepare('SELECT id, name FROM counter_staff WHERE is_active = 1 ORDER BY name COLLATE NOCASE').all();
    const active = openShift();
    const shifts = db.prepare('SELECT * FROM counter_shifts WHERE work_date = ? ORDER BY started_at, id').all(date);
    if (date === today && active && !shifts.some((row) => row.id === active.id)) shifts.push(active);
    const billsForShift = db.prepare(`
      SELECT id, bill_number, customer_name, total, created_at
      FROM bills WHERE counter_shift_id = ?
      ORDER BY id
    `);
    res.json({
      date,
      today,
      staff,
      active,
      shifts: shifts.map((shift) => ({ ...shift, bills: billsForShift.all(shift.id) })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/staff', (req, res) => {
  try {
    const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ');
    if (!name) return res.status(400).json({ error: 'Enter the person\'s name.' });
    if (name.length > 40) return res.status(400).json({ error: 'Name is too long.' });
    const existing = db.prepare('SELECT * FROM counter_staff WHERE name = ? COLLATE NOCASE').get(name);
    if (existing && existing.is_active) {
      return res.status(400).json({ error: 'This person is already on the counter list.' });
    }
    if (existing) {
      db.prepare('UPDATE counter_staff SET is_active = 1, name = ? WHERE id = ?').run(name, existing.id);
      return res.json(db.prepare('SELECT id, name FROM counter_staff WHERE id = ?').get(existing.id));
    }
    const result = db.prepare('INSERT INTO counter_staff (name) VALUES (?)').run(name);
    const created = db.prepare('SELECT id, name FROM counter_staff WHERE id = ?').get(result.lastInsertRowid);
    log('counter_staff_added', 'counter_staff', created.id, { staff_name: created.name });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/staff/:id', (req, res) => {
  try {
    const person = db.prepare('SELECT * FROM counter_staff WHERE id = ?').get(req.params.id);
    if (!person || !person.is_active) return res.status(404).json({ error: 'Person not found.' });
    const active = openShift();
    if (active && active.staff_id === person.id) {
      return res.status(400).json({ error: 'End this person\'s counter time before removing them.' });
    }
    db.prepare('UPDATE counter_staff SET is_active = 0 WHERE id = ?').run(person.id);
    log('counter_staff_removed', 'counter_staff', person.id, { staff_name: person.name });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/start', (req, res) => {
  try {
    const staff = db.prepare('SELECT * FROM counter_staff WHERE id = ? AND is_active = 1').get(Number(req.body?.staff_id));
    if (!staff) return res.status(400).json({ error: 'Choose a person from the counter list.' });
    const current = openShift();
    if (current && current.staff_id === staff.id) return res.json({ active: current });
    const now = localStamp();
    const started = db.transaction(() => {
      if (current) db.prepare('UPDATE counter_shifts SET ended_at = ? WHERE id = ?').run(now, current.id);
      const result = db.prepare(`
        INSERT INTO counter_shifts (staff_id, staff_name, started_at, ended_at, work_date)
        VALUES (?, ?, ?, NULL, ?)
      `).run(staff.id, staff.name, now, now.slice(0, 10));
      return db.prepare('SELECT * FROM counter_shifts WHERE id = ?').get(result.lastInsertRowid);
    })();
    log('counter_started', 'counter_shift', started.id, { staff_name: staff.name, started_at: now });
    res.status(201).json({ active: started });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/end', (req, res) => {
  try {
    const current = openShift();
    if (!current) return res.json({ active: null });
    const now = localStamp();
    db.prepare('UPDATE counter_shifts SET ended_at = ? WHERE ended_at IS NULL').run(now);
    log('counter_ended', 'counter_shift', current.id, { staff_name: current.staff_name, ended_at: now });
    res.json({ active: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
