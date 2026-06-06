const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = process.env.DATA_PATH || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'entries.jsonl');

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(DATA_FILE); } catch { await fs.writeFile(DATA_FILE, ''); }
}

async function readAll() {
  await ensureFile();
  const content = await fs.readFile(DATA_FILE, 'utf-8');
  const entries = content.trim().split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
  // newest first
  entries.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
  return entries;
}

async function append(entry) {
  await ensureFile();
  await fs.appendFile(DATA_FILE, JSON.stringify(entry) + '\n', 'utf-8');
}

async function deleteById(id) {
  const all = await readAll();
  const filtered = all.filter(e => e.id !== id);
  if (filtered.length === all.length) return false; // not found
  // Write back (oldest first to preserve append order)
  const lines = filtered.slice().reverse().map(e => JSON.stringify(e)).join('\n');
  await fs.writeFile(DATA_FILE, lines ? lines + '\n' : '', 'utf-8');
  return true;
}

async function updateNote(id, note) {
  const all = await readAll();
  const idx = all.findIndex(e => e.id === id);
  if (idx === -1) return false;
  all[idx] = { ...all[idx], note };
  const lines = all.slice().reverse().map(e => JSON.stringify(e)).join('\n');
  await fs.writeFile(DATA_FILE, lines + '\n', 'utf-8');
  return true;
}

module.exports = { readAll, append, deleteById, updateNote };
