import React from 'react';

function EventItem({ event, categories = [], onEdit, onDelete }) {
  const cat = categories.find(c => c.id === event.categoryId);
  const color = cat?.color || event.color || '#6b7280';

  const handleEdit = (e) => { e.stopPropagation(); onEdit(event); };
  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Delete "${event.title}"?`)) onDelete(event.id);
  };

  const isAllDay = event.allDay || (!event.startTime && !event.endTime);
  const timeLabel = isAllDay ? 'All Day' : `${event.startTime} – ${event.endTime}`;

  return (
    <div className="event-item" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="event-item-content">
        <div className="event-details">
          <div className="event-item-meta">
            <span className="event-time">{timeLabel}</span>
            {cat && (
              <span className="event-category-badge" style={{ backgroundColor: color + '33', color }}>
                {cat.name}
              </span>
            )}
          </div>
          <div className="event-title">{event.title}</div>
          {event.description && (
            <div className="event-description">{event.description}</div>
          )}
        </div>
      </div>
      <div className="event-actions">
        <button type="button" className="btn-edit" onClick={handleEdit}>Edit</button>
        <button type="button" className="btn-delete" onClick={handleDelete}>Delete</button>
      </div>
    </div>
  );
}

export default EventItem;
