import { useMemo, useState } from 'react'

/**
 * DescriptionBreakdown - ranks expenses by (normalized) description.
 *
 * Pick a category to rank descriptions within it, or "All" to rank
 * descriptions across every category. Grouping key is the description
 * trimmed + lowercased; the first-seen spelling is shown as the label.
 *
 * Props:
 *   expenses   - array of { categoryId, description, amount }
 *   categories - array of { id, name, color }
 */
export default function DescriptionBreakdown({ expenses = [], categories = [] }) {
  const [selectedCat, setSelectedCat] = useState(null) // null = all

  const rows = useMemo(() => {
    const groups = {} // key -> { label, total, count }
    for (const e of expenses) {
      if (selectedCat && e.categoryId !== selectedCat) continue
      const raw = (e.description || '').trim()
      const key = raw.toLowerCase()
      if (!groups[key]) groups[key] = { label: raw || '(no description)', total: 0, count: 0 }
      groups[key].total += e.amount || 0
      groups[key].count += 1
    }
    return Object.values(groups).sort((a, b) => b.total - a.total)
  }, [expenses, selectedCat])

  const max = rows.length ? rows[0].total : 0

  return (
    <div className="desc-breakdown">
      <h3 className="desc-breakdown__title">Description breakdown</h3>

      <div className="desc-breakdown__filters">
        <button
          className={`desc-breakdown__chip${selectedCat === null ? ' is-active' : ''}`}
          onClick={() => setSelectedCat(null)}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`desc-breakdown__chip${selectedCat === cat.id ? ' is-active' : ''}`}
            onClick={() => setSelectedCat(cat.id)}
            style={selectedCat === cat.id ? { borderColor: cat.color } : undefined}
          >
            <span className="desc-breakdown__chip-dot" style={{ backgroundColor: cat.color }} />
            {cat.name}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="desc-breakdown__empty">No expenses to break down.</p>
      ) : (
        <ul className="desc-breakdown__list">
          {rows.map(row => (
            <li key={row.label} className="desc-breakdown__item">
              <div className="desc-breakdown__item-head">
                <span className="desc-breakdown__item-label">
                  {row.label}
                  {row.count > 1 && <span className="desc-breakdown__item-count"> ×{row.count}</span>}
                </span>
                <span className="desc-breakdown__item-amount">{formatAmount(row.total)}</span>
              </div>
              <div className="desc-breakdown__bar">
                <div
                  className="desc-breakdown__bar-fill"
                  style={{ width: `${max ? (row.total / max) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function formatAmount(amount) {
  return 'R' + new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
