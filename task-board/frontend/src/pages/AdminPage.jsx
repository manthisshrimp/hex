import { useState, useEffect } from 'react';
import {
  fetchAdminUsers,
  createUser,
  deleteUser,
  resetPassword,
  fetchPermissions,
  addGrant,
  removeGrant,
} from '../api.js';

// ============================================================
// Password display modal
// ============================================================
function PasswordModal({ title, username, password, onClose }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleBackdrop}>
      <div className="modal modal-sm" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Password for <strong>{username}</strong>:
          </p>
          <div className="password-display">{password}</div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Copy this password now — it will not be shown again.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Confirm modal
// ============================================================
function ConfirmModal({ message, onConfirm, onClose }) {
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleBackdrop}>
      <div className="modal modal-sm" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">Confirm</h2>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '14px' }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Users tab
// ============================================================
function UsersTab({ users, onRefresh }) {
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [pwModal, setPwModal] = useState(null); // { title, username, password }
  const [confirmDelete, setConfirmDelete] = useState(null); // username to delete
  const [actionError, setActionError] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    if (!newUsername.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const result = await createUser(newUsername.trim(), newPassword.trim() || undefined);
      setNewUsername('');
      setNewPassword('');
      setPwModal({ title: 'User Created', username: result.username, password: result.password });
      onRefresh();
    } catch (err) {
      setCreateError(err.message || 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  }

  async function handleReset(username) {
    setActionError('');
    try {
      const result = await resetPassword(username);
      setPwModal({ title: 'Password Reset', username, password: result.password });
    } catch (err) {
      setActionError(err.message || 'Failed to reset password.');
    }
  }

  async function handleDelete(username) {
    setActionError('');
    try {
      await deleteUser(username);
      setConfirmDelete(null);
      onRefresh();
    } catch (err) {
      setActionError(err.message || 'Failed to delete user.');
      setConfirmDelete(null);
    }
  }

  return (
    <div>
      {/* New user form */}
      <div className="section-title">Create User</div>
      <form className="new-user-form" onSubmit={handleCreate}>
        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            className="form-input"
            type="text"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            placeholder="new_user"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Password (optional)</label>
          <input
            className="form-input"
            type="text"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Leave blank to generate"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={creating || !newUsername.trim()}>
          {creating ? 'Creating…' : 'Create'}
        </button>
        {createError && <div className="form-error" style={{ width: '100%' }}>{createError}</div>}
      </form>

      {/* Users table */}
      <div className="section-title">All Users</div>
      {actionError && (
        <div className="error-text" style={{ marginBottom: '12px' }}>{actionError}</div>
      )}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Admin</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  No users found
                </td>
              </tr>
            )}
            {users.map(u => (
              <tr key={u.username}>
                <td><strong>{u.username}</strong></td>
                <td>
                  {u.isAdmin
                    ? <span className="bool-yes">Yes</span>
                    : <span className="bool-no">No</span>}
                </td>
                <td>
                  <div className="admin-actions-row">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleReset(u.username)}
                    >
                      Reset Password
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => setConfirmDelete(u.username)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Password modal */}
      {pwModal && (
        <PasswordModal
          title={pwModal.title}
          username={pwModal.username}
          password={pwModal.password}
          onClose={() => setPwModal(null)}
        />
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <ConfirmModal
          message={`Delete user "${confirmDelete}"? This cannot be undone.`}
          onConfirm={() => handleDelete(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Access tab
// ============================================================
function AccessTab({ users, grants, onRefresh }) {
  const [grantee, setGrantee] = useState('');
  const [owner, setOwner] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [removeError, setRemoveError] = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    if (!grantee || !owner) return;
    setAdding(true);
    setAddError('');
    try {
      await addGrant(grantee, owner);
      setGrantee('');
      setOwner('');
      onRefresh();
    } catch (err) {
      setAddError(err.message || 'Failed to add grant.');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(g, o) {
    setRemoveError('');
    try {
      await removeGrant(g, o);
      onRefresh();
    } catch (err) {
      setRemoveError(err.message || 'Failed to remove grant.');
    }
  }

  const userList = users.map(u => u.username);

  return (
    <div>
      {/* Add grant */}
      <div className="section-title">Add Access Grant</div>
      <form className="grant-form" onSubmit={handleAdd}>
        <div className="form-group">
          <label className="form-label">Grantee (who gets access)</label>
          <select
            className="form-select"
            value={grantee}
            onChange={e => setGrantee(e.target.value)}
          >
            <option value="">Select user…</option>
            {userList.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Owner (whose tasks)</label>
          <select
            className="form-select"
            value={owner}
            onChange={e => setOwner(e.target.value)}
          >
            <option value="">Select user…</option>
            {userList.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={adding || !grantee || !owner || grantee === owner}
        >
          {adding ? 'Granting…' : 'Grant'}
        </button>
        {addError && <div className="form-error" style={{ width: '100%' }}>{addError}</div>}
      </form>

      {/* Grants table */}
      <div className="section-title">Current Grants</div>
      {removeError && (
        <div className="error-text" style={{ marginBottom: '12px' }}>{removeError}</div>
      )}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Grantee</th>
              <th>Can access tasks of</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {grants.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  No access grants
                </td>
              </tr>
            )}
            {grants.map((g, i) => (
              <tr key={i}>
                <td>{g.grantee}</td>
                <td>{g.owner}</td>
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleRemove(g.grantee, g.owner)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// AdminPage
// ============================================================
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [grants, setGrants] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingGrants, setLoadingGrants] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [grantsError, setGrantsError] = useState('');

  useEffect(() => {
    loadUsers();
    loadGrants();
  }, []);

  async function loadUsers() {
    setLoadingUsers(true);
    setUsersError('');
    try {
      const data = await fetchAdminUsers();
      setUsers(data.users || data || []);
    } catch (err) {
      if (err.message !== 'Unauthorized' && err.message !== 'Forbidden') {
        setUsersError(err.message || 'Failed to load users.');
      }
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadGrants() {
    setLoadingGrants(true);
    setGrantsError('');
    try {
      const data = await fetchPermissions();
      setGrants(data.grants || data || []);
    } catch (err) {
      if (err.message !== 'Unauthorized' && err.message !== 'Forbidden') {
        setGrantsError(err.message || 'Failed to load permissions.');
      }
    } finally {
      setLoadingGrants(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Admin</h1>
      </div>

      <div className="page-body">
        <div className="tabs">
          <button
            className={`tab-btn${activeTab === 'users' ? ' active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button
            className={`tab-btn${activeTab === 'access' ? ' active' : ''}`}
            onClick={() => setActiveTab('access')}
          >
            Access
          </button>
        </div>

        {activeTab === 'users' && (
          loadingUsers
            ? <div className="loading-text">Loading users…</div>
            : usersError
              ? <div className="error-text">{usersError}</div>
              : <UsersTab users={users} onRefresh={loadUsers} />
        )}

        {activeTab === 'access' && (
          loadingGrants || loadingUsers
            ? <div className="loading-text">Loading…</div>
            : grantsError
              ? <div className="error-text">{grantsError}</div>
              : <AccessTab users={users} grants={grants} onRefresh={loadGrants} />
        )}
      </div>
    </div>
  );
}
