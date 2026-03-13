const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../database');
const dbPath = path.join(dbDir, 'oliyaruvi.db');

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Run migrations
function runMigrations() {
  const migrationsDir = path.join(__dirname, '../db/migrations');
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec(sql);
  }
}

// Run seed (only if shop_settings is empty)
function runSeed() {
  const seedPath = path.join(dbDir, 'seed.sql');
  if (!fs.existsSync(seedPath)) return;

  const existing = db.prepare('SELECT COUNT(*) as count FROM shop_settings').get();
  if (existing.count > 0) return; // Already seeded

  const sql = fs.readFileSync(seedPath, 'utf8');
  db.exec(sql);
}

// Initialize on first run
runMigrations();
runSeed();

module.exports = db;
