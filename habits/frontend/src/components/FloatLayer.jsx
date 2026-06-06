import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { fmtNum } from '../fmt';

const FloatContext = createContext(null);

function FloatNumber({ type, amount, x, y, offsetX, delay }) {
  const duration = type === 'damage' ? 1500 : type === 'gold' ? 1200 : 1000;

  let text;
  if (type === 'damage') text = `-${fmtNum(amount)}`;
  else if (type === 'gold') text = `+${fmtNum(Math.round(amount))} ⚜`;
  else if (type === 'renown') text = `+${fmtNum(Math.round(amount))} ✦`;
  else text = `+${fmtNum(Math.round(amount))}`;

  let fontSize;
  if (type === 'damage') fontSize = '2rem';
  else if (type === 'gold') fontSize = '1.8rem';
  else if (type === 'renown') fontSize = '1.6rem';
  else fontSize = '1rem';

  return (
    <span
      className={`float-num ${type}`}
      style={{
        position: 'absolute',
        left: `calc(50% + ${offsetX}px)`,
        top: y != null ? `${y}px` : '80px',
        fontSize,
        color: `var(--color-num-${type})`,
        fontFamily: "'Cinzel', serif",
        fontWeight: 700,
        animationName: 'float-number',
        animationDuration: `${duration}ms`,
        animationDelay: `${delay}ms`,
        animationTimingFunction: 'ease-out',
        animationFillMode: 'forwards',
        textShadow: '0 2px 4px rgba(0,0,0,0.8)',
        pointerEvents: 'none',
      }}
    >
      {text}
    </span>
  );
}

export function FloatProvider({ children }) {
  const [floats, setFloats] = useState([]);
  const nextId = useRef(0);

  const addFloat = useCallback(({ type, amount, x, y }) => {
    const id = nextId.current++;
    // Capture current count for stagger calculation before state update
    setFloats(prev => {
      const delay = prev.length * 120;
      const offsetX = (Math.random() - 0.5) * 40;
      const duration = type === 'damage' ? 1500 : type === 'gold' ? 1200 : 1000;

      const newFloat = { id, type, amount, x, y, offsetX, delay };

      // Schedule removal after animation completes
      setTimeout(() => {
        setFloats(current => current.filter(f => f.id !== id));
      }, duration + delay);

      return [...prev, newFloat];
    });
  }, []);

  return (
    <FloatContext.Provider value={{ addFloat }}>
      {children}
      <div
        id="float-layer"
        style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1000 }}
      >
        {floats.map(f => (
          <FloatNumber key={f.id} {...f} />
        ))}
      </div>
    </FloatContext.Provider>
  );
}

export function useFloat() {
  return useContext(FloatContext);
}
