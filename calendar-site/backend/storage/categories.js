const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = process.env.DATA_PATH || path.join(__dirname, '..', 'data');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');

const DEFAULT_CATEGORIES = [
  { id: 'cat-work',     name: 'Work',     color: '#3b82f6' },
  { id: 'cat-personal', name: 'Personal', color: '#22c55e' },
  { id: 'cat-health',   name: 'Health',   color: '#ef4444' },
  { id: 'cat-social',   name: 'Social',   color: '#8b5cf6' },
  { id: 'cat-travel',   name: 'Travel',   color: '#f59e0b' },
  { id: 'cat-other',    name: 'Other',    color: '#6b7280' },
];

async function ensureDataDir() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch (_) {}
}

async function initCategories() {
  await ensureDataDir();
  try { await fs.access(CATEGORIES_FILE); }
  catch (_) {
    await fs.writeFile(CATEGORIES_FILE, JSON.stringify({ categories: DEFAULT_CATEGORIES }, null, 2), 'utf-8');
  }
}

async function getAllCategories() {
  await initCategories();
  const data = JSON.parse(await fs.readFile(CATEGORIES_FILE, 'utf-8'));
  return data.categories || [];
}

async function createCategory({ name, color, isNonWorking }) {
  const categories = await getAllCategories();
  if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Category with this name already exists');
  }
  const cat = { id: `cat-${uuidv4().split('-')[0]}`, name: name.trim(), color: color || '#6b7280', isNonWorking: !!isNonWorking };
  categories.push(cat);
  await fs.writeFile(CATEGORIES_FILE, JSON.stringify({ categories }, null, 2), 'utf-8');
  return cat;
}

async function updateCategory(id, { name, color, isNonWorking }) {
  const categories = await getAllCategories();
  const idx = categories.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Category not found');
  if (name) categories[idx].name = name.trim();
  if (color) categories[idx].color = color;
  if (isNonWorking !== undefined) categories[idx].isNonWorking = !!isNonWorking;
  await fs.writeFile(CATEGORIES_FILE, JSON.stringify({ categories }, null, 2), 'utf-8');
  return categories[idx];
}

async function deleteCategory(id) {
  const categories = await getAllCategories();
  const idx = categories.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Category not found');
  categories.splice(idx, 1);
  await fs.writeFile(CATEGORIES_FILE, JSON.stringify({ categories }, null, 2), 'utf-8');
  return { deleted: id };
}

module.exports = { getAllCategories, createCategory, updateCategory, deleteCategory };
