# Task 12: Integration and End-to-End Testing

## Objective
Verify all components work together—backend API, frontend UI, Docker containers, and data persistence.

## Test Scenarios

### 1. Backend API Tests
Test all endpoints with real HTTP requests:

```bash
# Start backend only
cd backend && npm run dev

# Test health
curl http://localhost:3000/health

# Create events
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-03-21","title":"Test Event","allDay":true,"color":"#3b82f6"}'

# Read events for date
curl http://localhost:3000/api/events/2026-03-21

# Read events in range
curl "http://localhost:3000/api/events?start=2026-03-01&end=2026-03-31"

# Update event
curl -X PUT http://localhost:3000/api/events/{id} \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Event"}'

# Delete event
curl -X DELETE http://localhost:3000/api/events/{id}

# Get days for infinite scroll
curl "http://localhost:3000/api/days?start=2026-03-21&count=14"
```

### 2. Frontend Integration Tests
Start both services and test UI flow:

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Open http://localhost:5173
```

**Manual Test Checklist:**
- [ ] Page loads without console errors
- [ ] YearMiniMap renders with month labels
- [ ] DaysList shows day squares
- [ ] Infinite scroll loads more days
- [ ] Clicking mini-map day scrolls DaysList to that day
- [ ] Clicking DaysList day selects it and shows events in DetailPanel
- [ ] Creating event adds it to list immediately
- [ ] Event colors show in both mini-map and day squares
- [ ] Editing event updates in real-time
- [ ] Deleting event removes it from UI
- [ ] Data persists after page reload

### 3. Docker Integration Tests

```bash
# Build and start production containers
docker-compose -f docker-compose.prod.yml up --build -d

# Test backend directly
curl http://localhost:3000/health

# Test frontend
curl http://localhost:8080

# Test API through nginx
curl http://localhost:8080/api/health

# Create event via containerized API
curl -X POST http://localhost:8080/api/events \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-03-21","title":"Docker Test","allDay":true}'

# Verify data persisted in volume
docker exec calendar-backend cat /data/events.jsonl
```

### 4. Mobile Responsive Tests

**Browser DevTools:**
- [ ] Set viewport to iPhone SE (375×667)
- [ ] Set viewport to iPhone 12 Pro (390×844)
- [ ] Set viewport to Pixel 5 (393×851)

**Mobile Checklist:**
- [ ] Only YearMiniMap + DaysList visible initially
- [ ] YearMiniMap compact (~40-50px)
- [ ] DaysList scrollable, no horizontal scroll
- [ ] Clicking day navigates to detail page
- [ ] Detail page shows back button
- [ ] Back button returns to list
- [ ] Can create/edit/delete events on mobile detail page
- [ ] Touch scrolling works smoothly

### 5. Deployment Tests

```bash
# Deploy to server
ansible-playbook ansible/playbooks/deploy-calendar-site.yml

# Test on server
ssh aldus@10.227.6.155
curl http://localhost:3000/health
curl http://localhost:8080/api/health

# Test from external
# Open http://10.227.6.155:8080 in browser

# Verify data persistence
# 1. Create events in UI
# 2. Restart containers: docker-compose restart
# 3. Verify events still exist
```

## Bug Fix Template
If issues found:

```markdown
## Issue: [Brief description]
**Severity:** Blocker/High/Medium/Low

### Steps to Reproduce
1. 
2. 
3. 

### Expected Behavior

### Actual Behavior

### Root Cause

### Fix Applied
[Link to commit or describe change]

### Verification
- [ ] Issue resolved
- [ ] No regressions
```

## Success Criteria (All Must Pass)
- [ ] Backend API all endpoints functional
- [ ] Frontend loads and renders correctly
- [ ] Infinite scroll works smoothly (no jank)
- [ ] Event CRUD works end-to-end
- [ ] Colors display correctly in both mini-map and days
- [ ] Data persists across reloads
- [ ] Docker production build works
- [ ] Mobile responsive (both list and detail views)
- [ ] Deployed version accessible and functional
- [ ] No critical console errors
- [ ] No memory leaks (test by leaving open for 10 min)

## Performance Benchmarks
- [ ] Initial load: < 2 seconds
- [ ] Infinite scroll load: < 500ms for 14 days
- [ ] Event create/update: < 300ms response
- [ ] DaysList scroll: 60fps smooth

## Dependencies
ALL previous tasks must be complete:
- Task 1-3 (Backend)
- Task 4-9 (Frontend + Components + Responsive)
- Task 10 (Docker)
- Task 11 (Ansible)

## Deliverables
- [ ] Test results documented
- [ ] Bug fixes applied
- [ ] Performance validated
- [ ] Deployment verified
- [ ] README.md with final setup instructions
