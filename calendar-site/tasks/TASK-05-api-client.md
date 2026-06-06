# Task 5: API Client and Hooks

## Objective
Create the API client module and React hooks for data fetching. Connect frontend to backend API endpoints.

## Output Location
`octiron/calendar-site/frontend/src/`

## Deliverables

### 1. api.js - Complete API client
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function fetchEventsInRange(start, end) { }
export async function fetchEventsForDate(date) { }
export async function fetchEventById(id) { }
export async function createEvent(eventData) { }
export async function updateEvent(id, updates) { }
export async function deleteEvent(id) { }
export async function fetchDays(start, count) { }
```

### 2. hooks/useEvents.js
```javascript
// Hook for event CRUD operations
export function useEvents() {
  // Returns: {
  //   events,
  //   loading,
  //   error,
  //   createEvent,
  //   updateEvent,
  //   deleteEvent,
  //   refresh
  // }
}
```

### 3. hooks/useDays.js
```javascript
// Hook for infinite scroll day fetching
export function useDays(initialDate, initialCount = 28) {
  // Returns: {
  //   days,
  //   loading,
  //   hasMore,
  //   loadMore,
  //   refresh
  // }
}
```

### 4. hooks/useScroll.js
```javascript
// Hook for infinite scroll detection using Intersection Observer
export function useInfiniteScroll(callback, options) { }
```

### 5. Test in App.jsx
Temporarily update App.jsx to test the hooks:
```jsx
function App() {
  const { events, loading, createEvent } = useEvents();
  const { days, loadMore } = useDays('2026-03-21');
  
  return (
    <div>
      <h1>API Test</h1>
      {loading && <p>Loading...</p>}
      <p>Days loaded: {days.length}</p>
      <button onClick={loadMore}>Load More</button>
    </div>
  );
}
```

## Success Criteria
- [ ] All API functions exported from api.js
- [ ] useEvents hook returns data and functions
- [ ] useDays hook fetches initial days and supports `loadMore`
- [ ] Creating an event through hook persists to backend
- [ ] Test UI shows days and can load more
- [ ] No memory leaks (proper cleanup in useEffect)

## Backend Requirement
Backend must be running on localhost:3000 for testing.
Or use mock data if backend not available yet.

## Context from Spec
- API URL: `http://localhost:3000/api`
- Days endpoint: `/api/days?start=&count=`
- Events endpoints: `/api/events/*`
- Infinite scroll pattern: load 14 more days on request

## Dependencies
- Task 4 (Frontend Setup) - needs React project structure
- Task 3 (API Endpoints) - needs backend running for full testing

## Independent From
- Components can use mock data if backend not ready
- Docker completely

## Blocks
- Task 6 (YearMiniMap) - needs useEvents/useDays for data
- Task 7 (DaysList) - needs useDays hook
- Task 8 (Detail Components) - needs useEvents hook
