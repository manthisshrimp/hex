const express = require('express');
const router = express.Router();
const storage = require('../storage');

// GET /api/years - List all years with summary
router.get('/', async (req, res) => {
  try {
    const years = await storage.getAllYears();
    res.json({ years });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/years - Create new year
router.post('/', async (req, res) => {
  try {
    const { year } = req.body;
    if (!year || !Number.isInteger(Number(year))) {
      return res.status(400).json({ error: 'Year must be a valid integer' });
    }
    
    const result = await storage.createYear(year);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
