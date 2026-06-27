import React, { useState, useRef, useLayoutEffect, useEffect, useMemo } from 'react';
import './YearMiniMap.css';

function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function generateWeeks(monthsBack = 1, monthsAhead = 12) {
  const today = new Date();
  const todayStr = dateToStr(today);

  const rangeStart = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1);
  const rangeEnd = new Date(today.getFullYear(), today.getMonth() + monthsAhead + 1, 0);

  const cur = new Date(rangeStart);
  const dow = cur.getDay();
  cur.setDate(cur.getDate() - (dow === 0 ? 6 : dow - 1));

  const weeks = [];
  while (cur <= rangeEnd) {
    const mondayStr = dateToStr(cur);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(cur);
      d.setDate(d.getDate() + i);
      days.push(dateToStr(d));
    }
    const sundayStr = days[6];
    const isCurrentWeek = mondayStr <= todayStr && todayStr <= sundayStr;
    const prev = weeks.length > 0 ? weeks[weeks.length - 1] : null;

    weeks.push({
      key: mondayStr,
      startDate: mondayStr,
      endDate: sundayStr,
      days,
      weekNum: getISOWeek(cur),
      monthNum: cur.getMonth() + 1,
      year: cur.getFullYear(),
      isCurrentWeek,
      todayStr,
      isYearBoundary: prev !== null && cur.getFullYear() !== prev.year,
      isMonthBoundary: prev !== null && cur.getMonth() !== new Date(prev.startDate + 'T00:00:00').getMonth(),
    });

    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

function getBaseColor(date, todayStr) {
  if (date === todayStr) return '#0d2422';
  const dow = new Date(date + 'T00:00:00').getDay();
  if (dow === 0 || dow === 6) return '#1a2e1e';
  return '#24243a';
}

// Returns { bg, stripe }. A partial event keeps the base day colour as bg and
// overlays diagonal stripes in the event colour so the day shows through.
function getDayStyle(date, events, categories, todayStr) {
  const base = getBaseColor(date, todayStr);
  // Representative event = the top one in the day view (lowest order).
  const ev = events
    .filter(e => e.date === date)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
  if (!ev) return { bg: base, stripe: null };
  const cat = categories.find(c => c.id === ev.categoryId);
  const col = cat?.color || ev.color || '#7c6af7';
  // Non-all-day events are "half" — striped so the day shows through.
  return ev.allDay ? { bg: col, stripe: null } : { bg: base, stripe: col };
}

// Leave totals for a year, matched on category name. Striped (partial) leave
// counts as half a day.
function computeYearStats(year, events, categories) {
  const leaveCatIds = new Set(
    categories.filter(c => /leave/i.test(c.name)).map(c => c.id)
  );
  const leave = events.filter(e => e.date.startsWith(`${year}-`) && leaveCatIds.has(e.categoryId));
  let full = 0, half = 0;
  // All-day leave = full; otherwise half.
  for (const e of leave) { if (e.allDay) full++; else half++; }
  return { year, full, half, total: full + half * 0.5 };
}

function buildChainMap(weeks, events, categories) {
  const nonWorkingCatIds = new Set(categories.filter(c => c.isNonWorking).map(c => c.id));
  const allDays = weeks.flatMap(w => w.days);

  const isWeekend = (date) => { const d = new Date(date + 'T00:00:00').getDay(); return d === 0 || d === 6; };
  const getNonWorkingEvent = (date) => events.find(e => e.date === date && nonWorkingCatIds.has(e.categoryId));
  const isNonWorking = (date) => isWeekend(date) || !!getNonWorkingEvent(date);

  const runs = [];
  let cur = null;
  for (const date of allDays) {
    if (isNonWorking(date)) { if (!cur) cur = []; cur.push(date); }
    else { if (cur) { runs.push(cur); cur = null; } }
  }
  if (cur) runs.push(cur);

  const map = {};
  for (const run of runs) {
    const firstEventDate = run.find(d => getNonWorkingEvent(d));
    if (!firstEventDate || run.length < 2) continue;

    const ev = getNonWorkingEvent(firstEventDate);
    const cat = categories.find(c => c.id === ev.categoryId);
    const color = cat?.color || '#22c55e';

    for (let i = 0; i < run.length; i++) {
      const pos = i === 0 ? 'start' : i === run.length - 1 ? 'end' : 'middle';
      map[run[i]] = { pos, color };
    }
  }
  return map;
}

