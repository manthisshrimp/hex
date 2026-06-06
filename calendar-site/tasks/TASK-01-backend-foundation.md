# Task 1: Backend Foundation

## Objective
Create the Node.js + Express backend with project structure, package.json, and basic server setup. No storage implementation yet—just the API skeleton.

## Output Location
`octiron/calendar-site/backend/`

## Deliverables

### 1. package.json
- Dependencies: express, cors, uuid, date-fns
- Dev dependencies: nodemon
- Scripts: `start`, `dev`

### 2. server.js
- Express app with middleware (cors, json parsing)
- Health check endpoint: `GET /health`
- Port: 3000
- Basic error handling middleware

### 3. Directory structure
```
backend/
├── package.json
├── server.js
├── routes/
│   ├── events.js    # Skeleton only (empty exports)
│   └── days.js      # Skeleton only (empty exports)
├── storage/
│   └── events.js    # Empty file (placeholder)
└── data/
    └── .gitkeep
```

### 4. Routes skeleton
- `routes/events.js`: Export router with no endpoints yet
- `routes/days.js`: Export router with no endpoints yet

## Success Criteria
- [ ] `npm install` works without errors
- [ ] `npm run dev` starts server on port 3000
- [ ] `GET http://localhost:3000/health` returns `{"status":"ok"}`
- [ ] No linting errors in server.js

## Context from Spec
- Use Node.js 18+
- Express for REST API
- Port 3000 for backend
- Health endpoint required for Docker

## Independent From
This task can be done completely independently. No frontend, no storage logic, no Docker yet.

## Blocks
- Task 2 (Storage Layer) - needs this server.js structure
- Task 3 (API Endpoints) - needs this foundation
