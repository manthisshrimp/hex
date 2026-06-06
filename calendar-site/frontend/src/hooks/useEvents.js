import { useState, useCallback, useEffect } from 'react';
import {
  fetchEventsInRange,
  fetchEventsForDate,
  fetchEventById,
  createEvent,
  updateEvent,
  deleteEvent,
} from '../api';

export function useEvents(initialRange = null) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async (range = initialRange) => {
    setLoading(true);
    setError(null);
    
    try {
      let loadedEvents = [];
      
      if (range && range.start && range.end) {
        loadedEvents = await fetchEventsInRange(range.start, range.end);
      } else if (range && range.date) {
        loadedEvents = await fetchEventsForDate(range.date);
      } else if (range && range.id) {
        const event = await fetchEventById(range.id);
        loadedEvents = event ? [event] : [];
      } else {
        // Default: fetch events for today
        const today = new Date().toISOString().split('T')[0];
        loadedEvents = await fetchEventsForDate(today);
      }
      
      setEvents(loadedEvents);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [initialRange]);

  useEffect(() => {
    if (initialRange) {
      refresh(initialRange);
    }
  }, [initialRange, refresh]);

  const handleCreateEvent = useCallback(async (eventData) => {
    setLoading(true);
    try {
      const newEvent = await createEvent(eventData);
      setEvents(prev => [...prev, newEvent]);
      setLastUpdated(new Date());
      return newEvent;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpdateEvent = useCallback(async (id, updates) => {
    setLoading(true);
    try {
      const updatedEvent = await updateEvent(id, updates);
      setEvents(prev =>
        prev.map(e => e.id === id ? updatedEvent : e)
      );
      setLastUpdated(new Date());
      return updatedEvent;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteEvent = useCallback(async (id) => {
    setLoading(true);
    try {
      await deleteEvent(id);
      setEvents(prev => prev.filter(e => e.id !== id));
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    events,
    loading,
    error,
    createEvent: handleCreateEvent,
    updateEvent: handleUpdateEvent,
    deleteEvent: handleDeleteEvent,
    refresh,
    lastUpdated,
  };
}
