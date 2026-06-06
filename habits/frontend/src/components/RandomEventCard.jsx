import { useState } from 'react';
import { resolveRandomEvent, chooseRandomEvent } from '../api';
import { fmtNum } from '../fmt';

export default function RandomEventCard({ event, onDismiss }) {
  const [outcome, setOutcome] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleResolve = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await resolveRandomEvent();
      if (!res.ok) return;
      const data = await res.json();
      setOutcome(data);
    } finally {
      setBusy(false);
    }
  };

  const handleChoose = async (index) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await chooseRandomEvent(index);
      if (!res.ok) return;
      const data = await res.json();
      setOutcome(data);
    } finally {
      setBusy(false);
    }
  };

  if (outcome) {
    return (
      <div className="event-card stone-panel">
        <div className="event-outcome-header">OUTCOME</div>
        <div className="event-outcome-text">{outcome.outcomeText}</div>
        <div className="event-outcome-stats">
          {outcome.hpDelta !== 0 && (
            <span className={outcome.hpDelta > 0 ? 'event-stat-pos' : 'event-stat-neg'}>
              ♥ {outcome.hpDelta > 0 ? '+' : ''}{Math.round(outcome.hpDelta)}
            </span>
          )}
          {outcome.goldDelta !== 0 && (
            <span className={outcome.goldDelta > 0 ? 'event-stat-pos' : 'event-stat-neg'}>
              ⚜ {outcome.goldDelta > 0 ? '+' : ''}{fmtNum(Math.abs(Math.round(outcome.goldDelta)))}
            </span>
          )}
          {outcome.hpDelta === 0 && outcome.goldDelta === 0 && (
            <span className="event-stat-neutral">No effect</span>
          )}
        </div>
        <button className="bevel-btn event-dismiss-btn" onClick={onDismiss}>
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="event-card stone-panel">
      <div className="event-kind-label">
        {event.kind === 'passive' ? '✦ ENCOUNTER' : '✦ CHOICE'}
      </div>
      <div className="event-title">{event.title}</div>
      <div className="event-text">{event.text}</div>
      {event.kind === 'passive' ? (
        <button className="bevel-btn event-resolve-btn" onClick={handleResolve} disabled={busy}>
          RESOLVE
        </button>
      ) : (
        <div className="event-options">
          {event.options.map((opt, i) => (
            <div key={i} className="event-option">
              <button
                className="bevel-btn event-option-btn"
                onClick={() => handleChoose(i)}
                disabled={busy}
              >
                {opt.label}
              </button>
              <div className="event-option-prompt">{opt.prompt}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
