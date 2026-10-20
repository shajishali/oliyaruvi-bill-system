const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { log } = require('../lib/activityLog');

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function clean(value) {
  return String(value || '').trim();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthBounds(month) {
  const m = String(month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return null;
  const [y, mo] = m.split('-').map(Number);
  const last = new Date(y, mo, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    from: `${y}-${pad(mo)}-01`,
    to: `${y}-${pad(mo)}-${pad(last)}`,
  };
}

function resolveBranch(branchId, branchName) {
  const id = branchId != null && branchId !== '' ? Number(branchId) : null;
  if (id && !Number.isNaN(id)) {
    const row = db.prepare('SELECT id, name FROM shop_branches WHERE id = ?').get(id);
    if (row) return { branch_id: row.id, branch_name: row.name };
  }
  const name = clean(branchName);
  if (!name) return null;
  const byName = db.prepare('SELECT id, name FROM shop_branches WHERE lower(name) = lower(?)').get(name);
  if (byName) return { branch_id: byName.id, branch_name: byName.name };
  return { branch_id: null, branch_name: name };
}

function getEntry(id) {
  return db.prepare('SELECT * FROM branch_work_entries WHERE id = ?').get(id);
}

function summarize(entries) {
  let theyOweUs = 0;
  let weOweThem = 0;
  const byBranch = {};

  for (const e of entries) {
    if (e.status !== 'open') continue;
    const key = e.branch_name || 'Other';
    if (!byBranch[key]) {
      byBranch[key] = { branch_name: key, they_owe_us: 0, we_owe_them: 0, net: 0, open_count: 0 };
    }
    const amt = roundMoney(e.amount);
    if (e.direction === 'for_them') {
      theyOweUs += amt;
      byBranch[key].they_owe_us += amt;
    } else {
      weOweThem += amt;
      byBranch[key].we_owe_them += amt;
    }
    byBranch[key].open_count += 1;
  }

  const branches = Object.values(byBranch).map((b) => ({
    ...b,
    they_owe_us: roundMoney(b.they_owe_us),
    we_owe_them: roundMoney(b.we_owe_them),
    net: roundMoney(b.they_owe_us - b.we_owe_them),
  })).sort((a, b) => a.branch_name.localeCompare(b.branch_name));

  return {
    they_owe_us: roundMoney(theyOweUs),
    we_owe_them: roundMoney(weOweThem),
    net: roundMoney(theyOweUs - weOweThem),
    open_count: entries.filter((e) => e.status === 'open').length,
    branches,
  };
}

router.get('/', (req, res) => {
  try {
    const { month, from, to, branch, status, q } = req.query;
    let fromDate = clean(from);
    let toDate = clean(to);
    if (month) {
      const bounds = monthBounds(month);
      if (!bounds) return res.status(400).json({ error: 'month must be YYYY-MM' });
      fromDate = bounds.from;
      toDate = bounds.to;
    }
    if (!fromDate || !toDate) {
      const now = new Date();
      const bounds = monthBounds(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
      fromDate = bounds.from;
      toDate = bounds.to;
    }

    let sql = `
      SELECT * FROM branch_work_entries
      WHERE work_date >= ? AND work_date <= ?
    `;
    const params = [fromDate, toDate];

    if (branch) {
      sql += ' AND lower(branch_name) = lower(?)';
      params.push(clean(branch));
    }
    if (status === 'open' || status === 'settled') {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (q) {
      sql += ' AND (description LIKE ? OR note LIKE ? OR branch_name LIKE ?)';
      const like = `%${clean(q)}%`;
      params.push(like, like, like);
    }

    sql += ' ORDER BY work_date DESC, id DESC';
    const entries = db.prepare(sql).all(...params);
    res.json({
      from: fromDate,
      to: toDate,
      entries,
      summary: summarize(entries),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/summary', (req, res) => {
  try {
    const { month } = req.query;
    const bounds = month ? monthBounds(month) : null;
    let entries;
    if (bounds) {
      entries = db.prepare(`
        SELECT * FROM branch_work_entries
        WHERE work_date >= ? AND work_date <= ?
      `).all(bounds.from, bounds.to);
    } else {
      entries = db.prepare('SELECT * FROM branch_work_entries WHERE status = ?').all('open');
    }
    res.json(summarize(entries));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const direction = clean(req.body?.direction);
    if (direction !== 'for_them' && direction !== 'for_us') {
      return res.status(400).json({ error: 'direction must be for_them or for_us' });
    }
    const description = clean(req.body?.description);
    if (!description) return res.status(400).json({ error: 'description required' });
    const amount = roundMoney(req.body?.amount);
    if (!(amount > 0)) return res.status(400).json({ error: 'amount must be greater than 0' });

    const branch = resolveBranch(req.body?.branch_id, req.body?.branch_name);
    if (!branch) return res.status(400).json({ error: 'Select or enter the other branch' });

    const workDate = clean(req.body?.work_date) || today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
      return res.status(400).json({ error: 'work_date must be YYYY-MM-DD' });
    }

    const note = clean(req.body?.note);
    const result = db.prepare(`
      INSERT INTO branch_work_entries
        (work_date, direction, branch_id, branch_name, description, amount, status, note)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
    `).run(workDate, direction, branch.branch_id, branch.branch_name, description, amount, note);

    const created = getEntry(result.lastInsertRowid);
    log('branch_work_created', 'branch_work', created.id, {
      direction: created.direction,
      branch_name: created.branch_name,
      amount: created.amount,
      work_date: created.work_date,
      description: created.description,
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const existing = getEntry(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Entry not found' });
    if (existing.status === 'settled') {
      return res.status(400).json({ error: 'Settled entries cannot be edited. Reopen first if needed.' });
    }

    const direction = clean(req.body?.direction) || existing.direction;
    if (direction !== 'for_them' && direction !== 'for_us') {
      return res.status(400).json({ error: 'direction must be for_them or for_us' });
    }
    const description = clean(req.body?.description) || existing.description;
    if (!description) return res.status(400).json({ error: 'description required' });
    const amount = req.body?.amount != null ? roundMoney(req.body.amount) : roundMoney(existing.amount);
    if (!(amount > 0)) return res.status(400).json({ error: 'amount must be greater than 0' });

    const branch = resolveBranch(
      req.body?.branch_id != null ? req.body.branch_id : existing.branch_id,
      req.body?.branch_name != null ? req.body.branch_name : existing.branch_name
    );
    if (!branch) return res.status(400).json({ error: 'Select or enter the other branch' });

    const workDate = clean(req.body?.work_date) || existing.work_date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
      return res.status(400).json({ error: 'work_date must be YYYY-MM-DD' });
    }
    const note = req.body?.note != null ? clean(req.body.note) : existing.note;

    db.prepare(`
      UPDATE branch_work_entries
      SET work_date = ?, direction = ?, branch_id = ?, branch_name = ?,
          description = ?, amount = ?, note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(workDate, direction, branch.branch_id, branch.branch_name, description, amount, note, existing.id);

    const updated = getEntry(existing.id);
    log('branch_work_updated', 'branch_work', updated.id, {
      direction: updated.direction,
      branch_name: updated.branch_name,
      amount: updated.amount,
      work_date: updated.work_date,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/settle-branch', (req, res) => {
  try {
    const branchName = clean(req.body?.branch_name);
    if (!branchName) return res.status(400).json({ error: 'branch_name required' });
    const month = clean(req.body?.month);
    const bounds = month ? monthBounds(month) : null;
    const settledOn = clean(req.body?.settled_on) || today();
    const settlementNote = clean(req.body?.settlement_note) || (month ? `Month settle ${month}` : 'Branch settle');

    let sql = `
      SELECT id FROM branch_work_entries
      WHERE status = 'open' AND lower(branch_name) = lower(?)
    `;
    const params = [branchName];
    if (bounds) {
      sql += ' AND work_date >= ? AND work_date <= ?';
      params.push(bounds.from, bounds.to);
    }
    const rows = db.prepare(sql).all(...params);
    const update = db.prepare(`
      UPDATE branch_work_entries
      SET status = 'settled', settled_on = ?, settlement_note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const tx = db.transaction(() => {
      for (const row of rows) update.run(settledOn, settlementNote, row.id);
    });
    tx();

    log('branch_work_settled_batch', 'branch_work', null, {
      branch_name: branchName,
      count: rows.length,
      month: month || null,
      settled_on: settledOn,
    });
    res.json({ settled: rows.length, branch_name: branchName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/settle', (req, res) => {
  try {
    const existing = getEntry(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Entry not found' });
    if (existing.status === 'settled') return res.json(existing);

    const settledOn = clean(req.body?.settled_on) || today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(settledOn)) {
      return res.status(400).json({ error: 'settled_on must be YYYY-MM-DD' });
    }
    const settlementNote = clean(req.body?.settlement_note);

    db.prepare(`
      UPDATE branch_work_entries
      SET status = 'settled', settled_on = ?, settlement_note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(settledOn, settlementNote, existing.id);

    const updated = getEntry(existing.id);
    log('branch_work_settled', 'branch_work', updated.id, {
      branch_name: updated.branch_name,
      amount: updated.amount,
      settled_on: updated.settled_on,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/reopen', (req, res) => {
  try {
    const existing = getEntry(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Entry not found' });
    db.prepare(`
      UPDATE branch_work_entries
      SET status = 'open', settled_on = NULL, settlement_note = '', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(existing.id);
    const updated = getEntry(existing.id);
    log('branch_work_reopened', 'branch_work', updated.id, {
      branch_name: updated.branch_name,
      amount: updated.amount,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const existing = getEntry(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Entry not found' });
    db.prepare('DELETE FROM branch_work_entries WHERE id = ?').run(existing.id);
    log('branch_work_deleted', 'branch_work', existing.id, {
      direction: existing.direction,
      branch_name: existing.branch_name,
      amount: existing.amount,
      work_date: existing.work_date,
      description: existing.description,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
