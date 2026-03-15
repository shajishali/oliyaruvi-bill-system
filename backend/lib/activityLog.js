const db = require('../config/database');

function log(actionType, entityType, entityId, details) {
  try {
    db.prepare(`
      INSERT INTO activity_log (action_type, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?)
    `).run(actionType, entityType || null, entityId || null, details ? JSON.stringify(details) : null);
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

module.exports = { log };
