import { useRef, useState, useEffect } from 'react'
import StatBar from './StatBar'
import { fmtNum } from '../fmt'
import { IMP_COLOR } from '../constants'
import { deadlineLabel, isOverdue } from '../utils'

function importanceIcon(imp) {
  return imp === 'low' ? '◆' : imp === 'medium' ? '◆◆' : '◆◆◆'
}

function KebabMenu({ items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  if (!items.length) return null

  return (
    <div className="kebab-wrap" ref={ref}>
      <button
        className="kebab-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        aria-label="Actions"
      >⋮</button>
      {open && (
        <div className="kebab-menu">
          {items.map(({ label, danger, disabled, onClick }) => (
            <button
              key={label}
              className={`kebab-item${danger ? ' danger' : ''}${disabled ? ' disabled' : ''}`}
              onClick={(e) => { e.stopPropagation(); if (!disabled) { setOpen(false); onClick(); } }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HabitCard({
  habit,
  consistency,
  nextDeadline,
  rescheduleCost,
  currentGold,
  completionGold,
  passiveGold,
  healing,
  streak,
  onComplete,
  onReschedule,
  onEdit,
  onPause,
  onDelete,
  onResume,
  onMoveUp,
  onMoveDown,
  completed,
}) {
  const cardRef = useRef()

  const handleComplete = async () => {
    await onComplete()
    if (cardRef.current) {
      cardRef.current.style.animation = 'none'
      requestAnimationFrame(() => {
        cardRef.current.style.animation = 'completion-flash 600ms ease-out'
      })
    }
  }

  const menuItems = habit.system ? [] : habit.active
    ? [
        ...(onMoveUp   ? [{ label: 'Move up',   onClick: onMoveUp }]   : []),
        ...(onMoveDown ? [{ label: 'Move down', onClick: onMoveDown }] : []),
        ...(onEdit  ? [{ label: 'Edit',   onClick: onEdit }]  : []),
        ...(onReschedule && rescheduleCost !== null ? [{ label: `Delay — ${rescheduleCost} ⚜`, onClick: onReschedule, disabled: currentGold < rescheduleCost }] : []),
        ...(onPause ? [{ label: 'Pause',  onClick: onPause }] : []),
        ...(onDelete ? [{ label: 'Delete', danger: true, onClick: onDelete }] : []),
      ]
    : [
        ...(onResume ? [{ label: 'Resume', onClick: onResume }] : []),
        ...(onDelete ? [{ label: 'Delete', danger: true, onClick: onDelete }] : []),
      ]

  return (
    <>
      <style>{`
        .habit-card {
          position: relative;
          border-left: 4px solid var(--color-border);
          padding: 14px 16px;
          margin-bottom: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .habit-card.completed { background-color: var(--color-complete); opacity: 0.75; }
        .habit-card.paused { border-style: dashed; opacity: 0.8; }
        .habit-card.high-importance { animation: pulse-border 3s ease-in-out infinite; }
        .habit-name { font-family: 'Cinzel', serif; font-size: 1rem; font-weight: 600; flex: 1; min-width: 0; }
        .habit-badge { font-size: 0.65rem; color: var(--color-text-muted); letter-spacing: 0.1em; font-family: 'Cinzel', serif; }
        .habit-card-header { display: flex; align-items: center; gap: 8px; }
        .habit-divider { border: none; border-top: 1px solid var(--color-border); margin: 2px 0; }
        .habit-mastery-row { display: flex; align-items: center; gap: 10px; }
        .habit-mastery-row .stat-bar-wrapper { flex: 1; min-width: 0; }
        .habit-meta-gold { font-style: normal; color: var(--color-gold); font-weight: 600; font-size: 0.85rem; white-space: nowrap; }
        .habit-meta-heal { font-style: normal; color: #e05555; font-weight: 600; font-size: 0.85rem; white-space: nowrap; }
        .habit-freq-row { display: flex; align-items: baseline; }
        .habit-freq-label { font-size: 0.75rem; color: var(--color-text-muted); font-style: italic; flex: 1; }
        .habit-deadline { font-size: 0.75rem; color: var(--color-text-muted); font-style: italic; flex: 1; text-align: center; }
        .habit-deadline.overdue { color: var(--color-overdue); font-weight: bold; font-style: normal; }
        .habit-streak { font-size: 0.75rem; color: var(--color-gold); font-family: 'Cinzel', serif; white-space: nowrap; flex: 1; text-align: right; }
        .habit-notes { font-size: 0.75rem; color: var(--color-text-muted); font-style: italic; line-height: 1.4; padding-top: 2px; }
        .habit-completed-rune { text-align: center; color: var(--color-gold); font-family: 'Cinzel', serif; font-size: 0.9rem; padding: 4px 0; }
        .habit-actions { display: flex; gap: 6px; flex-direction: column; }
        .complete-btn { width: 100%; padding: 8px; font-size: 0.85rem; }
        .reschedule-btn { width: 100%; padding: 8px; font-size: 0.8rem; color: var(--color-text-muted); }
        .habit-imp-icon { font-style: normal; letter-spacing: 0.05em; }
        .kebab-wrap { position: relative; flex-shrink: 0; }
        .kebab-btn { background: none; border: none; color: var(--color-text-muted); font-size: 1.2rem; line-height: 1; padding: 0 2px; cursor: pointer; }
        .kebab-btn:hover { color: var(--color-text); }
        .kebab-menu { position: absolute; top: 100%; right: 0; z-index: 100; min-width: 110px; background: var(--color-surface-mid); border: 1px solid var(--color-border); border-radius: 2px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: flex; flex-direction: column; }
        .kebab-item { background: none; border: none; text-align: left; padding: 10px 14px; font-size: 0.85rem; color: var(--color-text); cursor: pointer; font-family: 'IM Fell English', Georgia, serif; }
        .kebab-item:hover { background: var(--color-surface-high); }
        .kebab-item.danger { color: var(--color-overdue); }
        .kebab-item.disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>

      <div
        ref={cardRef}
        className={[
          'habit-card stone-panel',
          completed ? 'completed' : '',
          !habit.active ? 'paused' : '',
          habit.importance === 'high' && !completed ? 'high-importance' : '',
        ].filter(Boolean).join(' ')}
        style={{ borderLeftColor: IMP_COLOR[habit.importance] }}
      >
        {/* Header row */}
        <div className="habit-card-header">
          <span className="habit-name" style={{ color: IMP_COLOR[habit.importance] }}>
            {habit.name}
          </span>
          {habit.system
            ? <span className="habit-badge">INNATE</span>
            : <span className="habit-imp-icon" style={{ color: IMP_COLOR[habit.importance] }}>{importanceIcon(habit.importance)}</span>
          }
          <KebabMenu items={menuItems} />
        </div>

        <div className="habit-divider" />

        {/* Mastery bar + gold/day */}
        <div className="habit-mastery-row">
          <StatBar value={consistency} color={IMP_COLOR[habit.importance]} label="Mastery" />
          {healing
            ? <span className="habit-meta-heal">♥ {fmtNum(passiveGold ?? 0, 1)}/day</span>
            : <span className="habit-meta-gold">⚜ {fmtNum(passiveGold ?? 0, 1)}/day</span>
          }
        </div>

        {/* Freq + deadline + streak */}
        <div className="habit-freq-row">
          <span className="habit-freq-label">
            {habit.frequency === 'daily' ? 'Daily Quest' : `Every ${habit.windowDays} days`}
          </span>
          <span className={`habit-deadline${isOverdue(nextDeadline) ? ' overdue' : ''}`}>
            {deadlineLabel(nextDeadline)}
          </span>
          <span className="habit-streak">{streak > 0 ? `>> ${streak}` : ''}</span>
        </div>

        {/* Notes */}
        {habit.notes && (
          <div className="habit-notes">{habit.notes}</div>
        )}

        {/* Actions: active and not completed */}
        {habit.active && !completed && (
          <div className="habit-actions">
            <button className="bevel-btn complete-btn" onClick={handleComplete}>
              COMPLETE &nbsp;⚜ ~{fmtNum(Math.floor(completionGold ?? 0))}
            </button>
          </div>
        )}

        {/* Completed state */}
        {completed && (
          <div className="habit-completed-rune">✦ Quest Complete</div>
        )}
      </div>
    </>
  )
}
