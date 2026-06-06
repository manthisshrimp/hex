const express = require('express');
const { v4: uuid } = require('uuid');
const { readTasks, writeTasks, appendTask } = require('../storage');
const { apiKeyMiddleware } = require('../middleware/api-key');

const router = express.Router();

router.use(apiKeyMiddleware);

// POST /api/service/tasks — called by habits when a todo is created
router.post('/tasks', (req, res) => {
  const { ownerUsername, title, habitsId } = req.body;
  if (!ownerUsername || !title) {
    return res.status(400).json({ error: 'ownerUsername and title are required' });
  }
  const now = new Date().toISOString();
  const task = {
    id: uuid(),
    ownerUsername,
    title,
    description: '',
    status: 'todo',
    priority: 'medium',
    dueDate: null,
    habitsId: habitsId || null,
    createdAt: now,
    updatedAt: now,
  };
  appendTask(task);
  res.status(201).json(task);
});

// PUT /api/service/tasks/:id/done — called by habits when a todo is completed
router.put('/tasks/:id/done', (req, res) => {
  const { id } = req.params;
  const tasks = readTasks();
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const now = new Date().toISOString();
  tasks[index] = { ...tasks[index], status: 'done', completedAt: now, updatedAt: now };
  writeTasks(tasks);
  res.json(tasks[index]);
});

// DELETE /api/service/tasks/:id — called by habits when a todo is deleted
router.delete('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const tasks = readTasks();
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  tasks.splice(index, 1);
  writeTasks(tasks);
  res.json({ success: true });
});

module.exports = router;
