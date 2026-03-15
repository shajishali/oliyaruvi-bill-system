const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Banner materials
router.get('/banner-materials', (req, res) => {
  try {
    const all = req.query.all === '1' || req.query.admin === '1';
    const materials = all
      ? db.prepare('SELECT * FROM banner_materials ORDER BY material_name').all()
      : db.prepare('SELECT * FROM banner_materials WHERE is_active = 1 ORDER BY material_name').all();
    res.json(materials);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/banner-materials', (req, res) => {
  try {
    const { material_name, price_per_sqft, pricing_type } = req.body;
    if (!material_name || !material_name.trim()) return res.status(400).json({ error: 'material_name required' });
    const price = parseFloat(price_per_sqft) || 0;
    const ptype = (pricing_type === 'per_qty') ? 'per_qty' : 'per_sqft';
    const result = db.prepare('INSERT INTO banner_materials (material_name, price_per_sqft, pricing_type) VALUES (?, ?, ?)').run(material_name.trim(), price, ptype);
    const created = db.prepare('SELECT * FROM banner_materials WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sticker materials (same as banner - sqft pricing, different material)
router.get('/sticker-materials', (req, res) => {
  try {
    const all = req.query.all === '1' || req.query.admin === '1';
    const materials = all
      ? db.prepare('SELECT * FROM sticker_materials ORDER BY material_name').all()
      : db.prepare('SELECT * FROM sticker_materials WHERE is_active = 1 ORDER BY material_name').all();
    res.json(materials);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sticker-materials', (req, res) => {
  try {
    const { material_name, price_per_sqft, pricing_type } = req.body;
    if (!material_name || !material_name.trim()) return res.status(400).json({ error: 'material_name required' });
    const price = parseFloat(price_per_sqft) || 0;
    const ptype = (pricing_type === 'per_qty') ? 'per_qty' : 'per_sqft';
    const result = db.prepare('INSERT INTO sticker_materials (material_name, price_per_sqft, pricing_type) VALUES (?, ?, ?)').run(material_name.trim(), price, ptype);
    const created = db.prepare('SELECT * FROM sticker_materials WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/sticker-materials/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM sticker_materials WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/sticker-materials/:id', (req, res) => {
  try {
    const { material_name, price_per_sqft, pricing_type } = req.body;
    const id = req.params.id;
    if (material_name !== undefined) {
      db.prepare('UPDATE sticker_materials SET material_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(material_name.trim(), id);
    }
    if (price_per_sqft !== undefined) {
      db.prepare('UPDATE sticker_materials SET price_per_sqft = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(parseFloat(price_per_sqft), id);
    }
    if (pricing_type !== undefined) {
      const ptype = (pricing_type === 'per_qty') ? 'per_qty' : 'per_sqft';
      db.prepare('UPDATE sticker_materials SET pricing_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(ptype, id);
    }
    const updated = db.prepare('SELECT * FROM sticker_materials WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/banner-materials/:id', (req, res) => {
  try {
    const id = req.params.id;
    db.prepare('DELETE FROM banner_sizes WHERE material_id = ?').run(id);
    db.prepare('DELETE FROM banner_materials WHERE id = ?').run(id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/banner-materials/:id', (req, res) => {
  try {
    const { material_name, price_per_sqft, pricing_type } = req.body;
    const id = req.params.id;
    if (material_name !== undefined) {
      db.prepare('UPDATE banner_materials SET material_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(material_name.trim(), id);
    }
    if (price_per_sqft !== undefined) {
      db.prepare('UPDATE banner_materials SET price_per_sqft = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(parseFloat(price_per_sqft), id);
    }
    if (pricing_type !== undefined) {
      const ptype = (pricing_type === 'per_qty') ? 'per_qty' : 'per_sqft';
      db.prepare('UPDATE banner_materials SET pricing_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(ptype, id);
    }
    const updated = db.prepare('SELECT * FROM banner_materials WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Banner sizes (for each material - e.g. 5+3, 5+8 feet)
router.get('/banner-sizes', (req, res) => {
  try {
    const { material_id } = req.query;
    let sql = 'SELECT bs.*, bm.material_name, bm.price_per_sqft FROM banner_sizes bs JOIN banner_materials bm ON bs.material_id = bm.id';
    const params = [];
    if (material_id) {
      sql += ' WHERE bs.material_id = ?';
      params.push(material_id);
    }
    sql += ' ORDER BY bm.material_name, bs.size_name';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/banner-sizes', (req, res) => {
  try {
    const { material_id, size_name, width_ft, height_ft } = req.body;
    if (!material_id || !size_name || !size_name.trim()) return res.status(400).json({ error: 'material_id and size_name required' });
    const w = parseFloat(width_ft) || 0;
    const h = parseFloat(height_ft) || 0;
    const result = db.prepare(
      'INSERT INTO banner_sizes (material_id, size_name, width_ft, height_ft) VALUES (?, ?, ?, ?)'
    ).run(material_id, size_name.trim(), w, h);
    const created = db.prepare(`
      SELECT bs.*, bm.material_name, bm.price_per_sqft FROM banner_sizes bs
      JOIN banner_materials bm ON bs.material_id = bm.id
      WHERE bs.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/banner-sizes/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM banner_sizes WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Frame sizes
router.get('/frame-sizes', (req, res) => {
  try {
    const frames = db.prepare('SELECT * FROM frame_sizes ORDER BY size_name').all();
    res.json(frames);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Photo sizes
router.get('/photo-sizes', (req, res) => {
  try {
    const photos = db.prepare('SELECT * FROM photo_sizes ORDER BY size_name').all();
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Service charges
router.get('/charges', (req, res) => {
  try {
    const charges = db.prepare('SELECT * FROM service_charges').all();
    res.json(charges);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/charges/:id', (req, res) => {
  try {
    const { amount } = req.body;
    db.prepare('UPDATE service_charges SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(amount, req.params.id);
    const updated = db.prepare('SELECT * FROM service_charges WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Billable items - search by name (returns all items for building search list)
router.get('/billable-items', (req, res) => {
  try {
    const items = [];
    let bannerSizes = [];
    try {
      bannerSizes = db.prepare(`
        SELECT bs.*, bm.material_name, bm.price_per_sqft
        FROM banner_sizes bs
        JOIN banner_materials bm ON bs.material_id = bm.id
      `).all();
    } catch (_) {}
    let designBanner = [], designPhoto = [];
    try {
      designBanner = db.prepare('SELECT * FROM design_for_banner_sizes ORDER BY size_name').all();
      designPhoto = db.prepare('SELECT * FROM design_for_photo_sizes ORDER BY size_name').all();
    } catch (_) {}
    const frames = db.prepare('SELECT * FROM frame_sizes ORDER BY size_name').all();
    const photos = db.prepare('SELECT * FROM photo_sizes ORDER BY size_name').all();

    // Banner roll items: material + roll size (6ft, 8ft, 10ft) - qty = sqft, price = price_per_sqft * sqft
    let bannerStock = [];
    try {
      bannerStock = db.prepare('SELECT * FROM banner_stock ORDER BY size_name').all();
    } catch (_) {}
    const bannerMaterials = db.prepare("SELECT * FROM banner_materials WHERE is_active = 1 AND (pricing_type IS NULL OR pricing_type = 'per_sqft')").all();
    bannerMaterials.forEach((bm) => {
      bannerStock.forEach((br) => {
        const widthMatch = String(br.size_name).match(/(\d+(?:\.\d+)?)\s*feet?/i) || String(br.size_name).match(/(\d+)/);
        const widthFt = widthMatch ? parseFloat(widthMatch[1]) : 6;
        items.push({
          type: 'banner_roll',
          name: `Banner ${bm.material_name}`,
          sizeName: br.size_name,
          sizeId: br.id,
          materialId: bm.id,
          materialName: bm.material_name,
          bannerStockId: br.id,
          widthFt,
          feetRemaining: br.feet_remaining ?? 0,
          pricePerSqft: bm.price_per_sqft,
          calcType: 'sqft_direct',
        });
      });
    });
    // Sticker roll items: material + roll size - qty = sqft, price = price_per_sqft * sqft
    let stickerStock = [];
    try {
      stickerStock = db.prepare('SELECT * FROM sticker_stock ORDER BY size_name').all();
    } catch (_) {}
    let stickerMaterials = [];
    try {
      stickerMaterials = db.prepare("SELECT * FROM sticker_materials WHERE is_active = 1 AND (pricing_type IS NULL OR pricing_type = 'per_sqft')").all();
    } catch (_) {}
    stickerMaterials.forEach((sm) => {
      stickerStock.forEach((sr) => {
        const widthMatch = String(sr.size_name).match(/(\d+(?:\.\d+)?)\s*feet?/i) || String(sr.size_name).match(/(\d+)/);
        const widthFt = widthMatch ? parseFloat(widthMatch[1]) : 6;
        items.push({
          type: 'sticker_roll',
          name: `Sticker ${sm.material_name}`,
          sizeName: sr.size_name,
          sizeId: sr.id,
          materialId: sm.id,
          materialName: sm.material_name,
          stickerStockId: sr.id,
          widthFt,
          feetRemaining: sr.feet_remaining ?? 0,
          pricePerSqft: sm.price_per_sqft,
          calcType: 'sqft_direct',
        });
      });
    });
    // Legacy banner sizes (dimensions like 5x3) - keep for backward compat
    bannerSizes.forEach((bs) => {
      items.push({
        type: 'banner',
        name: `Banner ${bs.material_name} (size)`,
        sizeName: bs.size_name,
        sizeId: bs.id,
        materialId: bs.material_id,
        widthFt: bs.width_ft,
        heightFt: bs.height_ft,
        pricePerSqft: bs.price_per_sqft,
        calcType: 'sqft',
      });
    });
    // Per-qty materials (fixed price per unit - no sizes)
    let perQtyMaterials = [];
    try {
      perQtyMaterials = db.prepare("SELECT * FROM banner_materials WHERE is_active = 1 AND pricing_type = 'per_qty'").all();
    } catch (_) {}
    perQtyMaterials.forEach((bm) => {
      items.push({
        type: 'service',
        name: bm.material_name,
        sizeName: 'Unit',
        sizeId: bm.id,
        materialId: bm.id,
        unitPrice: bm.price_per_sqft,
        calcType: 'fixed',
      });
    });
    designBanner.forEach((d) => {
      items.push({
        type: 'designforBanner',
        name: 'Design for Banner',
        sizeName: d.size_name,
        sizeId: d.id,
        unitPrice: d.unit_price,
        calcType: 'fixed',
      });
    });
    designPhoto.forEach((d) => {
      items.push({
        type: 'designforPhoto',
        name: 'Design for Photo',
        sizeName: d.size_name,
        sizeId: d.id,
        unitPrice: d.unit_price,
        calcType: 'fixed',
      });
    });
    frames.forEach((f) => {
      const typeLabel = f.frame_type ? ` (${f.frame_type})` : '';
      items.push({
        type: 'frame',
        name: `Frame${typeLabel}`,
        sizeName: f.frame_type ? `${f.size_name} - ${f.frame_type}` : f.size_name,
        sizeId: f.id,
        frameId: f.id,
        unitPrice: f.unit_price,
        stockQty: f.stock_qty,
        calcType: 'fixed',
      });
    });
    photos.forEach((p) => {
      items.push({
        type: 'photo',
        name: 'Photo',
        sizeName: p.size_name,
        sizeId: p.id,
        photoId: p.id,
        unitPrice: p.unit_price,
        stockQty: p.stock_qty,
        calcType: 'fixed',
      });
    });

    const { q } = req.query;
    if (q) {
      const lower = q.toLowerCase();
      const filtered = items.filter(
        (i) =>
          i.name.toLowerCase().includes(lower) ||
          i.sizeName.toLowerCase().includes(lower) ||
          `${i.name} ${i.sizeName}`.toLowerCase().includes(lower)
      );
      return res.json(filtered);
    }
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Design for banner sizes (for stock/settings - owner can update prices)
router.get('/design-banner-sizes', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM design_for_banner_sizes ORDER BY size_name').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/design-banner-sizes/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM design_for_banner_sizes WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/design-banner-sizes/:id', (req, res) => {
  try {
    const { unit_price } = req.body;
    db.prepare('UPDATE design_for_banner_sizes SET unit_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(unit_price, req.params.id);
    const updated = db.prepare('SELECT * FROM design_for_banner_sizes WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Design for photo sizes
router.get('/design-photo-sizes', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM design_for_photo_sizes ORDER BY size_name').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/design-photo-sizes/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM design_for_photo_sizes WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/design-photo-sizes/:id', (req, res) => {
  try {
    const { unit_price } = req.body;
    db.prepare('UPDATE design_for_photo_sizes SET unit_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(unit_price, req.params.id);
    const updated = db.prepare('SELECT * FROM design_for_photo_sizes WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
