import { useState } from 'react';

const PRIORITY_LABELS = { low: 'LOW', medium: 'MED', high: 'HIGH' };
const PRIORITY_CLASSES = {
  low: 'badge badge-priority-low',
  medium: 'badge badge-priority-medium',
  high: 'badge badge-priority-high',
};

const STATUS_CYCLE = { todo: 'in_progress', in_progress: 'done', done: 'todo' };

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
}

function isOverdue(dateStr, status) {
  if (!dateStr || status === 'done') return false;
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export default function TaskItem({ task, onEdit, onDelete, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);

  const desc = task.description || '';
  const descTruncated = desc.length > 80 ? desc.slice(0, 80) + '…' : desc;
  const hasMore = desc.length > 80;

  function handleStatusClick() {
    const next = STATUS_CYCLE[task.status] || 'todo';
    onStatusChange(task.id, next);
  }

  const overdue = isOverdue(task.dueDate, task.status);
  const formattedDate = formatDate(task.dueDate);

  return (
    <div className="task-item">
      {/* Status circle */}
      <button
        className={`status-circle ${task.status}`}
        onClick={handleStatusClick}
        title={`Status: ${task.status.replace('_', ' ')} — click to advance`}
        aria-label={`Task status: ${task.status}`}
      >
        {task.status === 'done' ? '✓' : task.status === 'in_progress' ? '●' : ''}
      </button>

      {/* Body */}
      <div className="task-body">
        <div className={`task-title${task.status === 'done' ? ' done' : ''}`}>
          {task.title}
        </div>

        <div className="task-meta">
          {task.priority && (
            <span className={PRIORITY_CLASSES[task.priority]}>
              {PRIORITY_LABELS[task.priority]}
            </span>
          )}
          {formattedDate && (
            <span className={`due-date${overdue ? ' overdue' : ''}`}>
              {overdue ? '⚠ ' : ''}{formattedDate}
            </span>
          )}
        </div>

        {desc && (
          <div>
            <div
              className="task-description"
              onClick={() => hasMore && setExpanded(e => !e)}
              style={{ cursor: hasMore ? 'pointer' : 'default' }}
            >
              {expanded ? desc : descTruncated}
            </div>
            {hasMore && (
              <button
                className="task-description-toggle"
                onClick={() => setExpanded(e => !e)}
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="task-actions">
        <button
          className="task-action-btn"
          onClick={() => onEdit(task)}
          title="Edit task"
          aria-label="Edit task"
        >
          ✎
        </button>
        <button
          className="task-action-btn danger"
          onClick={() => onDelete(task.id)}
          title="Delete task"
          aria-label="Delete task"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
