import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { SnackbarProvider } from './components/Snackbar.jsx';
import AdminAuth from './components/AdminAuth.jsx';
import YearsList from './components/YearsList.jsx';
import YearView from './components/YearView.jsx';
import MonthView from './components/MonthView.jsx';
import CategoriesManager from './components/CategoriesManager.jsx';
import { setAuthToken as apiSetAuthToken, setAuthFailureHandler } from './api.js';
import './index.css';

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;

function App() {
  const [authToken, setAuthToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on mount and register auth failure handler
  useEffect(() => {
    setAuthFailureHandler(() => {
      setAuthToken(null);
      localStorage.removeItem('octiron_token');
    });
    const token = localStorage.getItem('octiron_token');
    if (token) {
      apiSetAuthToken(token);
      setAuthToken(token);
    }
    setLoading(false);
  }, []);

  const handleAuthenticate = (token) => {
    apiSetAuthToken(token);
    setAuthToken(token);
  };

  const handleLogout = () => {
    apiSetAuthToken(null);
    localStorage.removeItem('octiron_token');
    setAuthToken(null);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Not authenticated - show login
  if (!authToken) {
    return <AdminAuth onAuthenticate={handleAuthenticate} />;
  }

  // Authenticated - show main app
  return (
    <SnackbarProvider>
      <Router basename="/expenses/">
        <div className="app">
          <header className="app-header">
            <h1>💰 Expense Tracker</h1>
            <Link to={`/month/${CURRENT_YEAR}/${CURRENT_MONTH}`} className="btn btn--secondary">
              This Month
            </Link>
            <button className="btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </header>
          <Routes>
            <Route path="/" element={<YearsList authToken={authToken} />} />
            <Route path="/year/:year" element={<YearView authToken={authToken} />} />
            <Route path="/month/:year/:month" element={<MonthView authToken={authToken} />} />
            <Route path="/categories" element={<CategoriesManager authToken={authToken} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </SnackbarProvider>
  );
}

export default App;
