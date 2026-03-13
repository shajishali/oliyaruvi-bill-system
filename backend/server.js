const express = require('express');
const cors = require('cors');

const billsRouter = require('./routes/bills');
const stockRouter = require('./routes/stock');
const customersRouter = require('./routes/customers');
const servicesRouter = require('./routes/services');
const settingsRouter = require('./routes/settings');
const reportsRouter = require('./routes/reports');
const notificationsRouter = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Oliyaruvi Printers API' });
});

// API Routes
app.use('/api/bills', billsRouter);
app.use('/api/stock', stockRouter);
app.use('/api/customers', customersRouter);
app.use('/api/services', servicesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/notifications', notificationsRouter);

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
