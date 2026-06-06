const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { initAdminPassword, authMiddleware, getAdminHash } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3006;

// Initialise password on startup
initAdminPassword();

// Middleware
app.use(cors({
  origin: ['http://localhost:5176', 'http://localhost:8080'],
  credentials: true
}));
app.use(express.json());
app.use(authMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Auth endpoint
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (hash !== getAdminHash()) return res.status(403).json({ error: 'Invalid password' });
  res.json({ token: hash });
});

// Route handlers
const eventsRouter = require('./routes/events');
const daysRouter = require('./routes/days');
const categoriesRouter = require('./routes/categories');
const holidaysRouter = require('./routes/holidays');

app.use('/api/events', eventsRouter);
app.use('/api/days', daysRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/holidays', holidaysRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
