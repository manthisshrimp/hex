const express = require('express');
const cors = require('cors');
const { initAuth, authMiddleware } = require('./middleware/auth');
const entriesRouter = require('./routes/entries');

initAuth();

const app = express();
app.use(cors());
app.use(express.json());
app.use(authMiddleware);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/auth', (req, res) => {
  const { getAuthHash } = require('./middleware/auth');
  const crypto = require('crypto');
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'password required' });
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (hash !== getAuthHash()) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ token: hash });
});

app.use('/api/entries', entriesRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`mood-tracker backend on :${PORT}`));
