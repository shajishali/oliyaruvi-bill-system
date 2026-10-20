const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { log } = require('../lib/activityLog');
const { syncProgramReminders } = require('../lib/programReminders');

function clean(value) {
  const s = String(value ?? '').trim();
  return s || null;
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function isTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

function mapProgram(row) {
  if (!row) return null;
  return {
    id: row.id,
    program_type: row.program_type,
    location: row.location,
    customer_id: row.customer_id,
    customer_name: row.customer_name || '',
    phone: row.phone,
    event_date: row.event_date,
    end_date: row.end_date || row.event_date,
    event_time: row.event_time,
    end_time: row.end_time || null,
    notes: row.notes,
    deleted_at: row.deleted_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseBody(body) {
  const program_type = clean(body?.program_type);
  const location = clean(body?.location);
  const customer_name = clean(body?.customer_name) || '';
  const phone = clean(body?.phone);
  const event_date = isDate(body?.event_date) ? String(body.event_date) : null;
  let end_date = isDate(body?.end_date) ? String(body.end_date) : null;
  const event_time = isTime(body?.event_time) ? String(body.event_time) : null;
  const end_time = isTime(body?.end_time) ? String(body.end_time) : null;
  const notes = clean(body?.notes);
  let customer_id = body?.customer_id != null && body.customer_id !== '' ? Number(body.customer_id) : null;
  if (customer_id != null && Number.isNaN(customer_id)) customer_id = null;

  if (!program_type) return { error: 'Enter the program type' };
  if (!event_date) return { error: 'Choose the program date' };
  if (!end_date) end_date = event_date;
  if (end_date < event_date) return { error: 'End date cannot be before the start date' };
  if (event_time && end_time && end_date === event_date && end_time < event_time) {
    return { error: 'Approx. end time cannot be before start time' };
  }

  if (customer_id) {
    const cust = db.prepare('SELECT id, name, phone FROM customers WHERE id = ?').get(customer_id);
    if (!cust) return { error: 'Customer not found' };
  }

  // Optionally create / update customer when name+phone given
  let linkedId = customer_id;
  let linkedName = customer_name;
  if (!linkedId && customer_name) {
    const existing = phone
      ? db.prepare('SELECT id, name, phone FROM customers WHERE phone = ? COLLATE NOCASE').get(phone)
      : null;
    if (existing) {
      linkedId = existing.id;
      linkedName = existing.name || customer_name;
      if (phone && !existing.phone) {
        db.prepare('UPDATE customers SET phone = ? WHERE id = ?').run(phone, existing.id);
      }
    } else {
      const result = db.prepare('INSERT INTO customers (name, phone) VALUES (?, ?)').run(customer_name, phone);
      linkedId = result.lastInsertRowid;
      linkedName = customer_name;
    }
  } else if (linkedId && customer_name) {
    linkedName = customer_name;
    db.prepare('UPDATE customers SET name = ?, phone = COALESCE(?, phone) WHERE id = ?')
      .run(customer_name, phone, linkedId);
  }

  return {
    data: {
      program_type,
      location,
      customer_id: linkedId,
      customer_name: linkedName || customer_name || '',
      phone,
      event_date,
      end_date,
      event_time,
      end_time,
      notes,
    },
  };
}

function historyFor(programId) {
  return db.prepare(`
    SELECT id, program_id, changed_at, summary, changes_json
    FROM program_history
    WHERE program_id = ?
    ORDER BY changed_at DESC, id DESC
  `).all(programId).map((h) => ({
    id: h.id,
    program_id: h.program_id,
    changed_at: h.changed_at,
    summary: h.summary,
    changes: h.changes_json ? JSON.parse(h.changes_json) : [],
  }));
}

function addHistory(programId, summary, changes) {
  db.prepare(`
    INSERT INTO program_history (program_id, summary, changes_json)
    VALUES (?, ?, ?)
  `).run(programId, summary, JSON.stringify(changes || []));
}

function diffFields(before, after) {
  const keys = [
    'program_type', 'location', 'customer_name', 'phone',
    'event_date', 'end_date', 'event_time', 'end_time', 'notes',
  ];
  const changes = [];
  for (const key of keys) {
    const a = before[key] ?? '';
    const b = after[key] ?? '';
    if (String(a) !== String(b)) {
      changes.push({ field: key, from: a || null, to: b || null });
    }
  }
  return changes;
}

function mapHistoryRow(h) {
  return {
    id: h.id,
    program_id: h.program_id,
    changed_at: h.changed_at,
    summary: h.summary,
    changes: h.changes_json ? JSON.parse(h.changes_json) : [],
  };
}

// List programs (optional month=YYYY-MM or from/to) — active only
router.get('/', (req, res) => {
  try {
    const { month, from, to } = req.query;
    let sql = 'SELECT * FROM programs WHERE deleted_at IS NULL';
    const params = [];
    if (month && /^\d{4}-\d{2}$/.test(String(month))) {
      sql += ' AND (event_date LIKE ? OR end_date LIKE ? OR (event_date <= ? AND COALESCE(end_date, event_date) >= ?))';
      const start = `${month}-01`;
      const [y, m] = month.split('-').map(Number);
      const last = new Date(y, m, 0).getDate();
      const end = `${month}-${String(last).padStart(2, '0')}`;
      params.push(`${month}%`, `${month}%`, end, start);
    }
    if (from) { sql += ' AND COALESCE(end_date, event_date) >= ?'; params.push(from); }
    if (to) { sql += ' AND event_date <= ?'; params.push(to); }
    sql += ' ORDER BY event_date, event_time, id';
    const rows = db.prepare(sql).all(...params).map(mapProgram);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// One-shot history for a month (includes soft-deleted + activity_log removals)
router.get('/month-history', (req, res) => {
  try {
    const month = String(req.query.month || '');
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month must be YYYY-MM' });
    }
    const start = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    const end = `${month}-${String(last).padStart(2, '0')}`;
    const rows = db.prepare(`
      SELECT h.id, h.program_id, h.changed_at, h.summary, h.changes_json, p.program_type
      FROM program_history h
      INNER JOIN programs p ON p.id = h.program_id
      WHERE p.event_date LIKE ?
         OR COALESCE(p.end_date, p.event_date) LIKE ?
         OR (p.event_date <= ? AND COALESCE(p.end_date, p.event_date) >= ?)
         OR (p.deleted_at IS NOT NULL AND p.deleted_at LIKE ?)
      ORDER BY h.changed_at DESC, h.id DESC
      LIMIT 80
    `).all(`${month}%`, `${month}%`, end, start, `${month}%`).map((h) => ({
      ...mapHistoryRow(h),
      program_type: h.program_type || null,
    }));

    // Recover hard-deleted removals still stored in activity_log
    const seenDeleteIds = new Set(
      rows.filter((r) => /deleted/i.test(r.summary || '')).map((r) => r.program_id)
    );
    const activityDeletes = db.prepare(`
      SELECT id, entity_id, created_at, details
      FROM activity_log
      WHERE action_type = 'program_deleted'
        AND created_at >= ? AND created_at < date(?, '+1 month')
      ORDER BY created_at DESC
      LIMIT 40
    `).all(start, start);

    for (const a of activityDeletes) {
      const pid = Number(a.entity_id);
      if (seenDeleteIds.has(pid)) continue;
      let details = {};
      try { details = a.details ? JSON.parse(a.details) : {}; } catch { details = {}; }
      const eventDate = String(details.event_date || '').slice(0, 10);
      if (eventDate && (eventDate < start || eventDate > end) && !String(a.created_at).startsWith(month)) {
        continue;
      }
      rows.push({
        id: -Number(a.id),
        program_id: pid || 0,
        changed_at: a.created_at,
        summary: 'Program deleted',
        changes: [],
        program_type: details.program_type || 'Program',
      });
      seenDeleteIds.add(pid);
    }

    rows.sort((a, b) => String(b.changed_at).localeCompare(String(a.changed_at)));
    res.json(rows.slice(0, 80));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const row = db.prepare('SELECT id FROM programs WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Program not found' });
    res.json(historyFor(row.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM programs WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Program not found' });
    res.json({ ...mapProgram(row), history: historyFor(row.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const parsed = parseBody(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const d = parsed.data;
    const result = db.prepare(`
      INSERT INTO programs (
        program_type, location, customer_id, customer_name, phone,
        event_date, end_date, event_time, end_time, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      d.program_type, d.location, d.customer_id, d.customer_name, d.phone,
      d.event_date, d.end_date, d.event_time, d.end_time, d.notes
    );
    const created = mapProgram(db.prepare('SELECT * FROM programs WHERE id = ?').get(result.lastInsertRowid));
    addHistory(created.id, 'Program created', []);
    log('program_created', 'program', created.id, {
      program_type: created.program_type,
      customer_name: created.customer_name,
      event_date: created.event_date,
      location: created.location,
    });
    syncProgramReminders();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM programs WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Program not found' });
    const parsed = parseBody({ ...mapProgram(existing), ...req.body });
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const d = parsed.data;
    const before = mapProgram(existing);
    db.prepare(`
      UPDATE programs SET
        program_type = ?, location = ?, customer_id = ?, customer_name = ?, phone = ?,
        event_date = ?, end_date = ?, event_time = ?, end_time = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      d.program_type, d.location, d.customer_id, d.customer_name, d.phone,
      d.event_date, d.end_date, d.event_time, d.end_time, d.notes,
      existing.id
    );
    const updated = mapProgram(db.prepare('SELECT * FROM programs WHERE id = ?').get(existing.id));
    const changes = diffFields(before, updated);
    if (changes.length) {
      addHistory(updated.id, `Updated ${changes.map((c) => c.field.replace(/_/g, ' ')).join(', ')}`, changes);
    }
    log('program_updated', 'program', updated.id, {
      program_type: updated.program_type,
      customer_name: updated.customer_name,
      event_date: updated.event_date,
      changes,
    });
    syncProgramReminders();
    res.json({ ...updated, history: historyFor(updated.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM programs WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Program not found' });
    // Soft-delete only. Keep existing notifications so staff can still mark/read them.
    // Future reminders stop because sync skips deleted programs.
    const tx = db.transaction(() => {
      addHistory(existing.id, 'Program deleted', [
        { field: 'program_type', from: existing.program_type, to: null },
        { field: 'event_date', from: existing.event_date, to: null },
        { field: 'customer_name', from: existing.customer_name || null, to: null },
        { field: 'location', from: existing.location || null, to: null },
      ]);
      db.prepare(`
        UPDATE programs SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(existing.id);
    });
    tx();
    log('program_deleted', 'program', existing.id, {
      program_type: existing.program_type,
      customer_name: existing.customer_name,
      event_date: existing.event_date,
      location: existing.location,
      phone: existing.phone,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
