import { useState, useEffect, useCallback } from 'react';
import HabitCard from '../components/HabitCard';
import SectionHeader from '../components/SectionHeader';
import ModalPanel from '../components/ModalPanel';
import { useFloat } from '../components/FloatLayer';
import { getHabits, createHabit, updateHabit, deleteHabit, completeHabit, rescheduleHabit, moveHabit } from '../api';
import { SYSTEM_HABIT_ID } from '../constants';

export default function HabitsPage({ hp, gold, refreshCharacter }) {
  const { addFloat } = useFloat();
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completedIds, setCompletedIds] = useState(new Set());
  const [freqFilter, setFreqFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);

  const [confirmDelete, setConfirmDelete] = useState(null);

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

  useEffect(() => {
    loadHabits();
  }, [loadHabits]);

  const handleSave = useCallback(async (data) => {
    if (editingHabit) {
      const res = await updateHabit(editingHabit.id, data);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update');
      }
    } else {
      const res = await createHabit(data);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create');
      }
    }
    setModalOpen(false);
    setEditingHabit(null);
    await loadHabits();
  }, [editingHabit, loadHabits]);

  const handlePause = useCallback(async (habit) => {
    try {
      await updateHabit(habit.id, { active: false });
      await loadHabits();
    } catch {
      // ignore
    }
  }, [loadHabits]);

  const handleResume = useCallback(async (habit) => {
    try {
      await updateHabit(habit.id, { active: true });
      await loadHabits();
    } catch {
      // ignore
    }
  }, [loadHabits]);

  const handleDeleteRequest = useCallback((habit) => {
    setConfirmDelete(habit);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmDelete) return;
    try {
      await deleteHabit(confirmDelete.id);
      setConfirmDelete(null);
      await loadHabits();
    } catch {
      setConfirmDelete(null);
    }
  }, [confirmDelete, loadHabits]);

  const handleEdit = useCallback((habit) => {
    setEditingHabit(habit);
    setModalOpen(true);
  }, []);

  const handleReschedule = useCallback(async (habitId) => {
    try {
      const res = await rescheduleHabit(habitId);
      if (!res.ok) return;
      await Promise.all([loadHabits(), refreshCharacter()]);
    } catch {
      // ignore
    }
  }, [loadHabits, refreshCharacter]);

  const handleMove = useCallback(async (habitId, direction) => {
    try {
      const res = await moveHabit(habitId, direction);
      if (!res.ok) return;
      await loadHabits();
    } catch {
      // ignore
    }
  }, [loadHabits]);

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
      // ignore
    }
  }, [completedIds, addFloat, loadHabits, refreshCharacter]);

  const openAddModal = () => {
    setEditingHabit(null);
    setModalOpen(true);
  };

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

  const activeHabits = habits
    .filter(h => h.active)
    .filter(h => h.id === SYSTEM_HABIT_ID || freqFilter === 'all' || h.frequency === freqFilter)
    .sort((a, b) => {
      if (a.id === SYSTEM_HABIT_ID) return 1;
      if (b.id === SYSTEM_HABIT_ID) return -1;
      if (a.position !== b.position) return a.position - b.position;
      return a.createdAt.localeCompare(b.createdAt);
    });

  const pausedHabits = habits.filter(h => !h.active);

  return (
    <div className="page-content">
      <div className="page-header-row">
        <SectionHeader>
          <span>ACTIVE QUESTS</span>
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
        <button className="bevel-btn add-btn" onClick={openAddModal}>+ ADD</button>
      </div>

      {activeHabits.length === 0 ? (
        <div className="empty-state">No active quests. Add your first quest above.</div>
      ) : (
        <div className="habit-card-grid">
          {activeHabits.map((h) => {
            const moveable = activeHabits.filter(x => x.id !== SYSTEM_HABIT_ID);
            const moveIdx = moveable.indexOf(h);
            return (
              <HabitCard
                key={h.id}
                habit={h}
                consistency={h.consistency}
                nextDeadline={h.nextDeadline}
                rescheduleCost={h.rescheduleCost ?? null}
                currentGold={gold}
                completionGold={h.completionGold}
                passiveGold={h.passiveGold}
                healing={hp < 100}
                streak={h.streak ?? 0}
                completed={completedIds.has(h.id)}
                onComplete={() => handleComplete(h.id)}
                onReschedule={() => handleReschedule(h.id)}
                onEdit={() => handleEdit(h)}
                onPause={() => handlePause(h)}
                onDelete={() => handleDeleteRequest(h)}
                onResume={null}
                onMoveUp={moveIdx > 0 ? () => handleMove(h.id, 'up') : null}
                onMoveDown={moveIdx < moveable.length - 1 ? () => handleMove(h.id, 'down') : null}
              />
            );
          })}
        </div>
      )}

      {/* Suspended section */}
      {pausedHabits.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <SectionHeader>SUSPENDED</SectionHeader>
          {pausedHabits.map(h => (
            <HabitCard
              key={h.id}
              habit={h}
              consistency={h.consistency}
              nextDeadline={h.nextDeadline}
              rescheduleCost={null}
              currentGold={gold}
              completionGold={h.completionGold}
              passiveGold={h.passiveGold}
              completed={false}
              onComplete={null}
              onReschedule={null}
              onEdit={null}
              onPause={null}
              onDelete={() => handleDeleteRequest(h)}
              onResume={() => handleResume(h)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <ModalPanel
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingHabit(null); }}
        onSave={handleSave}
        initial={editingHabit}
      />

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="confirm-overlay">
          <div className="confirm-panel stone-panel">
            <p className="confirm-text">
              This cannot be undone. Delete this quest?
              <br />
              <strong style={{ color: 'var(--color-text)' }}>{confirmDelete.name}</strong>
            </p>
            <div className="confirm-actions">
              <button
                className="bevel-btn"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                className="bevel-btn confirm-danger"
                onClick={handleDeleteConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
