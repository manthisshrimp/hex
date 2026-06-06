const express = require('express');
const router = express.Router();
const storage = require('../storage/events');

/**
 * GET /api/events
 * Query events in date range
 * Query params: start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns: { events: Event[] }
 */
router.get('/', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'Missing required parameters: start and end' });
    }
    
    const events = await storage.readEventsInRange(start, end);
    res.json({ events });
  } catch (error) {
    console.error('Error reading events:', error.message);
    res.status(500).json({ error: 'Failed to retrieve events' });
  }
});

/**
 * GET /api/events/:date
 * Get events for specific date
 * Returns: { date: string, events: Event[] }
 */
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Basic date format validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    
    const events = await storage.readEventsForDate(date);
    res.json({ date, events });
  } catch (error) {
    console.error('Error reading events for date:', error.message);
    res.status(500).json({ error: 'Failed to retrieve events' });
  }
});

/**
 * GET /api/events/by-id/:id
 * Get single event by ID
 * Returns: Event
 */
router.get('/by-id/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const events = await storage.readAllEvents();
    const event = events.find(e => e.id === id);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(event);
  } catch (error) {
    console.error('Error reading event by ID:', error.message);
    res.status(500).json({ error: 'Failed to retrieve event' });
  }
});

/**
 * POST /api/events
 * Create new event
 * Body: { date, title, description?, color?, startTime?, endTime?, allDay? }
 * Returns: created Event
 */
router.post('/', async (req, res) => {
  try {
    const { date, title } = req.body;
    
    if (!date || !title) {
      return res.status(400).json({ error: 'Missing required fields: date and title' });
    }
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    
    const event = await storage.createEvent(req.body);
    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error.message);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

/**
 * PUT /api/events/:id
 * Update event
 * Body: any Event fields
 * Returns: updated Event
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updatedEvent = await storage.updateEvent(id, updates);
    
    if (!updatedEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(updatedEvent);
  } catch (error) {
    console.error('Error updating event:', error.message);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

/**
 * DELETE /api/events/:id
 * Delete event
 * Returns: { success: true }
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await storage.deleteEvent(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error.message);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
