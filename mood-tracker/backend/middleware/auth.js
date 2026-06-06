const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PWD_FILE = '/root/.mood-admin.pwd';
const DEFAULT_PWD = 'changeme123';

let adminHash = null;

function initAuth() {
  let pwd;
  if (process.env.ADMIN_PASSWORD) {
    pwd = process.env.ADMIN_PASSWORD.trim();
    console.log('[auth] Admin password loaded from ADMIN_PASSWORD env var');
  } else {
    try {
      pwd = fs.readFileSync(PWD_FILE, 'utf-8').trim();
    } catch {
      pwd = DEFAULT_PWD;
      console.warn(`[auth] Password file not found at ${PWD_FILE}, using default`);
    }
  }
  adminHash = crypto.createHash('sha256').update(pwd).digest('hex');
  console.log('[auth] Admin token initialized');
}

function authMiddleware(req, res, next) {
  if (req.path === '/health' || (req.path === '/api/auth' && req.method === 'POST')) {
    return next();
  }
  const token = req.headers['x-admin-token'];
  if (!token || token !== adminHash) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function getAuthHash() { return adminHash; }

module.exports = { initAuth, authMiddleware, getAuthHash };
