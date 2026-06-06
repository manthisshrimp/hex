const express = require('express');
const router = express.Router();
const storage = require('../storage/events');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Get events count for a date
 */
async function getEventCountForDate(date) {
  const events = await storage.readEventsForDate(date);
  return events.length;
}

/**
 * Check if a date is today
 */
function isToday(dateStr) {
  const today = new Date();
  const date = new Date(dateStr);
  return date.toDateString() === today.toDateString();
}

/**
 * Check if a date is at month boundary
 */
function isMonthBoundary(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDate();
  const nextDay = new Date(date);
  nextDay.setDate(day + 1);
  return nextDay.getMonth() !== date.getMonth();
}

/**
 * Check if a date is weekend
 */
function isWeekend(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * GET /api/days
 * Get day data for infinite scroll
 * Query params: start=YYYY-MM-DD&count=N
 * Returns: { days: DayMetadata[] }
 */
router.get('/', async (req, res) => {
  try {
    const { start, count } = req.query;
    
    if (!start) {
      return res.status(400).json({ error: 'Missing required parameter: start' });
    }
    
    if (!count) {
      return res.status(400).json({ error: 'Missing required parameter: count' });
    }
    
    const totalCount = parseInt(count, 10);
    if (isNaN(totalCount) || totalCount <= 0) {
      return res.status(400).json({ error: 'count must be a positive number' });
    }
    
    // Validate start date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    
    const days = [];
    const startDate = new Date(start);
    
    for (let i = 0; i < totalCount; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfMonth = currentDate.getDate();
      const month = currentDate.getMonth() + 1;
      const monthName = MONTH_NAMES[currentDate.getMonth()];
      const dayName = DAY_NAMES[currentDate.getDay()];
      const isWeekendDay = isWeekend(dateStr);
      const isMonthBoundaryDay = isMonthBoundary(dateStr);
      const isTodayFlag = isToday(dateStr);
      const eventCount = await getEventCountForDate(dateStr);
      const hasEvents = eventCount > 0;
      
      days.push({
        date: dateStr,
        dayOfMonth,
        month,
        monthName,
        dayName,
        isWeekend: isWeekendDay,
        isMonthBoundary: isMonthBoundaryDay,
        isToday: isTodayFlag,
        eventCount,
        hasEvents
      });
    }
    
    res.json({ days });
  } catch (error) {
    console.error('Error reading days:', error.message);
    res.status(500).json({ error: 'Failed to retrieve days' });
  }
});

module.exports = router;
