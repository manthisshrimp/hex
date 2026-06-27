import React, { useState } from 'react';
import YearMiniMap from './components/YearMiniMap';
import DaysList from './components/DaysList';
import DaysPanelHeader from './components/DaysPanelHeader';
import DetailPanel from './components/DetailPanel';
import EventForm from './components/EventForm';
import CategoriesManager from './components/CategoriesManager';
import './DesktopLayout.css';

function DesktopLayout({ selectedDate, setSelectedDate, events, loading, onFormSave, onDeleteEvent, onReorderEvents, categories = [] }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [daysListKey, setDaysListKey] = useState(0);
  const [scrolledDate, setScrolledDate] = useState(new Date().toISOString().split('T')[0]);

  // Get events for the selected date
  const selectedDateEvents = events.filter(e => e.date === selectedDate);

  // Scroll DaysList to selected date in YearMiniMap
  const handleYearDayClick = (date) => {
    setSelectedDate(date);
    setTimeout(() => {
      const el = document.querySelector(`[data-date="${date}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleScrollToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    const el = document.querySelector(`[data-date="${today}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Today not in DOM — reset the list from today
      setDaysListKey(k => k + 1);
    }
  };

  // Handle day selection in DaysList
  const handleDaySelect = (date) => {
    setSelectedDate(date);
  };

  // Event management
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
    <div className="desktop-layout">
      {/* Year Mini Map - 120px fixed width */}
      <aside className="year-panel">
        <YearMiniMap
          events={events}
          categories={categories}
          selectedDate={selectedDate}
          scrolledDate={scrolledDate}
          onDayClick={handleYearDayClick}
        />
        <div className="year-panel-settings">
          <button
            className="btn-settings"
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
            className={`btn-settings ${isCategoriesOpen ? 'active' : ''}`}
            onClick={() => { setIsCategoriesOpen(v => !v); setIsFormOpen(false); }}
            title="Manage categories"
          >
            ⚙
          </button>
        </div>
      </aside>

      {/* Days List - 200px fixed width */}
      <section className="days-panel">
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
      </section>

      {/* Detail Panel - flexible width */}
      <main className="detail-panel">
        {isCategoriesOpen ? (
          <CategoriesManager onClose={() => setIsCategoriesOpen(false)} />
        ) : isFormOpen ? (
          <EventForm
            event={selectedEvent}
            date={selectedDate}
            categories={categories}
            onSave={handleFormSave}
            onCancel={handleFormCancel}
          />
        ) : (
          <DetailPanel
            date={selectedDate}
            events={selectedDateEvents}
            categories={categories}
            loading={loading}
            onAdd={handleAddEvent}
            onEdit={handleEditEvent}
            onDelete={handleDeleteEvent}
            onReorder={onReorderEvents}
          />
        )}
      </main>
    </div>
  );
}

export default DesktopLayout;
