import { useState, useEffect, useCallback } from 'react';
import { fmtNum } from '../fmt';
import SectionHeader from '../components/SectionHeader';
import RandomEventCard from '../components/RandomEventCard';
import { useFloat } from '../components/FloatLayer';
import { useNavigate } from 'react-router-dom';
import { getHabits, getCharacter, completeHabit, debugAdvanceDays, payFerryman, getHistoryHp, getHistoryGold, getRandomEvent, getTodos, createTodo, completeTodo, deleteTodo, getWeeklyReward, claimWeeklyReward, getParty, cheerMember, addPartyMember, removePartyMember, getBoss } from '../api';
import { IMP_COLOR, SYSTEM_HABIT_ID } from '../constants';
import { getTodayStr, daysBetween, deadlineLabel } from '../utils';

function HpSparkline({ hpEvents }) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    days.push(d);
  }
  const nets = days.map(day => {
    const dayEvents = hpEvents.filter(e => e.tickDate === day);
    const regen = dayEvents.filter(e => e.type === 'regen').reduce((s, e) => s + e.amount, 0);
    const damage = dayEvents.filter(e => e.type === 'damage').reduce((s, e) => s + e.amount, 0);
    return regen - damage;
  });

  const W = 84, H = 28, barW = 9, gap = 3;
  const maxAbs = Math.max(...nets.map(Math.abs), 1);

  return (
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
      {nets.map((net, i) => {
        const x = i * (barW + gap);
        const h = Math.max(2, Math.abs(net) / maxAbs * (H / 2 - 2));
        const positive = net >= 0;
        const y = positive ? H / 2 - h : H / 2;
        return (
          <rect
            key={i}
            x={x} y={y} width={barW} height={h}
            fill={positive ? '#4a7c59' : '#8b2020'}
            opacity={0.85}
          />
        );
      })}
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="var(--color-border)" strokeWidth={1} />
    </svg>
  );
}

function CompactQuestRow({ habit, completed, onComplete, completionGold }) {
  const overdue = daysBetween(getTodayStr(), habit.nextDeadline) < 0;
  return (
    <div
        className={`dq-row stone-panel${completed ? ' dq-completed' : ''}`}
        style={{ borderLeftColor: IMP_COLOR[habit.importance] }}
      >
        <div className="dq-header">
          <span className="dq-name" style={{ color: IMP_COLOR[habit.importance] }}>
            {habit.name}
          </span>
          {overdue && (
            <span className="dq-deadline overdue">
              {deadlineLabel(habit.nextDeadline)}
            </span>
          )}
        </div>
        {completed ? (
          <div className="dq-done">✦ Quest Complete</div>
        ) : (
          <button className="bevel-btn dq-btn" onClick={onComplete}>
            COMPLETE &nbsp;⚜ ~{fmtNum(Math.floor(completionGold ?? 0))}
          </button>
        )}
    </div>
  );
}

