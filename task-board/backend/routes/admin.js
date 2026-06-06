const express = require('express');
const path = require('path');
const fs = require('fs');
const {
  createUserPassword,
  deleteUserPassword,
  generatePassword,
  reloadPasswords,
} = require('../middleware/auth');
const {
  readUsers,
  writeUsers,
  readTasks,
  writeTasks,
  readPermissions,
  writePermissions,
} = require('../storage');

const router = express.Router();

const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, '../../data');
const PASSWORDS_DIR = path.join(DATA_PATH, 'passwords');

// Admin-only guard
router.use((req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
});

// --- User routes ---

// GET /users
router.get('/users', (req, res) => {
  const data = readUsers();
  const users = data.users.map(u => ({
    ...u,
    hasPasswordFile: fs.existsSync(path.join(PASSWORDS_DIR, `${u.username}.pwd`)),
  }));
  res.json({ users });
});

// POST /users
router.post('/users', (req, res) => {
  const { username, password } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }
  if (!/^[a-zA-Z0-9-]+$/.test(username)) {
    return res.status(400).json({ error: 'username may only contain letters, numbers, and hyphens' });
  }

  const data = readUsers();
  if (data.users.some(u => u.username === username)) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const pwd = password || generatePassword();
  createUserPassword(username, pwd);

  data.users.push({ username, isAdmin: false });
  writeUsers(data);

  res.status(201).json({ username, password: pwd });
});

// DELETE /users/:username
router.delete('/users/:username', (req, res) => {
  const { username } = req.params;

  if (username === 'admin') {
    return res.status(400).json({ error: 'Cannot delete admin user' });
  }

  const data = readUsers();
  const userIndex = data.users.findIndex(u => u.username === username);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  data.users.splice(userIndex, 1);
  writeUsers(data);

  deleteUserPassword(username);

  // Remove all tasks belonging to this user
  const tasks = readTasks().filter(t => t.ownerUsername !== username);
  writeTasks(tasks);

  // Remove all permission grants involving this user
  const permissions = readPermissions();
  permissions.grants = permissions.grants.filter(
    g => g.grantee !== username && g.owner !== username
  );
  writePermissions(permissions);

  res.json({ success: true });
});

// POST /users/:username/reset-password
router.post('/users/:username/reset-password', (req, res) => {
  const { username } = req.params;
  const pwd = generatePassword();
  createUserPassword(username, pwd);
  res.json({ password: pwd });
});

// --- Permission routes ---

// GET /permissions
router.get('/permissions', (req, res) => {
  res.json(readPermissions());
});

// POST /permissions
router.post('/permissions', (req, res) => {
  const { grantee, owner } = req.body;

  if (!grantee || !owner) {
    return res.status(400).json({ error: 'grantee and owner are required' });
  }

  const data = readUsers();
  const usernames = data.users.map(u => u.username);

  if (!usernames.includes(grantee)) {
    return res.status(400).json({ error: `User "${grantee}" does not exist` });
  }
  if (!usernames.includes(owner)) {
    return res.status(400).json({ error: `User "${owner}" does not exist` });
  }

  const permissions = readPermissions();
  const alreadyExists = permissions.grants.some(
    g => g.grantee === grantee && g.owner === owner
  );

  if (!alreadyExists) {
    permissions.grants.push({ grantee, owner });
    writePermissions(permissions);
  }

  res.json({ success: true });
});

// DELETE /permissions
router.delete('/permissions', (req, res) => {
  const { grantee, owner } = req.body;

  if (!grantee || !owner) {
    return res.status(400).json({ error: 'grantee and owner are required' });
  }

  const permissions = readPermissions();
  permissions.grants = permissions.grants.filter(
    g => !(g.grantee === grantee && g.owner === owner)
  );
  writePermissions(permissions);

  res.json({ success: true });
});

module.exports = router;
