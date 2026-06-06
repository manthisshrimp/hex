import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { fmtNum } from '../fmt';

const HpBar = forwardRef(function HpBar({ hp }, ref) {
  const [displayWidth, setDisplayWidth] = useState(0);
  const trackRef = useRef(null);

  // Animate from 0 to current HP on mount
  useEffect(() => {
    // Defer to next frame so CSS transition fires
    const id = requestAnimationFrame(() => {
      setDisplayWidth(Math.max(0, Math.min(100, hp)));
    });
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update width when hp prop changes after mount
  useEffect(() => {
    setDisplayWidth(Math.max(0, Math.min(100, hp)));
  }, [hp]);

  // Expose animateDamage via ref
  useImperativeHandle(ref, () => ({
    animateDamage(amount) {
      const track = trackRef.current;
      if (!track) return;
      track.classList.add('hp-shake');
      track.addEventListener('animationend', () => {
        track.classList.remove('hp-shake');
      }, { once: true });
    },
  }));

  const isBurnout = hp <= 0;
  const isLow = hp > 0 && hp <= 30;
  const isMid = hp > 30 && hp <= 70;

  let fillClass = 'hp-bar-fill';
  if (isBurnout) fillClass += ' hp-burnout';
  else if (isLow) fillClass += ' hp-low hp-heartbeat';
  else if (isMid) fillClass += ' hp-mid';

  return (
    <div className="hp-bar-wrapper">
      <div className="hp-bar-track" ref={trackRef}>
        <div
          className={fillClass}
          style={{ width: `${displayWidth}%` }}
        />
        <span className={`hp-bar-label tabular${isBurnout ? ' forsaken' : ''}`}>
          {isBurnout ? 'FORSAKEN' : `${fmtNum(Math.floor(hp))} / 100`}
        </span>
      </div>
    </div>
  );
});

export default HpBar;
