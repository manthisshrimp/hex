import React from 'react';
import './DaysPanelHeader.css';

function getMondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d;
}

function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

function weeksApart(dateStr) {
  const todayStr = new Date().toISOString().split('T')[0];
  const msPerWeek = 7 * 86400000;
  return Math.round((getMondayOf(dateStr) - getMondayOf(todayStr)) / msPerWeek);
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function countdownLabel(dateStr) {
  const n = daysUntil(dateStr);
  if (n <= 0) return 'today';
  if (n < 7) return '<1w';
  return `${weeksApart(dateStr)}w`;
}

function countdownColor(dateStr) {
  const n = daysUntil(dateStr);
  if (n < 7) return '#3ecbc2';
  const w = weeksApart(dateStr);
  if (w < 2) return '#3ecbc2';  // this week + next week
  if (w < 3) return '#2a8c85';  // one week between
  return '#6b7280';             // further out
}

export default function DaysPanelHeader({ events = [], categories = [] }) {
  const today = new Date().toISOString().split('T')[0];

  const upcoming = events
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);

  return (
    <div className="days-panel-header">
      <div className="days-panel-header-top">
        <span className="days-panel-title">Schedule</span>
      </div>

      {upcoming.length > 0 && (
        <div className="upcoming-list">
          {upcoming.map(ev => {
            const cat = categories.find(c => c.id === ev.categoryId);
            const color = cat?.color || ev.color || '#6b7280';
            return (
              <div key={ev.id} className="upcoming-item">
                <span className="upcoming-dot" style={{ backgroundColor: color }} />
                <span className="upcoming-title">{ev.title}</span>
                <span className="upcoming-date">{formatDate(ev.date)}</span>
                <span className="upcoming-days" style={{ color: countdownColor(ev.date) }}>
                  {countdownLabel(ev.date)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