function MemberCard({ member, onCheer, onRemove, cheerLoading, removeLoading, gold, today }) {
  const pub = member.cachedPublic;
  const hp = pub?.hp ?? null;
  const armor = pub?.armor ?? 0;
  const damage = pub?.damage ?? 0;
  const renown = pub?.renown ?? 0;

  const displayName = pub?.name || (() => {
    try { return new URL(member.url).hostname; } catch { return member.url; }
  })();

  const cacheDate = member.cacheUpdatedAt
    ? new Date(member.cacheUpdatedAt).toLocaleDateString()
    : null;

  const alreadyCheered = member.lastCheerSentAt === today;
  const canCheer = !alreadyCheered && gold >= 100;
  const hpColor = hp === null ? 'var(--color-border)' : hp > 70 ? '#4caf7d' : hp > 30 ? '#e0a040' : '#e05555';

  return (
    <div className="stone-panel" style={{ padding: '12px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
        <div>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.9rem', fontWeight: 600 }}>{displayName}</div>
          {cacheDate && (
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {hp !== null ? `Last seen ${cacheDate}` : `Offline · last seen ${cacheDate}`}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button
            className="bevel-btn"
            style={{ padding: '5px 10px', fontSize: '0.72rem' }}
            onClick={onCheer}
            disabled={cheerLoading || !canCheer}
            title={alreadyCheered ? 'Already cheered today' : gold < 100 ? 'Need 100 gold' : 'Cheer (+15 HP, costs 100 gold)'}
          >
            {cheerLoading ? '...' : alreadyCheered ? '✓ Cheered' : '♡ Cheer'}
          </button>
          <button
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.85rem', padding: '4px 6px', lineHeight: 1 }}
            onClick={onRemove}
            disabled={removeLoading}
            title="Remove from party"
          >
            {removeLoading ? '...' : '✕'}
          </button>
        </div>
      </div>

      {hp !== null ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
            <span>HP</span>
            <span>{Math.floor(hp)} / 100</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', marginBottom: '8px' }}>
            <div style={{ height: '100%', width: `${hp}%`, background: hpColor, borderRadius: '3px', transition: 'width 0.3s' }} />
          </div>
        </>
      ) : (
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontStyle: 'italic', marginBottom: '8px' }}>Offline</div>
      )}

      {pub && (damage > 0 || armor > 0 || renown > 0) && (
        <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem' }}>
          {damage > 0 && <span style={{ color: '#e05555' }}>⚔ {damage}</span>}
          {armor > 0 && <span style={{ color: 'var(--color-text-muted)' }}>🛡 {armor}</span>}
          {renown > 0 && <span style={{ color: '#b8963e' }}>✦ {Math.floor(renown)}</span>}
        </div>
      )}
    </div>
  );
}

function ForsakenCard({ gold, onPay }) {
  const cost = Math.floor(gold / 2);
  return (
    <div className="forsaken-card stone-panel">
        <div className="forsaken-title">✦ FORSAKEN ✦</div>
        <div className="forsaken-body">
          Your spirit lingers at the threshold. The Ferryman waits.<br />
          No gold flows, no wounds close, until you pay the toll.
        </div>
        <div className="forsaken-cost">Cost: {fmtNum(cost)} ⚜ — half your treasury</div>
        <button className="bevel-btn ferryman-btn" onClick={onPay}>
          PAY THE FERRYMAN
        </button>
    </div>
  );
}

export default function DashboardPage({ hp, gold, refreshCharacter }) {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completedIds, setCompletedIds] = useState(new Set());
  const [yesterdayHealed, setYesterdayHealed] = useState(0);
  const [yesterdayGold, setYesterdayGold] = useState(0);
  const [hpEvents, setHpEvents] = useState([]);
  const [freqFilter, setFreqFilter] = useState('all');
  const [randomEvent, setRandomEvent] = useState(null);
  const [todos, setTodos] = useState([]);
  const [todoInput, setTodoInput] = useState('');
  const [party, setParty] = useState(null);
  const [partyLoading, setPartyLoading] = useState(true);
  const [cheerLoading, setCheerLoading] = useState(null);
  const [addMemberUrl, setAddMemberUrl] = useState('');
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(null);
  const [boss, setBoss] = useState(null);
  const [reward, setReward] = useState(null);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const { addFloat } = useFloat();
  const navigate = useNavigate();
  const [advancing, setAdvancing] = useState(false);

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  useEffect(() => {
    async function loadYesterday() {
      try {
        const [hpRes, goldRes] = await Promise.all([getHistoryHp(), getHistoryGold()]);
        const [hpData, goldData] = await Promise.all([
          hpRes.ok ? hpRes.json() : [],
          goldRes.ok ? goldRes.json() : [],
        ]);
        const healed = hpData
          .filter(e => e.tickDate === yesterday && e.type === 'regen')
          .reduce((s, e) => s + e.amount, 0);
        const passive = goldData
          .filter(e => (e.timestamp || '').slice(0, 10) === yesterday && e.type === 'passive_income')
          .reduce((s, e) => s + e.amount, 0);
        setYesterdayHealed(healed);
        setYesterdayGold(passive);
        setHpEvents(hpData);
      } catch {
        // ignore
      }
    }
    loadYesterday();
  }, [yesterday]);

  const loadParty = useCallback(async () => {
    setPartyLoading(true);
    try {
      const res = await getParty();
      if (res.ok) setParty(await res.json());
    } catch { /* ignore */ } finally { setPartyLoading(false); }
  }, []);

  const loadBoss = useCallback(async () => {
    try {
      const res = await getBoss();
      if (res.ok) setBoss(await res.json());
    } catch { /* ignore */ }
  }, []);

  const loadHabits = useCallback(async () => {
    try {
      const res = await getHabits();
      if (!res.ok) throw new Error('Failed to load habits');
      const data = await res.json();
      setHabits(data);
      setCompletedIds(new Set(data.filter(h => !h.canComplete).map(h => h.id)));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReward = useCallback(async () => {
    try {
      const res = await getWeeklyReward();
      if (res.ok) setReward(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    getCharacter().catch(() => {});
    loadHabits();
    getRandomEvent()
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.current) setRandomEvent(data.current); })
      .catch(() => {});
    getTodos().then(r => r.ok ? r.json() : []).then(setTodos).catch(() => {});
    loadReward();
    loadParty();
    loadBoss();
  }, [loadHabits, loadParty, loadReward, loadBoss]);

  const handleComplete = useCallback(async (habitId) => {
    if (completedIds.has(habitId)) return;
    try {
      const res = await completeHabit(habitId);
      if (!res.ok) return;
      const result = await res.json();
      if (result.already_completed) return;
      setCompletedIds(prev => new Set([...prev, habitId]));
      if (result.gold_earned != null) {
        addFloat({ type: 'gold', amount: Math.round(result.gold_earned) });
      }
      await Promise.all([loadHabits(), refreshCharacter()]);
    } catch {
      // auth errors handled upstream
    }
  }, [completedIds, addFloat, loadHabits, refreshCharacter]);

  const handlePayFerryman = useCallback(async () => {
    try {
      const res = await payFerryman();
      if (!res.ok) return;
      await Promise.all([loadHabits(), refreshCharacter()]);
    } catch {
      // ignore
    }
  }, [loadHabits, refreshCharacter]);

  const handleAddTodo = useCallback(async () => {
    const title = todoInput.trim();
    if (!title) return;
    setTodoInput('');
    try {
      const res = await createTodo(title);
      if (!res.ok) return;
      const t = await res.json();
      setTodos(prev => [...prev, { ...t, gold: 50 }]);
    } catch { /* ignore */ }
  }, [todoInput]);

  const handleCompleteTodo = useCallback(async (id) => {
    try {
      const res = await completeTodo(id);
      if (!res.ok) return;
      const result = await res.json();
      setTodos(prev => prev.filter(t => t.id !== id));
      if (result.gold_earned > 0) {
        addFloat({ type: 'gold', amount: Math.round(result.gold_earned) });
      }
      await refreshCharacter();
      await loadReward();
    } catch { /* ignore */ }
  }, [addFloat, refreshCharacter, loadReward]);

  const handleClaimReward = useCallback(async (type) => {
    if (claiming) return;
    setClaiming(true);
    try {
      const res = await claimWeeklyReward(type);
      if (!res.ok) { const b = await res.json().catch(() => ({})); alert(b.error || 'Claim failed'); return; }
      const result = await res.json();
      if (result.goldEarned > 0) addFloat({ type: 'gold', amount: Math.round(result.goldEarned) });
      setRewardOpen(false);
      await refreshCharacter();
      await loadReward();
    } catch { /* ignore */ } finally { setClaiming(false); }
  }, [claiming, addFloat, refreshCharacter, loadReward]);

  const handleCheer = useCallback(async (memberUrl) => {
    setCheerLoading(memberUrl);
    const myUrl = window.location.origin;
    try {
      const res = await cheerMember(memberUrl, myUrl);
      if (!res.ok) { const b = await res.json().catch(() => ({})); alert(b.error || 'Cheer failed'); return; }
      await loadParty();
      await refreshCharacter();
    } catch { /* ignore */ } finally { setCheerLoading(null); }
  }, [refreshCharacter, loadParty]);

  const handleAddMember = useCallback(async () => {
    if (!addMemberUrl.trim()) return;
    setAddMemberLoading(true);
    const myUrl = window.location.origin;
    const raw = addMemberUrl.trim();
    const theirUrl = raw.startsWith('http') ? raw : `https://${raw}`;
    try {
      const res = await addPartyMember(theirUrl, myUrl);
      if (!res.ok) { const b = await res.json().catch(() => ({})); alert(b.error || 'Failed to add member'); return; }
      setAddMemberUrl('');
      setAddMemberOpen(false);
      await loadParty();
    } finally { setAddMemberLoading(false); }
  }, [addMemberUrl, loadParty]);

  const handleRemoveMember = useCallback(async (memberUrl) => {
    if (!confirm('Remove this member from your party?')) return;
    setRemoveLoading(memberUrl);
    const myUrl = window.location.origin;
    try {
      const res = await removePartyMember(memberUrl, myUrl);
      if (!res.ok) { const b = await res.json().catch(() => ({})); alert(b.error || 'Failed to remove member'); return; }
      await loadParty();
    } finally { setRemoveLoading(null); }
  }, [loadParty]);

  const handleDeleteTodo = useCallback(async (id) => {
    try {
      await deleteTodo(id);
      setTodos(prev => prev.filter(t => t.id !== id));
    } catch { /* ignore */ }
  }, []);

  const handleAdvanceDays = useCallback(async (days) => {
    if (advancing) return;
    setAdvancing(true);
    try {
      await debugAdvanceDays(days);
      await getCharacter();
      await Promise.all([loadHabits(), refreshCharacter()]);
    } catch {
      // ignore
    } finally {
      setAdvancing(false);
    }
  }, [advancing, loadHabits, refreshCharacter]);

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading-state">Loading quests...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content">
        <div className="empty-state">Failed to load: {error}</div>
      </div>
    );
  }

  const today = getTodayStr();
  const todayDow = new Date().getDay(); // 0=Sun, 1=Mon … 6=Sat

  const activeHabits = habits.filter(h => h.active && !h.inscribed);

  const dueHabits = activeHabits
    .filter(h => {
      if (h.id === SYSTEM_HABIT_ID) return false;
      if (h.nextDeadline <= today) return h.canComplete;
      // Also show windowed quests on their scheduled days if not yet completed this cycle
      return h.frequency === 'windowed'
        && Array.isArray(h.showOnDays)
        && h.showOnDays.includes(todayDow)
        && h.canComplete;
    })
    .filter(h => freqFilter === 'all' || h.frequency === freqFilter)
    .sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.createdAt.localeCompare(b.createdAt);
    });

  const allDueCompleted = dueHabits.length > 0 && dueHabits.every(h => completedIds.has(h.id));

  const forsaken = hp <= 0;
  const cheersToday = party?.cheersReceivedToday ?? [];
  const cheeredToday = cheersToday.length > 0;

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
        <HpSparkline hpEvents={hpEvents} />
        {(yesterdayHealed > 0 || yesterdayGold > 0) && (
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic', display: 'flex', gap: '14px' }}>
            <span>Yesterday:</span>
            {yesterdayHealed > 0 && <span>♥ +{fmtNum(Math.floor(yesterdayHealed))} healed</span>}
            {yesterdayGold > 0 && <span>⚜ +{fmtNum(Math.floor(yesterdayGold))} passive</span>}
          </div>
        )}
      </div>
      {cheeredToday && (
        <div style={{
          border: '2px solid var(--color-border-glow)',
          background: 'linear-gradient(135deg, #1c1408 0%, #2a1e08 50%, #1c1408 100%)',
          boxShadow: '0 0 18px rgba(240,192,64,0.25), inset 0 1px 0 var(--color-border-hi)',
          padding: '10px 16px',
          marginBottom: '14px',
          textAlign: 'center',
        }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.8rem', color: 'var(--color-border-glow)', letterSpacing: '0.15em' }}>
            ✦ &nbsp; AN ALLY CHEERED YOU ON &nbsp; ✦
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
            {cheersToday.length === 1
              ? 'A party member rallied behind you today, restoring your vigour.'
              : `${cheersToday.length} allies rallied behind you today, restoring your vigour.`}
          </div>
        </div>
      )}
      {boss?.active && (
        <div style={{
          border: '1px solid #7a2020',
          background: 'linear-gradient(135deg, #1a0a0a 0%, #2a1010 100%)',
          padding: '10px 16px',
          marginBottom: '12px',
          cursor: 'pointer',
        }} onClick={() => navigate('/boss')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.8rem', color: '#c04040', letterSpacing: '0.12em' }}>
              ⚔ {boss.active.boss?.name ?? 'UNKNOWN THREAT'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              {boss.active.myContributedToday ? '✓ Advanced today' : '— Not yet advanced'}
            </div>
          </div>
          <div style={{ marginTop: '6px', height: '6px', background: '#3a1010', borderRadius: '3px' }}>
            <div style={{
              height: '100%',
              borderRadius: '3px',
              background: '#c04040',
              width: `${Math.max(0, Math.min(100, 100 * (1 - (boss.active.quest?.hpRemaining ?? 0) / (boss.active.quest?.hpPool ?? 1))))}%`,
            }} />
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {Math.round(100 * (1 - (boss.active.quest?.hpRemaining ?? 0) / (boss.active.quest?.hpPool ?? 1)))}% felled
          </div>
        </div>
      )}
      {!boss?.active && boss?.revealed?.length > 0 && (
        <div style={{
          border: '1px solid #5a3a10',
          background: '#1a1008',
          padding: '8px 16px',
          marginBottom: '12px',
          cursor: 'pointer',
          fontSize: '0.78rem',
          color: '#b07820',
        }} onClick={() => navigate('/boss')}>
          ⚠ A threat has been revealed — visit the Boss tab
        </div>
      )}
      {!boss?.active && boss?.invitations?.length > 0 && (
        <div style={{
          border: '1px solid #204a5a',
          background: '#0a1a1f',
          padding: '8px 16px',
          marginBottom: '12px',
          cursor: 'pointer',
          fontSize: '0.78rem',
          color: '#3090b0',
        }} onClick={() => navigate('/boss')}>
          ⚔ You have been invited to join a boss quest
        </div>
      )}
      {randomEvent && (
        <RandomEventCard
          event={randomEvent}
          onDismiss={() => {
            setRandomEvent(null);
            refreshCharacter();
          }}
        />
      )}
      {forsaken && (
        <ForsakenCard gold={gold} onPay={handlePayFerryman} />
      )}

      {rewardOpen && reward && (
        <div className="checkin-overlay" onClick={() => setRewardOpen(false)}>
          <div className="checkin-panel" onClick={e => e.stopPropagation()}>
            <div className="checkin-title">Weekly Bounty</div>
            <div className="checkin-subtitle">
              The week of {reward.weekStart} — you completed {reward.count} {reward.count === 1 ? 'task' : 'tasks'}. Claim your reward.
            </div>
            <div className="checkin-habit-list">
              {reward.tasks.map((t, i) => (
                <div key={i} className="checkin-habit-row" style={{ cursor: 'default' }}>
                  <div className="checkin-habit-body">
                    <div className="checkin-habit-name">{t.title}</div>
                  </div>
                  <span className="checkin-habit-imp" style={{ color: 'var(--color-text-muted)' }}>
                    {t.completedAt?.slice(0, 10)}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="bevel-btn checkin-submit-btn"
                style={{ color: 'var(--color-gold)' }}
                onClick={() => handleClaimReward('gold')}
                disabled={claiming}
              >
                ⚜ Gold +{Math.round(reward.gold)}
              </button>
              <button
                className="bevel-btn checkin-submit-btn"
                style={{ color: '#4caf7d' }}
                onClick={() => handleClaimReward('heal')}
                disabled={claiming}
              >
                ♥ Heal +{Math.round(reward.heal)}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-cols">
        <div>
          <SectionHeader>
            <span>{allDueCompleted && dueHabits.length > 0 ? 'ALL QUESTS COMPLETE' : "TODAY'S QUESTS"}</span>
            <div className="freq-filter">
              {['all', 'daily', 'windowed'].map(f => (
                <button
                  key={f}
                  className={`freq-filter-btn${freqFilter === f ? ' active' : ''}`}
                  onClick={() => setFreqFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'daily' ? 'Daily' : 'Windowed'}
                </button>
              ))}
            </div>
          </SectionHeader>

          {dueHabits.length === 0 ? (
            <div className="empty-state">
              {freqFilter === 'all' ? 'All quests are current — the keep holds.' : `No ${freqFilter} quests due.`}
            </div>
          ) : (
            dueHabits.map(h => (
              <CompactQuestRow
                key={h.id}
                habit={h}
                completed={completedIds.has(h.id)}
                onComplete={() => handleComplete(h.id)}
                completionGold={h.completionGold}
              />
            ))
          )}
        </div>

        {/* Tasks column */}
        <div>
          <SectionHeader>
            <span>
              TASKS
              {reward?.weekCount > 0 && (
                <span
                  title="Tasks completed this week"
                  style={{ marginLeft: '8px', color: 'var(--color-gold)', fontFamily: "'Cinzel', serif", fontSize: '0.8rem' }}
                >
                  {reward.weekCount}
                </span>
              )}
            </span>
            {reward?.available && (
              <button
                className="bevel-btn"
                style={{ padding: '5px 12px', fontSize: '0.72rem', marginBottom: '8px', color: 'var(--color-gold)' }}
                onClick={() => setRewardOpen(true)}
              >
                ⚜ CLAIM
              </button>
            )}
          </SectionHeader>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input
              className="todo-input"
              value={todoInput}
              onChange={e => setTodoInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
              placeholder="Add a task..."
            />
            <button className="bevel-btn" style={{ whiteSpace: 'nowrap', padding: '8px 10px', fontSize: '0.8rem' }} onClick={handleAddTodo}>
              + ADD
            </button>
          </div>
          {todos.length === 0 ? (
            <div className="empty-state">No tasks pending.</div>
          ) : (
            todos.map(t => {
              const urgent = t.gold <= 10;
              const fading = t.gold < 30;
              return (
                <div key={t.id} className="todo-row stone-panel">
                  <span className="todo-title">{t.title}</span>
                  <span className="todo-gold" style={{ color: urgent ? 'var(--color-overdue)' : fading ? 'var(--color-text-muted)' : 'var(--color-gold)' }}>
                    ⚜ {Math.round(t.gold)}
                  </span>
                  <button className="bevel-btn todo-complete-btn" onClick={() => handleCompleteTodo(t.id)}>
                    DONE
                  </button>
                  <button className="todo-delete-btn" onClick={() => handleDeleteTodo(t.id)} aria-label="Delete">✕</button>
                </div>
              );
            })
          )}
        </div>

        {/* Party column */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionHeader>PARTY</SectionHeader>
            <button
              className="bevel-btn"
              style={{ padding: '6px 12px', fontSize: '0.72rem', marginBottom: '8px' }}
              onClick={() => setAddMemberOpen(true)}
            >
              + Add Member
            </button>
          </div>
          {partyLoading && <div className="loading-state" style={{ fontSize: '0.78rem' }}>Polling party members...</div>}
          {!partyLoading && (!party?.members?.length) && (
            <div className="empty-state">No party members yet. Add a friend's URL to get started.</div>
          )}
          {!partyLoading && party?.members?.map(member => (
            <MemberCard
              key={member.url}
              member={member}
              onCheer={() => handleCheer(member.url)}
              onRemove={() => handleRemoveMember(member.url)}
              cheerLoading={cheerLoading === member.url}
              removeLoading={removeLoading === member.url}
              gold={gold}
              today={today}
            />
          ))}
          {addMemberOpen && (
            <div className="checkin-overlay">
              <div className="checkin-panel">
                <div className="checkin-title">Add Party Member</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                  Paste their domain — e.g. habits.example.com
                </div>
                <input
                  type="text"
                  value={addMemberUrl}
                  onChange={e => setAddMemberUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddMember()}
                  placeholder="habits.example.com"
                  style={{
                    width: '100%',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    color: 'var(--color-text)',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    marginBottom: '16px',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="bevel-btn"
                    style={{ flex: 1, padding: '8px' }}
                    onClick={() => { setAddMemberOpen(false); setAddMemberUrl(''); }}
                  >
                    Cancel
                  </button>
                  <button
                    className="bevel-btn checkin-submit-btn"
                    style={{ flex: 1, padding: '8px' }}
                    onClick={handleAddMember}
                    disabled={addMemberLoading || !addMemberUrl.trim()}
                  >
                    {addMemberLoading ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
