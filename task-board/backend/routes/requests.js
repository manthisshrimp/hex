const express = require('express');
const { v4: uuid } = require('uuid');
const { readRequests, writeRequests, appendRequest, readUsers, appendTask } = require('../storage');

const router = express.Router();

// POST / — Send a new request
router.post('/', (req, res) => {
  const { toUsername, title, description, priority, dueDate } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (!toUsername || !toUsername.trim()) {
    return res.status(400).json({ error: 'toUsername is required' });
  }
  if (toUsername === req.user.username) {
    return res.status(400).json({ error: 'Cannot send a request to yourself' });
  }

  const usersData = readUsers();
  const recipientExists = usersData.users.some(u => u.username === toUsername);
  if (!recipientExists) {
    return res.status(400).json({ error: `User '${toUsername}' does not exist` });
  }

  const now = new Date().toISOString();
  const request = {
    id: uuid(),
    fromUsername: req.user.username,
    toUsername,
    title: title.trim(),
    description: description || '',
    priority: priority || 'medium',
    dueDate: dueDate || null,
    status: 'pending',
    taskId: null,
    createdAt: now,
    updatedAt: now,
    respondedAt: null,
  };

  appendRequest(request);
  res.status(201).json(request);
});

// GET /sent — Get all requests sent by the current user
router.get('/sent', (req, res) => {
  const requests = readRequests()
    .filter(r => r.fromUsername === req.user.username)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ requests });
});

// GET /received — Get pending requests received by the current user
router.get('/received', (req, res) => {
  const requests = readRequests()
    .filter(r => r.toUsername === req.user.username && r.status === 'pending')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json({ requests });
});

// PUT /:id/accept — Accept a request
router.put('/:id/accept', (req, res) => {
  const requests = readRequests();
  const idx = requests.findIndex(r => r.id === req.params.id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Request not found' });
  }

  const request = requests[idx];

  if (request.toUsername !== req.user.username) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (request.status !== 'pending') {
    return res.status(400).json({ error: 'Request is not pending' });
  }

  const now = new Date().toISOString();
  const taskId = uuid();

  const task = {
    id: taskId,
    ownerUsername: req.user.username,
    title: request.title,
    description: request.description,
    status: 'todo',
    priority: request.priority,
    dueDate: request.dueDate,
    createdAt: now,
    updatedAt: now,
  };
  appendTask(task);

  requests[idx] = {
    ...request,
    status: 'accepted',
    taskId,
    respondedAt: now,
    updatedAt: now,
  };
  writeRequests(requests);

  res.json({ request: requests[idx], task });
});

// PUT /:id/decline — Decline a request
router.put('/:id/decline', (req, res) => {
  const requests = readRequests();
  const idx = requests.findIndex(r => r.id === req.params.id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Request not found' });
  }

  const request = requests[idx];

  if (request.toUsername !== req.user.username) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (request.status !== 'pending') {
    return res.status(400).json({ error: 'Request is not pending' });
  }

  const now = new Date().toISOString();
  requests[idx] = {
    ...request,
    status: 'declined',
    respondedAt: now,
    updatedAt: now,
  };
  writeRequests(requests);

  res.json(requests[idx]);
});

module.exports = router;
