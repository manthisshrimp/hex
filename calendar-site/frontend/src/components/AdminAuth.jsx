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
      const res = await fetch('/calendar/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error('Invalid password');
      const { token } = await res.json();
      localStorage.setItem('octiron_token', token);
      onAuthenticate(token);
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
        <div className="auth-icon">📅</div>
        <h1>Calendar</h1>
        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Checking…' : 'Unlock'}
          </button>
        </form>
        {error && <p className="auth-error">{error}</p>}
      </div>
    </div>
  );
}
