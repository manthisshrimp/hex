import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
  setAuthToken,
  setAuthFailureHandler,
  fetchMe,
} from './api.js';
import Sidebar from './components/Sidebar.jsx';
import LoginPage from './components/AdminAuth.jsx';
import MyTasksPage from './pages/MyTasksPage.jsx';
import UserTasksPage from './pages/UserTasksPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import RequestsPage from './pages/RequestsPage.jsx';

// ============================================================
// Auth context
// ============================================================
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

// ============================================================
// App
// ============================================================
export default function App() {
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canAccess, setCanAccess] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // On 401 — clear everything
  const handleAuthFailure = useCallback(() => {
    localStorage.removeItem('tasksAuthToken');
    localStorage.removeItem('tasksUsername');
    setToken(null);
    setUsername(null);
    setIsAdmin(false);
    setCanAccess([]);
  }, []);

  // Register auth failure handler once
  useEffect(() => {
    setAuthFailureHandler(handleAuthFailure);
  }, [handleAuthFailure]);

  // Hydrate from localStorage on mount
  useEffect(() => {
    async function hydrate() {
      const savedToken = localStorage.getItem('tasksAuthToken');
      const savedUsername = localStorage.getItem('tasksUsername');

      if (savedToken && savedUsername) {
        setAuthToken(savedToken, savedUsername);
        try {
          const me = await fetchMe();
          setToken(savedToken);
          setUsername(me.username);
          setIsAdmin(me.isAdmin);
          setCanAccess(me.canAccess || []);
        } catch {
          // fetchMe failed — clear storage
          localStorage.removeItem('tasksAuthToken');
          localStorage.removeItem('tasksUsername');
          setAuthToken(null, null);
        }
      }

      setLoading(false);
      setAuthChecked(true);
    }

    hydrate();
  }, []);

  const handleLogin = useCallback(async ({ token: t, username: u, isAdmin: admin }) => {
    setAuthToken(t, u);
    let me;
    try {
      me = await fetchMe();
    } catch {
      me = { username: u, isAdmin: admin, canAccess: [] };
    }
    localStorage.setItem('tasksAuthToken', t);
    localStorage.setItem('tasksUsername', u);
    setToken(t);
    setUsername(me.username);
    setIsAdmin(me.isAdmin);
    setCanAccess(me.canAccess || []);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('tasksAuthToken');
    localStorage.removeItem('tasksUsername');
    setAuthToken(null, null);
    setToken(null);
    setUsername(null);
    setIsAdmin(false);
    setCanAccess([]);
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="loading-text">Loading…</span>
      </div>
    );
  }

  if (authChecked && !token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const authValue = {
    token,
    username,
    isAdmin,
    canAccess,
    onLogout: handleLogout,
  };

  return (
    <AuthContext.Provider value={authValue}>
      <BrowserRouter basename="/todo/">
        <AppLayout />
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

// ============================================================
// App layout (sidebar + routes)
// ============================================================
function AppLayout() {
  const { isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout" style={{ flexDirection: 'column', height: '100%' }}>
      {/* Mobile header */}
      <header className="mobile-header">
        <button
          className="hamburger-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          &#9776;
        </button>
        <span className="mobile-app-title">Task Board</span>
      </header>

      {/* Main row */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar overlay (mobile) */}
        <div
          className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="main-content">
          <Routes>
            <Route path="/" element={<MyTasksPage />} />
            <Route path="/tasks/:username" element={<UserTasksPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route
              path="/admin"
              element={isAdmin ? <AdminPage /> : <Navigate to="/" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
