#!/usr/bin/env node
// Reset database - deletes oliyaruvi.db so migrations run fresh on next backend start
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../database/oliyaruvi.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Database reset. Restart the backend to run migrations with a clean slate.');
} else {
  console.log('No database file found. Nothing to reset.');
}
