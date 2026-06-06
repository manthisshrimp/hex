import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App.jsx';
import {
  fetchReceivedRequests,
  fetchSentRequests,
  sendRequest,
  acceptRequest,
  declineRequest,
  fetchUsers,
} from '../api.js';

// ============================================================
// Helpers
// ============================================================
function priorityLabel(p) {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function priorityClass(p) {
  if (p === 'high') return 'badge badge-priority-high';
  if (p === 'medium') return 'badge badge-priority-medium';
  return 'badge badge-priority-low';
}

function formatDate(d) {
  if (!d) return null;
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ============================================================
// New Request Modal
// ============================================================
function NewRequestModal({ onClose, onSent }) {
  const { username: currentUser } = useAuth();
  const [toUsername, setToUsername] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchUsers()
      .then(data => {
        const others = (data.users || []).filter(u => u !== currentUser);
        setUsers(others);
        if (others.length > 0) setToUsername(others[0]);
      })
      .catch(() => {});
  }, [currentUser]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!toUsername || !title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await sendRequest({
        toUsername,
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate: dueDate || null,
      });
      onSent();
      onClose();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">New Request</span>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error error-text">{error}</div>}
            <div className="form-group">
              <label className="form-label">To *</label>
              <select
                className="form-select"
                value={toUsername}
                onChange={e => setToUsername(e.target.value)}
                required
                autoFocus
              >
                {users.length === 0 && <option value="">No other users</option>}
                {users.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input
                className="form-input"
                type="text"
                placeholder="Task title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                placeholder="Optional description"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                className="form-select"
                value={priority}
                onChange={e => setPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input
                className="form-input"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !toUsername || !title.trim()}>
              {submitting ? 'Sending…' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Received tab
// ============================================================
function ReceivedTab({ onCountChange }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inFlight, setInFlight] = useState({}); // id → true
  const [successMsg, setSuccessMsg] = useState({}); // id → message

  useEffect(() => {
    fetchReceivedRequests()
      .then(data => setRequests(data.requests || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleAccept(id) {
    setInFlight(f => ({ ...f, [id]: true }));
    try {
      await acceptRequest(id);
      setRequests(rs => {
        const updated = rs.filter(r => r.id !== id);
        onCountChange(updated.filter(r => r.status === 'pending').length);
        return updated;
      });
      setSuccessMsg(m => ({ ...m, [id]: 'Task added to your list' }));
    } catch (err) {
      setInFlight(f => { const n = { ...f }; delete n[id]; return n; });
      setError(err.message);
    }
  }

  async function handleDecline(id) {
    setInFlight(f => ({ ...f, [id]: true }));
    try {
      await declineRequest(id);
      setRequests(rs => {
        const updated = rs.filter(r => r.id !== id);
        onCountChange(updated.filter(r => r.status === 'pending').length);
        return updated;
      });
    } catch (err) {
      setInFlight(f => { const n = { ...f }; delete n[id]; return n; });
      setError(err.message);
    }
  }

  if (loading) return <p className="loading-text">Loading…</p>;
  if (error) return <div className="error-text">{error}</div>;

  const pending = requests.filter(r => r.status === 'pending');

  if (pending.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📬</div>
        <p className="empty-state-text">No pending requests</p>
      </div>
    );
  }

  return (
    <div className="task-list">
      {pending.map(req => (
        <div key={req.id} className="request-card">
          <div className="request-card-header">
            <span className="request-card-title">{req.title}</span>
            <span className={priorityClass(req.priority)}>{priorityLabel(req.priority)}</span>
          </div>
          <div className="request-card-meta">
            <span>From: <strong>{req.fromUsername}</strong></span>
            {req.dueDate && <span>Due: {formatDate(req.dueDate)}</span>}
          </div>
          {req.description && <p className="request-card-desc">{req.description}</p>}
          <div className="request-card-actions">
            <button
              className="btn btn-primary btn-sm"
              disabled={!!inFlight[req.id]}
              onClick={() => handleAccept(req.id)}
            >
              Accept
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
              disabled={!!inFlight[req.id]}
              onClick={() => handleDecline(req.id)}
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Sent tab
// ============================================================
function SentTab() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSentRequests()
      .then(data => setRequests(data.requests || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading-text">Loading…</p>;
  if (error) return <div className="error-text">{error}</div>;

  if (requests.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📤</div>
        <p className="empty-state-text">No requests sent yet</p>
      </div>
    );
  }

  function statusBadgeClass(status) {
    if (status === 'accepted') return 'badge badge-status-accepted';
    if (status === 'declined') return 'badge badge-status-declined';
    return 'badge badge-status-pending';
  }

  function statusLabel(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  return (
    <div className="task-list">
      {requests.map(req => (
        <div key={req.id} className="request-card">
          <div className="request-card-header">
            <span className="request-card-title">{req.title}</span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span className={priorityClass(req.priority)}>{priorityLabel(req.priority)}</span>
              <span className={statusBadgeClass(req.status)}>{statusLabel(req.status)}</span>
            </div>
          </div>
          <div className="request-card-meta">
            <span>To: <strong>{req.toUsername}</strong></span>
            {req.dueDate && <span>Due: {formatDate(req.dueDate)}</span>}
            {req.status === 'accepted' && (
              <span style={{ color: 'var(--success)', fontSize: '12px' }}>
                Added to {req.toUsername}'s task list
              </span>
            )}
            {req.status === 'declined' && (
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Declined</span>
            )}
          </div>
          {req.description && <p className="request-card-desc">{req.description}</p>}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// RequestsPage
// ============================================================
export default function RequestsPage() {
  const [activeTab, setActiveTab] = useState('received');
  const [showModal, setShowModal] = useState(false);
  const [sentKey, setSentKey] = useState(0); // force re-mount of SentTab to refresh
  const [receivedCount, setReceivedCount] = useState(null);

  // Fetch pending count for tab label
  const refreshReceivedCount = useCallback(() => {
    fetchReceivedRequests()
      .then(data => {
        const pending = (data.requests || []).filter(r => r.status === 'pending');
        setReceivedCount(pending.length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshReceivedCount();
  }, [refreshReceivedCount]);

  function handleSent() {
    if (activeTab === 'sent') {
      setSentKey(k => k + 1);
    }
    refreshReceivedCount();
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Requests</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Request
        </button>
      </div>

      <div className="page-body">
        <div className="tabs">
          <button
            className={`tab-btn${activeTab === 'received' ? ' active' : ''}`}
            onClick={() => setActiveTab('received')}
          >
            Received{receivedCount !== null && receivedCount > 0 ? ` (${receivedCount})` : ''}
          </button>
          <button
            className={`tab-btn${activeTab === 'sent' ? ' active' : ''}`}
            onClick={() => setActiveTab('sent')}
          >
            Sent
          </button>
        </div>

        {activeTab === 'received' && <ReceivedTab key="received" onCountChange={setReceivedCount} />}
        {activeTab === 'sent' && <SentTab key={`sent-${sentKey}`} />}
      </div>

      {showModal && (
        <NewRequestModal
          onClose={() => setShowModal(false)}
          onSent={handleSent}
        />
      )}
    </>
  );
}
