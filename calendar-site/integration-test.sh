#!/bin/bash
# Simplified Integration Test Script for Calendar Site

TEST_START=$(date '+%Y-%m-%d %H:%M:%S')
COMMIT_HASH=$(git rev-parse HEAD)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASS_COUNT++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAIL_COUNT++))
}

echo "=========================================="
echo "Calendar Site Integration Test Suite"
echo "=========================================="
echo "Test Start: $TEST_START"
echo "Commit: $COMMIT_HASH"
echo ""

# ==================== BACKEND API TESTS ====================
echo "=== BACKEND API TESTS ==="

# Use docker exec to run curl inside the container
RUN_CMD="docker exec calendar-backend-prod wget -qO-"

# Test 1: Health check
echo -n "1. Health check... "
if $RUN_CMD http://localhost:3000/health | grep -q '"status":"ok"'; then
    pass "Health check OK"
else
    fail "Health check failed"
fi

# Test 2: Create event
echo -n "2. Create event... "
EVENT_DATA=$($RUN_CMD "http://localhost:3000/api/events" -q --post-data='{"date":"2026-03-21","title":"Integration Test Event","allDay":true,"color":"#3b82f6"}' --header='Content-Type: application/json' 2>/dev/null)
EVENT_ID=$(echo "$EVENT_DATA" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
if [ -n "$EVENT_ID" ]; then
    pass "Create event: $EVENT_ID"
else
    fail "Create event failed: $EVENT_DATA"
fi

# Test 3: Read events for date
echo -n "3. Read events for date... "
if $RUN_CMD "http://localhost:3000/api/events/2026-03-21" | grep -q '"events"'; then
    pass "Read events for date OK"
else
    fail "Read events for date failed"
fi

# Test 4: Read events in range
echo -n "4. Read events in range... "
if $RUN_CMD "http://localhost:3000/api/events?start=2026-03-01&end=2026-03-31" | grep -q '"events"'; then
    pass "Read events in range OK"
else
    fail "Read events in range failed"
fi

# Test 5: Get event by ID
echo -n "5. Get event by ID... "
EVENT_BY_ID=$($RUN_CMD "http://localhost:3000/api/events/by-id/$EVENT_ID" 2>/dev/null)
if echo "$EVENT_BY_ID" | grep -q '"id":"'$EVENT_ID'"'; then
    pass "Get event by ID OK"
else
    fail "Get event by ID failed: $EVENT_BY_ID"
fi

# Test 6: Update event
echo -n "6. Update event... "
if $RUN_CMD "http://localhost:3000/api/events/$EVENT_ID" -q --post-data='{"title":"Updated Test"}' --header='Content-Type: application/json' 2>/dev/null | grep -q '"title":"Updated Test"'; then
    pass "Update event OK"
else
    fail "Update event failed"
fi

# Test 7: Delete event
echo -n "7. Delete event... "
if $RUN_CMD "http://localhost:3000/api/events/$EVENT_ID" -q --post-data='' --header='Content-Type: application/json' --delete 2>/dev/null | grep -q '"success":true'; then
    pass "Delete event OK"
else
    fail "Delete event failed"
fi

# Test 8: Days endpoint
echo -n "8. Days endpoint... "
if $RUN_CMD "http://localhost:3000/api/days?start=2026-03-21&count=14" | grep -q '"days"'; then
    pass "Days endpoint OK"
else
    fail "Days endpoint failed"
fi

# ==================== DOCKER TESTS ====================
echo ""
echo "=== DOCKER TESTS ==="

echo -n "1. Backend container running... "
if docker ps | grep -q calendar-backend-prod; then
    pass "Backend container running"
else
    fail "Backend container not running"
fi

echo -n "2. Frontend container running... "
if docker ps | grep -q calendar-frontend-prod; then
    pass "Frontend container running"
else
    fail "Frontend container not running"
fi

echo -n "3. Backend health (through nginx)... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    pass "Backend health OK (HTTP 200)"
else
    # Test through docker
    if docker exec calendar-backend-prod wget -qO- http://localhost:3000/health 2>/dev/null | grep -q ok; then
        pass "Backend health OK"
    else
        fail "Backend health failed"
    fi
fi

echo -n "4. Frontend served on :8080... "
if curl -s http://localhost:8080/ 2>/dev/null | grep -q '<!DOCTYPE html>'; then
    pass "Frontend served"
else
    fail "Frontend not served"
fi

echo -n "5. Data volume exists... "
# Check both dev and prod volume paths
if docker exec calendar-backend-prod test -f /data/events.jsonl || docker exec calendar-backend-prod test -f /app/data/events.jsonl; then
    pass "Data volume exists"
else
    fail "Data volume missing"
fi

# ==================== FRONTEND COMPONENT TESTS ====================
echo ""
echo "=== FRONTEND COMPONENT TESTS ==="

echo -n "1. YearMiniMap component... "
if [ -f "frontend/src/components/YearMiniMap.jsx" ]; then
    pass "YearMiniMap.jsx exists"
else
    fail "YearMiniMap.jsx missing"
fi

echo -n "2. DaysList component... "
if [ -f "frontend/src/components/DaysList.jsx" ]; then
    pass "DaysList.jsx exists"
else
    fail "DaysList.jsx missing"
fi

echo -n "3. DetailPanel component... "
if [ -f "frontend/src/components/DetailPanel.jsx" ]; then
    pass "DetailPanel.jsx exists"
else
    fail "DetailPanel.jsx missing"
fi

echo -n "4. MobileLayout component... "
if [ -f "frontend/src/MobileLayout.jsx" ]; then
    pass "MobileLayout.jsx exists"
else
    fail "MobileLayout.jsx missing"
fi

echo -n "5. Responsive CSS... "
if grep -q "@media" frontend/src/App.css frontend/src/MobileLayout.css 2>/dev/null; then
    pass "Responsive CSS found"
else
    fail "Responsive CSS missing"
fi

# ==================== DOCKER PROD BUILD TESTS ====================
echo ""
echo "=== DOCKER PROD BUILD TESTS ==="

echo -n "1. Backend prod container... "
if docker ps | grep -q calendar-backend-prod; then
    pass "Backend prod running"
else
    fail "Backend prod not running"
fi

echo -n "2. Frontend prod container... "
if docker ps | grep -q calendar-frontend-prod; then
    pass "Frontend prod running"
else
    fail "Frontend prod not running"
fi

# ==================== PERFORMANCE METRICS ====================
echo ""
echo "=== PERFORMANCE METRICS ==="

echo "Note: Performance tests require baseline measurements"
echo "- Event Create: <300ms (target)"
echo "- Event Update: <300ms (target)"
echo "- Event Delete: <300ms (target)"
echo "- Initial Load: <2s (target)"
echo "- Infinite Scroll: <500ms (target)"

# ==================== SUMMARY ====================
echo ""
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo "Total Tests: $((PASS_COUNT + FAIL_COUNT))"
echo "Passed: $PASS_COUNT"
echo "Failed: $FAIL_COUNT"
echo "=========================================="

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "${GREEN}ALL TESTS PASSED${NC}"
    exit 0
else
    echo -e "${RED}SOME TESTS FAILED${NC}"
    exit 1
fi
