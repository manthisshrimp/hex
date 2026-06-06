import { useState, useEffect, useCallback } from 'react';
import { fmtNum } from '../fmt';
import SectionHeader from '../components/SectionHeader';
import { useFloat } from '../components/FloatLayer';
import { getDeeds, createDeed, updateDeed, deleteDeed, logDeed } from '../api';
import { IMP_COLOR } from '../constants';

const IMP_LABELS = { low: 'Low', medium: 'Med', high: 'High' };
const EFFECT_AMOUNTS = { low: 3, medium: 5, high: 8 };

function DeedModal({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [deedType, setDeedType] = useState(initial?.type ?? 'good');
  const [importance, setImportance] = useState(initial?.importance ?? 'medium');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const isEdit = !!initial?.id;

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({ name: trimmed, type: deedType, importance, notes: notes.trim() || null });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel stone-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{isEdit ? 'Edit Deed' : 'New Deed'}</div>

        {!isEdit && (
          <div className="modal-row">
            <label className="modal-label">Type</label>
            <div className="type-toggle">
              {['good', 'bad'].map(t => (
                <button
                  key={t}
                  className={`type-toggle-btn${deedType === t ? ' active' : ''} ${t}`}
                  onClick={() => setDeedType(t)}
                >
                  {t === 'good' ? '✦ Good' : '✕ Bad'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="modal-row">
          <label className="modal-label">Name</label>
          <input
            className="modal-input"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Describe this deed..."
            autoFocus
          />
        </div>

        <div className="modal-row">
          <label className="modal-label">Weight</label>
          <div className="imp-buttons">
            {['low', 'medium', 'high'].map(imp => (
              <button
                key={imp}
                className={`imp-btn${importance === imp ? ' active' : ''}`}
                style={{ '--imp-color': IMP_COLOR[imp] }}
                onClick={() => setImportance(imp)}
              >
                {IMP_LABELS[imp]} ({EFFECT_AMOUNTS[imp]})
              </button>
            ))}
          </div>
        </div>

        <div className="modal-row">
          <label className="modal-label">Notes</label>
          <textarea
            className="modal-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional reminder..."
            rows={2}
          />
        </div>

        <div className="modal-actions">
          <button className="bevel-btn modal-save-btn" onClick={handleSave}>
            {isEdit ? 'Save' : 'Create'}
          </button>
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function DeedCard({ deed, onLog, onEdit, onDelete }) {
  const isGood = deed.type === 'good';
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLog() {
    if (deed.loggedToday) return;
    onLog(deed.id);
  }

  return (
    <div className={`deed-card stone-panel ${isGood ? 'deed-good' : 'deed-bad'}`}>
      <div className="deed-header">
        <span className="deed-type-badge" style={{ color: isGood ? '#4a7c59' : '#8b2020' }}>
          {isGood ? '✦' : '✕'}
        </span>
        <span className="deed-name">{deed.name}</span>
        <span className="deed-imp" style={{ color: IMP_COLOR[deed.importance] }}>
          {IMP_LABELS[deed.importance]}
        </span>
        <div className="deed-menu-wrap">
          <button className="kebab-btn" onClick={() => setMenuOpen(o => !o)}>⋮</button>
          {menuOpen && (
            <div className="kebab-menu" onMouseLeave={() => setMenuOpen(false)}>
              <button className="kebab-item" onClick={() => { setMenuOpen(false); onEdit(deed); }}>Edit</button>
              <button className="kebab-item kebab-danger" onClick={() => { setMenuOpen(false); onDelete(deed.id); }}>Delete</button>
            </div>
          )}
        </div>
      </div>
      {deed.notes && <div className="deed-notes">{deed.notes}</div>}
      <div className="deed-footer">
        <span className="deed-effect" style={{ color: isGood ? '#4a7c59' : '#8b2020' }}>
          {isGood ? `+${deed.effect} renown` : `-${deed.effect} renown/HP`}
        </span>
        <button
          className={`bevel-btn deed-log-btn${deed.loggedToday ? ' deed-logged' : ''}`}
          onClick={handleLog}
          disabled={deed.loggedToday}
        >
          {deed.loggedToday ? '✦ Logged' : 'LOG IT'}
        </button>
      </div>
    </div>
  );
}

export default function DeedsPage({ renown, refreshCharacter }) {
  const [deeds, setDeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode: 'create' | 'edit', deed?: {} }
  const { addFloat } = useFloat();

  const loadDeeds = useCallback(async () => {
    try {
      const res = await getDeeds();
      if (res.ok) setDeeds(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDeeds(); }, [loadDeeds]);

  const handleLog = useCallback(async (id) => {
    try {
      const res = await logDeed(id);
      if (!res.ok) return;
      const result = await res.json();
      if (result.renownDelta > 0) {
        addFloat({ type: 'renown', amount: Math.round(result.renownDelta) });
      } else if (result.hpDelta < 0) {
        addFloat({ type: 'damage', amount: Math.round(-result.hpDelta) });
      }
      setDeeds(prev => prev.map(d => d.id === id ? { ...d, loggedToday: true } : d));
      await refreshCharacter();
    } catch { /* ignore */ }
  }, [addFloat, refreshCharacter]);

  const handleCreate = useCallback(async (data) => {
    try {
      const res = await createDeed(data);
      if (!res.ok) return;
      const created = await res.json();
      setDeeds(prev => [...prev, { ...created, loggedToday: false, effect: EFFECT_AMOUNTS[created.importance] }]);
      setModal(null);
    } catch { /* ignore */ }
  }, []);

  const handleUpdate = useCallback(async (id, data) => {
    try {
      const res = await updateDeed(id, data);
      if (!res.ok) return;
      const updated = await res.json();
      setDeeds(prev => prev.map(d => d.id === id
        ? { ...d, ...updated, effect: EFFECT_AMOUNTS[updated.importance] }
        : d
      ));
      setModal(null);
    } catch { /* ignore */ }
  }, []);

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteDeed(id);
      setDeeds(prev => prev.filter(d => d.id !== id));
    } catch { /* ignore */ }
  }, []);

  const goodDeeds = deeds.filter(d => d.type === 'good');
  const badDeeds = deeds.filter(d => d.type === 'bad');

  if (loading) return <div className="page-content"><div className="loading-state">Loading deeds...</div></div>;

  return (
    <div className="page-content">
      {modal && (
        <DeedModal
          initial={modal.deed ?? null}
          onSave={modal.mode === 'edit'
            ? (data) => handleUpdate(modal.deed.id, data)
            : handleCreate
          }
          onClose={() => setModal(null)}
        />
      )}

      <div className="deeds-renown-bar stone-panel">
        <span className="renown-label">RENOWN</span>
        <div className="renown-track">
          <div className="renown-fill" style={{ width: `${Math.min(renown / 30 * 100, 100)}%` }} />
          {[10, 15, 20, 25, 30].map(n => (
            <div
              key={n}
              className={`renown-milestone${renown >= n ? ' reached' : ''}`}
              style={{ left: `${n / 30 * 100}%` }}
              title={`Renown ${n}`}
            />
          ))}
        </div>
        <span className="renown-value">{Math.floor(renown)}</span>
      </div>

      <div className="deeds-cols">
        <div>
          <SectionHeader>
            <span>GOOD DEEDS</span>
            <button className="bevel-btn deed-add-btn" onClick={() => setModal({ mode: 'create', deed: { type: 'good' } })}>+ ADD</button>
          </SectionHeader>
          {goodDeeds.length === 0
            ? <div className="empty-state">No good deeds yet. Add one to earn renown.</div>
            : goodDeeds.map(d => (
              <DeedCard
                key={d.id}
                deed={d}
                onLog={handleLog}
                onEdit={(deed) => setModal({ mode: 'edit', deed })}
                onDelete={handleDelete}
              />
            ))
          }
        </div>

        <div>
          <SectionHeader>
            <span>BAD DEEDS</span>
            <button className="bevel-btn deed-add-btn" onClick={() => setModal({ mode: 'create', deed: { type: 'bad' } })}>+ ADD</button>
          </SectionHeader>
          {badDeeds.length === 0
            ? <div className="empty-state">No bad deeds tracked. Add one to keep yourself honest.</div>
            : badDeeds.map(d => (
              <DeedCard
                key={d.id}
                deed={d}
                onLog={handleLog}
                onEdit={(deed) => setModal({ mode: 'edit', deed })}
                onDelete={handleDelete}
              />
            ))
          }
        </div>
      </div>
    </div>
  );
}
