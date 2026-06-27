import React from 'react';
import EventItem from './EventItem';

// Manual order wins; ties fall back to all-day first, then start time.
function sortEvents(events) {
  return [...events].sort((a, b) => {
    if ((a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0);
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    return 0;
  });
}

function EventList({ events, categories = [], onEdit, onDelete, onReorder }) {
  const sortedEvents = sortEvents(events);
  const [dragId, setDragId] = React.useState(null);

  if (events.length === 0) {
    return (
      <div className="event-list-empty">
        No events for this day
      </div>
    );
  }

  const handleDrop = (targetId) => {
    if (!onReorder || !dragId || dragId === targetId) return;
    const ids = sortedEvents.map(e => e.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onReorder(sortedEvents[0].date, ids);
    setDragId(null);
  };

  return (
    <div className="event-list">
      {sortedEvents.map((event) => (
        <div
          key={event.id}
          // ponytail: native HTML5 DnD — desktop only; add pointer-based DnD if touch reorder is needed
          draggable={!!onReorder}
          onDragStart={() => setDragId(event.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(event.id)}
          className={dragId === event.id ? 'event-dragging' : ''}
        >
          <EventItem
            event={event}
            categories={categories}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      ))}
    </div>
  );
}

export default EventList;
