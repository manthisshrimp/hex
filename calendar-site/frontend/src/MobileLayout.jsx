import React, { useState } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import YearMiniMap from './components/YearMiniMap';
import DaysList from './components/DaysList';
import DaysPanelHeader from './components/DaysPanelHeader';
import DetailPanel from './components/DetailPanel';
import EventForm from './components/EventForm';
import CategoriesManager from './components/CategoriesManager';
import './MobileLayout.css';

// Mobile List View - YearMiniMap + DaysList
function MobileListView({ selectedDate, setSelectedDate, events, loading, categories = [] }) {
  const navigate = useNavigate();
  const [daysListKey, setDaysListKey] = useState(0);
  const [scrolledDate, setScrolledDate] = useState(new Date().toISOString().split('T')[0]);

  const handleMinimapSelect = (date) => {
    setSelectedDate(date);
    setTimeout(() => {
      const el = document.querySelector(`[data-date="${date}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleDaySelect = (date) => {
    setSelectedDate(date);
    navigate(`/day/${date}`);
  };

  const handleScrollToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    const el = document.querySelector(`[data-date="${today}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setDaysListKey(k => k + 1);
    }
  };

  return (
    <div className="mobile-list-view">
      <div className="mobile-content">
        {/* Compact Year MiniMap */}
        <div className="mobile-year-minimap">
          <YearMiniMap
            compact
            events={events}
            categories={categories}
            selectedDate={selectedDate}
            scrolledDate={scrolledDate}
            onDayClick={handleMinimapSelect}
          />
          <div className="minimap-bottom-btns">
            <button
              className="mobile-icon-btn"
              onClick={handleScrollToToday}
              title="Today"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="2" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                <line x1="1" y1="5.5" x2="13" y2="5.5" stroke="currentColor" strokeWidth="1.3"/>
                <rect x="5" y="7.5" width="4" height="3.5" rx="1" fill="currentColor"/>
              </svg>
            </button>
            <button
              className="mobile-icon-btn"
              onClick={() => navigate('/categories')}
              title="Manage categories"
            >
              ⚙
            </button>
          </div>
        </div>

        {/* Days List */}
        <div className="mobile-days-column">
          <DaysPanelHeader
            events={events}
            categories={categories}
          />
          <DaysList
            key={daysListKey}
            initialDate={selectedDate}
            selectedDate={selectedDate}
            onDaySelect={handleDaySelect}
            onScrollWeek={setScrolledDate}
            events={events}
            categories={categories}
          />
        </div>
      </div>
    </div>
  );
}

// Mobile Detail View - Full screen detail with back button
function MobileDetailView({ selectedDate, setSelectedDate, events, loading, onFormSave, onDeleteEvent, categories = [] }) {
  const navigate = useNavigate();
  const { date } = useParams();
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Ensure selectedDate is updated when route changes
  React.useEffect(() => {
    if (date && date !== selectedDate) {
      setSelectedDate(date);
    }
  }, [date, selectedDate, setSelectedDate]);

  const selectedDateEvents = events.filter(e => e.date === date);

  const handleBack = () => {
    navigate('/');
  };

  const handleAddEvent = () => {
    setSelectedEvent(null);
    setIsFormOpen(true);
  };

  const handleEditEvent = (event) => {
    setSelectedEvent(event);
    setIsFormOpen(true);
  };

  const handleDeleteEvent = async (eventId) => {
    await onDeleteEvent(eventId);
  };

  const handleFormSave = async (formData) => {
    await onFormSave(formData);
    setIsFormOpen(false);
    setSelectedEvent(null);
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setSelectedEvent(null);
  };

  return (
    <div className="mobile-detail-view">
      <header className="mobile-detail-header">
        <button className="back-button" onClick={handleBack}>
          ← Back
        </button>
        <span className="detail-date-display">
          {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </span>
        {!isFormOpen && (
          <button className="btn-add-header" onClick={handleAddEvent} title="Add event">+</button>
        )}
      </header>

      <div className="mobile-detail-content">
        {isFormOpen ? (
          <EventForm
            event={selectedEvent}
            date={date}
            categories={categories}
            onSave={handleFormSave}
            onCancel={handleFormCancel}
          />
        ) : (
          <DetailPanel
            date={date}
            events={selectedDateEvents}
            categories={categories}
            loading={loading}
            onAdd={handleAddEvent}
            onEdit={handleEditEvent}
            onDelete={handleDeleteEvent}
          />
        )}
      </div>
    </div>
  );
}

// Mobile Categories View - full screen categories manager
function MobileCategoriesView() {
  const navigate = useNavigate();
  return (
    <div className="mobile-categories-view">
      <CategoriesManager onClose={() => navigate('/')} />
    </div>
  );
}

// Main MobileLayout component — uses the top-level BrowserRouter from main.jsx
function MobileLayout({ selectedDate, setSelectedDate, events, loading, onFormSave, onDeleteEvent, categories = [] }) {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <MobileListView
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            events={events}
            loading={loading}
            categories={categories}
          />
        }
      />
      <Route
        path="/day/:date"
        element={
          <MobileDetailView
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            events={events}
            loading={loading}
            onFormSave={onFormSave}
            onDeleteEvent={onDeleteEvent}
            categories={categories}
          />
        }
      />
      <Route
        path="/categories"
        element={<MobileCategoriesView />}
      />
    </Routes>
  );
}

export default MobileLayout;
