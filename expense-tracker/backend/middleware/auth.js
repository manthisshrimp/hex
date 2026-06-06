const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Path to admin password file
const PWD_FILE = path.join(os.homedir(), '.expense-admin.pwd');

let adminHash = null;

// Initialize admin password
function initAdminPassword() {
  try {
    if (fs.existsSync(PWD_FILE)) {
      const pwd = fs.readFileSync(PWD_FILE, 'utf8').trim();
      adminHash = crypto.createHash('sha256').update(pwd).digest('hex');
      console.log('✓ Admin password loaded from ~/.expense-admin.pwd');
    } else {
      // Create default password if file doesn't exist
      const defaultPwd = 'changeme123';
      fs.writeFileSync(PWD_FILE, defaultPwd, { mode: 0o600 });
      adminHash = crypto.createHash('sha256').update(defaultPwd).digest('hex');
      console.log('✓ Created default admin password file at ~/.expense-admin.pwd');
      console.log('  ⚠️  DEFAULT PASSWORD: changeme123 (please change this!)');
    }
  } catch (err) {
    console.error('Error initializing admin password:', err.message);
    process.exit(1);
  }
}

// Middleware to check authentication
function authMiddleware(req, res, next) {
  // Health check doesn't require auth
  if (req.path === '/health') {
    return next();
  }

  // Auth endpoint doesn't require auth (obviously)
  if (req.method === 'POST' && req.path === '/api/auth') {
    return next();
  }

  // All other endpoints require token
  const token = req.headers['x-admin-token'];

  if (!token) {
    return res.status(401).json({ error: 'Missing X-Admin-Token header' });
  }

  if (token !== adminHash) {
    return res.status(403).json({ error: 'Invalid admin token' });
  }

  next();
}

const getAdminHash = () => adminHash;

module.exports = {
  initAdminPassword,
  authMiddleware,
  getAdminHash
};
