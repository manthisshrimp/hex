import { useState } from 'react';
import { authenticate, setAuthToken } from '../api';

function AdminAuth({ onAuth }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;

    setError('');
    setLoading(true);

    try {
      const token = await authenticate(password);
      localStorage.setItem('octiron_token', token);
      setAuthToken(token);
      onAuth(token);
    } catch {
      setError('The passphrase was rejected. Try again.');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-panel stone-panel">
        <h1 className="auth-title">HABITS</h1>
        <p className="auth-subtitle">Enter your passphrase</p>
        <form onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            disabled={loading}
            placeholder="············"
          />
          <button
            className="bevel-btn"
            type="submit"
            disabled={loading || !password.trim()}
            style={{ width: '100%', fontSize: '0.85rem' }}
          >
            {loading ? 'ENTERING…' : 'ENTER THE KEEP'}
          </button>
          {error && <p className="auth-error">{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default AdminAuth;
