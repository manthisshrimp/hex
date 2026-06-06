const express = require('express');
const { v4: uuid } = require('uuid');
const { readTasks, writeTasks, appendTask, readPermissions } = require('../storage');
const { getHabitsSync, HABITS_SYNC_USER } = require('../sync');

const router = express.Router();

function canAccess(caller, targetUsername, permissions) {
  if (caller.isAdmin) return true;
  if (caller.username === targetUsername) return true;
  return permissions.grants.some(
    g => g.grantee === caller.username && g.owner === targetUsername
  );
}

// GET /:username — list tasks for a user
router.get('/:username', (req, res) => {
  const { username } = req.params;
  const permissions = readPermissions();

  if (!canAccess(req.user, username, permissions)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const tasks = readTasks().filter(t => t.ownerUsername === username);
  res.json({ tasks });
});

// POST /:username — create a task
router.post('/:username', async (req, res) => {
  const { username } = req.params;
  const permissions = readPermissions();

  if (!canAccess(req.user, username, permissions)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { title, description, priority, dueDate } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  const now = new Date().toISOString();
  const task = {
    id: uuid(),
    ownerUsername: username,
    title,
    description: description || '',
    status: 'todo',
    priority: priority || 'medium',
    dueDate: dueDate || null,
    habitsId: null,
    createdAt: now,
    updatedAt: now,
  };

  appendTask(task);

  // Sync to habits when creating a task for the habits-linked user
  const sync = getHabitsSync();
  if (sync && username === HABITS_SYNC_USER) {
    const habitsId = await sync.createTodo(title, task.id);
    if (habitsId) {
      const tasks = readTasks();
      const index = tasks.findIndex(t => t.id === task.id);
      if (index !== -1) {
        tasks[index].habitsId = habitsId;
        writeTasks(tasks);
        task.habitsId = habitsId;
      }
    }
  }

  res.status(201).json(task);
});

// PUT /:username/:id — update a task
router.put('/:username/:id', async (req, res) => {
  const { username, id } = req.params;
  const permissions = readPermissions();

  if (!canAccess(req.user, username, permissions)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const tasks = readTasks();
  const index = tasks.findIndex(t => t.id === id && t.ownerUsername === username);
  if (index === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const existing = tasks[index];
  const { title, description, status, priority, dueDate } = req.body;

  const now = new Date().toISOString();
  const updated = {
    ...existing,
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(status !== undefined && { status }),
    ...(priority !== undefined && { priority }),
    ...(dueDate !== undefined && { dueDate }),
    updatedAt: now,
  };

  if (status === 'done' && existing.status !== 'done') {
    updated.completedAt = now;
  }

  tasks[index] = updated;
  writeTasks(tasks);

  // Sync done status to habits
  const sync = getHabitsSync();
  if (sync && updated.habitsId && status === 'done' && existing.status !== 'done') {
    await sync.completeTodo(updated.habitsId);
  }

  res.json(updated);
});

// DELETE /:username/:id — delete a task
router.delete('/:username/:id', async (req, res) => {
  const { username, id } = req.params;
  const permissions = readPermissions();

  if (!canAccess(req.user, username, permissions)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const tasks = readTasks();
  const index = tasks.findIndex(t => t.id === id && t.ownerUsername === username);
  if (index === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const task = tasks[index];
  tasks.splice(index, 1);
  writeTasks(tasks);

  // Sync deletion to habits
  const sync = getHabitsSync();
  if (sync && task.habitsId) {
    await sync.deleteTodo(task.habitsId);
  }

  res.json({ success: true });
});

module.exports = router;
