export default function StatBar({ value, color, label }) {
  const filledCount = Math.round(Math.max(0, Math.min(1, value)) * 10);
  const pct = Math.round(value * 100);

  return (
    <div className="stat-bar-wrapper">
      {label && <span className="stat-bar-label">{label}</span>}
      <div className="stat-bar-track">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="stat-bar-segment"
            style={i < filledCount ? { backgroundColor: color, opacity: 0.9 } : undefined}
          />
        ))}
      </div>
      <span className="stat-bar-pct">{pct}%</span>
    </div>
  );
}
