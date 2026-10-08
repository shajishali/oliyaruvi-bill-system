const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

if (process.env.RESEND_KEY || process.env.RESEND_API_KEY) {
  console.log('[Config] Resend key loaded for OTP emails');
}

const express = require('express');
const cors = require('cors');

const billsRouter = require('./routes/bills');
const stockRouter = require('./routes/stock');
const customersRouter = require('./routes/customers');
const servicesRouter = require('./routes/services');
const settingsRouter = require('./routes/settings');
const reportsRouter = require('./routes/reports');
const expensesRouter = require('./routes/expenses');
const notificationsRouter = require('./routes/notifications');
const authRouter = require('./routes/auth');
const branchesRouter = require('./routes/branches');
const counterRouter = require('./routes/counter');
const salaryRouter = require('./routes/salary');

const app = express();
const PORT = Number(process.env.PORT || 5000);

// Middleware
app.use(cors());
app.use((req, res, next) => {
  if (req.method === 'POST' && (req.path === '/api/settings/logo' || req.path === '/api/settings/send-report')) {
    return express.json({ limit: '6mb' })(req, res, next);
  }
  return express.json()(req, res, next);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Oliyaruvi Printers API' });
});

// Stock create endpoints - defined at app level to guarantee they match (before any router)
const db = require('./config/database');
const { log } = require('./lib/activityLog');
app.post('/api/stock/frames', createFrameHandler);
app.post('/api/stock/frames/', createFrameHandler);  // trailing slash variant
app.post('/api/stock/photos', createPhotoHandler);
app.post('/api/stock/photos/', createPhotoHandler); // trailing slash variant

function createFrameHandler(req, res) {
  try {
    const { size_name, frame_type = 'Standard', subitem_name = '', stock_qty = 0, unit_price = 0, low_stock_threshold = 5 } = req.body || {};
    if (!size_name || !String(size_name).trim()) return res.status(400).json({ error: 'size_name required' });
    const sub = String(subitem_name || '').trim();
    const result = db.prepare(`
      INSERT INTO frame_sizes (size_name, frame_type, subitem_name, stock_qty, unit_price, low_stock_threshold)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(String(size_name).trim(), String(frame_type || 'Standard').trim(), sub, stock_qty || 0, unit_price || 0, low_stock_threshold || 5);
    const created = db.prepare('SELECT * FROM frame_sizes WHERE id = ?').get(result.lastInsertRowid);
    log('frame_created', 'frame', created.id, { size_name: created.size_name, frame_type: created.frame_type });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
function createPhotoHandler(req, res) {
  try {
    const { size_name, stock_qty = 0, unit_price = 0, low_stock_threshold = 5 } = req.body || {};
    if (!size_name || !String(size_name).trim()) return res.status(400).json({ error: 'size_name required' });
    const result = db.prepare(`
      INSERT INTO photo_sizes (size_name, stock_qty, unit_price, low_stock_threshold)
      VALUES (?, ?, ?, ?)
    `).run(String(size_name).trim(), stock_qty || 0, unit_price || 0, low_stock_threshold || 5);
    const created = db.prepare('SELECT * FROM photo_sizes WHERE id = ?').get(result.lastInsertRowid);
    log('photo_created', 'photo', created.id, { size_name: created.size_name });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// API Routes
app.use('/api/bills', billsRouter);
app.use('/api/stock', stockRouter);
app.use('/api/customers', customersRouter);
app.use('/api/services', servicesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/auth', authRouter);
app.use('/api/branches', branchesRouter);
app.use('/api/counter', counterRouter);
app.use('/api/salary', salaryRouter);

// Serve built frontend when running in Electron (production)
const isElectron = process.env.ELECTRON_APP === 'true';
const frontendDistCandidates = [
  process.env.FRONTEND_DIST,
  path.join(__dirname, '../frontend/dist'),
  path.join(path.dirname(process.execPath || __dirname), 'resources', 'app.asar.unpacked', 'frontend', 'dist'),
];
const frontendDist = frontendDistCandidates.find((p) => p && fs.existsSync(p)) || frontendDistCandidates[1];
if (isElectron && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const server = app.listen(PORT, process.env.ELECTRON_APP === 'true' ? '127.0.0.1' : undefined, () => {
  console.log(`Oliyaruvi Printers API running on http://localhost:${server.address().port}`);
});
module.exports = server;

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`\n[Error] Port ${PORT} is already in use. Another process (often an old node server) is still running.\n`);
    console.error('Fix: stop it, then run npm start again.');
    console.error('  PowerShell: Get-NetTCPConnection -LocalPort ' + PORT + ' -State Listen | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }');
    console.error('  Or:        npm run start:clean\n');
    process.exit(1);
  }
  throw err;
});
