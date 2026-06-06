const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = process.env.DATA_PATH || path.join(__dirname, '..', 'data');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');

// Default categories with colors
const DEFAULT_CATEGORIES = [
  { id: 'cat-groceries', name: 'Groceries', color: '#22c55e' },
  { id: 'cat-transport', name: 'Transport', color: '#3b82f6' },
  { id: 'cat-utilities', name: 'Utilities', color: '#f59e0b' },
  { id: 'cat-entertainment', name: 'Entertainment', color: '#8b5cf6' },
  { id: 'cat-dining', name: 'Dining', color: '#ef4444' },
  { id: 'cat-healthcare', name: 'Healthcare', color: '#06b6d4' },
  { id: 'cat-shopping', name: 'Shopping', color: '#ec4899' },
  { id: 'cat-other', name: 'Other', color: '#6b7280' },
];

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // Directory already exists or can't be created
  }
}

// Initialize categories file with defaults if it doesn't exist
async function initCategories() {
  await ensureDataDir();
  try {
    await fs.access(CATEGORIES_FILE);
    // File exists, do nothing
  } catch (err) {
    // File doesn't exist, create with defaults
    await fs.writeFile(
      CATEGORIES_FILE,
      JSON.stringify({ categories: DEFAULT_CATEGORIES }, null, 2),
      'utf-8'
    );
  }
}

// Read all categories
async function getAllCategories() {
  await initCategories();
  const content = await fs.readFile(CATEGORIES_FILE, 'utf-8');
  const data = JSON.parse(content);
  return data.categories || [];
}

// Get a single category by ID
async function getCategoryById(categoryId) {
  const categories = await getAllCategories();
  return categories.find(c => c.id === categoryId) || null;
}

// Create a new category
async function createCategory({ name, color }) {
  const categories = await getAllCategories();
  
  // Check for duplicate name
  if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Category with this name already exists');
  }
  
  const newCategory = {
    id: `cat-${uuidv4().split('-')[0]}`,
    name: name.trim(),
    color: validateColor(color),
  };
  
  categories.push(newCategory);
  await fs.writeFile(
    CATEGORIES_FILE,
    JSON.stringify({ categories }, null, 2),
    'utf-8'
  );
  
  return newCategory;
}

// Update a category
async function updateCategory(categoryId, { name, color }) {
  const categories = await getAllCategories();
  const index = categories.findIndex(c => c.id === categoryId);
  
  if (index === -1) {
    throw new Error('Category not found');
  }
  
  // Check for duplicate name (excluding current category)
  if (name && categories.some(c => c.id !== categoryId && c.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Category with this name already exists');
  }
  
  if (name) categories[index].name = name.trim();
  if (color) categories[index].color = validateColor(color);
  
  await fs.writeFile(
    CATEGORIES_FILE,
    JSON.stringify({ categories }, null, 2),
    'utf-8'
  );
  
  return categories[index];
}

// Delete a category
async function deleteCategory(categoryId) {
  const categories = await getAllCategories();
  const index = categories.findIndex(c => c.id === categoryId);
  
  if (index === -1) {
    throw new Error('Category not found');
  }
  
  categories.splice(index, 1);
  await fs.writeFile(
    CATEGORIES_FILE,
    JSON.stringify({ categories }, null, 2),
    'utf-8'
  );
  
  return { deleted: categoryId };
}

// Validate hex color
function validateColor(color) {
  if (!color || typeof color !== 'string') {
    return '#6b7280'; // Default gray
  }
  // Allow #RGB or #RRGGBB format
  const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
  if (hexRegex.test(color)) {
    // Normalize 3-digit hex to 6-digit
    if (color.length === 4) {
      const r = color[1];
      const g = color[2];
      const b = color[3];
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return color.toLowerCase();
  }
  return '#6b7280'; // Default gray for invalid colors
}

// Get expense count for a category across all years
async function getCategoryExpenseCount(categoryId, getAllYearsData) {
  const years = await getAllYearsData();
  let count = 0;
  
  for (const year of years) {
    for (const month of year.months) {
      count += month.expenses.filter(e => e.categoryId === categoryId).length;
    }
  }
  
  return count;
}

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  validateColor,
  getCategoryExpenseCount,
};
