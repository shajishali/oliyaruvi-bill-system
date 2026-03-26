const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { log } = require('../lib/activityLog');

router.get('/', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM shop_settings WHERE id = 1').get();
    if (settings) return res.json(settings);

    // If this is a fresh DB (no seed), create an empty row so the UI can work.
    // We intentionally store blanks so users enter real values manually.
    db.prepare(`
      INSERT INTO shop_settings (id, shop_name, address, contact, gstin, updated_at)
      VALUES (1, '', '', '', NULL, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO NOTHING
    `).run();
    const created = db.prepare('SELECT * FROM shop_settings WHERE id = 1').get();
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', (req, res) => {
  try {
    const { shop_name, address, contact, gstin } = req.body;

    // Upsert so it works on a brand-new/empty DB.
    db.prepare(`
      INSERT INTO shop_settings (id, shop_name, address, contact, gstin, updated_at)
      VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        shop_name = COALESCE(excluded.shop_name, shop_settings.shop_name),
        address = COALESCE(excluded.address, shop_settings.address),
        contact = COALESCE(excluded.contact, shop_settings.contact),
        gstin = COALESCE(excluded.gstin, shop_settings.gstin),
        updated_at = CURRENT_TIMESTAMP
    `).run(shop_name ?? '', address ?? '', contact ?? '', gstin ?? null);

    const updated = db.prepare('SELECT * FROM shop_settings WHERE id = 1').get();
    log('settings_updated', 'settings', 1, { shop_name: updated.shop_name });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
