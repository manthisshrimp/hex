import { useState, useEffect } from 'react';
import SectionHeader from '../components/SectionHeader';
import { getBoss, launchBoss, joinBoss, abandonBoss } from '../api';

const TIER_COLOR = { lesser: '#80b040', greater: '#4080c0', ancient: '#c04080', mythic: '#e0a020' };

function HpBar({ remaining, pool }) {
  const pct = pool > 0 ? Math.min(100, (remaining / pool) * 100) : 0;
  const felledPct = (100 - pct).toFixed(1);
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
        <span>{felledPct}% felled</span>
        <span>{remaining.toFixed(1)} / {pool.toFixed(1)} HP</span>
      </div>
      <div style={{ height: '8px', background: '#3a1010', borderRadius: '4px' }}>
        <div style={{ height: '100%', background: '#c04040', borderRadius: '4px', width: `${100 - pct}%` }} />
      </div>
    </div>
  );
}

function TierBadge({ tier }) {
  return (
    <span style={{
      fontSize: '0.65rem',
      color: TIER_COLOR[tier] ?? 'var(--color-text-muted)',
      border: `1px solid ${TIER_COLOR[tier] ?? 'var(--color-border)'}`,
      borderRadius: '3px',
      padding: '1px 6px',
      fontFamily: "'Cinzel', serif",
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    }}>
      {tier}
    </span>
  );
}

function shortenUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export default function BossPage({ refreshCharacter }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [launching, setLaunching] = useState(null);
  const [joining, setJoining] = useState(null);
  const [joinInput, setJoinInput] = useState('');

  async function reload() {
    try {
      const res = await getBoss();
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
  }

  useEffect(() => {
    getBoss()
      .then(res => res.ok ? res.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  async function handleLaunch(bossId) {
    setLaunching(bossId);
    try {
      const res = await launchBoss(bossId);
      if (!res.ok) { const b = await res.json().catch(() => ({})); alert(b.error || 'Launch failed'); return; }
      await reload();
      refreshCharacter();
    } finally { setLaunching(null); }
  }

  async function handleJoin(hostUrl) {
    setJoining(hostUrl);
    try {
      const raw = hostUrl.trim();
      const url = raw.startsWith('http') ? raw : `https://${raw}`;
      const res = await joinBoss(url);
      if (!res.ok) { const b = await res.json().catch(() => ({})); alert(b.error || 'Join failed'); return; }
      setJoinInput('');
      await reload();
      refreshCharacter();
    } finally { setJoining(null); }
  }

  async function handleAbandon() {
    if (!confirm('Abandon this quest?')) return;
    try {
      await abandonBoss();
      await reload();
      refreshCharacter();
    } catch { /* ignore */ }
  }

  if (loading) return <div className="page-content"><div className="loading-state">Loading...</div></div>;
  if (error) return <div className="page-content"><div className="empty-state">Failed to load boss data.</div></div>;

  const active = data?.active;
  const revealed = data?.revealed ?? [];
  const invitations = data?.invitations ?? [];
  const recent = data?.recent ?? [];
  const isEmpty = !active && !invitations.length && !revealed.length;

  return (
    <div className="page-content">

      {active && (() => {
        const { boss, quest, myContribution, myContributedToday, gear, leaderboard } = active;
        return (
          <>
            <SectionHeader>ACTIVE QUEST</SectionHeader>
            <div className="stone-panel" style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: '1rem', fontWeight: 700 }}>{boss.name}</span>
                <TierBadge tier={boss.tier} />
                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                  ⚜ {boss.rewardGold} reward
                </span>
              </div>

              <HpBar remaining={quest.hpRemaining} pool={quest.hpPool} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '10px' }}>
                <span style={{ color: myContributedToday ? '#4caf7d' : 'var(--color-text-muted)', fontStyle: myContributedToday ? 'normal' : 'italic' }}>
                  {myContributedToday ? '✓ Contributed today' : 'Not yet advanced today'}
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>
                  My p-score: <span style={{ color: 'var(--color-text)' }}>{myContribution.toFixed(2)}</span>
                </span>
              </div>

              {leaderboard?.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', letterSpacing: '0.1em', marginBottom: '4px' }}>LEADERBOARD</div>
                  {leaderboard.map((entry, i) => {
                    const isMe = entry.url.includes('localhost');
                    return (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: '0.73rem', padding: '3px 0',
                        color: isMe ? 'var(--color-text)' : 'var(--color-text-muted)',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}>
                        <span>{shortenUrl(entry.url)}{isMe && <span style={{ color: '#4caf7d', marginLeft: '6px', fontSize: '0.65rem' }}>(you)</span>}</span>
                        <span>{entry.total.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {gear?.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', letterSpacing: '0.1em', marginBottom: '6px' }}>GEAR</div>
                  {gear.map((g, i) => {
                    const pct = g.max > 0 ? (g.durability / g.max) * 100 : 0;
                    const barColor = pct < 25 ? '#c04040' : pct < 60 ? '#c08040' : '#4a7c59';
                    return (
                      <div key={i} style={{ marginBottom: '5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
                          <span>{g.name}</span>
                          <span>{g.durability}/{g.max}</span>
                        </div>
                        <div style={{ height: '4px', background: '#3a1010', borderRadius: '2px' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '2px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                className="bevel-btn"
                style={{ color: '#c04040', borderColor: '#6a2020', marginTop: '4px' }}
                onClick={handleAbandon}
              >
                ABANDON QUEST
              </button>
            </div>
          </>
        );
      })()}

      {invitations.length > 0 && (
        <>
          <SectionHeader>INVITATIONS</SectionHeader>
          {invitations.map((inv, i) => (
            <div key={i} className="stone-panel" style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{shortenUrl(inv.hostUrl)}</span>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: '0.85rem' }}>{inv.boss.name}</span>
                <TierBadge tier={inv.boss.tier} />
              </div>
              {inv.quest && <HpBar remaining={inv.quest.hpRemaining} pool={inv.quest.hpPool} />}
              <button
                className="bevel-btn"
                onClick={() => handleJoin(inv.hostUrl)}
                disabled={joining === inv.hostUrl || !!active}
              >
                {joining === inv.hostUrl ? 'Joining...' : 'JOIN'}
              </button>
            </div>
          ))}
        </>
      )}

      <SectionHeader>JOIN BY URL</SectionHeader>
      <div className="stone-panel" style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <input
          type="text"
          value={joinInput}
          onChange={e => setJoinInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && joinInput.trim() && handleJoin(joinInput)}
          placeholder="Host URL..."
          style={{
            flex: 1,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            color: 'var(--color-text)',
            padding: '7px 10px',
            fontSize: '0.82rem',
          }}
        />
        <button
          className="bevel-btn"
          onClick={() => joinInput.trim() && handleJoin(joinInput)}
          disabled={!joinInput.trim() || joining === joinInput.trim()}
        >
          {joining ? 'Joining...' : 'JOIN'}
        </button>
      </div>

      {revealed.length > 0 && (
        <>
          <SectionHeader>REVEALED THREATS</SectionHeader>
          {revealed.map(boss => (
            <div key={boss.id} className="stone-panel" style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: '0.9rem', fontWeight: 600 }}>{boss.name}</span>
                <TierBadge tier={boss.tier} />
                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--color-gold)' }}>⚜ {boss.rewardGold}</span>
              </div>
              {(boss.revealText || boss.lore) && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic', marginBottom: '8px' }}>
                  {boss.revealText || boss.lore}
                </div>
              )}
              <button
                className="bevel-btn"
                onClick={() => handleLaunch(boss.id)}
                disabled={launching === boss.id || !!active}
              >
                {launching === boss.id ? 'Launching...' : 'LAUNCH'}
              </button>
            </div>
          ))}
        </>
      )}

      {recent.length > 0 && (
        <>
          <SectionHeader>RECENT</SectionHeader>
          {recent.map((entry, i) => (
            <div key={i} className="stone-panel" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: '0.82rem' }}>{entry.boss.name}</span>
                <span style={{
                  marginLeft: '10px',
                  fontSize: '0.68rem',
                  color: entry.outcome === 'victory' ? '#4caf7d' : '#c04040',
                }}>
                  {entry.outcome === 'victory' ? '✓ Victory' : '✕ Abandoned'}
                </span>
                {entry.brokenGear?.length > 0 && (
                  <span style={{ marginLeft: '8px', fontSize: '0.68rem', color: '#c04040' }}>
                    💔 {entry.brokenGear.join(', ')}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                {entry.resolvedAt?.slice(0, 10)}
              </span>
            </div>
          ))}
        </>
      )}

      {isEmpty && (
        <div className="empty-state">No threats detected. Explore the world to reveal bosses.</div>
      )}
    </div>
  );
}
