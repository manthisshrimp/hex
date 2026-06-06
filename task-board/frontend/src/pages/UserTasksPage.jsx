import { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { fetchTasks, createTask, updateTask, deleteTask } from '../api.js';
import TaskList from '../components/TaskList.jsx';
import TaskForm from '../components/TaskForm.jsx';

export default function UserTasksPage() {
  const { username: pageUsername } = useParams();
  const { username: myUsername, isAdmin, canAccess } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('createdAt');
  const [formTask, setFormTask] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  // Access check
  const hasAccess = isAdmin || canAccess.includes(pageUsername);

  useEffect(() => {
    if (!hasAccess) return;
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageUsername, hasAccess]);

  async function loadTasks() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTasks(pageUsername);
      setTasks(data.tasks || []);
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        setError(err.message || 'Failed to load tasks.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  function openAdd() {
    setFormTask(null);
    setFormOpen(true);
  }

  function openEdit(task) {
    setFormTask(task);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setFormTask(null);
  }

  async function handleSave(data) {
    if (formTask) {
      const updated = await updateTask(pageUsername, formTask.id, data);
      setTasks(prev => prev.map(t => t.id === formTask.id ? { ...t, ...updated } : t));
    } else {
      const created = await createTask(pageUsername, data);
      setTasks(prev => [created, ...prev]);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this task?')) return;
    try {
      await deleteTask(pageUsername, id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete task.');
    }
  }

  async function handleStatusChange(id, newStatus) {
    const prev = tasks.find(t => t.id === id);
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status: newStatus } : t));
    try {
      const updated = await updateTask(pageUsername, id, { ...prev, status: newStatus });
      setTasks(ts => ts.map(t => t.id === id ? { ...t, ...updated } : t));
    } catch {
      setTasks(ts => ts.map(t => t.id === id ? prev : t));
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tasks — {pageUsername}</h1>
      </div>

      <div className="page-body">
        {error && <div className="error-text" style={{ marginBottom: '16px' }}>{error}</div>}

        <TaskList
          tasks={tasks}
          loading={loading}
          onAdd={openAdd}
          onEdit={openEdit}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          filter={filter}
          sort={sort}
          onFilterChange={setFilter}
          onSortChange={setSort}
        />
      </div>

      {formOpen && (
        <TaskForm
          task={formTask}
          username={pageUsername}
          onSave={handleSave}
          onClose={closeForm}
        />
      )}
    </div>
  );
}
