const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { log } = require('../lib/activityLog');

function normalizePriceAudience(value) {
  return String(value || '').trim().toLowerCase() === 'st' ? 'st' : 'local';
}

/** Normalize for matching Settings sale rows to Stock `size_name` */
function normalizeSizeMatchKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();
}

/** Same as size match but strips display suffixes like (in) so catalog vs stock size strings align */
function normalizeFrameSizeKey(s) {
  const stripped = String(s || '')
    .replace(/\(in\)/gi, '')
    .replace(/inch(es)?/gi, '');
  return normalizeSizeMatchKey(stripped);
}

/** e.g. "10x15", "10 X 15", "Class 10X15" → canonical "10x15" for matching */
function extractDimensionKey(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+(?:\.\d+)?)\s*[xX×+]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const a = parseFloat(m[1]);
  const b = parseFloat(m[2]);
  return normalizeSizeMatchKey(`${a}x${b}`);
}

/**
 * Stock rows whose physical size matches catalog (string match OR same WxH from combined labels).
 */
function collectFrameStockCandidates(pricing, stockFrames) {
  const nk = normalizeFrameSizeKey(pricing.size_name);
  let candidates = stockFrames.filter((s) => normalizeFrameSizeKey(s.size_name) === nk);
  if (candidates.length > 0) return candidates;

  const dim =
    extractDimensionKey(pricing.size_name) ||
    extractDimensionKey([pricing.subitem_name, pricing.size_name].filter(Boolean).join(' '));
  if (!dim) return [];

  candidates = stockFrames.filter((s) => {
    const d = extractDimensionKey(s.size_name);
    return d && d === dim;
  });
  return candidates;
}

/** e.g. "Class 10X15" → "Class" — type hint when subitem empty but size contains it */
function extractTypeFromCombinedSize(s) {
  if (!s) return null;
  const first = String(s).trim().split(/\s+/)[0];
  return first && /^[A-Za-z]+$/.test(first) && !/^\d+$/.test(first) ? first : null;
}

/**
 * Match a catalog `frame_pricing` row to a stock `frame_sizes` row.
 * - Settings subitem "Class" ↔ Stock `frame_type` when `subitem_name` is empty on stock.
 * - If `size_name` is combined (e.g. "Class 10X15"), extract "Class" and match stock.frame_type.
 * - When multiple same type (e.g. two Duro rows), prefer the one with higher stock.
 */
