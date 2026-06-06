import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { setAuthToken, setAuthFailureHandler } from './api';
import LoginPage from './pages/LoginPage';
import RecordPage from './pages/RecordPage';

function ProtectedRoute({ token, children }) {
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('octiron_token'));

  useEffect(() => {
    if (token) setAuthToken(token);
  }, []);

  useEffect(() => {
    setAuthFailureHandler(() => {
      localStorage.removeItem('octiron_token');
      setToken(null);
    });
  }, []);

  const handleLogin = (t) => {
    localStorage.setItem('octiron_token', t);
    setAuthToken(t);
    setToken(t);
  };

  const handleLogout = () => {
    localStorage.removeItem('octiron_token');
    setAuthToken(null);
    setToken(null);
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={token ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />}
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute token={token}>
            <Routes>
              <Route path="/" element={<RecordPage />} />
            </Routes>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
