import { useState, useEffect, useCallback } from 'react';
import { useMediaQuery } from './hooks/useMediaQuery';
import DesktopLayout from './DesktopLayout';
import MobileLayout from './MobileLayout';
import AdminAuth from './components/AdminAuth';
import './App.css';
import { useEvents } from './hooks/useEvents';
import { useCategories } from './hooks/useCategories';
import { setAuthToken, setAuthFailureHandler, reorderEvents } from './api';

function App() {
  const [authToken, setAuth] = useState(() => {
    const stored = localStorage.getItem('octiron_token');
    if (stored) setAuthToken(stored);
    return stored;
  });

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const isMobile = useMediaQuery('(max-width: 768px)');

  const { events, loading, error, createEvent, updateEvent, deleteEvent, refresh } = useEvents();
  const { categories } = useCategories();

  const handleLogout = useCallback(() => {
    localStorage.removeItem('octiron_token');
    setAuthToken(null);
    setAuth(null);
  }, []);

  useEffect(() => {
    setAuthFailureHandler(handleLogout);
  }, [handleLogout]);

  const handleAuthenticate = (token) => {
    setAuthToken(token);
    setAuth(token);
  };

  // Span previous year → 5 years ahead so the minimap's scroll range and the
  // imported public holidays both have their events loaded.
  const yearRange = () => {
    const year = new Date().getFullYear();
    return { start: `${year - 1}-01-01`, end: `${year + 5}-12-31` };
  };

  const handleFormSave = async (formData) => {
    try {
      if (formData.id) {
        await updateEvent(formData.id, formData);
      } else {
        await createEvent(formData);
      }
      await refresh(yearRange());
    } catch (err) {
      console.error('Error saving event:', err);
      throw err;
    }
  };

  const handleReorderEvents = async (date, ids) => {
    try {
      await reorderEvents(date, ids);
      await refresh(yearRange());
    } catch (err) {
      console.error('Error reordering events:', err);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      await deleteEvent(eventId);
      await refresh(yearRange());
    } catch (err) {
      console.error('Error deleting event:', err);
      throw err;
    }
  };

  useEffect(() => {
    if (!authToken) return;
    refresh(yearRange());
  }, [authToken, refresh]);

  if (!authToken) {
    return <AdminAuth onAuthenticate={handleAuthenticate} />;
  }

  if (error) {
    return (
      <div className="app">
        <div className="error-banner">
          <p>Error loading events: {error}</p>
          <button onClick={() => refresh()}>Retry</button>
        </div>
      </div>
    );
  }

  if (loading && events.length === 0) {
    return (
      <div className="app">
        <div className="loading-spinner">Loading calendar…</div>
      </div>
    );
  }

  return (
    <div className="app">
      {isMobile ? (
        <MobileLayout
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          events={events}
          loading={loading}
          onFormSave={handleFormSave}
          onDeleteEvent={handleDeleteEvent}
          onReorderEvents={handleReorderEvents}
          categories={categories}
        />
      ) : (
        <DesktopLayout
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          events={events}
          loading={loading}
          onFormSave={handleFormSave}
          onDeleteEvent={handleDeleteEvent}
          onReorderEvents={handleReorderEvents}
          categories={categories}
        />
      )}
    </div>
  );
}

export default App;
