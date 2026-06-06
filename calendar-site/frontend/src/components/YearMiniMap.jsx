import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
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
    // Build 7 day date strings: Mon–Sun
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

function getDayColor(date, events, categories, todayStr) {
  const dayEvents = events.filter(e => e.date === date);
  if (dayEvents.length > 0) {
    const ev = dayEvents[0];
    const cat = categories.find(c => c.id === ev.categoryId);
    return cat?.color || ev.color || '#7c6af7';
  }
  if (date === todayStr) return '#0d2422';
  const dow = new Date(date + 'T00:00:00').getDay();
  if (dow === 0 || dow === 6) return '#1a2e1e';
  return '#24243a';
}

function buildChainMap(weeks, events, categories) {
  const nonWorkingCatIds = new Set(categories.filter(c => c.isNonWorking).map(c => c.id));
  const allDays = weeks.flatMap(w => w.days);

  const isWeekend = (date) => { const d = new Date(date + 'T00:00:00').getDay(); return d === 0 || d === 6; };
  const getNonWorkingEvent = (date) => events.find(e => e.date === date && nonWorkingCatIds.has(e.categoryId));
  const isNonWorking = (date) => isWeekend(date) || !!getNonWorkingEvent(date);

  // Build consecutive runs of non-working days
  const runs = [];
  let cur = null;
  for (const date of allDays) {
    if (isNonWorking(date)) { if (!cur) cur = []; cur.push(date); }
    else { if (cur) { runs.push(cur); cur = null; } }
  }
  if (cur) runs.push(cur);

  // Only runs with at least one holiday/vacation event AND length > 1
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

export default function YearMiniMap({ events = [], categories = [], selectedDate, scrolledDate, onDayClick }) {
  const [tooltip, setTooltip] = useState(null);
  const wrapperRef = useRef(null);
  const weeks = generateWeeks(1, 12);

  const chainMap = buildChainMap(weeks, events, categories);

  // Auto-scroll year map to keep the scrolled week visible
  const prevScrolledWeekRef = useRef(null);
  useEffect(() => {
    if (!scrolledDate || !wrapperRef.current) return;
    const week = weeks.find(w => scrolledDate >= w.startDate && scrolledDate <= w.endDate);
    if (!week || week.startDate === prevScrolledWeekRef.current) return;
    prevScrolledWeekRef.current = week.startDate;
    const el = wrapperRef.current.querySelector(`[data-week-start="${week.startDate}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [scrolledDate, weeks]);

  // Measure height and compute width so square cells fill the panel without overflow
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const numBoundaries = weeks.filter(w => w.isYearBoundary).length;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      const rowH = (h - numBoundaries * 14) / weeks.length;
      el.style.width = `${32 + 7 * rowH}px`;
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [weeks.length]);

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
    <div className="year-minimap" ref={wrapperRef}>
      {weeks.map(week => {
        const label = `${String(week.monthNum).padStart(2, '0')}|${String(week.weekNum).padStart(2, '0')}`;
        const isScrolledWeek = scrolledDate >= week.startDate && scrolledDate <= week.endDate;

        return (
          <React.Fragment key={week.key}>
            {week.isYearBoundary && (
              <div className="minimap-year-boundary">
                <span>{week.year}</span>
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
                  const bg = getDayColor(date, events, categories, week.todayStr);
                  return (
                    <div
                      key={date}
                      className={[
                        'minimap-day',
                        isToday ? 'is-today' : '',
                        isSelectedDay ? 'is-selected' : '',
                      ].filter(Boolean).join(' ')}
                      style={{ backgroundColor: bg }}
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
