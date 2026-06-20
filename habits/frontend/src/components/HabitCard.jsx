import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import StatBar from './StatBar'
import { fmtNum } from '../fmt'
import { IMP_COLOR } from '../constants'
import { deadlineLabel, isOverdue } from '../utils'

function importanceIcon(imp) {
  return imp === 'low' ? '◆' : imp === 'medium' ? '◆◆' : '◆◆◆'
}

function bleedIcon(healthRemoved) {
  if (!healthRemoved || healthRemoved <= 0) return null
  if (healthRemoved <= 17) return '▾'
  if (healthRemoved <= 34) return '▾▾'
  return '▾▾▾'
}

const KEBAB_CLOSE = 'kebab-close-all'

function KebabMenu({ items }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef()
  const menuRef = useRef()
  const id = useRef(Math.random())

  const handleOpen = (e) => {
    e.stopPropagation()
    if (!open) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + window.scrollY, right: window.innerWidth - rect.right })
      document.dispatchEvent(new CustomEvent(KEBAB_CLOSE, { detail: id.current }))
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    const onOutside = (e) => {
      if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target))
        setOpen(false)
    }
    const onOther = (e) => { if (e.detail !== id.current) setOpen(false) }
    document.addEventListener('click', onOutside)
    document.addEventListener(KEBAB_CLOSE, onOther)
    return () => {
      document.removeEventListener('click', onOutside)
      document.removeEventListener(KEBAB_CLOSE, onOther)
    }
  }, [open])

  if (!items.length) return null

  return (
    <>
      <button ref={btnRef} className="kebab-btn" onClick={handleOpen} aria-label="Actions">⋮</button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="kebab-menu"
          style={{ position: 'absolute', top: pos.top, right: pos.right, zIndex: 9999 }}
        >
          {items.map(({ label, danger, disabled, onClick }) => (
            <button
              key={label}
              className={`kebab-item${danger ? ' danger' : ''}${disabled ? ' disabled' : ''}`}
              onClick={(e) => { e.stopPropagation(); if (!disabled) { setOpen(false); onClick(); } }}
            >
              {label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
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
  onInscribe,
  onRestore,
  completed,
}) {
  const cardRef = useRef()
  const [showDevInfo, setShowDevInfo] = useState(false)

  const handleComplete = async () => {
    await onComplete()
    if (cardRef.current) {
      cardRef.current.style.animation = 'none'
      requestAnimationFrame(() => {
        cardRef.current.style.animation = 'completion-flash 600ms ease-out'
      })
    }
  }

  const devInfoItem = { label: 'Dev Info', onClick: () => setShowDevInfo(v => !v) }

  const menuItems = habit.system ? [] : habit.inscribed
    ? [
        ...(onRestore ? [{ label: 'Restore', onClick: onRestore }] : []),
        devInfoItem,
      ]
    : habit.active
    ? [
        ...(onMoveUp   ? [{ label: 'Move up',   onClick: onMoveUp }]   : []),
        ...(onMoveDown ? [{ label: 'Move down', onClick: onMoveDown }] : []),
        ...(onEdit  ? [{ label: 'Edit',   onClick: onEdit }]  : []),
        ...(onReschedule && rescheduleCost !== null ? [{ label: `Delay — ${rescheduleCost} ⚜`, onClick: onReschedule, disabled: currentGold < rescheduleCost }] : []),
        ...(onInscribe && consistency >= 1 ? [{ label: 'Inscribe', onClick: onInscribe }] : []),
        ...(onPause ? [{ label: 'Pause',  onClick: onPause }] : []),
        ...(onDelete ? [{ label: 'Delete', danger: true, onClick: onDelete }] : []),
        devInfoItem,
      ]
    : [
        ...(onResume ? [{ label: 'Resume', onClick: onResume }] : []),
        ...(onDelete ? [{ label: 'Delete', danger: true, onClick: onDelete }] : []),
        devInfoItem,
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
        .habit-card.inscribed { border-color: #5a5a5a; border-left-color: #9a9a9a; background-color: #2a2a2a; background-image: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px), repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.02) 8px, rgba(255,255,255,0.02) 9px); box-shadow: inset 0 1px 0 rgba(150,150,150,0.15), inset 0 -1px 0 #1a1a1a, 0 4px 12px rgba(0,0,0,0.6); }
        .habit-card.inscribed .habit-name { color: #c0b8a8; }
        .habit-card.inscribed .habit-imp-icon { color: #7a7060; }
        .habit-card.inscribed .habit-divider { border-top-color: #484848; }
        .habit-inscribed-banner { text-align: center; font-family: 'Cinzel', serif; font-size: 0.75rem; letter-spacing: 0.2em; color: #9a9080; padding: 2px 0 4px; }
        .habit-inscribed-date { text-align: center; font-size: 0.7rem; color: #6a6050; font-style: italic; }
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
        .habit-bleed-icon { color: #cc2222; font-size: 0.75rem; letter-spacing: -0.05em; flex-shrink: 0; }
        .kebab-btn { background: none; border: none; color: var(--color-text-muted); font-size: 1.2rem; line-height: 1; padding: 0 2px; cursor: pointer; flex-shrink: 0; }
        .kebab-btn:hover { color: var(--color-text); }
        .kebab-menu { min-width: 110px; background: var(--color-surface-mid); border: 1px solid var(--color-border); border-radius: 2px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: flex; flex-direction: column; }
        .kebab-item { background: none; border: none; text-align: left; padding: 10px 14px; font-size: 0.85rem; color: var(--color-text); cursor: pointer; font-family: 'IM Fell English', Georgia, serif; }
        .kebab-item:hover { background: var(--color-surface-high); }
        .kebab-item.danger { color: var(--color-overdue); }
        .kebab-item.disabled { opacity: 0.4; cursor: not-allowed; }
        .dev-info-panel { background: #111; border: 1px solid #333; border-radius: 2px; padding: 10px 12px; font-family: monospace; font-size: 0.72rem; line-height: 1.8; color: #888; }
        .dev-info-row { display: flex; justify-content: space-between; gap: 16px; }
        .dev-info-key { color: #555; }
        .dev-info-val { color: #aaa; text-align: right; }
        .dev-info-val.negative { color: #e05555; }
      `}</style>

      <div
        ref={cardRef}
        className={[
          'habit-card stone-panel',
          completed ? 'completed' : '',
          habit.inscribed ? 'inscribed' : '',
          !habit.active && !habit.inscribed ? 'paused' : '',
          habit.importance === 'high' && !completed && !habit.inscribed ? 'high-importance' : '',
        ].filter(Boolean).join(' ')}
        style={habit.inscribed ? undefined : { borderLeftColor: IMP_COLOR[habit.importance] }}
      >
        {/* Header row */}
        <div className="habit-card-header">
          {bleedIcon(habit.healthRemoved) && (
            <span className="habit-bleed-icon">{bleedIcon(habit.healthRemoved)}</span>
          )}
          <span className="habit-name" style={habit.inscribed ? undefined : { color: IMP_COLOR[habit.importance] }}>
            {habit.name}
          </span>
          {habit.system
            ? <span className="habit-badge">INNATE</span>
            : <span className="habit-imp-icon" style={habit.inscribed ? undefined : { color: IMP_COLOR[habit.importance] }}>{importanceIcon(habit.importance)}</span>
          }
          <KebabMenu items={menuItems} />
        </div>

        <div className="habit-divider" />

        {/* Mastery bar + gold/day */}
        {!habit.inscribed && (
          <div className="habit-mastery-row">
            <StatBar value={consistency} color={IMP_COLOR[habit.importance]} label="Mastery" />
            {healing
              ? <span className="habit-meta-heal">♥ {fmtNum(passiveGold ?? 0, 1)}/day</span>
              : <span className="habit-meta-gold">⚜ {fmtNum(passiveGold ?? 0, 1)}/day</span>
            }
          </div>
        )}

        {/* Freq + deadline + streak */}
        {habit.inscribed ? (
          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#6a6050', fontStyle: 'italic' }}>
            {habit.frequency === 'daily' ? 'Daily Quest' : `Every ${habit.windowDays} days`}
          </div>
        ) : (
          <div className="habit-freq-row">
            <span className="habit-freq-label">
              {habit.frequency === 'daily' ? 'Daily Quest' : `Every ${habit.windowDays} days`}
            </span>
            <span className={`habit-deadline${isOverdue(nextDeadline) ? ' overdue' : ''}`}>
              {deadlineLabel(nextDeadline)}
            </span>
            <span className="habit-streak">{streak > 0 ? `>> ${streak}` : ''}</span>
          </div>
        )}

        {/* Notes */}
        {habit.notes && (
          <div className="habit-notes">{habit.notes}</div>
        )}

        {/* Inscribed state */}
        {habit.inscribed && (
          <>
            <div className="habit-inscribed-banner">⚜ INSCRIBED IN STONE ⚜</div>
            {habit.inscribedAt && (
              <div className="habit-inscribed-date">
                {new Date(habit.inscribedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            )}
          </>
        )}

        {/* Actions: active and not completed and not inscribed */}
        {habit.active && !completed && !habit.inscribed && (
          <div className="habit-actions">
            <button className="bevel-btn complete-btn" onClick={handleComplete}>
              COMPLETE &nbsp;⚜ ~{fmtNum(Math.floor(completionGold ?? 0))}
            </button>
          </div>
        )}

        {/* Completed state */}
        {completed && !habit.inscribed && (
          <div className="habit-completed-rune">✦ Quest Complete</div>
        )}

        {/* Dev info panel */}
        {showDevInfo && (
          <div className="dev-info-panel">
            {[
              ['hp debt',      `−${fmtNum(habit.healthRemoved ?? 0, 1)}`, true],
              ['mastery',      `${((consistency ?? 0) * 100).toFixed(1)}%`, false],
              ['passive/day',  `⚜ ${fmtNum(passiveGold ?? 0, 2)}`, false],
              ['completion',   `⚜ ~${fmtNum(Math.floor(completionGold ?? 0))}`, false],
              ['streak',       streak ?? 0, false],
              ['deadline',     nextDeadline ?? '—', false],
              ['importance',   habit.importance ?? '—', false],
              ['id',           habit.id, false],
            ].map(([key, val, neg]) => (
              <div key={key} className="dev-info-row">
                <span className="dev-info-key">{key}</span>
                <span className={`dev-info-val${neg ? ' negative' : ''}`}>{val}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
