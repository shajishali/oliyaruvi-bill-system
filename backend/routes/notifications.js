const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  try {
    const { unread_only } = req.query;
    let sql = 'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50';
    if (unread_only === 'true') sql = 'SELECT * FROM notifications WHERE is_read = 0 ORDER BY created_at DESC';
    const notifications = db.prepare(sql).all();
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/read', (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
    const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id);
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/read-all', (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1').run();
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
