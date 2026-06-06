const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PWD_FILE = path.join(os.homedir(), '.calendar-admin.pwd');

let adminHash = null;

function initAdminPassword() {
  try {
    if (fs.existsSync(PWD_FILE)) {
      const pwd = fs.readFileSync(PWD_FILE, 'utf8').trim();
      adminHash = crypto.createHash('sha256').update(pwd).digest('hex');
      console.log('✓ Admin password loaded from ~/.calendar-admin.pwd');
    } else {
      const defaultPwd = 'changeme123';
      fs.writeFileSync(PWD_FILE, defaultPwd, { mode: 0o600 });
      adminHash = crypto.createHash('sha256').update(defaultPwd).digest('hex');
      console.log('✓ Created default admin password at ~/.calendar-admin.pwd');
      console.log('  ⚠️  DEFAULT PASSWORD: changeme123 (please change this!)');
    }
  } catch (err) {
    console.error('Error initializing admin password:', err.message);
    process.exit(1);
  }
}

function authMiddleware(req, res, next) {
  if (req.path === '/health') return next();
  if (req.method === 'POST' && req.path === '/api/auth') return next();

  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ error: 'Missing X-Admin-Token header' });
  if (token !== adminHash) return res.status(403).json({ error: 'Invalid admin token' });

  next();
}

function getAdminHash() {
  return adminHash;
}

module.exports = { initAdminPassword, authMiddleware, getAdminHash };
