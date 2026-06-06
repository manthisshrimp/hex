import React from 'react';
import EventItem from './EventItem';

function EventList({ events, categories = [], onEdit, onDelete }) {
  const sortedEvents = [...events].sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    if (a.startTime && b.startTime) {
      return a.startTime.localeCompare(b.startTime);
    }
    return 0;
  });

  if (events.length === 0) {
    return (
      <div className="event-list-empty">
        No events for this day
      </div>
    );
  }

  return (
    <div className="event-list">
      {sortedEvents.map((event) => (
        <EventItem
          key={event.id}
          event={event}
          categories={categories}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export default EventList;
