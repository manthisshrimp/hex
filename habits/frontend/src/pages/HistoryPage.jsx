import { useState, useEffect } from 'react';
import { fmtNum } from '../fmt';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import SectionHeader from '../components/SectionHeader';
import { getHistoryHp, getHistoryGold, getHistoryCompletions, getHabits, getRandomEventHistory } from '../api';

const IMP_CLASS = {
  low: 'imp-low',
  medium: 'imp-medium',
  high: 'imp-high',
};

/** Returns an array of the last N days as YYYY-MM-DD strings, oldest first */
function lastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

/** Format date as "Apr 20" style */
function shortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export default function HistoryPage() {
  const [hpEvents, setHpEvents] = useState([]);
  const [goldEvents, setGoldEvents] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [habits, setHabits] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [hpRes, goldRes, compRes, habRes, encRes] = await Promise.all([
          getHistoryHp(),
          getHistoryGold(),
          getHistoryCompletions(),
          getHabits(),
          getRandomEventHistory(),
        ]);

        const [hpData, goldData, compData, habData, encData] = await Promise.all([
          hpRes.ok ? hpRes.json() : [],
          goldRes.ok ? goldRes.json() : [],
          compRes.ok ? compRes.json() : [],
          habRes.ok ? habRes.json() : [],
          encRes.ok ? encRes.json() : [],
        ]);

        setHpEvents(hpData);
        setGoldEvents(goldData);
        setCompletions(compData);
        setHabits(habData);
        setEncounters(encData);
      } catch {
        // auth failures handled upstream
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const days30 = lastNDays(30);
  const today = days30[days30.length - 1];

  // Build HP chart data: daily net HP delta
  const hpChartData = days30.map(day => {
    const dayEvents = hpEvents.filter(e => e.tickDate === day);
    const regen = dayEvents.filter(e => e.type === 'regen').reduce((s, e) => s + e.amount, 0);
    const damage = dayEvents.filter(e => e.type === 'damage').reduce((s, e) => s + e.amount, 0);
    return {
      date: shortDate(day),
      net: Math.round((regen - damage) * 10) / 10,
    };
  });

  // Build gold chart data: cumulative gold balance over last 30 days
  // Sort gold events by timestamp, compute running total
  const sortedGoldEvents = [...goldEvents].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
  // For each day, sum all gold events up to and including that day
  const goldChartData = days30.map(day => {
    const total = sortedGoldEvents
      .filter(e => (e.timestamp || '').slice(0, 10) <= day)
      .reduce((s, e) => s + e.amount, 0);
    return { date: shortDate(day), gold: Math.round(total) };
  });

  // Build heatmap: for each habit, which of the last 30 days had a completion?
  const completionsByHabit = {};
  completions.forEach(c => {
    const day = (c.completedAt || c.completed_at || '').slice(0, 10);
    if (!completionsByHabit[c.habitId || c.habit_id]) completionsByHabit[c.habitId || c.habit_id] = new Set();
    (completionsByHabit[c.habitId || c.habit_id]).add(day);
  });

  // For windowed habits, mark the days after a completion that fall within its window
  // (the days where the habit isn't due yet) so they can be shown faded
  const coveredByHabit = {};
  habits.forEach(h => {
    if (h.frequency !== 'windowed' || !h.windowDays || h.windowDays <= 1) return;
    const completionDates = completionsByHabit[h.id];
    if (!completionDates) return;
    const covered = new Set();
    completionDates.forEach(dateStr => {
      const base = new Date(dateStr + 'T00:00:00Z');
      for (let i = 1; i < h.windowDays; i++) {
        covered.add(new Date(base.getTime() + i * 86400000).toISOString().slice(0, 10));
      }
    });
    completionDates.forEach(d => covered.delete(d));
    coveredByHabit[h.id] = covered;
  });

  const days30Set = new Set(days30);

  // Only show active habits in heatmap, sorted by active days (completions + covered) ascending
  const heatmapHabits = [...habits]
    .filter(h => h.active)
    .sort((a, b) => {
      const completionsA = completionsByHabit[a.id] ?? new Set();
      const completionsB = completionsByHabit[b.id] ?? new Set();
      const coveredA = coveredByHabit[a.id] ?? new Set();
      const coveredB = coveredByHabit[b.id] ?? new Set();
      const countA = [...completionsA, ...coveredA].filter(d => days30Set.has(d)).length;
      const countB = [...completionsB, ...coveredB].filter(d => days30Set.has(d)).length;
      return countA - countB;
    });

  const tooltipStyle = {
    backgroundColor: 'var(--color-surface-mid)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    fontFamily: "'IM Fell English', Georgia, serif",
    fontSize: '0.8rem',
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading-state">Loading chronicle...</div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="chronicle-cols">
        {/* Column 1: Battle Record */}
        <div className="chart-section">
          <SectionHeader>BATTLE RECORD</SectionHeader>
          <div className="chart-container">
            {heatmapHabits.length === 0 ? (
              <div className="empty-state" style={{ padding: '16px 0' }}>
                No habits to display.
              </div>
            ) : (
              heatmapHabits.map(h => (
                <div key={h.id} className="heatmap-habit">
                  <div
                    className="heatmap-name"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: '0.8rem',
                      color: `var(--color-imp-${h.importance})`,
                      marginBottom: '6px',
                    }}
                  >
                    {h.name}
                  </div>
                  <div className="heatmap-grid">
                    {days30.map(day => {
                      const filled = completionsByHabit[h.id]?.has(day) ?? false;
                      const covered = !filled && (coveredByHabit[h.id]?.has(day) ?? false);
                      const isToday = day === today;
                      return (
                        <div
                          key={day}
                          className={[
                            'heatmap-cell',
                            filled ? `filled ${IMP_CLASS[h.importance]}` : '',
                            covered ? `covered ${IMP_CLASS[h.importance]}` : '',
                            isToday ? 'today-cell' : '',
                          ].filter(Boolean).join(' ')}
                          title={day}
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Encounters */}
        <div className="chart-section">
          <SectionHeader>ENCOUNTERS</SectionHeader>
          {encounters.length === 0 ? (
            <div className="empty-state" style={{ padding: '16px 0' }}>No encounters recorded yet.</div>
          ) : (
            <div className="encounter-list">
              {encounters.map((enc, i) => (
                <div key={i} className="encounter-row stone-panel">
                  <div className="encounter-header">
                    <span className="encounter-title">{enc.title}</span>
                    <span className="encounter-date">{enc.resolvedAt}</span>
                  </div>
                  <div className="encounter-outcome">{enc.outcomeText}</div>
                  <div className="encounter-stats">
                    {enc.choiceMade && (
                      <span className="encounter-choice">Choice: {enc.choiceMade}</span>
                    )}
                    {enc.hpDelta !== 0 && (
                      <span className={enc.hpDelta > 0 ? 'event-stat-pos' : 'event-stat-neg'}>
                        ♥ {enc.hpDelta > 0 ? '+' : ''}{Math.round(enc.hpDelta)}
                      </span>
                    )}
                    {enc.goldDelta !== 0 && (
                      <span className={enc.goldDelta > 0 ? 'event-stat-pos' : 'event-stat-neg'}>
                        ⚜ {enc.goldDelta > 0 ? '+' : ''}{Math.round(enc.goldDelta)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 3: Charts */}
        <div className="chronicle-charts">
          <div className="chart-section">
            <SectionHeader>VITALITY RECORD</SectionHeader>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={hpChartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#cc0000" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#cc0000" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontFamily: "'IM Fell English', Georgia, serif" }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    interval={6}
                  />
                  <YAxis
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontFamily: "'IM Fell English', Georgia, serif" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: 'var(--color-text-label)' }}
                    formatter={(val) => [`${fmtNum(val, 1)} HP`, 'Net change']}
                  />
                  <Area
                    type="monotone"
                    dataKey="net"
                    stroke="#cc0000"
                    strokeWidth={2}
                    fill="url(#hpGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#cc0000', stroke: 'var(--color-border-hi)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-section">
            <SectionHeader>TREASURY</SectionHeader>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={goldChartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffd700" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ffd700" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontFamily: "'IM Fell English', Georgia, serif" }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    interval={6}
                  />
                  <YAxis
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontFamily: "'IM Fell English', Georgia, serif" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: 'var(--color-text-label)' }}
                    formatter={(val) => [`${fmtNum(val)} ⚜`, 'Gold']}
                  />
                  <Area
                    type="monotone"
                    dataKey="gold"
                    stroke="#ffd700"
                    strokeWidth={2}
                    fill="url(#goldGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#ffd700', stroke: 'var(--color-border-hi)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
