const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');

const billsRouter = require('./routes/bills');
const stockRouter = require('./routes/stock');
const customersRouter = require('./routes/customers');
const servicesRouter = require('./routes/services');
const settingsRouter = require('./routes/settings');
const reportsRouter = require('./routes/reports');
const notificationsRouter = require('./routes/notifications');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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
    const { size_name, frame_type = 'Standard', stock_qty = 0, unit_price = 0, low_stock_threshold = 5 } = req.body || {};
    if (!size_name || !String(size_name).trim()) return res.status(400).json({ error: 'size_name required' });
    const result = db.prepare(`
      INSERT INTO frame_sizes (size_name, frame_type, stock_qty, unit_price, low_stock_threshold)
      VALUES (?, ?, ?, ?, ?)
    `).run(String(size_name).trim(), String(frame_type || 'Standard').trim(), stock_qty || 0, unit_price || 0, low_stock_threshold || 5);
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
app.use('/api/notifications', notificationsRouter);
app.use('/api/auth', authRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Oliyaruvi Printers API running on http://localhost:${PORT}`);
});
