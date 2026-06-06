const express = require('express');
const router = express.Router();
const cats = require('../storage/categories');

router.get('/', async (req, res) => {
  try { res.json({ categories: await cats.getAllCategories() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    res.status(201).json(await cats.createCategory({ name, color }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try { res.json(await cats.updateCategory(req.params.id, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try { res.json(await cats.deleteCategory(req.params.id)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
