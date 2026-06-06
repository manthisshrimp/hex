const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, '../../data');
const PASSWORDS_DIR = path.join(DATA_PATH, 'passwords');

// Map of token → { username, isAdmin }
let tokenMap = new Map();

function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(12);
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function hashToken(username, password) {
  return crypto.createHash('sha256').update(`${username}:${password}`).digest('hex');
}

function reloadPasswords() {
  tokenMap = new Map();
  if (!fs.existsSync(PASSWORDS_DIR)) return;

  const usersFile = path.join(DATA_PATH, 'users.json');
  let adminSet = new Set(['admin']);
  if (fs.existsSync(usersFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      for (const u of data.users) {
        if (u.isAdmin) adminSet.add(u.username);
      }
    } catch (err) {
      console.error('Failed to read users.json for admin lookup:', err.message);
    }
  }

  const files = fs.readdirSync(PASSWORDS_DIR).filter(f => f.endsWith('.pwd'));
  for (const file of files) {
    const username = file.replace(/\.pwd$/, '');
    const filePath = path.join(PASSWORDS_DIR, file);
    try {
      const password = fs.readFileSync(filePath, 'utf8').trim();
      const token = hashToken(username, password);
      tokenMap.set(token, { username, isAdmin: adminSet.has(username) });
    } catch (err) {
      console.error(`Failed to read password file for ${username}:`, err.message);
    }
  }
}

function initPasswords() {
  // Ensure passwords dir exists
  fs.mkdirSync(PASSWORDS_DIR, { recursive: true });

  // Seed default admin password if missing
  const adminPwdPath = path.join(PASSWORDS_DIR, 'admin.pwd');
  if (process.env.ADMIN_PASSWORD) {
    fs.writeFileSync(adminPwdPath, process.env.ADMIN_PASSWORD, 'utf8');
    console.log('Admin password set from ADMIN_PASSWORD env var');
  } else if (!fs.existsSync(adminPwdPath)) {
    const defaultPassword = 'changeme123';
    fs.writeFileSync(adminPwdPath, defaultPassword, 'utf8');
    console.warn('WARNING: Admin password file not found. Created with default password "changeme123". Change this immediately.');
  }

  // Ensure data files exist
  const tasksFile = path.join(DATA_PATH, 'tasks.jsonl');
  if (!fs.existsSync(tasksFile)) {
    fs.writeFileSync(tasksFile, '', 'utf8');
  }

  const usersFile = path.join(DATA_PATH, 'users.json');
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify({ users: [] }, null, 2), 'utf8');
  }

  const permissionsFile = path.join(DATA_PATH, 'permissions.json');
  if (!fs.existsSync(permissionsFile)) {
    fs.writeFileSync(permissionsFile, JSON.stringify({ grants: [] }, null, 2), 'utf8');
  }

  const requestsFile = path.join(DATA_PATH, 'requests.jsonl');
  if (!fs.existsSync(requestsFile)) {
    fs.writeFileSync(requestsFile, '', 'utf8');
  }

  // Reload token map from password files
  reloadPasswords();

  // Sync admin into users.json if not already present
  const usersData = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  const hasAdmin = usersData.users.some(u => u.username === 'admin');
  if (!hasAdmin) {
    usersData.users.unshift({ username: 'admin', isAdmin: true });
    fs.writeFileSync(usersFile, JSON.stringify(usersData, null, 2), 'utf8');
  }
}

function authMiddleware(req, res, next) {
  const exempt =
    (req.method === 'GET' && req.path === '/health') ||
    (req.method === 'POST' && req.path === '/api/auth');

  if (exempt) return next();

  const token = req.headers['x-auth-token'];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = tokenMap.get(token);
  if (!user) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  req.user = user;
  next();
}

function createUserPassword(username, password) {
  const filePath = path.join(PASSWORDS_DIR, `${username}.pwd`);
  fs.writeFileSync(filePath, password, 'utf8');
  reloadPasswords();
}

function deleteUserPassword(username) {
  const filePath = path.join(PASSWORDS_DIR, `${username}.pwd`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  reloadPasswords();
}

function getKnownUsers() {
  if (!fs.existsSync(PASSWORDS_DIR)) return [];
  const files = fs.readdirSync(PASSWORDS_DIR).filter(f => f.endsWith('.pwd'));
  return files.map(f => {
    const username = f.replace(/\.pwd$/, '');
    return { username, isAdmin: username === 'admin' };
  });
}

function lookupToken(token) {
  return tokenMap.get(token) || null;
}

module.exports = {
  initPasswords,
  authMiddleware,
  createUserPassword,
  deleteUserPassword,
  generatePassword,
  reloadPasswords,
  getKnownUsers,
  lookupToken,
};
