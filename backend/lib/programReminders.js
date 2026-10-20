const db = require('../config/database');

function localToday(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(isoDate, days) {
  const [y, m, d] = String(isoDate).slice(0, 10).split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function daysUntil(fromIso, toIso) {
  const [y1, m1, d1] = String(fromIso).slice(0, 10).split('-').map(Number);
  const [y2, m2, d2] = String(toIso).slice(0, 10).split('-').map(Number);
  const a = new Date(y1, (m1 || 1) - 1, d1 || 1);
  const b = new Date(y2, (m2 || 1) - 1, d2 || 1);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Drop only unread orphan program notifications (never wipe read history). */
function cleanupOrphanProgramNotifications() {
  db.prepare(`
    DELETE FROM notifications
    WHERE type = 'program'
      AND is_read = 0
      AND id NOT IN (
        SELECT notification_id FROM program_reminders WHERE notification_id IS NOT NULL
      )
  `).run();
}

/** Create daily notifications from 3 days before the program until it ends. */
function syncProgramReminders(today = localToday()) {
  cleanupOrphanProgramNotifications();
  const programs = db.prepare(`
    SELECT * FROM programs
    WHERE deleted_at IS NULL
      AND event_date IS NOT NULL AND event_date != ''
  `).all();

  const insertNotif = db.prepare(`
    INSERT INTO notifications (type, title, message, is_read)
    VALUES ('program', ?, ?, 0)
  `);
  const insertReminder = db.prepare(`
    INSERT OR IGNORE INTO program_reminders (program_id, remind_date, notification_id)
    VALUES (?, ?, ?)
  `);
  const existsReminder = db.prepare(`
    SELECT id FROM program_reminders WHERE program_id = ? AND remind_date = ?
  `);

  let created = 0;
  for (const p of programs) {
    const start = String(p.event_date).slice(0, 10);
    const end = String(p.end_date || p.event_date).slice(0, 10);
    const windowStart = addDays(start, -3);
    if (today < windowStart || today > end) continue;
    if (existsReminder.get(p.id, today)) continue;

    const left = daysUntil(today, start);
    let whenLabel = '';
    if (p.event_time && p.end_time) whenLabel = ` ${p.event_time}-${p.end_time}`;
    else if (p.event_time) whenLabel = ` at ${p.event_time}`;
    const whereLabel = p.location ? ` | ${p.location}` : '';
    const who = p.customer_name ? ` | ${p.customer_name}` : '';
    let timing;
    if (today > start) timing = 'Program in progress';
    else if (left === 0) timing = 'Program is today';
    else if (left === 1) timing = 'Program tomorrow';
    else timing = `Program in ${left} days`;

    const title = `${timing}: ${p.program_type || 'Program'}`;
    const message = `${start}${whenLabel}${whereLabel}${who}${p.phone ? ` | ${p.phone}` : ''}${p.notes ? ` | ${p.notes}` : ''}`.trim();

    const tx = db.transaction(() => {
      const result = insertNotif.run(title, message);
      insertReminder.run(p.id, today, result.lastInsertRowid);
    });
    tx();
    created += 1;
  }
  return created;
}

module.exports = { syncProgramReminders, cleanupOrphanProgramNotifications, localToday, addDays };
