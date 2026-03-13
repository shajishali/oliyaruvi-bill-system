const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Banner materials
router.get('/banner-materials', (req, res) => {
  try {
    const materials = db.prepare('SELECT * FROM banner_materials WHERE is_active = 1').all();
    res.json(materials);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/banner-materials/:id', (req, res) => {
  try {
    const { price_per_sqft } = req.body;
    db.prepare('UPDATE banner_materials SET price_per_sqft = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(price_per_sqft, req.params.id);
    const updated = db.prepare('SELECT * FROM banner_materials WHERE id = ?').get(req.params.id);
    res.json(updated);
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

    bannerSizes.forEach((bs) => {
      items.push({
        type: 'banner',
        name: `Banner ${bs.material_name}`,
        sizeName: bs.size_name,
        sizeId: bs.id,
        materialId: bs.material_id,
        widthFt: bs.width_ft,
        heightFt: bs.height_ft,
        pricePerSqft: bs.price_per_sqft,
        calcType: 'sqft',
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
      items.push({
        type: 'frame',
        name: 'Frame',
        sizeName: f.size_name,
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
