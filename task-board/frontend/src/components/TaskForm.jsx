import { useState, useEffect, useRef } from 'react';

const DEFAULT_FORM = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: '',
};

export default function TaskForm({ task, username, onSave, onClose }) {
  const isEdit = !!task;
  const [form, setForm] = useState(
    task
      ? {
          title: task.title || '',
          description: task.description || '',
          status: task.status || 'todo',
          priority: task.priority || 'medium',
          dueDate: task.dueDate || '',
        }
      : DEFAULT_FORM
  );
  const [titleError, setTitleError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Close on ESC
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    if (field === 'title') setTitleError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setTitleError('Title is required.');
      titleRef.current?.focus();
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await onSave({
        title: form.title.trim(),
        description: form.description.trim(),
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || null,
      });
      onClose();
    } catch (err) {
      setSaveError(err.message || 'Failed to save task.');
    } finally {
      setSaving(false);
    }
  }

  // Enter key in non-textarea fields submits
  function handleKeyDown(e) {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="modal-overlay" onClick={handleBackdrop}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="task-form-title">
        <div className="modal-header">
          <h2 className="modal-title" id="task-form-title">
            {isEdit ? 'Edit Task' : 'New Task'}
          </h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
          <div className="modal-body">
            {/* Title */}
            <div className="form-group">
              <label className="form-label" htmlFor="task-title">Title *</label>
              <input
                id="task-title"
                ref={titleRef}
                className="form-input"
                type="text"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Task title"
              />
              {titleError && <div className="form-error">{titleError}</div>}
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label" htmlFor="task-desc">Description</label>
              <textarea
                id="task-desc"
                className="form-textarea"
                rows={3}
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Optional details…"
              />
            </div>

            {/* Status + Priority */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '120px' }}>
                <label className="form-label" htmlFor="task-status">Status</label>
                <select
                  id="task-status"
                  className="form-select"
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                >
                  <option value="todo">Todo</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <div className="form-group" style={{ flex: 1, minWidth: '120px' }}>
                <label className="form-label" htmlFor="task-priority">Priority</label>
                <select
                  id="task-priority"
                  className="form-select"
                  value={form.priority}
                  onChange={e => set('priority', e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Due Date */}
            <div className="form-group">
              <label className="form-label" htmlFor="task-due">Due Date</label>
              <input
                id="task-due"
                className="form-input"
                type="date"
                value={form.dueDate || ''}
                onChange={e => set('dueDate', e.target.value)}
              />
            </div>

            {saveError && <div className="form-error">{saveError}</div>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
