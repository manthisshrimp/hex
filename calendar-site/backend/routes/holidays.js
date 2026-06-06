const express = require('express');
const https = require('https');
const { readAllEvents, createEvent } = require('../storage/events');
const { getAllCategories, createCategory } = require('../storage/categories');

const router = express.Router();

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'calendar-site/1.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Failed to parse response from ${url}`)); }
      });
    }).on('error', reject);
  });
}

async function ensureHolidayCategory() {
  const categories = await getAllCategories();
  const existing = categories.find(c => c.name === 'Public Holiday');
  if (existing) return existing;
  return await createCategory({ name: 'Public Holiday', color: '#fdca40' });
}

// POST /api/holidays/import?year=2026
// Imports SA public holidays for the given year (defaults to current + next year)
router.post('/import', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const years = req.query.year
      ? [parseInt(req.query.year)]
      : [currentYear, currentYear + 1];

    const holidayCat = await ensureHolidayCategory();
    const allEvents = await readAllEvents();

    let imported = 0;
    let skipped = 0;

    for (const year of years) {
      let holidays;
      try {
        holidays = await fetchJson(`https://date.nager.at/api/v3/PublicHolidays/${year}/ZA`);
      } catch (err) {
        return res.status(502).json({ error: `Failed to fetch holidays for ${year}: ${err.message}` });
      }

      if (!Array.isArray(holidays)) {
        return res.status(502).json({ error: `Unexpected response for year ${year}` });
      }

      for (const holiday of holidays) {
        const duplicate = allEvents.find(
          e => e.date === holiday.date && e.title === holiday.localName
        );
        if (duplicate) {
          skipped++;
          continue;
        }

        const event = await createEvent({
          title: holiday.localName,
          date: holiday.date,
          allDay: true,
          categoryId: holidayCat.id,
          description: holiday.name !== holiday.localName ? holiday.name : '',
        });
        allEvents.push(event);
        imported++;
      }
    }

    res.json({ imported, skipped, years });
  } catch (err) {
    console.error('Holiday import error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
