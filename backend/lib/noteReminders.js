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

function cleanupOrphanNoteNotifications() {
  db.prepare(`
    DELETE FROM notifications
    WHERE type = 'shop_note'
      AND is_read = 0
      AND id NOT IN (
        SELECT notification_id FROM shop_note_reminders WHERE notification_id IS NOT NULL
      )
  `).run();
}

/** Create daily notifications from 3 days before remind_on through that day. */
function syncNoteReminders(today = localToday()) {
  cleanupOrphanNoteNotifications();
  const notes = db.prepare(`
    SELECT * FROM shop_notes
    WHERE note_type = 'reminder'
      AND remind_on IS NOT NULL AND remind_on != ''
  `).all();

  const insertNotif = db.prepare(`
    INSERT INTO notifications (type, title, message, is_read)
    VALUES ('shop_note', ?, ?, 0)
  `);
  const insertReminder = db.prepare(`
    INSERT OR IGNORE INTO shop_note_reminders (note_id, remind_date, notification_id)
    VALUES (?, ?, ?)
  `);
  const existsReminder = db.prepare(`
    SELECT id FROM shop_note_reminders WHERE note_id = ? AND remind_date = ?
  `);

  let created = 0;
  for (const n of notes) {
    const due = String(n.remind_on).slice(0, 10);
    const windowStart = addDays(due, -3);
    if (today < windowStart || today > due) continue;
    if (existsReminder.get(n.id, today)) continue;

    const left = daysUntil(today, due);
    let timing;
    if (left === 0) timing = 'Reminder is today';
    else if (left === 1) timing = 'Reminder tomorrow';
    else timing = `Reminder in ${left} days`;

    const title = `${timing}: ${n.title || 'Shop note'}`;
    const message = [n.body, due ? `Due ${due}` : ''].filter(Boolean).join(' | ');

    const tx = db.transaction(() => {
      const result = insertNotif.run(title, message);
      insertReminder.run(n.id, today, result.lastInsertRowid);
    });
    tx();
    created += 1;
  }
  return created;
}

module.exports = { syncNoteReminders, cleanupOrphanNoteNotifications, localToday, addDays };
