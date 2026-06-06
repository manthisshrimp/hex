# Task 2: JSONL Storage Layer

## Objective
Implement the file-based storage layer for events using JSONL format. This is a pure Node.js module with no Express dependencies.

## Output Location
`octiron/calendar-site/backend/storage/events.js`

## Deliverables

### 1. storage/events.js module with functions:

```javascript
// Read all events from JSONL file
// Returns: Event[]
async function readAllEvents()

// Read events for a date range
// Returns: Event[] filtered by date range
async function readEventsInRange(startDate, endDate)

// Read events for specific date (YYYY-MM-DD)
// Returns: Event[]
async function readEventsForDate(date)

// Create new event
// Returns: created Event with id, timestamps
async function createEvent(eventData)

// Update event by id
// Returns: updated Event
async function updateEvent(id, updates)

// Delete event by id
// Returns: boolean success
async function deleteEvent(id)
```

### 2. File handling:
- Data file: `backend/data/events.jsonl`
- Auto-create file if missing
- Append-only writes for new events
- Full file read + filter for queries (acceptable for small scale)
- Atomic updates: read all, modify in memory, write all back

### 3. Event data structure:
```javascript
{
  id: string (UUID),
  date: string (YYYY-MM-DD),
  title: string,
  description: string (optional),
  color: string (hex, optional),
  startTime: string (HH:MM, optional),
  endTime: string (HH:MM, optional),
  allDay: boolean,
  createdAt: string (ISO timestamp),
  updatedAt: string (ISO timestamp)
}
```

## Success Criteria
- [ ] Module exports all 6 functions
- [ ] `createEvent()` generates UUID and timestamps
- [ ] `readAllEvents()` returns array from JSONL file
- [ ] `updateEvent()` modifies and persists changes
- [ ] `deleteEvent()` removes event and persists
- [ ] Data persists to `data/events.jsonl` after each write
- [ ] File is valid JSONL (one JSON object per line)

## Testing Script
Create `backend/test-storage.js`:
```javascript
const storage = require('./storage/events');

async function test() {
  // Create test event
  const event = await storage.createEvent({
    date: '2026-03-21',
    title: 'Test Event',
    allDay: true
  });
  console.log('Created:', event);
  
  // Read it back
  const events = await storage.readEventsForDate('2026-03-21');
  console.log('Read:', events);
}

test();
```

## Context from Spec
- JSONL format: one line per event
- Storage is file-based, no database
- In-memory cache acceptable but not required
- Data directory: `backend/data/`

## Dependencies
- Task 1 (Backend Foundation) - needs the directory structure

## Independent From
- Frontend completely
- Docker completely
- API routes (this is just the storage module)

## Blocks
- Task 3 (API Endpoints) - needs these storage functions
