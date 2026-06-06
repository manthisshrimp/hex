# Week-First Calendar - Task Index

## Quick Start
1. Review the main spec: `../SPEC.md`
2. Pick a task from below
3. Spawn a sub-agent with that task file

## Task Dependencies

### Backend Track (can run in parallel with Frontend Track)
```
TASK-01 (Backend Foundation)
    ↓
TASK-02 (Storage Layer)
    ↓
TASK-03 (API Endpoints)
    ↓
TASK-12 (Integration - backend tests)
```

### Frontend Track (can run in parallel with Backend Track)
```
TASK-04 (Frontend Setup)
    ↓
TASK-05 (API Client)
    ↓
TASK-06 (YearMiniMap) ─┐
TASK-07 (DaysList) ────┼→ TASK-09 (Responsive Layout)
TASK-08 (Detail UI) ───┘
    ↓
TASK-12 (Integration - frontend tests)
```

### DevOps Track (run after both tracks complete)
```
TASK-10 (Docker) → TASK-11 (Ansible) → TASK-12 (Deploy tests)
```

## Tasks by Difficulty

### Easy (2-4 hours)
- **TASK-01** - Backend Foundation (Node + Express setup)
- **TASK-04** - Frontend Setup (Vite + React setup)
- **TASK-10** - Docker (Dockerfile + compose)

### Medium (4-8 hours)
- **TASK-02** - Storage Layer (JSONL file operations)
- **TASK-05** - API Client (React hooks)
- **TASK-06** - YearMiniMap (component with hover/click)
- **TASK-08** - Detail Components (forms + event management)

### Hard (8-16 hours)
- **TASK-03** - API Endpoints (complete CRUD + days endpoint)
- **TASK-07** - DaysList (infinite scroll, square tiles)
- **TASK-09** - Responsive Layout (desktop + mobile flows)
- **TASK-11** - Ansible Deployment (full server deployment)

### Integration (4-8 hours, requires all above)
- **TASK-12** - End-to-End Testing (comprehensive verification)

## Parallel Execution Groups

**Group A - Foundation (parallel):**
- TASK-01: Backend Foundation
- TASK-04: Frontend Setup

**Group B - Core Logic (parallel after A):**
- TASK-02: Storage Layer
- TASK-05: API Client (can mock)

**Group C - Components (parallel after B):**
- TASK-06: YearMiniMap
- TASK-07: DaysList
- TASK-08: Detail Components

**Group D - Integration (after C):**
- TASK-03: API Endpoints (needs storage)
- TASK-09: Responsive Layout (needs components)

**Group E - DevOps (after everything):**
- TASK-10: Docker
- TASK-11: Ansible
- TASK-12: Integration Testing

## Sub-Agent Spawn Template

```javascript
sessions_spawn({
  runtime: "subagent",
  mode: "run",
  model: "dev",
  task: `Read TASK-XX from octiron/calendar-site/tasks/TASK-XX-*.md and implement exactly as specified.

Key requirements:
- [Main objective from task file]
- [Key success criteria]

After completing:
1. Run all success criteria checks
2. git add, commit, push changes
3. Report back with results`,
  label: "calendar-task-XX"
})
```

## Example: Spawn Task 1 (Backend Foundation)

```javascript
sessions_spawn({
  runtime: "subagent",
  mode: "run",
  model: "dev",
  task: `Read TASK-01 from octiron/calendar-site/tasks/TASK-01-backend-foundation.md and implement.

Create:
1. backend/package.json with express, cors, uuid, date-fns, nodemon
2. backend/server.js with Express, /health endpoint, port 3000
3. backend/routes/ skeletons
4. backend/data/ directory

Success: npm run dev starts server, curl localhost:3000/health returns {"status":"ok"}

After: git add, commit, push`,
  label: "calendar-backend-foundation"
})
```

## Tips for Sub-Agents

1. **Start with clear scope** - Each task file has exact deliverables
2. **Mock when blocked** - If dependency not ready, create mock data/functions
3. **Test as you go** - Don't wait until end to verify
4. **Commit frequently** - Push after each major component
5. **Ask for clarification** - If task unclear, ask parent session

## Current Status

| Task | Status | Notes |
|------|--------|-------|
| TASK-01 | 🔲 Not started | Backend Foundation |
| TASK-02 | 🔲 Not started | Storage Layer |
| TASK-03 | 🔲 Not started | API Endpoints |
| TASK-04 | 🔲 Not started | Frontend Setup |
| TASK-05 | 🔲 Not started | API Client |
| TASK-06 | 🔲 Not started | YearMiniMap |
| TASK-07 | 🔲 Not started | DaysList |
| TASK-08 | 🔲 Not started | Detail Components |
| TASK-09 | 🔲 Not started | Responsive Layout |
| TASK-10 | 🔲 Not started | Docker |
| TASK-11 | 🔲 Not started | Ansible |
| TASK-12 | 🔲 Not started | Integration |

## Next Steps

1. Spawn TASK-01 and TASK-04 in parallel (foundation)
2. Once done, spawn TASK-02, TASK-05, TASK-06, TASK-07, TASK-08 in parallel
3. Then TASK-03 and TASK-09 (integration points)
4. Finally TASK-10, TASK-11, TASK-12 (deployment)
