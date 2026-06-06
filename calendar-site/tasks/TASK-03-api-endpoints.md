# Task 3: API Endpoints

## Objective
Implement all REST API endpoints using Express, connecting the storage layer to HTTP routes.

## Output Location
`octiron/calendar-site/backend/routes/`

## Deliverables

### 1. routes/events.js
Implement endpoints:

```javascript
// GET /api/events?start=YYYY-MM-DD&end=YYYY-MM-DD
// Query events in date range
// Returns: { events: Event[] }

// GET /api/events/:date
// Get events for specific date (YYYY-MM-DD)
// Returns: { date: string, events: Event[] }

// GET /api/events/by-id/:id
// Get single event by ID
// Returns: Event

// POST /api/events
// Create new event
// Body: { date, title, description?, color?, startTime?, endTime?, allDay? }
// Returns: created Event

// PUT /api/events/:id
// Update event
// Body: any Event fields
// Returns: updated Event

// DELETE /api/events/:id
// Delete event
// Returns: { success: true }
```

### 2. routes/days.js
Implement endpoints:

```javascript
// GET /api/days?start=YYYY-MM-DD&count=N
// Get day data for infinite scroll
// Returns: {
//   days: [
//     {
//       date: string,
//       dayOfMonth: number,
//       month: number,
//       monthName: string,
//       dayName: string,
//       isWeekend: boolean,
//       isMonthBoundary: boolean,
//       isToday: boolean,
//       eventCount: number,
//       hasEvents: boolean
//     }
//   ]
// }
```

### 3. Update server.js
- Import and mount routes
- Add `/api` prefix to all routes

```javascript
const eventsRouter = require('./routes/events');
const daysRouter = require('./routes/days');

app.use('/api/events', eventsRouter);
app.use('/api/days', daysRouter);
```

### 4. Error handling
- 404 for not found
- 400 for validation errors
- 500 for server errors with generic message

## Success Criteria
- [ ] All endpoints respond to curl/httpie requests
- [ ] `POST /api/events` creates event with UUID
- [ ] `GET /api/events/2026-03-21` returns events for that date
- [ ] `PUT /api/events/:id` updates and returns modified event
- [ ] `DELETE /api/events/:id` removes event
- [ ] `GET /api/days?start=2026-03-21&count=7` returns 7 days with metadata
- [ ] Proper HTTP status codes (200, 201, 404, 500)

## Testing Commands
```bash
# Create
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-03-21","title":"Test","allDay":true}'

# Read range
curl "http://localhost:3000/api/events?start=2026-03-01&end=2026-03-31"

# Read specific date
curl http://localhost:3000/api/events/2026-03-21

# Update
curl -X PUT http://localhost:3000/api/events/{id} \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated"}'

# Delete
curl -X DELETE http://localhost:3000/api/events/{id}

# Get days
curl "http://localhost:3000/api/days?start=2026-03-21&count=14"
```

## Context from Spec
- API prefix: `/api`
- Date format: YYYY-MM-DD
- Days endpoint powers the infinite scroll with metadata

## Dependencies
- Task 1 (Backend Foundation) - needs server.js structure
- Task 2 (Storage Layer) - needs storage module functions

## Independent From
- Frontend completely
- Docker completely

## Blocks
- Task 8 (Integration Testing) - needs working API
