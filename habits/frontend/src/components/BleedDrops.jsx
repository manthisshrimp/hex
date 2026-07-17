function bleedCount(healthRemoved) {
  if (!healthRemoved || healthRemoved <= 0) return 0
  if (healthRemoved <= 17) return 1
  if (healthRemoved <= 34) return 2
  return 3
}

export default function BleedDrops({ healthRemoved }) {
  const count = bleedCount(healthRemoved)
  if (!count) return null
  return (
    <span className="habit-bleed-drops">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="habit-bleed-drop" />
      ))}
    </span>
  )
}
