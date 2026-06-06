import TaskItem from './TaskItem.jsx';

const FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Todo', value: 'todo' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
];

const SORT_OPTIONS = [
  { label: 'Due Date', value: 'dueDate' },
  { label: 'Priority', value: 'priority' },
  { label: 'Created At', value: 'createdAt' },
];

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function sortTasks(tasks, sortBy) {
  const sorted = [...tasks];
  if (sortBy === 'dueDate') {
    sorted.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  } else if (sortBy === 'priority') {
    sorted.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 99;
      const pb = PRIORITY_ORDER[b.priority] ?? 99;
      return pa - pb;
    });
  } else {
    // createdAt — newest first
    sorted.sort((a, b) => {
      const ta = a.createdAt || '';
      const tb = b.createdAt || '';
      return tb.localeCompare(ta);
    });
  }
  return sorted;
}

export default function TaskList({
  tasks,
  loading,
  onAdd,
  onEdit,
  onDelete,
  onStatusChange,
  filter,
  sort,
  onFilterChange,
  onSortChange,
}) {
  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
  const sorted = sortTasks(filtered, sort);

  return (
    <div>
      {/* Toolbar */}
      <div className="task-toolbar">
        <div className="filter-pills">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`filter-pill${filter === opt.value ? ' active' : ''}`}
              onClick={() => onFilterChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          className="sort-select"
          value={sort}
          onChange={e => onSortChange(e.target.value)}
          aria-label="Sort tasks by"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <span className="task-count">{sorted.length} task{sorted.length !== 1 ? 's' : ''}</span>

        <button className="btn btn-primary btn-sm" onClick={onAdd} style={{ marginLeft: 'auto' }}>
          + Add Task
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="loading-text">Loading tasks…</div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#9744;</div>
          <div className="empty-state-text">No tasks yet — add one above</div>
        </div>
      ) : (
        <div className="task-list">
          {sorted.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
