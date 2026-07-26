const express = require('express');
const { v4: uuidv4 } = require('uuid');
const storage = require('../storage');

const router = express.Router();

const VALID_FEELINGS = ['irritable', 'angry', 'anxious', 'stressed', 'understimulated', 'overstimulated', 'sad', 'lonely', 'tired'];
const SCALE = ['1', '2', '3', '4', '5', '6', '7'];

// POST /api/entries
router.post('/', async (req, res) => {
  const { type, value } = req.body;
  if (!['feeling', 'mood', 'drive'].includes(type)) {
    return res.status(400).json({ error: 'type must be feeling, mood or drive' });
  }
  if (type === 'feeling' && !VALID_FEELINGS.includes(value)) {
    return res.status(400).json({ error: 'Invalid feeling value' });
  }
  if (type !== 'feeling' && !SCALE.includes(String(value))) {
    return res.status(400).json({ error: `Invalid ${type} value` });
  }
  const entry = {
    id: uuidv4(),
    type,
    value: String(value),
    recordedAt: new Date().toISOString(),
  };
  await storage.append(entry);
  res.status(201).json(entry);
});

// GET /api/entries?limit=30&before=<ISO>
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const before = req.query.before;
  let entries = await storage.readAll();
  if (before) {
    entries = entries.filter(e => e.recordedAt < before);
  }
  const page = entries.slice(0, limit);
  const hasMore = entries.length > limit;
  res.json({ entries: page, hasMore });
});

// PATCH /api/entries/:id — add/update note
router.patch('/:id', async (req, res) => {
  const { note } = req.body;
  if (typeof note !== 'string' || note.length > 500) {
    return res.status(400).json({ error: 'note must be a string up to 500 characters' });
  }
  const found = await storage.updateNote(req.params.id, note.trim());
  if (!found) return res.status(404).json({ error: 'Entry not found' });
  res.json({ success: true });
});

// DELETE /api/entries/:id
router.delete('/:id', async (req, res) => {
  const found = await storage.deleteById(req.params.id);
  if (!found) return res.status(404).json({ error: 'Entry not found' });
  res.json({ success: true });
});

module.exports = router;
