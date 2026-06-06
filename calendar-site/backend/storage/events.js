const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = process.env.DATA_PATH || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'events.jsonl');

/**
 * Ensure data file exists
 */
function ensureFileExists() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '', 'utf8');
  }
}

/**
 * Read all events from JSONL file
 * @returns {Promise<Array>} Array of events
 */
async function readAllEvents() {
  ensureFileExists();
  
  const content = fs.readFileSync(DATA_FILE, 'utf8');
  if (!content.trim()) {
    return [];
  }
  
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map(line => JSON.parse(line));
}

/**
 * Read events for a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Array>} Filtered events
 */
async function readEventsInRange(startDate, endDate) {
  const allEvents = await readAllEvents();
  
  return allEvents.filter(event => {
    const eventDate = new Date(event.date);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return eventDate >= start && eventDate <= end;
  });
}

/**
 * Read events for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} Events for that date
 */
async function readEventsForDate(date) {
  const allEvents = await readAllEvents();
  
  return allEvents.filter(event => event.date === date);
}

/**
 * Create a new event
 * @param {Object} eventData - Event data object
 * @returns {Promise<Object>} Created event
 */
async function createEvent(eventData) {
  ensureFileExists();
  
  const now = new Date().toISOString();
  const event = {
    id: eventData.id || uuidv4(),
    date: eventData.date,
    title: eventData.title,
    description: eventData.description || '',
    categoryId: eventData.categoryId || '',
    color: eventData.color || '',
    startTime: eventData.startTime || '',
    endTime: eventData.endTime || '',
    allDay: eventData.allDay !== undefined ? eventData.allDay : false,
    createdAt: now,
    updatedAt: now
  };
  
  const line = JSON.stringify(event) + '\n';
  fs.appendFileSync(DATA_FILE, line, 'utf8');
  
  return event;
}

/**
 * Update an event by ID
 * @param {string} id - Event ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} Updated event or null if not found
 */
async function updateEvent(id, updates) {
  const allEvents = await readAllEvents();
  
  const eventIndex = allEvents.findIndex(e => e.id === id);
  if (eventIndex === -1) {
    return null;
  }
  
  const existingEvent = allEvents[eventIndex];
  const updatedEvent = {
    ...existingEvent,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  // Replace the event in the array
  allEvents[eventIndex] = updatedEvent;
  
  // Write all events back to file
  const content = allEvents.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(DATA_FILE, content, 'utf8');
  
  return updatedEvent;
}

/**
 * Delete an event by ID
 * @param {string} id - Event ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function deleteEvent(id) {
  const allEvents = await readAllEvents();
  
  const eventIndex = allEvents.findIndex(e => e.id === id);
  if (eventIndex === -1) {
    return false;
  }
  
  // Remove the event
  allEvents.splice(eventIndex, 1);
  
  // Write remaining events back to file
  const content = allEvents.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(DATA_FILE, content, 'utf8');
  
  return true;
}

module.exports = {
  readAllEvents,
  readEventsInRange,
  readEventsForDate,
  createEvent,
  updateEvent,
  deleteEvent
};