// Fixed pixel height per week row. Kept constant (not fit-to-container) so that
// loading more past weeks always adds real height — that overflow is what makes
// the panel scrollable. Width is label column + 7 square day cells. `compact`
// (mobile) shrinks both the cells and the label to take less horizontal space.
const ROW_H = { default: 14, compact: 11 };
const LABEL_W = { default: 32, compact: 26 };
const MONTHS_PER_LOAD = 6;
const MAX_MONTHS_BACK = 120;
// Weeks of past context shown above the current week on load.
const PAST_WEEKS_ON_LOAD = 16;

export default function YearMiniMap({ events = [], categories = [], selectedDate, scrolledDate, onDayClick, compact = false }) {
  const rowH = compact ? ROW_H.compact : ROW_H.default;
  const labelW = compact ? LABEL_W.compact : LABEL_W.default;
  const minimapWidth = labelW + 7 * rowH;
  const [tooltip, setTooltip] = useState(null);
  const [yearStats, setYearStats] = useState(null);
  const [monthsBack, setMonthsBack] = useState(4);
  const wrapperRef = useRef(null);
  const topSentinelRef = useRef(null);
  const prevScrollHeightRef = useRef(null);
  const prevScrolledWeekRef = useRef(null);
  const bootstrapping = useRef(true);

  // Render forward through December of the 5th year ahead (71 - currentMonth months).
  const monthsAhead = 71 - new Date().getMonth();
  const weeks = useMemo(() => generateWeeks(monthsBack, monthsAhead), [monthsBack, monthsAhead]);
  const chainMap = useMemo(() => buildChainMap(weeks, events, categories), [weeks, events, categories]);

  const scrollToWeek = (startDate, behavior = 'auto') => {
    const c = wrapperRef.current;
    if (!c) return;
    const el = c.querySelector(`[data-week-start="${startDate}"]`);
    if (el) c.scrollTo({ top: el.offsetTop, behavior });
  };

  // Restore scroll position after prepending past weeks (user-driven loads only).
  useLayoutEffect(() => {
    const container = wrapperRef.current;
    if (!container || prevScrollHeightRef.current == null) return;
    container.scrollTop += container.scrollHeight - prevScrollHeightRef.current;
    prevScrollHeightRef.current = null;
  }, [monthsBack]);

  // Bootstrap: ensure the list overflows the panel, then land on today's week.
  // Runs after each render until overflow is reached. Because ROW_H is fixed,
  // each extra batch adds real height, so this terminates with a scrollbar.
  useLayoutEffect(() => {
    const c = wrapperRef.current;
    if (!c || !bootstrapping.current) return;
    if (c.scrollHeight <= c.clientHeight + 1 && monthsBack < MAX_MONTHS_BACK) {
      setMonthsBack(m => m + MONTHS_PER_LOAD);
      return;
    }
    bootstrapping.current = false;
    // Land the current week PAST_WEEKS_ON_LOAD rows down so that many past
    // weeks stay visible above it for context.
    const idx = weeks.findIndex(w => w.isCurrentWeek);
    const target = idx >= 0 ? weeks[Math.max(0, idx - PAST_WEEKS_ON_LOAD)] : null;
    if (target) scrollToWeek(target.startDate);
  }, [monthsBack, weeks]);

  // Top sentinel — load more past weeks when the user scrolls to the top.
  useEffect(() => {
    const el = topSentinelRef.current;
    const root = wrapperRef.current;
    if (!el || !root) return;
    const observer = new IntersectionObserver((entries) => {
      if (bootstrapping.current || !entries[0].isIntersecting) return;
      prevScrollHeightRef.current = root.scrollHeight;
      setMonthsBack(m => m + MONTHS_PER_LOAD);
    }, { root, threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Auto-scroll minimap to keep the scrolled week in view
  useEffect(() => {
    if (bootstrapping.current || !scrolledDate || !wrapperRef.current) return;
    const week = weeks.find(w => scrolledDate >= w.startDate && scrolledDate <= w.endDate);
    if (!week || week.startDate === prevScrolledWeekRef.current) return;
    prevScrolledWeekRef.current = week.startDate;
    const el = wrapperRef.current.querySelector(`[data-week-start="${week.startDate}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [scrolledDate, weeks]);

  const handleDayMouseEnter = (e, date) => {
    const dayEvents = events.filter(ev => ev.date === date);
    const rect = e.currentTarget.getBoundingClientRect();
    const items = dayEvents.map(ev => {
      const cat = categories.find(c => c.id === ev.categoryId);
      return { title: ev.title, color: cat?.color || ev.color || '#6b7280' };
    });
    const d = new Date(date + 'T00:00:00');
    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    setTooltip({
      items: items.length ? items : null,
      fallback: label,
      x: rect.right + 8,
      y: rect.top,
    });
  };

  return (
    <div
      className="year-minimap"
      ref={wrapperRef}
      style={{ width: minimapWidth, '--minimap-row-h': `${rowH}px`, '--minimap-label-w': `${labelW}px` }}
    >
      {/* Top sentinel — triggers loading more past weeks */}
      <div ref={topSentinelRef} style={{ height: 1, flexShrink: 0 }} />

      {/* Leading label for the first (otherwise unmarked) year */}
      {weeks[0] && (
        <div className="minimap-year-boundary">
          <span onClick={() => setYearStats(computeYearStats(weeks[0].year, events, categories))}>{weeks[0].year}</span>
        </div>
      )}

      {weeks.map(week => {
        const label = `${String(week.monthNum).padStart(2, '0')}|${String(week.weekNum).padStart(2, '0')}`;
        const isScrolledWeek = scrolledDate >= week.startDate && scrolledDate <= week.endDate;

        return (
          <React.Fragment key={week.key}>
            {week.isYearBoundary && (
              <div className="minimap-year-boundary">
                <span onClick={() => setYearStats(computeYearStats(week.year, events, categories))}>{week.year}</span>
              </div>
            )}
            <div
              data-week-start={week.startDate}
              className={[
                'minimap-week-row',
                week.isCurrentWeek ? 'current-week' : '',
                isScrolledWeek ? 'scrolled-week' : '',
                week.isMonthBoundary && !week.isYearBoundary ? 'month-boundary' : '',
              ].filter(Boolean).join(' ')}
            >
              <span
                className="minimap-label"
                onClick={() => onDayClick && onDayClick(week.isCurrentWeek ? week.todayStr : week.startDate)}
              >
                {label}
              </span>
              <div className="minimap-days">
                {week.days.map(date => {
                  const isToday = date === week.todayStr;
                  const isSelectedDay = date === selectedDate;
                  const { bg, stripe } = getDayStyle(date, events, categories, week.todayStr);
                  return (
                    <div
                      key={date}
                      data-date={date}
                      className={[
                        'minimap-day',
                        isToday ? 'is-today' : '',
                        isSelectedDay ? 'is-selected' : '',
                      ].filter(Boolean).join(' ')}
                      style={{
                        backgroundColor: bg,
                        ...(stripe && {
                          backgroundImage: `repeating-linear-gradient(45deg, ${stripe} 0 1.5px, transparent 1.5px 4px)`,
                        }),
                      }}
                      onClick={() => onDayClick && onDayClick(date)}
                      onMouseEnter={e => handleDayMouseEnter(e, date)}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {chainMap[date] && (
                        <div
                          className={`chain-stripe chain-stripe--${chainMap[date].pos}`}
                          style={{ backgroundColor: chainMap[date].color }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </React.Fragment>
        );
      })}

      {yearStats && (
        <div className="year-stats-backdrop" onClick={() => setYearStats(null)}>
          <div className="year-stats-popup" onClick={e => e.stopPropagation()}>
            <div className="year-stats-title">{yearStats.year} stats</div>
            <div className="year-stats-row">
              <span>Leave</span>
              <strong>{yearStats.total} days</strong>
            </div>
            <div className="year-stats-sub">
              {yearStats.full} full · {yearStats.half} half
            </div>
            <button className="year-stats-close" onClick={() => setYearStats(null)}>Close</button>
          </div>
        </div>
      )}

      {tooltip && (
        <div className="minimap-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="minimap-tooltip-date">{tooltip.fallback}</div>
          {tooltip.items && tooltip.items.map((item, i) => (
            <div key={i} className="minimap-tooltip-row">
              <span className="minimap-tooltip-dot" style={{ backgroundColor: item.color }} />
              {item.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
