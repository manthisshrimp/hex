const fs = require('fs');
const path = require('path');

const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, '../data');

const TASKS_FILE = path.join(DATA_PATH, 'tasks.jsonl');
const USERS_FILE = path.join(DATA_PATH, 'users.json');
const PERMISSIONS_FILE = path.join(DATA_PATH, 'permissions.json');

// --- Tasks (JSONL) ---

function readTasks() {
  if (!fs.existsSync(TASKS_FILE)) return [];
  const content = fs.readFileSync(TASKS_FILE, 'utf8');
  return content
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line));
}

function writeTasks(tasks) {
  const content = tasks.map(t => JSON.stringify(t)).join('\n');
  fs.writeFileSync(TASKS_FILE, content ? content + '\n' : '', 'utf8');
}

function appendTask(task) {
  fs.appendFileSync(TASKS_FILE, JSON.stringify(task) + '\n', 'utf8');
}

// --- Users (JSON) ---

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) return { users: [] };
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return { users: [] };
  }
}

function writeUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// --- Permissions (JSON) ---

function readPermissions() {
  if (!fs.existsSync(PERMISSIONS_FILE)) return { grants: [] };
  try {
    return JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf8'));
  } catch {
    return { grants: [] };
  }
}

function writePermissions(data) {
  fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// --- Requests (JSONL) ---

const REQUESTS_FILE = path.join(DATA_PATH, 'requests.jsonl');

function readRequests() {
  if (!fs.existsSync(REQUESTS_FILE)) return [];
  const content = fs.readFileSync(REQUESTS_FILE, 'utf8');
  return content.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

function writeRequests(requests) {
  const content = requests.map(r => JSON.stringify(r)).join('\n');
  fs.writeFileSync(REQUESTS_FILE, content ? content + '\n' : '', 'utf8');
}

function appendRequest(request) {
  fs.appendFileSync(REQUESTS_FILE, JSON.stringify(request) + '\n', 'utf8');
}

module.exports = {
  readTasks,
  writeTasks,
  appendTask,
  readUsers,
  writeUsers,
  readPermissions,
  writePermissions,
  readRequests,
  writeRequests,
  appendRequest,
};
