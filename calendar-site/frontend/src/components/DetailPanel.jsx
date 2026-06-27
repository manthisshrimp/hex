import React from 'react';
import EventList from './EventList';

function DetailPanel({ date, events, categories = [], loading, onAdd, onEdit, onDelete, onReorder }) {
  const formattedDate = React.useMemo(() => {
    if (!date) return '';
    const dateObj = new Date(date + 'T00:00:00');
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [date]);

  const handleAdd = () => {
    onAdd();
  };

  const handleEdit = (event) => {
    onEdit(event);
  };

  const handleDelete = (eventId) => {
    onDelete(eventId);
  };

  if (loading) {
    return (
      <div className="detail-panel">
        <div className="detail-panel-header">
          <h2>Loading...</h2>
        </div>
        <div className="detail-panel-content">
          <div className="loading-spinner">Loading events...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-panel">
      <div className="detail-panel-header">
        <h2>{formattedDate}</h2>
        <button type="button" className="btn-add-header" onClick={handleAdd} title="Add event">+</button>
      </div>

      <div className="detail-panel-content">
        <EventList events={events} categories={categories} onEdit={handleEdit} onDelete={handleDelete} onReorder={onReorder} />
      </div>
    </div>
  );
}

export default DetailPanel;
