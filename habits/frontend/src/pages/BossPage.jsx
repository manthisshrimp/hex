import { useState, useEffect } from 'react';
import SectionHeader from '../components/SectionHeader';
import { getBoss, launchBoss, joinBoss, abandonBoss } from '../api';
import { getTodayStr, daysBetween } from '../utils';

const TIER_COLOR = { lesser: '#80b040', greater: '#4080c0', ancient: '#c04080', mythic: '#e0a020' };

// Boss HP and contributions are stored in p-units (0–1 per player-day). Scale
// up for display so the numbers read like a real health bar.
const HP_SCALE = 100;
const dmg = (p) => Math.round(p * HP_SCALE);

function HpBar({ remaining, pool }) {
  const pct = pool > 0 ? Math.max(0, Math.min(100, (remaining / pool) * 100)) : 0;
  const felledPct = (100 - pct).toFixed(1);
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
        <span>{dmg(Math.max(0, remaining))} / {dmg(pool)} HP</span>
        <span>{felledPct}% felled</span>
      </div>
      <div style={{ height: '8px', background: '#2a0c0c', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: '#c04040', borderRadius: '4px', width: `${pct}%`, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

function TimeBar({ endsAt, durationDays }) {
  const daysLeft = Math.max(0, daysBetween(getTodayStr(), endsAt));
  const pct = durationDays > 0 ? Math.max(0, Math.min(100, (daysLeft / durationDays) * 100)) : 0;
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
        <span>{daysLeft} {daysLeft === 1 ? 'day' : 'days'} remaining</span>
        <span>ends {endsAt}</span>
      </div>
      <div style={{ height: '6px', background: '#0d1a22', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: '#3a90b0', borderRadius: '3px', width: `${pct}%`, transition: 'width 0.4s' }} />
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

// Difficulty hint: duration · scaled HP · damage multiplier · soloable?
function DifficultyLine({ boss }) {
  return (
    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
      {boss.durationDays}d · {dmg(boss.baseHp)} HP · ×{boss.damageMultiplier} dmg ·{' '}
      <span style={{ color: boss.soloable ? '#4caf7d' : '#c08040' }}>
        {boss.soloable ? 'soloable' : 'needs a party'}
      </span>
    </div>
  );
}

// One-time victory screen: announces the kill and the reward that actually
// rolled (gold always; item/heal only if they dropped).
function VictoryModal({ entry, onClose }) {
  const r = entry.reward || {};
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} className="stone-panel" style={{ maxWidth: '360px', width: '100%', padding: '22px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: '1.4rem', color: '#4caf7d', letterSpacing: '0.1em', marginBottom: '4px' }}>VICTORY</div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', marginBottom: '18px' }}>
          <span style={{ fontFamily: "'Cinzel', serif" }}>{entry.boss.name}</span>
          <TierBadge tier={entry.boss.tier} />
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', letterSpacing: '0.12em', marginBottom: '10px' }}>SPOILS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
          <div style={{ color: 'var(--color-gold)', fontSize: '1rem' }}>⚜ {Math.round(r.gold || 0)} gold</div>
          <div style={{ fontSize: '0.9rem', color: r.item ? '#c08040' : 'var(--color-text-muted)' }}>
            {r.item ? `🗡 ${r.item}` : '🗡 No item dropped'}
          </div>
          <div style={{ fontSize: '0.9rem', color: r.heal > 0 ? '#4caf7d' : 'var(--color-text-muted)' }}>
            {r.heal > 0 ? `♥ +${Math.round(r.heal)} HP` : '♥ No heal'}
          </div>
        </div>
        {entry.brokenGear?.length > 0 && (
          <div style={{ fontSize: '0.72rem', color: '#c04040', marginBottom: '16px' }}>
            💔 Broke: {entry.brokenGear.join(', ')}
          </div>
        )}
        <button className="rune-btn" onClick={onClose} style={{ width: '100%' }}>Claim</button>
      </div>
    </div>
  );
}

function LeaderboardList({ leaderboard }) {
  if (!leaderboard?.length) return null;
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', letterSpacing: '0.1em', marginBottom: '4px' }}>LEADERBOARD</div>
      {leaderboard.map((entry, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: '0.73rem', padding: '3px 0',
          color: entry.isMe ? 'var(--color-text)' : 'var(--color-text-muted)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          <span>{entry.name}{entry.isMe && <span style={{ color: '#4caf7d', marginLeft: '6px', fontSize: '0.65rem' }}>(you)</span>}</span>
          <span>{dmg(entry.total)}</span>
        </div>
      ))}
    </div>
  );
}

// Read-only recap of a resolved fight: outcome, final HP, leaderboard, spoils.
function RecentDetailModal({ entry, onClose }) {
  const { boss, outcome, reward, brokenGear, quest, leaderboard, myContribution = 0, resolvedAt } = entry;
  const label = outcome === 'victory' ? '✓ Victory' : outcome === 'defeat' ? '✕ Defeat' : '⚐ Abandoned';
  const color = outcome === 'victory' ? '#4caf7d' : outcome === 'abandoned' ? '#c0a040' : '#c04040';
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} className="stone-panel" style={{ maxWidth: '380px', width: '100%', padding: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <span style={{ fontFamily: "'Cinzel', serif", fontSize: '1rem', fontWeight: 700 }}>{boss.name}</span>
          <TierBadge tier={boss.tier} />
        </div>
        <div style={{ fontSize: '0.72rem', marginBottom: '10px' }}>
          <span style={{ color }}>{label}</span>
          <span style={{ color: 'var(--color-text-muted)', marginLeft: '8px' }}>{resolvedAt?.slice(0, 10)}</span>
        </div>
        {quest && <HpBar remaining={quest.hpRemaining} pool={quest.hpPool} />}
        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.75rem', marginBottom: '10px', color: 'var(--color-text-muted)' }}>
          Damage dealt:&nbsp;<span style={{ color: 'var(--color-text)' }}>{dmg(myContribution)}</span>
        </div>
        <LeaderboardList leaderboard={leaderboard} />
        {outcome === 'victory' && reward && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', letterSpacing: '0.1em', marginBottom: '4px' }}>SPOILS</div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--color-gold)' }}>⚜ {Math.round(reward.gold || 0)}</span>
              {reward.item && <span style={{ color: '#c08040' }}>🗡 {reward.item}</span>}
              {reward.heal > 0 && <span style={{ color: '#4caf7d' }}>♥ +{Math.round(reward.heal)}</span>}
            </div>
          </div>
        )}
        {brokenGear?.length > 0 && (
          <div style={{ fontSize: '0.72rem', color: '#c04040', marginBottom: '12px' }}>💔 Broke: {brokenGear.join(', ')}</div>
        )}
        <button className="rune-btn" onClick={onClose} style={{ width: '100%' }}>Close</button>
      </div>
    </div>
  );
}

