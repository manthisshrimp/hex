import React, { useState, useEffect, useCallback, useRef, useLayoutEffect, forwardRef, useMemo } from 'react';
import DaySquare from './DaySquare';
import { useDays } from '../hooks/useDays';
import './DaysList.css';

function getMondayStr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekNumber(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

const DaysList = forwardRef(function DaysList({
  initialDate = new Date().toISOString().split('T')[0],
  selectedDate,
  onDaySelect,
  onScrollWeek,
  events = [],
  categories = []
}, ref) {
  const {
    days,
    loading,
    hasMore,
    loadMore,
    loadBefore,
    selectDay,
  } = useDays(initialDate, 28);

  const todayMonday = useMemo(() => getMondayStr(new Date().toISOString().split('T')[0]), []);
  const [currentScrollDate, setCurrentScrollDate] = useState(todayMonday);
  const listRef = useRef(null);
  const scrollRafRef = useRef(null);
  const topObserverRef = useRef(null);
  const bottomObserverRef = useRef(null);
  const prevFirstDayRef = useRef(null);
  const prevScrollHeightRef = useRef(null);
  // Prevent top observer from firing immediately on mount
  const readyForTopLoad = useRef(false);
  const initialScrollDone = useRef(false);
  // After a selection we set the highlight explicitly; ignore scroll-driven
  // sync briefly so the programmatic scroll (and any lazy-load prepend it
  // triggers) can't clobber the highlight onto the wrong week.
  const suppressSyncUntil = useRef(0);

  // Selecting a day highlights that day's week directly — independent of where
  // the programmatic scroll actually lands.
  useEffect(() => {
    if (!selectedDate) return;
    const mon = getMondayStr(selectedDate);
    setCurrentScrollDate(mon);
    if (onScrollWeek) onScrollWeek(mon);
    suppressSyncUntil.current = Date.now() + 900;
  }, [selectedDate, onScrollWeek]);

  // Group flat days array into weeks keyed by Monday date string
  const weekGroups = useMemo(() => {
    const groups = [];
    for (const day of days) {
      const monday = getMondayStr(day.date);
      if (groups.length === 0 || groups[groups.length - 1].monday !== monday) {
        groups.push({ monday, days: [day] });
      } else {
        groups[groups.length - 1].days.push(day);
      }
    }
    return groups;
  }, [days]);

  // Restore scroll position after prepend (runs before paint)
  useLayoutEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const currentFirstDay = days[0]?.date;
    if (
      prevFirstDayRef.current &&
      currentFirstDay !== prevFirstDayRef.current &&
      prevScrollHeightRef.current != null
    ) {
      container.scrollTop += container.scrollHeight - prevScrollHeightRef.current;
    }
    prevFirstDayRef.current = currentFirstDay;
    prevScrollHeightRef.current = container.scrollHeight;
  }, [days]);

  // Enable top loading after initial render settles
  useEffect(() => {
    const t = setTimeout(() => { readyForTopLoad.current = true; }, 300);
    return () => clearTimeout(t);
  }, []);

  // After initial load, centre the current week group in the panel.
  useLayoutEffect(() => {
    if (days.length > 0 && !initialScrollDone.current && listRef.current) {
      initialScrollDone.current = true;
      const grp = listRef.current.querySelector('.week-group--current');
      if (grp) {
        const cRect = listRef.current.getBoundingClientRect();
        const gRect = grp.getBoundingClientRect();
        listRef.current.scrollTop += (gRect.top - cRect.top) - (cRect.height - gRect.height) / 2;
      }
    }
  }, [days.length, todayMonday]);

  // Bottom observer — load more days
  useEffect(() => {
    const el = bottomObserverRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) loadMore();
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  // Top observer — load earlier days
  useEffect(() => {
    const el = topObserverRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && readyForTopLoad.current && !loading) {
        // Save scroll height before loadBefore mutates state
        if (listRef.current) prevScrollHeightRef.current = listRef.current.scrollHeight;
        loadBefore();
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, loadBefore]);

  const handleScroll = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      if (!onScrollWeek || !listRef.current) return;
      if (Date.now() < suppressSyncUntil.current) return;
      const containerTop = listRef.current.getBoundingClientRect().top;
      const sepEls = listRef.current.querySelectorAll('.week-separator[data-monday]');
      // The active week is the one spanning the top of the viewport — i.e. the
      // last separator at or above the container top, not the first one below it
      // (that off-by-one highlighted the week after the clicked day).
      let activeMonday = null;
      for (const el of sepEls) {
        if (el.getBoundingClientRect().top <= containerTop + 4) {
          activeMonday = el.dataset.monday;
        } else {
          break;
        }
      }
      if (!activeMonday && sepEls.length) activeMonday = sepEls[0].dataset.monday;
      if (activeMonday) {
        setCurrentScrollDate(activeMonday);
        onScrollWeek && onScrollWeek(activeMonday);
      }
    });
  }, [onScrollWeek]);

  const handleDaySelect = useCallback((date) => {
    selectDay(date);
    if (onDaySelect) onDaySelect(date);
  }, [selectDay, onDaySelect]);

  const getDayEvents = useCallback((date) => {
    return events.filter(e => e.date === date);
  }, [events]);

  return (
    <div className="days-list" ref={listRef} onScroll={handleScroll}>
      <div className="days-list-content">
        {/* Top sentinel for loading earlier days */}
        <div ref={topObserverRef} className="scroll-observer" />

        {loading && days.length === 0 && (
          <div className="loading-indicator">Loading…</div>
        )}

        {weekGroups.map((group) => {
          const isActive = currentScrollDate === group.monday;
          const isCurrentWeek = group.monday === todayMonday;
          return (
            <div
              key={group.monday}
              className={`week-group${isActive ? ' week-group--active' : ''}${isCurrentWeek ? ' week-group--current' : ''}`}
            >
              <div
                data-monday={group.monday}
                className={`week-separator${isActive ? ' week-separator--active' : ''}`}
              >
                <span className="week-number">W{getWeekNumber(group.monday)}</span>
              </div>
              {group.days.map((day) => (
                <DaySquare
                  key={day.date}
                  date={day.date}
                  dayOfMonth={day.dayOfMonth}
                  monthName={day.monthName}
                  dayName={day.dayName}
                  isWeekend={day.isWeekend}
                  isMonthBoundary={day.isMonthBoundary}
                  isToday={day.isToday}
                  isSelected={selectedDate === day.date || day.isSelected}
                  events={getDayEvents(day.date)}
                  categories={categories}
                  onClick={handleDaySelect}
                />
              ))}
            </div>
          );
        })}

        {/* Bottom sentinel for loading more days */}
        <div ref={bottomObserverRef} className="scroll-observer" />

        {loading && days.length > 0 && (
          <div className="loading-indicator">Loading more…</div>
        )}
      </div>
    </div>
  );
});

export default DaysList;
