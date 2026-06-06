import RandomEventCard from './RandomEventCard';
import { fmtNum } from '../fmt';

export default function CharacterPanel({ hp, gold, damage, armor, randomEvent, onEventDismiss }) {
  const forsaken = hp <= 0;
  const hpPct = Math.max(0, Math.min(100, hp));
  const hpClass = hp < 20 ? 'char-hp-fill hp-low' : hp < 50 ? 'char-hp-fill hp-mid' : 'char-hp-fill';

  return (
    <aside className="char-panel">
      <div className="char-stat-block stone-panel">
        <div className="char-hp-row">
          <span className="char-hp-value" style={{ color: forsaken ? 'var(--color-overdue)' : 'var(--color-hp-full)' }}>
            {forsaken ? '✦ FORSAKEN' : `♥ ${Math.floor(hp)}`}
          </span>
          {!forsaken && <span className="char-hp-max">/ 100</span>}
        </div>
        <div className="char-hp-track">
          <div className={hpClass} style={{ width: `${hpPct}%` }} />
        </div>
        <div className="char-stats-row">
          <span className="char-stat-gold">⚜ {fmtNum(Math.floor(gold))}</span>
          {damage > 0 && <span className="char-stat-dmg">⚔ {damage}</span>}
          {armor > 0 && <span className="char-stat-arm">🛡 {armor}</span>}
        </div>
      </div>

      {randomEvent && (
        <RandomEventCard event={randomEvent} onDismiss={onEventDismiss} />
      )}
    </aside>
  );
}
