const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Support custom DB path (e.g. Electron userData)
const customDbPath = process.env.DATABASE_PATH;
let dbDir, dbPath, seedDir;

if (customDbPath) {
  dbPath = customDbPath;
  dbDir = path.dirname(dbPath);
  seedDir = path.join(__dirname, '../../database');
} else {
  dbDir = path.join(__dirname, '../../database');
  dbPath = path.join(dbDir, 'oliyaruvi.db');
  seedDir = dbDir;
}

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Run migrations (with tracking - each migration runs only once)
function runMigrations() {
  const migrationsDir = path.join(__dirname, '../db/migrations');
  if (!fs.existsSync(migrationsDir)) return;

  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)`);
  const run = db.prepare('SELECT 1 FROM _migrations WHERE name = ?').pluck();
  const insert = db.prepare('INSERT INTO _migrations (name) VALUES (?)');

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (run.get(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec(sql);
    insert.run(file);
  }
}

/** Add banner unit_price / price_unit if missing (e.g. DB copied before 041 ran). */
function ensureBannerStockPriceColumns() {
  try {
    const bannerCols = db.prepare('PRAGMA table_info(banner_stock)').all();
    if (!bannerCols.some((c) => c.name === 'unit_price')) {
      db.exec('ALTER TABLE banner_stock ADD COLUMN unit_price REAL');
    }
    if (!bannerCols.some((c) => c.name === 'price_unit')) {
      db.exec("ALTER TABLE banner_stock ADD COLUMN price_unit TEXT DEFAULT 'per_sqft'");
    }
  } catch (e) {
    console.error('ensureBannerStockPriceColumns:', e);
  }
}

/** Add banner print_type if missing (e.g. DB copied before 040 ran). */
function ensureBannerPrintTypeColumn() {
  try {
    const bannerCols = db.prepare('PRAGMA table_info(banner_stock)').all();
    if (!bannerCols.some((c) => c.name === 'print_type')) {
      db.exec("ALTER TABLE banner_stock ADD COLUMN print_type TEXT NOT NULL DEFAULT ''");
    }
  } catch (e) {
    console.error('ensureBannerPrintTypeColumn:', e);
  }
}

/** Add banner/sticker stock_type if missing (e.g. server never restarted after 037 was added). */
function ensureBannerStickerStockTypeColumns() {
  try {
    let added = false;
    const bannerCols = db.prepare('PRAGMA table_info(banner_stock)').all();
    if (!bannerCols.some((c) => c.name === 'stock_type')) {
      db.exec("ALTER TABLE banner_stock ADD COLUMN stock_type TEXT DEFAULT ''");
      added = true;
    }
    const stickerCols = db.prepare('PRAGMA table_info(sticker_stock)').all();
    if (!stickerCols.some((c) => c.name === 'stock_type')) {
      db.exec("ALTER TABLE sticker_stock ADD COLUMN stock_type TEXT DEFAULT ''");
      added = true;
    }
    if (added) {
      db.prepare('INSERT OR IGNORE INTO _migrations (name) VALUES (?)').run('037_banner_sticker_stock_type.sql');
    }
  } catch (e) {
    console.error('ensureBannerStickerStockTypeColumns:', e);
  }
}

// Run seed (only if shop_settings is empty)
function runSeed() {
  const seedPath = path.join(seedDir, 'seed.sql');
  if (!fs.existsSync(seedPath)) return;

  const existing = db.prepare('SELECT COUNT(*) as count FROM shop_settings').get();
  if (existing.count > 0) return; // Already seeded

  const sql = fs.readFileSync(seedPath, 'utf8');
  db.exec(sql);
}

// Remove any legacy default frame stock rows (added by old migrations).
// This ensures the setup/build starts with an empty system.
function removeLegacyDefaultFrameRows() {
  try {
    const ran = db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get('009_add_duro_frame.sql');
    if (!ran) return;

    // Default rows inserted by the legacy migration.
    const expected = [
      { size_name: '8x12', stock_qty: 7, unit_price: 2000, low_stock_threshold: 3 },
      { size_name: '10x15', stock_qty: 7, unit_price: 2800, low_stock_threshold: 3 },
      { size_name: '12x18', stock_qty: 7, unit_price: 3500, low_stock_threshold: 3 },
      { size_name: '16x24', stock_qty: 7, unit_price: 7500, low_stock_threshold: 3 },
    ];

    const rows = db
      .prepare(
        `SELECT size_name, stock_qty, unit_price, low_stock_threshold
         FROM frame_sizes
         WHERE frame_type = 'Duro' AND size_name IN (?, ?, ?, ?)`
      )
      .all('8x12', '10x15', '12x18', '16x24');

    if (!Array.isArray(rows) || rows.length !== expected.length) return;

    const matches = expected.every((e) =>
      rows.some(
        (r) =>
          String(r.size_name) === e.size_name &&
          Number(r.stock_qty) === e.stock_qty &&
          Number(r.unit_price) === e.unit_price &&
          Number(r.low_stock_threshold) === e.low_stock_threshold
      )
    );

    if (!matches) return;

    // Delete from stock and catalog pricing (pricing table mirrors stock by frame type).
    db.prepare(`DELETE FROM frame_pricing WHERE frame_type = 'Duro' AND size_name IN (?, ?, ?, ?)`).run(
      '8x12',
      '10x15',
      '12x18',
      '16x24'
    );
    db.prepare(`DELETE FROM frame_sizes WHERE frame_type = 'Duro' AND size_name IN (?, ?, ?, ?)`).run(
      '8x12',
      '10x15',
      '12x18',
      '16x24'
    );
  } catch (_) {
    /* ignore cleanup errors */
  }
}

function stripDefaultBannerDataIfNotConfigured() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS _app_flags (
        name TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    const flagName = 'banner_defaults_stripped';
    const already = db.prepare('SELECT 1 FROM _app_flags WHERE name = ?').get(flagName);
    if (already) return;

    const shop = db.prepare('SELECT shop_name FROM shop_settings WHERE id = 1').get();
    const shopName = shop?.shop_name == null ? '' : String(shop.shop_name).trim();
    // Only strip when shop settings are still empty (fresh setup stage).
    if (shopName !== '') return;

    const bannerPrintCount = db.prepare(
      `SELECT COUNT(*) as c
       FROM banner_materials
       WHERE LOWER(TRIM(material_name)) LIKE '%banner print%'`
    ).get().c;

    if (bannerPrintCount <= 0) return;

    // Remove banner/sticker auto-catalog rows and their stock so Bill dropdown doesn't show them.
    db.prepare('DELETE FROM banner_stock').run();
    db.prepare('DELETE FROM sticker_stock').run();
    db.prepare("DELETE FROM banner_materials WHERE LOWER(TRIM(material_name)) LIKE '%banner print%'").run();
    db.prepare('DELETE FROM sticker_materials').run();

    db.prepare('INSERT OR REPLACE INTO _app_flags (name, value) VALUES (?, ?)').run(flagName, '1');
  } catch (_) {
    /* ignore cleanup errors */
  }
}

// Initialize on first run
runMigrations();
ensureBannerStickerStockTypeColumns();
ensureBannerPrintTypeColumn();
ensureBannerStockPriceColumns();
runSeed();
removeLegacyDefaultFrameRows();
stripDefaultBannerDataIfNotConfigured();

module.exports = db;