// Reward breakdown: gold + chance at the unique item + chance at a heal.
function RewardLine({ boss }) {
  return (
    <div style={{ fontSize: '0.7rem', display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
      <span style={{ color: 'var(--color-gold)' }}>⚜ {boss.rewardGold}</span>
      {boss.rewardItemName && (
        <span style={{ color: '#c08040' }}>🗡 {boss.rewardItemName} ({Math.round(boss.rewardItemChance * 100)}%)</span>
      )}
      {boss.rewardHeal > 0 && (
        <span style={{ color: '#4caf7d' }}>♥ {boss.rewardHeal} ({Math.round(boss.rewardHealChance * 100)}%)</span>
      )}
    </div>
  );
}

export default function BossPage({ refreshCharacter }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [launching, setLaunching] = useState(null);
  const [joining, setJoining] = useState(null);
  const [victory, setVictory] = useState(null);
  const [detail, setDetail] = useState(null);

  // Pop the victory screen once per won quest (tracked in localStorage).
  useEffect(() => {
    const list = data?.recent ?? [];
    const seen = JSON.parse(localStorage.getItem('boss_victory_seen') || '[]');
    const win = list.find(e => e.outcome === 'victory' && e.reward && e.questId && !seen.includes(e.questId));
    if (win) setVictory(win);
  }, [data]);

  function dismissVictory() {
    if (victory?.questId) {
      const seen = JSON.parse(localStorage.getItem('boss_victory_seen') || '[]');
      if (!seen.includes(victory.questId)) {
        seen.push(victory.questId);
        localStorage.setItem('boss_victory_seen', JSON.stringify(seen));
      }
    }
    setVictory(null);
  }

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

  if (loading) return <div className="loading-state">Loading...</div>;
  if (error) return <div className="empty-state">Failed to load boss data.</div>;

  const active = data?.active;
  const revealed = data?.revealed ?? [];
  const invitations = data?.invitations ?? [];
  const recent = data?.recent ?? [];
  const isEmpty = !active && !invitations.length && !revealed.length;

  return (
    <>
      {victory && <VictoryModal entry={victory} onClose={dismissVictory} />}
      {detail && <RecentDetailModal entry={detail} onClose={() => setDetail(null)} />}
      {active && (() => {
        const { boss, quest, myContribution, myContributedThrough, gear, leaderboard, armor, damage, effMultiplier, damageBonus } = active;
        const scoredThrough = myContributedThrough
          ? new Date(myContributedThrough + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : null;
        return (
          <>
            <SectionHeader>BOSS QUEST</SectionHeader>
            <div className="stone-panel" style={{ padding: '14px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: '1rem', fontWeight: 700 }}>{boss.name}</span>
                <TierBadge tier={boss.tier} />
              </div>
              <RewardLine boss={boss} />

              <HpBar remaining={quest.hpRemaining} pool={quest.hpPool} />
              <TimeBar endsAt={quest.endsAt} durationDays={quest.durationDays} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '10px' }}>
                <span style={{ color: scoredThrough ? '#4caf7d' : 'var(--color-text-muted)', fontStyle: scoredThrough ? 'normal' : 'italic' }}>
                  {scoredThrough ? `✓ Scored through ${scoredThrough}` : 'No days scored yet'}
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>
                  Damage dealt: <span style={{ color: 'var(--color-text)' }}>{dmg(myContribution)}</span>
                </span>
              </div>

              <LeaderboardList leaderboard={leaderboard} />

              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '130px', background: '#0d1a22', border: '1px solid #204a5a', borderRadius: '4px', padding: '7px 10px' }}>
                  <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', letterSpacing: '0.08em', marginBottom: '2px' }}>🛡 ARMOUR {armor ?? 0}</div>
                  <div style={{ fontSize: '0.78rem', color: '#3a90b0' }}>
                    −{boss.damageMultiplier > 1 ? Math.round((1 - (effMultiplier ?? boss.damageMultiplier) / boss.damageMultiplier) * 100) : 0}% boss damage
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: '130px', background: '#1a0d0d', border: '1px solid #5a2020', borderRadius: '4px', padding: '7px 10px' }}>
                  <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', letterSpacing: '0.08em', marginBottom: '2px' }}>⚔ DAMAGE {damage ?? 0}</div>
                  <div style={{ fontSize: '0.78rem', color: '#c0703a' }}>
                    +{Math.round(((damageBonus ?? 1) - 1) * 100)}% dealt
                  </div>
                </div>
              </div>

              {gear?.length > 0 && (() => {
                const lowest = Math.min(...gear.map(g => (g.max > 0 ? (g.durability / g.max) * 100 : 100)));
                const lowColor = lowest < 25 ? '#c04040' : lowest < 60 ? '#c08040' : '#4a7c59';
                return (
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                    🛡 {gear.length} piece{gear.length === 1 ? '' : 's'} worn · lowest durability{' '}
                    <span style={{ color: lowColor }}>{Math.round(lowest)}%</span>
                  </div>
                );
              })()}

              <div style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)', fontStyle: 'italic', marginBottom: '10px' }}>
                ⚔ Gear is locked for the duration of the quest.
              </div>

              <button
                onClick={handleAbandon}
                style={{ background: 'none', border: 'none', color: '#a04040', fontSize: '0.7rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                Abandon quest
              </button>
            </div>
          </>
        );
      })()}

      {invitations.length > 0 && (
        <>
          <SectionHeader>INVITATIONS</SectionHeader>
          {invitations.map((inv, i) => (
            <div key={i} className="stone-panel" style={{ padding: '14px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: '0.85rem' }}>{inv.boss.name}</span>
                <TierBadge tier={inv.boss.tier} />
                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                  {inv.hostName || shortenUrl(inv.hostUrl)}'s party
                </span>
              </div>
              {inv.boss && <DifficultyLine boss={inv.boss} />}
              {inv.quest && <HpBar remaining={inv.quest.hpRemaining} pool={inv.quest.hpPool} />}
              <button
                className="bevel-btn"
                onClick={() => handleJoin(inv.hostUrl)}
                disabled={joining === inv.hostUrl || !!active}
              >
                {joining === inv.hostUrl ? 'Joining...' : active ? 'Already in a quest' : 'JOIN'}
              </button>
            </div>
          ))}
        </>
      )}

      {revealed.length > 0 && (
        <>
          <SectionHeader>REVEALED THREATS</SectionHeader>
          {revealed.map(boss => (
            <div key={boss.id} className="stone-panel" style={{ padding: '14px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: '0.9rem', fontWeight: 600 }}>{boss.name}</span>
                <TierBadge tier={boss.tier} />
              </div>
              <DifficultyLine boss={boss} />
              <RewardLine boss={boss} />
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
                {launching === boss.id ? 'Launching...' : active ? 'Already in a quest' : 'LAUNCH'}
              </button>
            </div>
          ))}
        </>
      )}

      {recent.length > 0 && (
        <>
          <SectionHeader>RECENT</SectionHeader>
          {recent.map((entry, i) => (
            <div key={i} onClick={() => setDetail(entry)} className="stone-panel" style={{ padding: '12px 14px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: '0.82rem' }}>{entry.boss.name}</span>
                <span style={{
                  marginLeft: '10px',
                  fontSize: '0.68rem',
                  color: entry.outcome === 'victory' ? '#4caf7d' : '#c04040',
                }}>
                  {entry.outcome === 'victory' ? '✓ Victory'
                    : entry.outcome === 'defeat' ? '✕ Defeat'
                    : '⚐ Abandoned'}
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
    </>
  );
}
