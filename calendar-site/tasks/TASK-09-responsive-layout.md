# Task 9: Responsive Layout and Mobile Detail Page

## Objective
Implement the responsive 3-panel desktop layout and 2-screen mobile experience.

## Output Location
`octiron/calendar-site/frontend/src/`

## Deliverables

### 1. App.jsx - Responsive layout structure
```jsx
function App() {
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [events, setEvents] = useState([]);
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  return (
    <div className="app">
      {isMobile ? <MobileLayout /> : <DesktopLayout />}
    </div>
  );
}
```

### 2. DesktopLayout.jsx (or inline in App)
```jsx
function DesktopLayout({ selectedDate, events, onDaySelect }) {
  return (
    <div className="desktop-layout">
      {/* 3-column grid/flex layout */}
      <aside className="year-panel">
        <YearMiniMap 
          year={2026} 
          events={events}
          selectedDate={selectedDate}
          onDayClick={onDaySelect}
        />
      </aside>
      
      <section className="days-panel">
        <DaysList
          initialDate={selectedDate}
          selectedDate={selectedDate}
          onDaySelect={onDaySelect}
          events={events}
        />
      </section>
      
      <main className="detail-panel">
        <DetailPanel
          date={selectedDate}
          events={getEventsForDate(events, selectedDate)}
          onAdd={handleAddEvent}
          onEdit={handleEditEvent}
          onDelete={handleDeleteEvent}
        />
      </main>
    </div>
  );
}
```

### 3. MobileLayout.jsx (or inline in App with React Router)
```jsx
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

function MobileLayout() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MobileListView />} />
        <Route path="/day/:date" element={<MobileDetailView />} />
      </Routes>
    </BrowserRouter>
  );
}

function MobileListView() {
  const navigate = useNavigate();
  
  const handleDaySelect = (date) => {
    navigate(`/day/${date}`);
  };
  
  return (
    <div className="mobile-list-view">
      <header>Week-First Calendar</header>
      <div className="mobile-content">
        <YearMiniMap compact onDayClick={scrollDaysToDate} />
        <DaysList onDaySelect={handleDaySelect} />
      </div>
    </div>
  );
}

function MobileDetailView() {
  const { date } = useParams();
  const navigate = useNavigate();
  
  return (
    <div className="mobile-detail-view">
      <header>
        <button onClick={() => navigate('/')}>← Back</button>
        <span>{formatDate(date)}</span>
      </header>
      <DetailPanel 
        date={date} 
        events={getEventsForDate(date)}
        // Full functionality: add, edit, delete
      />
    </div>
  );
}
```

### 4. CSS/Responsive styles (App.css or separate)
```css
/* Desktop: 3-column layout */
.desktop-layout {
  display: grid;
  grid-template-columns: 80px 200px 1fr;
  height: 100vh;
  gap: 1rem;
}

/* Mobile: full screen views */
@media (max-width: 768px) {
  .mobile-list-view,
  .mobile-detail-view {
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  .mobile-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  
  .mobile-content .year-minimap {
    width: 50px;
    flex-shrink: 0;
  }
  
  .mobile-content .days-list {
    flex: 1;
    overflow-y: auto;
  }
}
```

### 5. Custom hook: useMediaQuery.js
```javascript
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);
  
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);
  
  return matches;
}
```

### 6. Date formatting utilities
```javascript
export function formatDate(dateString) {
  // '2026-03-21' -> 'Friday, March 21, 2026'
}
```

## Success Criteria
- [ ] Desktop shows 3 panels side-by-side
- [ ] Desktop: YearMiniMap ~80px, DaysList ~200px, DetailPanel flexible
- [ ] Desktop: All panels visible simultaneously
- [ ] Mobile shows list view initially
- [ ] Mobile: YearMiniMap compact (~50px) + DaysList
- [ ] Mobile: Clicking day navigates to detail page
- [ ] Mobile detail page has back button
- [ ] Mobile detail page shows full event management
- [ ] Resizing browser switches layouts correctly
- [ ] No horizontal scroll on mobile

## Context from Spec
- Desktop (>768px): 3 panels
- Mobile (≤768px): 2 screens (list → detail)
- Year map on mobile should be compact or collapsible
- Smooth transitions between views

## Dependencies
- Task 4 (Frontend Setup) - needs React project
- Task 5 (API Client) - needs data hooks
- Task 6 (YearMiniMap) - needs component
- Task 7 (DaysList) - needs component
- Task 8 (Detail Components) - needs components

## Independent From
- Backend (can use mock data)
- Docker completely

## Blocks
- Task 12 (Integration Testing) - needs full UI flow
