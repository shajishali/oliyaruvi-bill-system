const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { log } = require('../lib/activityLog');

router.get('/', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM shop_settings WHERE id = 1').get();
    if (!settings) return res.status(404).json({ error: 'Settings not found' });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', (req, res) => {
  try {
    const { shop_name, address, contact, gstin } = req.body;
    db.prepare(`
      UPDATE shop_settings SET
        shop_name = COALESCE(?, shop_name),
        address = COALESCE(?, address),
        contact = COALESCE(?, contact),
        gstin = COALESCE(?, gstin),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(shop_name, address, contact, gstin);
    const updated = db.prepare('SELECT * FROM shop_settings WHERE id = 1').get();
    log('settings_updated', 'settings', 1, { shop_name: updated.shop_name });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
