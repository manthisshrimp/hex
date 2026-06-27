import { useState, useEffect, useCallback } from 'react';
import { fetchDays } from '../api';

const DAYS_PER_LOAD = 14;
const INITIAL_DAYS_COUNT = 28;

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function useDays(initialDate, initialCount = INITIAL_DAYS_COUNT) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const loadDays = useCallback(async (start, count, append = true) => {
    setLoading(true);
    try {
      const data = await fetchDays(start, count);
      const newDays = data.days ?? [];
      if (append) {
        setDays(prev => [...prev, ...newDays]);
      } else {
        setDays(newDays);
        if (newDays.length > 0) setStartDate(newDays[0].date);
      }
      if (newDays.length > 0) setEndDate(newDays[newDays.length - 1].date);
      setHasMore(newDays.length === count);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (!loading && hasMore && endDate) {
      loadDays(addDays(endDate, 1), DAYS_PER_LOAD, true);
    }
  }, [loading, hasMore, loadDays, endDate]);

  const loadBefore = useCallback(async () => {
    if (loading || !startDate) return null;
    const fetchStart = addDays(startDate, -DAYS_PER_LOAD);
    setLoading(true);
    try {
      const data = await fetchDays(fetchStart, DAYS_PER_LOAD);
      const newDays = data.days ?? [];
      if (newDays.length > 0) {
        setDays(prev => [...newDays, ...prev]);
        setStartDate(newDays[0].date);
      }
      return newDays.length;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [loading, startDate]);

  const refresh = useCallback(() => {
    setDays([]);
    setEndDate(null);
    const d = new Date(initialDate + 'T00:00:00');
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    const monday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // Start two weeks before the current week so there's room above to centre
    // the (taller-than-viewport) current week without clamping at the top.
    const firstDay = addDays(monday, -14);
    setStartDate(firstDay);
    loadDays(firstDay, INITIAL_DAYS_COUNT + 14, false);
  }, [loadDays, initialDate]);

  const selectDay = useCallback((date) => {
    setDays(prev => prev.map(d => ({ ...d, isSelected: d.date === date })));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { days, loading, error, hasMore, loadMore, loadBefore, refresh, selectDay };
}
