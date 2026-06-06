# Task 4: Frontend Project Setup

## Objective
Create React + Vite frontend project with basic structure, routing, and configuration. No components yet—just the foundation.

## Output Location
`octiron/calendar-site/frontend/`

## Deliverables

### 1. package.json
- Dependencies: react, react-dom, react-router-dom, date-fns
- Dev dependencies: vite, @vitejs/plugin-react
- Scripts: `dev`, `build`, `preview`

### 2. vite.config.js
- React plugin
- Dev server proxy to backend (port 3000)

### 3. index.html
- Standard Vite HTML template
- Root div for React mounting

### 4. src/main.jsx
- React 18 createRoot
- React Router setup
- Basic App import

### 5. src/App.jsx skeleton
```jsx
function App() {
  return (
    <div className="app">
      <h1>Week-First Calendar</h1>
      <p>Setup complete - components coming next</p>
    </div>
  );
}
export default App;
```

### 6. src/api.js skeleton
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// TODO: Implement API calls
export async function fetchEvents(date) {
  // Placeholder
}
```

### 7. Basic CSS
- src/App.css with minimal reset and basic layout
- Mobile-first responsive base

### 8. Directory structure
```
frontend/
├── package.json
├── vite.config.js
├── index.html
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── App.css
    ├── api.js
    └── components/
        └── .gitkeep
```

## Success Criteria
- [ ] `npm install` works without errors
- [ ] `npm run dev` starts Vite dev server (port 5173)
- [ ] Browser shows "Week-First Calendar" at http://localhost:5173
- [ ] No console errors
- [ ] Hot reload works (edit App.jsx, browser updates)

## Context from Spec
- React 18 with Vite
- Port 5173 for dev server
- React Router for mobile detail page
- date-fns for date manipulation

## Independent From
- Backend completely (can use mock data)
- Docker completely
- All other frontend tasks

## Blocks
- Task 5 (API Client) - needs this project structure
- Task 6 (YearMiniMap) - needs React setup
- Task 7 (DaysList) - needs React setup
- Task 9 (Detail Components) - needs React setup
