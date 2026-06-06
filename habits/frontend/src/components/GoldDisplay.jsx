import { useState, useEffect, useRef } from 'react';
import { fmtNum } from '../fmt';

export default function GoldDisplay({ gold }) {
  const prevGold = useRef(gold);
  const [isFlashing, setIsFlashing] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (gold > prevGold.current) {
      // Gold increased — trigger flash and glow
      setIsFlashing(false);
      setGlowing(false);
      // Re-trigger by double-scheduling
      requestAnimationFrame(() => {
        setIsFlashing(true);
        setGlowing(true);
      });

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setIsFlashing(false);
        setGlowing(false);
      }, 800);
    }
    prevGold.current = gold;
  }, [gold]);

  const formatted = fmtNum(Math.floor(gold));

  return (
    <div className="gold-display">
      <span className={`gold-icon${glowing ? ' glow' : ''}`}>⚜</span>
      <span
        className="tabular"
        style={isFlashing ? { animation: 'count-up-flash 0.8s ease-out forwards' } : undefined}
      >
        {formatted}
      </span>
    </div>
  );
}
