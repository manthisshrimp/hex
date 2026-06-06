import { useState, useEffect } from 'react'
import { IMP_COLOR } from '../constants'

export default function ModalPanel({ open, onClose, onSave, initial }) {
  const [name, setName] = useState('')
  const [importance, setImportance] = useState('medium')
  const [frequency, setFrequency] = useState('daily')
  const [windowDays, setWindowDays] = useState(7)
  const [showOnDays, setShowOnDays] = useState([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Reset or populate when modal opens
  useEffect(() => {
    if (open) {
      if (initial) {
        setName(initial.name)
        setImportance(initial.importance)
        setFrequency(initial.frequency)
        setWindowDays(initial.windowDays || 7)
        setShowOnDays(initial.showOnDays || [])
        setNotes(initial.notes || '')
      } else {
        setName(''); setImportance('medium'); setFrequency('daily'); setWindowDays(7); setShowOnDays([]); setNotes('')
      }
      setError('')
      setSaving(false)
    }
  }, [open, initial])

  const handleSave = async () => {
    if (!name.trim()) { setError('Quest name is required'); return }
    setSaving(true); setError('')
    try {
      await onSave({
        name: name.trim(),
        importance,
        frequency,
        windowDays: frequency === 'daily' ? 1 : Math.max(2, windowDays),
        showOnDays: frequency === 'windowed' ? showOnDays : [],
        notes: notes.trim() || null,
      })
    } catch (e) {
      setError(e.message || 'Failed to save')
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      <style>{`
        .modal-label {
          font-size: 0.75rem;
          font-family: 'Cinzel', serif;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--color-text-label);
        }
        .modal-input {
          background: var(--color-surface-mid);
          border: 1px solid var(--color-border);
          color: var(--color-text);
          font-family: 'IM Fell English', serif;
          font-size: 1rem;
          padding: 10px 12px;
          width: 100%;
          outline: none;
          transition: border-color 0.15s;
        }
        .modal-input:focus { border-color: var(--color-border-glow); }
        .rune-selector { display: flex; gap: 8px; }
        .rune-selector .rune-btn {
          flex: 1;
          padding: 8px;
          background: var(--color-surface-mid);
          border: 1px solid var(--color-border);
          color: var(--color-text-muted);
          font-family: 'Cinzel', serif;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.15s;
        }
        .rune-selector .rune-btn.active {
          border-color: var(--color-border-glow);
          color: var(--color-text);
          background: var(--color-surface-high);
        }
        .window-days-row { display: flex; align-items: center; gap: 12px; }
        .window-days-value {
          font-family: 'Cinzel', serif;
          font-size: 1.2rem;
          color: var(--color-gold);
          min-width: 32px;
          text-align: center;
          font-variant-numeric: tabular-nums;
        }
        .day-selector { display: flex; gap: 6px; flex-wrap: wrap; }
        .day-selector .rune-btn { flex: 1; min-width: 36px; padding: 6px 4px; font-size: 0.75rem; }
        .day-selector .rune-btn.active { border-color: var(--color-border-glow); color: var(--color-text); background: var(--color-surface-high); }
        .modal-textarea { background: var(--color-surface-mid); border: 1px solid var(--color-border); color: var(--color-text); font-family: 'IM Fell English', serif; font-size: 0.9rem; padding: 10px 12px; width: 100%; outline: none; resize: vertical; min-height: 64px; transition: border-color 0.15s; }
        .modal-textarea:focus { border-color: var(--color-border-glow); }
        .modal-error { color: var(--color-overdue); font-size: 0.85rem; }
        .modal-save-btn { width: 100%; padding: 14px; font-size: 1rem; margin-top: 4px; }
        .modal-panel-inner {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
      `}</style>

      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-panel stone-panel" onClick={e => e.stopPropagation()}>
          <div className="modal-panel-inner">
            <h2 className="modal-title">{initial ? 'Edit Quest' : 'New Quest'}</h2>

            <label className="modal-label">Quest Name</label>
            <input
              className="modal-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Name your habit..."
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />

            <label className="modal-label">Importance</label>
            <div className="rune-selector">
              {['low', 'medium', 'high'].map(lvl => (
                <button
                  key={lvl}
                  className={`rune-btn${importance === lvl ? ' active' : ''}`}
                  style={importance === lvl ? { borderColor: IMP_COLOR[lvl], color: IMP_COLOR[lvl] } : {}}
                  onClick={() => setImportance(lvl)}
                >
                  {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                </button>
              ))}
            </div>

            <label className="modal-label">Frequency</label>
            <div className="rune-selector">
              {['daily', 'windowed'].map(f => (
                <button
                  key={f}
                  className={`rune-btn${frequency === f ? ' active' : ''}`}
                  onClick={() => setFrequency(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {frequency === 'windowed' && (
              <div className="window-days-row">
                <span className="modal-label">Every</span>
                <button className="stepper-btn" onClick={() => setWindowDays(d => Math.max(2, d - 1))}>−</button>
                <span className="window-days-value tabular">{windowDays}</span>
                <button className="stepper-btn" onClick={() => setWindowDays(d => d + 1)}>+</button>
                <span className="modal-label">days</span>
              </div>
            )}

            {frequency === 'windowed' && (
              <>
                <label className="modal-label">Show on days</label>
                <div className="day-selector">
                  {[['Mo', 1], ['Tu', 2], ['We', 3], ['Th', 4], ['Fr', 5], ['Sa', 6], ['Su', 0]].map(([label, dow]) => (
                    <button
                      key={dow}
                      className={`rune-btn${showOnDays.includes(dow) ? ' active' : ''}`}
                      onClick={() => setShowOnDays(prev =>
                        prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow]
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}

            <label className="modal-label">Notes</label>
            <textarea
              className="modal-textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes or context..."
            />

            {error && <div className="modal-error">{error}</div>}

            <button className="bevel-btn modal-save-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : initial ? 'Update Quest' : 'Begin Quest'}
            </button>
            <button className="modal-cancel" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </>
  )
}
