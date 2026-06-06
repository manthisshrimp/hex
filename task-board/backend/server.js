const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { initPasswords, authMiddleware, lookupToken } = require('./middleware/auth');
const { loadApiKey, getApiKey } = require('./middleware/api-key');
const { initHabitsSync } = require('./sync');
const { readPermissions, readUsers } = require('./storage');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure passwords dir exists and seed admin if missing
initPasswords();

// Load shared API key and initialise habits sync client
loadApiKey();
initHabitsSync(getApiKey());

app.use(cors({
  origin: ['http://localhost:5179', 'http://localhost:8080'],
  credentials: true,
}));
app.use(express.json());

// Service routes use API key auth — must be mounted before authMiddleware
app.use('/api/service', require('./routes/service'));

app.use(authMiddleware);

// GET /health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// POST /api/auth — login
app.post('/api/auth', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  const token = crypto.createHash('sha256').update(`${username}:${password}`).digest('hex');
  const user = lookupToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  res.json({ token, username: user.username, isAdmin: user.isAdmin });
});

// GET /api/auth/me
app.get('/api/auth/me', (req, res) => {
  const perms = readPermissions();
  const canAccess = perms.grants
    .filter(g => g.grantee === req.user.username)
    .map(g => g.owner);
  res.json({ username: req.user.username, isAdmin: req.user.isAdmin, canAccess });
});

// GET /api/users — list of all usernames (for dropdowns etc.)
app.get('/api/users', (req, res) => {
  const { users } = readUsers();
  res.json({ users: users.map(u => u.username) });
});

app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/requests', require('./routes/requests'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

// 404 fallback
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => console.log(`Task Board backend running on port ${PORT}`));
