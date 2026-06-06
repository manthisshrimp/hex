import { useState } from 'react';
import './AdminAuth.css';

export default function AdminAuth({ onAuthenticate }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/expenses/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (!res.ok) {
        throw new Error('Invalid password');
      }

      const data = await res.json();
      localStorage.setItem('octiron_token', data.token);
      onAuthenticate(data.token);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
      setPassword('');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>💰 Expense Tracker</h1>
        <p className="auth-subtitle">Admin Access</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>

        {error && <p className="error-message">{error}</p>}
        <p className="auth-info">
          Password is required to view and manage expenses.
        </p>
      </div>
    </div>
  );
}