function findStockFrameForPricing(pricing, stockFrames) {
  const sub = String(pricing.subitem_name || '').trim();
  const pft = String(pricing.frame_type || '').trim();
  const typeFromSize = extractTypeFromCombinedSize(pricing.size_name);

  const candidates = collectFrameStockCandidates(pricing, stockFrames);
  if (candidates.length === 0) return undefined;

  const tryMatch = (hint) => {
    if (!hint) return null;
    // Prefer frame_type match (stock Type column) over subitem_name match
    const ftMatch = candidates.find(
      (s) => String(s.frame_type || '').trim().toLowerCase() === hint.toLowerCase()
    );
    if (ftMatch) return ftMatch;
    const snMatch = candidates.find(
      (s) => String(s.subitem_name || '').trim().toLowerCase() === hint.toLowerCase()
    );
    return snMatch;
  };

  let match = tryMatch(sub) || tryMatch(typeFromSize);
  if (match) return match;

  if (pft) {
    const matches = candidates.filter(
      (s) => String(s.frame_type || '').trim().toLowerCase() === pft.toLowerCase()
    );
    if (matches.length > 0) {
      return matches.reduce((best, s) =>
        (s.stock_qty || 0) > (best.stock_qty || 0) ? s : best
      );
    }
  }

  if (candidates.length === 1) return candidates[0];
  return candidates.reduce((best, s) =>
    (s.stock_qty || 0) > (best.stock_qty || 0) ? s : best
  );
}

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
    const { material_name, price_per_sqft, pricing_type, price_audience } = req.body;
    if (!material_name || !material_name.trim()) return res.status(400).json({ error: 'material_name required' });
    const price = parseFloat(price_per_sqft) || 0;
    const ptype = (pricing_type === 'per_qty') ? 'per_qty' : 'per_sqft';
    const audience = normalizePriceAudience(price_audience);
    const result = db.prepare('INSERT INTO banner_materials (material_name, price_per_sqft, pricing_type, price_audience) VALUES (?, ?, ?, ?)').run(material_name.trim(), price, ptype, audience);
    const created = db.prepare('SELECT * FROM banner_materials WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'This banner price already exists for that ST/Local choice.' });
    }
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
    const { material_name, price_per_sqft, pricing_type, price_audience } = req.body;
    if (!material_name || !material_name.trim()) return res.status(400).json({ error: 'material_name required' });
    const price = parseFloat(price_per_sqft) || 0;
    const ptype = (pricing_type === 'per_qty') ? 'per_qty' : 'per_sqft';
    const audience = normalizePriceAudience(price_audience);
    const result = db.prepare('INSERT INTO sticker_materials (material_name, price_per_sqft, pricing_type, price_audience) VALUES (?, ?, ?, ?)').run(material_name.trim(), price, ptype, audience);
    const created = db.prepare('SELECT * FROM sticker_materials WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'This sticker price already exists for that ST/Local choice.' });
    }
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
    const { material_name, price_per_sqft, pricing_type, price_audience } = req.body;
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
    if (price_audience !== undefined) {
      db.prepare('UPDATE sticker_materials SET price_audience = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(normalizePriceAudience(price_audience), id);
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
    const { material_name, price_per_sqft, pricing_type, price_audience } = req.body;
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
    if (price_audience !== undefined) {
      db.prepare('UPDATE banner_materials SET price_audience = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(normalizePriceAudience(price_audience), id);
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

// Frame catalog pricing (Settings + billing). Stock quantities are in frame_sizes only.
router.get('/frame-pricing', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM frame_pricing ORDER BY frame_type, size_name, subitem_name').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/frame-pricing', (req, res) => {
  try {
    const { size_name, frame_type = 'Duro', subitem_name = '', unit_price = 0, price_audience } = req.body;
    if (!size_name || !String(size_name).trim()) return res.status(400).json({ error: 'size_name required' });
    const ft = String(frame_type || 'Duro').trim() || 'Duro';
    const sub = String(subitem_name || '').trim();
    const price = parseFloat(String(unit_price)) || 0;
    const audience = normalizePriceAudience(price_audience);
    const result = db.prepare(`
      INSERT INTO frame_pricing (size_name, frame_type, subitem_name, unit_price, price_audience)
      VALUES (?, ?, ?, ?, ?)
    `).run(String(size_name).trim(), ft, sub, price, audience);
    const created = db.prepare('SELECT * FROM frame_pricing WHERE id = ?').get(result.lastInsertRowid);
    log('price_added', 'price', created.id, {
      item_name: [created.subitem_name || created.frame_type, created.size_name].filter(Boolean).join(' '),
      size_name: created.size_name,
      new_price: created.unit_price,
      price_audience: created.price_audience,
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'A frame price with this size, type, subitem, and ST/Local choice already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/frame-pricing/:id', (req, res) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM frame_pricing WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Frame price not found' });
    const { size_name, frame_type, subitem_name, unit_price, price_audience } = req.body;
    const updates = [];
    const params = [];
    if (size_name !== undefined && String(size_name).trim()) {
      updates.push('size_name = ?');
      params.push(String(size_name).trim());
    }
    if (frame_type !== undefined) {
      updates.push('frame_type = ?');
      params.push(String(frame_type || 'Duro').trim() || 'Duro');
    }
    if (subitem_name !== undefined) {
      updates.push('subitem_name = ?');
      params.push(String(subitem_name || '').trim());
    }
    if (unit_price !== undefined) {
      updates.push('unit_price = ?');
      params.push(parseFloat(String(unit_price)) || 0);
    }
    if (price_audience !== undefined) {
      updates.push('price_audience = ?');
      params.push(normalizePriceAudience(price_audience));
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
    params.push(id);
    db.prepare(`UPDATE frame_pricing SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT * FROM frame_pricing WHERE id = ?').get(id);
    log('price_changed', 'price', updated.id, {
      item_name: [updated.subitem_name || updated.frame_type, updated.size_name].filter(Boolean).join(' '),
      size_name: updated.size_name,
      old_price: row.unit_price,
      new_price: updated.unit_price,
      price_audience: updated.price_audience,
    });
    res.json(updated);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'A frame price with this size, type, subitem, and ST/Local choice already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/frame-pricing/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM frame_pricing WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Frame price not found' });
    db.prepare('DELETE FROM frame_pricing WHERE id = ?').run(row.id);
    log('price_removed', 'price', row.id, {
      item_name: [row.subitem_name || row.frame_type, row.size_name].filter(Boolean).join(' '),
      size_name: row.size_name,
      old_price: row.unit_price,
      price_audience: row.price_audience,
    });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Frame sizes (stock table — inventory)
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
    let framePricing = [];
    try {
      framePricing = db.prepare('SELECT * FROM frame_pricing ORDER BY frame_type, size_name').all();
    } catch (_) {}
    const stockFrames = db.prepare('SELECT * FROM frame_sizes').all();
    let photocopies = [];
    try {
      photocopies = db.prepare('SELECT * FROM photocopy_sizes ORDER BY size_name').all();
    } catch (_) {}

    // Banner roll items: material (Settings) + roll size (stock) — qty = sqft, price = row override or material price_per_sqft
    let bannerStock = [];
    try {
      bannerStock = db.prepare(
        `SELECT * FROM banner_stock ORDER BY COALESCE(stock_type, ''), COALESCE(print_type, ''), CAST(size_name AS REAL), size_name`
      ).all();
    } catch (_) {}
    const bannerMaterials = db.prepare("SELECT * FROM banner_materials WHERE is_active = 1 AND (pricing_type IS NULL OR pricing_type = 'per_sqft')").all();
    bannerMaterials.forEach((bm) => {
      bannerStock.forEach((br) => {
        const widthMatch = String(br.size_name).match(/(\d+(?:\.\d+)?)\s*feet?/i) || String(br.size_name).match(/(\d+)/);
        const widthFt = widthMatch ? parseFloat(widthMatch[1]) : 6;
        const stockTypeLabel = String(br.stock_type || '').trim();
        const printTypeLabel = String(br.print_type || '').trim();
        const rowPriceRaw = br.unit_price;
        const rowPrice =
          rowPriceRaw !== null && rowPriceRaw !== undefined && String(rowPriceRaw).trim() !== ''
            ? parseFloat(rowPriceRaw)
            : null;
        const rowUnit = String(br.price_unit || 'per_sqft').trim().toLowerCase() === 'per_qty' ? 'per_qty' : 'per_sqft';
        const hasRowPrice = rowPrice != null && !isNaN(rowPrice);
        const usePerQty = hasRowPrice && rowUnit === 'per_qty';
        const base = {
          type: 'banner_roll',
          name: `Banner ${bm.material_name}`,
          groupLabel: 'Banner',
          itemTypeLabel: stockTypeLabel || printTypeLabel || 'Banner',
          itemLabel: String(bm.material_name || '').trim(),
          sizeName: br.size_name,
          sizeId: br.id,
          materialId: bm.id,
          materialName: bm.material_name,
          bannerStockId: br.id,
          stockTypeLabel: stockTypeLabel || undefined,
          printTypeLabel: printTypeLabel || undefined,
          widthFt,
          feetRemaining: br.feet_remaining ?? 0,
          priceAudience: normalizePriceAudience(bm.price_audience),
        };
        if (usePerQty) {
          items.push({
            ...base,
            unitPrice: rowPrice,
            calcType: 'fixed',
          });
        } else {
          items.push({
            ...base,
            pricePerSqft: bm.price_per_sqft,
            calcType: 'sqft_direct',
          });
        }
      });
    });
    // Sticker roll items: material + roll size - qty = sqft, price = price_per_sqft * sqft
    let stickerStock = [];
    try {
      stickerStock = db.prepare(
        `SELECT * FROM sticker_stock ORDER BY COALESCE(stock_type, ''), CAST(size_name AS REAL), size_name`
      ).all();
    } catch (_) {}
    let stickerMaterials = [];
    try {
      stickerMaterials = db.prepare("SELECT * FROM sticker_materials WHERE is_active = 1 AND (pricing_type IS NULL OR pricing_type = 'per_sqft')").all();
    } catch (_) {}
    stickerMaterials.forEach((sm) => {
      stickerStock.forEach((sr) => {
        const widthMatch = String(sr.size_name).match(/(\d+(?:\.\d+)?)\s*feet?/i) || String(sr.size_name).match(/(\d+)/);
        const widthFt = widthMatch ? parseFloat(widthMatch[1]) : 6;
        const stockTypeLabel = String(sr.stock_type || '').trim();
        items.push({
          type: 'sticker_roll',
          name: `Sticker ${sm.material_name}`,
          groupLabel: 'Sticker',
          itemTypeLabel: stockTypeLabel || 'Sticker',
          sizeName: sr.size_name,
          sizeId: sr.id,
          materialId: sm.id,
          materialName: sm.material_name,
          stickerStockId: sr.id,
          stockTypeLabel: stockTypeLabel || undefined,
          widthFt,
          feetRemaining: sr.feet_remaining ?? 0,
          pricePerSqft: sm.price_per_sqft,
          calcType: 'sqft_direct',
          priceAudience: normalizePriceAudience(sm.price_audience),
        });
      });
    });
    // Legacy banner sizes (dimensions like 5x3) - keep for backward compat
    bannerSizes.forEach((bs) => {
      items.push({
        type: 'banner',
        name: `Banner ${bs.material_name} (size)`,
        groupLabel: 'Banner',
        itemTypeLabel: 'Banner',
        itemLabel: String(bs.material_name || '').trim(),
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
        groupLabel: 'Banner',
        itemTypeLabel: 'Banner',
        itemLabel: String(bm.material_name || '').trim(),
        sizeName: 'Unit',
        sizeId: bm.id,
        materialId: bm.id,
        unitPrice: bm.price_per_sqft,
        calcType: 'fixed',
        priceAudience: normalizePriceAudience(bm.price_audience),
      });
    });
    designBanner.forEach((d) => {
      items.push({
        type: 'designforBanner',
        name: 'Design for Banner',
        groupLabel: 'Design for Banner',
        itemTypeLabel: 'Design for Banner',
        itemLabel: `Design for Banner ${String(d.size_name || '').trim()}`.trim(),
        sizeName: d.size_name,
        sizeId: d.id,
        unitPrice: d.unit_price,
        calcType: 'fixed',
        priceAudience: normalizePriceAudience(d.price_audience),
      });
    });
    designPhoto.forEach((d) => {
      items.push({
        type: 'designforPhoto',
        name: 'Design for Photo',
        groupLabel: 'Design for Photo',
        itemTypeLabel: 'Design for Photo',
        itemLabel: `Design for Photo ${String(d.size_name || '').trim()}`.trim(),
        sizeName: d.size_name,
        sizeId: d.id,
        unitPrice: d.unit_price,
        calcType: 'fixed',
        priceAudience: normalizePriceAudience(d.price_audience),
      });
    });
    framePricing.forEach((f) => {
      const stockMatch = findStockFrameForPricing(f, stockFrames);
      const sub = (f.subitem_name && String(f.subitem_name).trim()) ? String(f.subitem_name).trim() : '';
      const sizeLabel = sub
        ? `${sub} ${f.size_name}`.trim()
        : (f.frame_type ? `${f.size_name} - ${f.frame_type}` : f.size_name);
      const ft = String(f.frame_type || '').trim() || 'Standard';
      const itemLabel = sub
        ? `${sub} ${f.size_name} (${ft})`.trim()
        : `${f.size_name} (${ft})`.trim();
      const frameGroupKey = `${String(f.subitem_name || '').trim().toLowerCase()}\u001f${String(f.frame_type || '').trim().toLowerCase()}`;
      items.push({
        type: 'frame',
        name: 'Frame',
        groupLabel: 'Frames',
        itemTypeLabel: ft,
        itemLabel,
        sizeName: sizeLabel,
        sizeId: f.id,
        frameId: stockMatch ? stockMatch.id : undefined,
        frameGroupKey,
        unitPrice: f.unit_price,
        stockQty: stockMatch != null ? stockMatch.stock_qty : 0,
        calcType: 'fixed',
        priceAudience: normalizePriceAudience(f.price_audience),
      });
    });
    photocopies.forEach((p) => {
      const sn = String(p.size_name || '').trim();
      items.push({
        type: 'photocopy',
        name: 'Photocopy',
        groupLabel: 'Photocopy',
        itemTypeLabel: 'Photocopy',
        itemLabel: sn || 'Photocopy',
        sizeName: p.size_name,
        sizeId: p.id,
        photocopyId: p.id,
        unitPrice: p.unit_price,
        stockQty: p.stock_qty,
        calcType: 'fixed',
      });
    });

    // Service-only items (no stock): passport print, shop copy, etc.
    let serviceItems = [];
    try {
      serviceItems = db.prepare('SELECT * FROM service_items ORDER BY name').all();
    } catch (_) {}
    serviceItems.forEach((si) => {
      const isPerSqft = si.qty_type === 'per_sqft';
      items.push({
        type: 'service_item',
        name: si.name,
        groupLabel: String(si.item_type || '').trim() || 'Services (no stock)',
        itemTypeLabel: String(si.item_type || '').trim() || 'Services (no stock)',
        itemLabel: String(si.name || '').trim(),
        sizeName: isPerSqft ? 'Per sqft' : 'Unit',
        sizeId: si.id,
        serviceItemId: si.id,
        unitPrice: si.unit_price,
        calcType: isPerSqft ? 'sqft_direct' : 'fixed',
        priceAudience: normalizePriceAudience(si.price_audience),
      });
    });

    // Custom section items (e.g. cloth)
    // Roll sections sold to customers:
    //   - Stock/quantity is stored in `custom_section_stock` (sizes like 4ft, 6ft, ...)
    //   - Pricing/subtypes is stored in `custom_section_sale_items` (e.g. Backlight print)
    // Count sections (if used) keep the old behavior: price comes from `custom_section_stock.unit_price`.
    let customStock = [];
    let customSections = [];
    let customSaleItems = [];
    try {
      customStock = db.prepare('SELECT * FROM custom_section_stock ORDER BY section_id, size_name').all();
      customSections = db.prepare(`
        SELECT section_id, label, section_type, COALESCE(affects_sales, 1) as affects_sales
        FROM custom_sections
      `).all();
      try {
        customSaleItems = db.prepare('SELECT * FROM custom_section_sale_items ORDER BY section_id, item_name, size_name').all();
      } catch (_) {}
    } catch (_) {}

    const sectionMap = Object.fromEntries((customSections || []).map((s) => [s.section_id, s]));
    const stockBySection = {};
    for (const cs of (customStock || [])) {
      if (!stockBySection[cs.section_id]) stockBySection[cs.section_id] = [];
      stockBySection[cs.section_id].push(cs);
    }
    const saleBySection = {};
    for (const si of (customSaleItems || [])) {
      if (!saleBySection[si.section_id]) saleBySection[si.section_id] = [];
      saleBySection[si.section_id].push(si);
    }

    for (const [sectionId, sec] of Object.entries(sectionMap)) {
      if ((sec.affects_sales ?? 1) === 0) continue; // maintenance-only

      const stockRows = stockBySection[sectionId] || [];
      if (sec.section_type === 'roll') {
        const saleItems = saleBySection[sectionId] || [];
        for (const sale of saleItems) {
          for (const cs of stockRows) {
            const widthMatch =
              String(cs.size_name).match(/(\d+(?:\.\d+)?)\s*feet?/i) ||
              String(cs.size_name).match(/(\d+)/);
            const widthFt = widthMatch ? parseFloat(widthMatch[1]) : 6;
            items.push({
              type: 'custom',
              name: sale.item_name,
              groupLabel: sec.label || sectionId,
              itemTypeLabel: String(sale.item_type || '').trim() || sec.label || sectionId,
              itemLabel: String(sale.item_name || '').trim(),
              sizeName: cs.size_name,
              sizeId: cs.id,
              customItemId: cs.id,
              sectionId: cs.section_id,
              unitPrice: sale.unit_price,
              pricePerSqft: sale.unit_price,
              priceAudience: normalizePriceAudience(sale.price_audience),
              stockQty: cs.stock_qty,
              widthFt,
              calcType: 'sqft_direct',
            });
          }
        }
      } else {
        // Count sections: pricing comes from custom_section_sale_items (per_unit rows added in Settings).
        // Stock qty comes from custom_section_stock (managed in Stock page) — matched by size_name.
        // Stock page and Settings are independent; naming match is best-effort.
        const saleItems = (saleBySection[sectionId] || []).filter((si) => si.qty_type !== 'per_sqft');
        if (saleItems.length > 0) {
          const totalSectionStock = stockRows.reduce((sum, cs) => sum + (cs.stock_qty || 0), 0);
          for (const sale of saleItems) {
            // Match Stock row by size_name (Settings "Size" field) when set; else legacy: item_name === stock.size_name
            const sizeKey =
              sale.size_name && String(sale.size_name).trim()
                ? sale.size_name
                : sale.item_name;
            const saleTypeKey = normalizeSizeMatchKey(String(sale.item_type || '').trim());
            const matchStock = stockRows.find((cs) => {
              const sizeOk = normalizeSizeMatchKey(cs.size_name) === normalizeSizeMatchKey(sizeKey);
              if (!sizeOk) return false;
              const stockTypeKey = normalizeSizeMatchKey(String(cs.item_type || '').trim());
              if (saleTypeKey) return stockTypeKey === saleTypeKey;
              return true;
            });
            const sn = sale.size_name && String(sale.size_name).trim();
            const sizeLabel = sn
              ? `${String(sale.item_name || '').trim()} ${sn}`.trim()
              : String(sale.item_name || '').trim();
            items.push({
              type: 'custom',
              name: sec.label,
              groupLabel: sec.label || sectionId,
              itemTypeLabel: String(sale.item_type || '').trim() || sec.label || sectionId,
              itemLabel: sizeLabel,
              sizeName: sizeLabel,
              sizeId: sale.id,
              customItemId: matchStock ? matchStock.id : null,
              sectionId: sectionId,
              unitPrice: sale.unit_price,
              calcType: 'fixed',
              priceAudience: normalizePriceAudience(sale.price_audience),
              stockQty: matchStock ? matchStock.stock_qty : totalSectionStock,
            });
          }
        } else {
          // Fallback: no pricing subitems defined yet — show stock rows directly so section appears in billing.
          for (const cs of stockRows) {
            const typePart = String(cs.item_type || '').trim();
            const baseLabel = String(cs.size_name || '').trim() || sec.label;
            const itemLabel = typePart ? `${baseLabel} · ${typePart}` : baseLabel;
            items.push({
              type: 'custom',
              name: sec.label,
              groupLabel: sec.label || cs.section_id,
              itemTypeLabel: typePart || sec.label || cs.section_id,
              itemLabel,
              sizeName: cs.size_name,
              sizeId: cs.id,
              customItemId: cs.id,
              sectionId: cs.section_id,
              unitPrice: cs.unit_price,
              calcType: 'fixed',
              stockQty: cs.stock_qty,
            });
          }
        }
      }
    }

    const { q } = req.query;
    if (q) {
      const lower = q.toLowerCase();
      const filtered = items.filter(
        (i) =>
          i.name.toLowerCase().includes(lower) ||
          i.sizeName.toLowerCase().includes(lower) ||
          (i.itemLabel && String(i.itemLabel).toLowerCase().includes(lower)) ||
          `${i.name} ${i.sizeName}`.toLowerCase().includes(lower)
      );
      return res.json(filtered);
    }
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Service-only items (no stock) - passport print, shop copy, etc.
router.get('/service-items', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM service_items ORDER BY name').all();
    res.json(rows);
  } catch (err) {
    if (err.message && err.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

router.post('/service-items', (req, res) => {
  try {
    const { name, item_type = '', qty_type = 'per_unit', unit_price = 0, price_audience } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name required' });
    const qty = (qty_type === 'per_sqft') ? 'per_sqft' : 'per_unit';
    const price = parseFloat(unit_price) || 0;
    const audience = normalizePriceAudience(price_audience);
    const result = db.prepare(`
      INSERT INTO service_items (name, item_type, qty_type, unit_price, price_audience)
      VALUES (?, ?, ?, ?, ?)
    `).run(String(name).trim(), String(item_type || '').trim(), qty, price, audience);
    const created = db.prepare('SELECT * FROM service_items WHERE id = ?').get(result.lastInsertRowid);
    log('price_added', 'price', created.id, {
      item_name: created.name,
      new_price: created.unit_price,
      price_audience: created.price_audience,
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/service-items/:id', (req, res) => {
  try {
    const { name, item_type, qty_type, unit_price, price_audience } = req.body;
    const id = req.params.id;
    const row = db.prepare('SELECT * FROM service_items WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Service item not found' });
    const updates = [];
    const params = [];
    if (name !== undefined && String(name).trim()) { updates.push('name = ?'); params.push(String(name).trim()); }
    if (item_type !== undefined) { updates.push('item_type = ?'); params.push(String(item_type || '').trim()); }
    if (qty_type !== undefined) { updates.push('qty_type = ?'); params.push(qty_type === 'per_sqft' ? 'per_sqft' : 'per_unit'); }
    if (unit_price !== undefined) { updates.push('unit_price = ?'); params.push(parseFloat(unit_price) || 0); }
    if (price_audience !== undefined) { updates.push('price_audience = ?'); params.push(normalizePriceAudience(price_audience)); }
    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
    params.push(id);
    db.prepare(`UPDATE service_items SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT * FROM service_items WHERE id = ?').get(id);
    log('price_changed', 'price', updated.id, {
      item_name: updated.name,
      old_price: row.unit_price,
      new_price: updated.unit_price,
      price_audience: updated.price_audience,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/service-items/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM service_items WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Service item not found' });
    db.prepare('DELETE FROM service_items WHERE id = ?').run(req.params.id);
    log('price_removed', 'price', row.id, {
      item_name: row.name,
      old_price: row.unit_price,
      price_audience: row.price_audience,
    });
    res.json({ deleted: true });
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
    const row = db.prepare('SELECT * FROM design_for_banner_sizes WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Design banner size not found' });
    db.prepare('DELETE FROM design_for_banner_sizes WHERE id = ?').run(row.id);
    log('price_removed', 'price', row.id, { item_name: row.size_name, size_name: row.size_name, old_price: row.unit_price, price_audience: row.price_audience });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/design-banner-sizes/:id', (req, res) => {
  try {
    const { unit_price, size_name, price_audience } = req.body;
    const id = req.params.id;
    const row = db.prepare('SELECT * FROM design_for_banner_sizes WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Design banner size not found' });
    const updates = [];
    const params = [];
    if (unit_price !== undefined) {
      updates.push('unit_price = ?');
      params.push(parseFloat(String(unit_price)) || 0);
    }
    if (size_name !== undefined && String(size_name).trim()) {
      updates.push('size_name = ?');
      params.push(String(size_name).trim());
    }
    if (price_audience !== undefined) {
      updates.push('price_audience = ?');
      params.push(normalizePriceAudience(price_audience));
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
    params.push(id);
    db.prepare(`UPDATE design_for_banner_sizes SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT * FROM design_for_banner_sizes WHERE id = ?').get(id);
    log('price_changed', 'price', updated.id, {
      item_name: updated.size_name,
      size_name: updated.size_name,
      old_price: row.unit_price,
      new_price: updated.unit_price,
      price_audience: updated.price_audience,
    });
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
    const row = db.prepare('SELECT * FROM design_for_photo_sizes WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Design photo size not found' });
    db.prepare('DELETE FROM design_for_photo_sizes WHERE id = ?').run(row.id);
    log('price_removed', 'price', row.id, { item_name: row.size_name, size_name: row.size_name, old_price: row.unit_price, price_audience: row.price_audience });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/design-photo-sizes/:id', (req, res) => {
  try {
    const { unit_price, size_name, price_audience } = req.body;
    const id = req.params.id;
    const row = db.prepare('SELECT * FROM design_for_photo_sizes WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Design photo size not found' });
    const updates = [];
    const params = [];
    if (unit_price !== undefined) {
      updates.push('unit_price = ?');
      params.push(parseFloat(String(unit_price)) || 0);
    }
    if (size_name !== undefined && String(size_name).trim()) {
      updates.push('size_name = ?');
      params.push(String(size_name).trim());
    }
    if (price_audience !== undefined) {
      updates.push('price_audience = ?');
      params.push(normalizePriceAudience(price_audience));
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
    params.push(id);
    db.prepare(`UPDATE design_for_photo_sizes SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT * FROM design_for_photo_sizes WHERE id = ?').get(id);
    log('price_changed', 'price', updated.id, {
      item_name: updated.size_name,
      size_name: updated.size_name,
      old_price: row.unit_price,
      new_price: updated.unit_price,
      price_audience: updated.price_audience,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
