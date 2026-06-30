import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminAuth from './components/AdminAuth';
import HpBar from './components/HpBar';
import GoldDisplay from './components/GoldDisplay';
import BottomNav from './components/BottomNav';
import { FloatProvider } from './components/FloatLayer';
import { setAuthToken, setAuthFailureHandler, getCharacter, submitCheckin } from './api';
import { fmtNum } from './fmt';
import DashboardPage from './pages/DashboardPage';
import HabitsPage from './pages/HabitsPage';
import HistoryPage from './pages/HistoryPage';
import CharacterPage from './pages/CharacterPage';
import DeedsPage from './pages/DeedsPage';
import BossPage from './pages/BossPage';

const IMP_COLOR = {
  low: 'var(--color-imp-low)',
  medium: 'var(--color-imp-medium)',
  high: 'var(--color-imp-high)',
};

function App() {
  const [authToken, setAuth] = useState(() => {
    const stored = localStorage.getItem('octiron_token');
    if (stored) setAuthToken(stored);
    return stored;
  });

  const [hp, setHp] = useState(100);
  const [gold, setGold] = useState(0);
  const [damage, setDamage] = useState(0);
  const [armor, setArmor] = useState(0);
  const [renown, setRenown] = useState(0);
  const [characterName, setCharacterName] = useState(null);
  const [pendingCheckin, setPendingCheckin] = useState(null);
  const [checkinSelected, setCheckinSelected] = useState(new Set());
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('octiron_token');
    setAuthToken(null);
    setAuth(null);
  }, []);

  useEffect(() => {
    setAuthFailureHandler(handleLogout);
  }, [handleLogout]);

  useEffect(() => {
    if (pendingCheckin) {
      setCheckinSelected(new Set(pendingCheckin.map(h => h.id)));
    }
  }, [pendingCheckin]);

  const handleAuthenticate = (token) => {
    localStorage.setItem('octiron_token', token);
    setAuthToken(token);
    setAuth(token);
  };

  const refreshCharacter = useCallback(async () => {
    try {
      const res = await getCharacter();
      if (res.ok) {
        const data = await res.json();
        setHp(data.hp);
        setGold(data.gold);
        setDamage(data.damage ?? 0);
        setArmor(data.armor ?? 0);
        setRenown(data.renown ?? 0);
        setCharacterName(data.name ?? null);
        if (data.pendingCheckin?.length > 0) {
          setPendingCheckin(data.pendingCheckin);
        }
      }
    } catch {
      // auth failure handled by apiFetch
    }
  }, []);

  const handleCheckinSubmit = async () => {
    setCheckinSubmitting(true);
    try {
      const res = await submitCheckin([...checkinSelected]);
      if (res.ok) {
        const data = await res.json();
        setHp(data.hp);
        setGold(data.gold);
        setDamage(data.damage ?? 0);
        setArmor(data.armor ?? 0);
        setRenown(data.renown ?? 0);
        setCharacterName(data.name ?? null);
        setPendingCheckin(null);
      }
    } catch {
      // auth failure handled
    } finally {
      setCheckinSubmitting(false);
    }
  };

  const toggleCheckin = (id) => {
    setCheckinSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (authToken) {
      refreshCharacter();
    }
  }, [authToken, refreshCharacter]);

  if (!authToken) {
    return <AdminAuth onAuth={handleAuthenticate} />;
  }

  return (
    <BrowserRouter basename="/habits/">
      <FloatProvider>
        {pendingCheckin && (
          <div className="checkin-overlay">
            <div className="checkin-panel">
              <div className="checkin-title">Morning Reckoning</div>
              <div className="checkin-subtitle">
                These quests were due yesterday. Mark those you completed — the rest will exact their toll.
              </div>
              <div className="checkin-habit-list">
                {pendingCheckin.map(habit => (
                  <label key={habit.id} className="checkin-habit-row">
                    <input
                      type="checkbox"
                      checked={checkinSelected.has(habit.id)}
                      onChange={() => toggleCheckin(habit.id)}
                    />
                    <div className="checkin-habit-body">
                      <div className="checkin-habit-name">{habit.name}</div>
                      {habit.notes && (
                        <div className="checkin-habit-notes">{habit.notes}</div>
                      )}
                    </div>
                    <span
                      className="checkin-habit-imp"
                      style={{ color: IMP_COLOR[habit.importance] }}
                    >
                      {habit.importance}
                    </span>
                  </label>
                ))}
              </div>
              <button
                className="bevel-btn checkin-submit-btn"
                onClick={handleCheckinSubmit}
                disabled={checkinSubmitting}
              >
                {checkinSubmitting ? 'Processing...' : 'Confirm & Proceed'}
              </button>
            </div>
          </div>
        )}
        <div className="app-container">
          <header className="app-header">
            <span className="app-header-title">HABITS</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {(damage > 0 || armor > 0) && (
                <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', fontFamily: "'Cinzel', serif" }}>
                  {damage > 0 && (
                    <span style={{ color: '#e05555' }}>⚔{fmtNum(damage)}</span>
                  )}
                  {armor > 0 && (
                    <span style={{ color: 'var(--color-text-muted)' }}>🛡{fmtNum(armor)}</span>
                  )}
                </div>
              )}
              {renown > 0 && (
                <span style={{ fontSize: '0.75rem', fontFamily: "'Cinzel', serif", color: '#b8963e', letterSpacing: '0.05em' }}>
                  ✦{Math.floor(renown)}
                </span>
              )}
              <GoldDisplay gold={gold} />
            </div>
          </header>

          <HpBar hp={hp} />

          <Routes>
            <Route path="/" element={<DashboardPage hp={hp} gold={gold} refreshCharacter={refreshCharacter} />} />
            <Route path="/habits" element={<HabitsPage hp={hp} gold={gold} refreshCharacter={refreshCharacter} />} />
            <Route path="/character" element={<CharacterPage hp={hp} gold={gold} damage={damage} armor={armor} renown={renown} characterName={characterName} refreshCharacter={refreshCharacter} />} />
            <Route path="/chronicle" element={<HistoryPage />} />
            <Route path="/deeds" element={<DeedsPage renown={renown} refreshCharacter={refreshCharacter} />} />
            <Route path="/boss" element={<BossPage refreshCharacter={refreshCharacter} />} />
          </Routes>

          <BottomNav />
        </div>
      </FloatProvider>
    </BrowserRouter>
  );
}

export default App;
