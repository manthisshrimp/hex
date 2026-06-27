import React from 'react';

function EventForm({ event, date, categories = [], onSave, onCancel }) {
  const [formData, setFormData] = React.useState({
    id: event?.id || undefined,
    title: event?.title || '',
    date: event?.date || date || new Date().toISOString().split('T')[0],
    allDay: event?.allDay ?? true,
    startTime: event?.startTime || '09:00',
    endTime: event?.endTime || '17:00',
    categoryId: event?.categoryId || categories?.[0]?.id || '',
    description: event?.description || '',
    partial: event?.partial ?? false,
  });

  const [errors, setErrors] = React.useState({});

  // Update categoryId default when categories load after mount
  React.useEffect(() => {
    if (!formData.categoryId && categories.length > 0) {
      setFormData(prev => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [categories]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }
    if (!formData.allDay && (!formData.startTime || !formData.endTime)) {
      newErrors.time = 'Start and end times are required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSave(formData);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const isEditing = !!event;

  return (
    <form className="event-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <div className="event-form-header">
        <h3>{isEditing ? 'Edit Event' : 'Add Event'}</h3>
        <button type="button" className="btn-close" onClick={onCancel} aria-label="Close">
          ×
        </button>
      </div>

      <div className="event-form-body">
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            type="text"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            className={errors.title ? 'error' : ''}
            placeholder="Event title"
          />
          {errors.title && <span className="error-message">{errors.title}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="date">Date</label>
          <input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => handleChange('date', e.target.value)}
            className={errors.date ? 'error' : ''}
          />
          {errors.date && <span className="error-message">{errors.date}</span>}
        </div>

        <div className="form-group">
          <div className="checkbox-wrapper">
            <input
              id="allDay"
              type="checkbox"
              checked={formData.allDay}
              onChange={(e) => handleChange('allDay', e.target.checked)}
            />
            <label htmlFor="allDay">All Day Event</label>
          </div>
        </div>

        <div className="form-group">
          <div className="checkbox-wrapper">
            <input
              id="partial"
              type="checkbox"
              checked={formData.partial}
              onChange={(e) => handleChange('partial', e.target.checked)}
            />
            <label htmlFor="partial">Partial (striped on minimap, day shows through)</label>
          </div>
        </div>

        {!formData.allDay && (
          <div className="form-group form-group-inline">
            <div>
              <label htmlFor="startTime">Start Time</label>
              <input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => handleChange('startTime', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="endTime">End Time</label>
              <input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => handleChange('endTime', e.target.value)}
              />
            </div>
            {errors.time && <span className="error-message">{errors.time}</span>}
          </div>
        )}

        <div className="form-group">
          <label>Category</label>
          {categories.length === 0 ? (
            <p className="category-placeholder">Loading categories...</p>
          ) : (
            <div className="category-select">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-option ${formData.categoryId === cat.id ? 'selected' : ''}`}
                  onClick={() => handleChange('categoryId', cat.id)}
                >
                  <span className="category-dot" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Event description (optional)"
            rows={3}
          />
        </div>
      </div>

      <div className="event-form-footer">
        <button type="button" className="btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-save">
          {isEditing ? 'Update' : 'Add Event'}
        </button>
      </div>
    </form>
  );
}

export default EventForm;
