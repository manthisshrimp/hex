const express = require('express');
const router = express.Router();
const categoriesStorage = require('../storage/categories');
const { isCategoryUsed } = require('../storage');

// GET /api/categories - List all categories
router.get('/', async (req, res) => {
  try {
    const categories = await categoriesStorage.getAllCategories();
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/categories - Create new category
router.post('/', async (req, res) => {
  try {
    const { name, color } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    const category = await categoriesStorage.createCategory({
      name: name.trim(),
      color: color || '#6b7280',
    });
    
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/categories/:id - Update category
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    
    const category = await categoriesStorage.updateCategory(id, updates);
    res.json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/categories/:id - Delete category
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if category is in use
    const inUse = await isCategoryUsed(id);
    if (inUse) {
      return res.status(409).json({ 
        error: 'Category cannot be deleted because it is used by existing expenses',
        inUse: true 
      });
    }
    
    await categoriesStorage.deleteCategory(id);
    res.json({ success: true, deleted: id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
