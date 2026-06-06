const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { initAdminPassword, authMiddleware, getAdminHash } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize admin password on startup
initAdminPassword();

// Apply auth middleware globally (exemptions for /health and POST /api/auth are in the middleware)
app.use(authMiddleware);

// Routes
const categoriesRouter = require('./routes/categories');
const yearsRouter = require('./routes/years');
const monthsRouter = require('./routes/months');

app.use('/api/categories', categoriesRouter);
app.use('/api/years', yearsRouter);
app.use('/api/years', monthsRouter);

// POST /api/auth - Verify password and get token
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (hash === getAdminHash()) return res.json({ token: hash });
  res.status(401).json({ error: 'Invalid password' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Expense tracker API running on port ${PORT}`);
});
