const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { log } = require('../lib/activityLog');

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function currentMonth() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function inMonth(dateValue, month) {
  return String(dateValue || '').slice(0, 7) === month;
}

function projectTouchesMonth(payment, month) {
  if (payment.pay_kind !== 'project') return payment.pay_month === month;
  if (inMonth(payment.paid_on, month)) return true;
  const start = String(payment.started_on || '').slice(0, 7);
  const end = String(payment.ended_on || payment.started_on || '').slice(0, 7);
  if (!start) return false;
  const last = end && end >= start ? end : start;
  return start <= month && month <= last;
}

router.get('/', (req, res) => {
  try {
    const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? String(req.query.month) : currentMonth();
    const people = db.prepare('SELECT id, name FROM salary_people WHERE is_active = 1 ORDER BY name COLLATE NOCASE').all();
    const payments = db.prepare('SELECT * FROM salary_payments ORDER BY paid_on DESC, id DESC').all()
      .filter((payment) => (payment.pay_kind === 'monthly' ? payment.pay_month === month : projectTouchesMonth(payment, month)))
      .map((payment) => ({ ...payment, amount: roundMoney(payment.amount) }));
    const byPerson = new Map();
    for (const payment of payments) {
      const row = byPerson.get(payment.person_id) || {
        person_id: payment.person_id,
        person_name: payment.person_name,
        monthly: 0,
        project: 0,
      };
      if (payment.pay_kind === 'project') row.project = roundMoney(row.project + payment.amount);
      else row.monthly = roundMoney(row.monthly + payment.amount);
      row.person_name = payment.person_name;
      byPerson.set(payment.person_id, row);
    }
    const summary = [...byPerson.values()].map((row) => ({
      ...row,
      total: roundMoney(row.monthly + row.project),
    })).sort((a, b) => a.person_name.localeCompare(b.person_name));
    res.json({
      month,
      people,
      payments,
      summary,
      monthlyTotal: roundMoney(summary.reduce((sum, row) => sum + row.monthly, 0)),
      projectTotal: roundMoney(summary.reduce((sum, row) => sum + row.project, 0)),
      total: roundMoney(summary.reduce((sum, row) => sum + row.total, 0)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/people', (req, res) => {
  try {
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ error: 'Enter the person\'s name.' });
    if (name.length > 40) return res.status(400).json({ error: 'Name is too long.' });
    const existing = db.prepare('SELECT * FROM salary_people WHERE name = ? COLLATE NOCASE').get(name);
    if (existing && existing.is_active) return res.status(400).json({ error: 'This person is already in the salary list.' });
    if (existing) {
      db.prepare('UPDATE salary_people SET is_active = 1, name = ? WHERE id = ?').run(name, existing.id);
      return res.json(db.prepare('SELECT id, name FROM salary_people WHERE id = ?').get(existing.id));
    }
    const result = db.prepare('INSERT INTO salary_people (name) VALUES (?)').run(name);
    const created = db.prepare('SELECT id, name FROM salary_people WHERE id = ?').get(result.lastInsertRowid);
    log('salary_person_added', 'salary_person', created.id, { staff_name: created.name });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/people/:id', (req, res) => {
  try {
    const person = db.prepare('SELECT * FROM salary_people WHERE id = ?').get(req.params.id);
    if (!person || !person.is_active) return res.status(404).json({ error: 'Person not found.' });
    db.prepare('UPDATE salary_people SET is_active = 0 WHERE id = ?').run(person.id);
    log('salary_person_removed', 'salary_person', person.id, { staff_name: person.name });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/payments', (req, res) => {
  try {
    const person = db.prepare('SELECT * FROM salary_people WHERE id = ? AND is_active = 1').get(Number(req.body?.person_id));
    if (!person) return res.status(400).json({ error: 'Choose a person.' });
    const payKind = req.body?.pay_kind === 'project' ? 'project' : 'monthly';
    const amount = roundMoney(req.body?.amount);
    if (amount <= 0) return res.status(400).json({ error: 'Enter the amount paid.' });
    const paidOn = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.paid_on || '')) ? String(req.body.paid_on) : '';
    if (!paidOn) return res.status(400).json({ error: 'Choose the date the money was paid.' });
    const notes = cleanName(req.body?.notes) || null;
    let payMonth = null;
    let projectName = null;
    let startedOn = null;
    let endedOn = null;
    if (payKind === 'monthly') {
      payMonth = /^\d{4}-\d{2}$/.test(String(req.body?.pay_month || '')) ? String(req.body.pay_month) : '';
      if (!payMonth) return res.status(400).json({ error: 'Choose the salary month.' });
    } else {
      projectName = cleanName(req.body?.project_name);
      startedOn = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.started_on || '')) ? String(req.body.started_on) : '';
      endedOn = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.ended_on || '')) ? String(req.body.ended_on) : '';
      if (!projectName) return res.status(400).json({ error: 'Enter the project name.' });
      if (!startedOn || !endedOn) return res.status(400).json({ error: 'Choose the project start and end dates.' });
      if (endedOn < startedOn) return res.status(400).json({ error: 'The end date is before the start date.' });
      payMonth = startedOn.slice(0, 7);
    }
    const result = db.prepare(`
      INSERT INTO salary_payments (person_id, person_name, pay_kind, pay_month, project_name, started_on, ended_on, paid_on, amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(person.id, person.name, payKind, payMonth, projectName, startedOn, endedOn, paidOn, amount, notes);
    const created = db.prepare('SELECT * FROM salary_payments WHERE id = ?').get(result.lastInsertRowid);
    log('salary_paid', 'salary_payment', created.id, {
      staff_name: person.name,
      pay_kind: payKind,
      amount,
      pay_month: payMonth,
      project_name: projectName,
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/payments/:id', (req, res) => {
  try {
    const payment = db.prepare('SELECT * FROM salary_payments WHERE id = ?').get(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found.' });
    db.prepare('DELETE FROM salary_payments WHERE id = ?').run(payment.id);
    log('salary_deleted', 'salary_payment', payment.id, {
      staff_name: payment.person_name,
      amount: payment.amount,
      pay_kind: payment.pay_kind,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
