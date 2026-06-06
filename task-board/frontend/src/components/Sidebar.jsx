import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../App.jsx';
import { fetchReceivedRequests } from '../api.js';

export default function Sidebar({ isOpen, onClose }) {
  const { username, isAdmin, canAccess, onLogout } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  // Users visible in the sidebar:
  // - canAccess list covers non-admin grants
  // - For admins we just show canAccess too; full user list is in Admin panel
  const otherUsers = canAccess.filter(u => u !== username);

  const showOthersSection = otherUsers.length > 0 || isAdmin;

  function handleNavClick() {
    // Close drawer on mobile when a link is clicked
    onClose();
  }

  // Poll for pending received requests count
  useEffect(() => {
    function loadCount() {
      fetchReceivedRequests()
        .then(data => {
          const pending = (data.requests || []).filter(r => r.status === 'pending');
          setPendingCount(pending.length);
        })
        .catch(() => {});
    }

    loadCount();
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <nav className={`sidebar${isOpen ? ' open' : ''}`}>
        <div className="sidebar-title">Task Board</div>

        {/* Primary nav */}
        <div className="sidebar-section">
          <div className="sidebar-nav">
            <NavLink to="/" end onClick={handleNavClick}>
              My Tasks
            </NavLink>
            <NavLink
              to="/requests"
              onClick={handleNavClick}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              Requests
              {pendingCount > 0 && (
                <span style={{
                  marginLeft: 'auto',
                  background: 'var(--danger)',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  minWidth: '18px',
                  textAlign: 'center',
                }}>
                  {pendingCount}
                </span>
              )}
            </NavLink>
          </div>
        </div>

        {/* Other users section */}
        {showOthersSection && (
          <div className="sidebar-section">
            <div className="sidebar-section-label">Other Users</div>
            <div className="sidebar-nav">
              {otherUsers.map(u => (
                <NavLink key={u} to={`/tasks/${u}`} onClick={handleNavClick}>
                  {u}
                </NavLink>
              ))}
              {isAdmin && otherUsers.length === 0 && (
                <span className="sidebar-nav-link" style={{ fontSize: '13px', opacity: 0.6 }}>
                  See Admin panel for all users
                </span>
              )}
            </div>
          </div>
        )}

        {/* Admin link */}
        {isAdmin && (
          <div className="sidebar-section">
            <div className="sidebar-nav">
              <NavLink to="/admin" onClick={handleNavClick}>
                Admin
              </NavLink>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-username" title={username}>
            {username}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </nav>
    </>
  );
}
