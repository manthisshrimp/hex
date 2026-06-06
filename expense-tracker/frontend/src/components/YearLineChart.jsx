import { useMemo, useState } from 'react'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * YearLineChart - SVG line chart showing monthly spending by category
 *
 * Props:
 *   months - array of month objects with expenses
 *   categories - array of Category objects { id, name, color }
 */
export default function YearLineChart({ months = [], categories = [], year }) {
  const [hiddenCategories, setHiddenCategories] = useState(new Set())

  // Build category map for quick lookup
  const categoryMap = useMemo(() => {
    const map = {}
    for (const cat of categories) {
      map[cat.id] = cat
    }
    return map
  }, [categories])

  // Calculate monthly totals by category
  const monthlyData = useMemo(() => {
    return months.map(m => {
      const totals = {}
      for (const expense of m.expenses) {
        const catId = expense.categoryId
        if (!totals[catId]) totals[catId] = 0
        totals[catId] += expense.amount
      }
      return { month: m.month, totals }
    })
  }, [months])

  // Get max value for Y-axis scaling
  const maxValue = useMemo(() => {
    let max = 0
    for (const m of monthlyData) {
      for (const [catId, amount] of Object.entries(m.totals)) {
        if (!hiddenCategories.has(catId) && amount > max) {
          max = amount
        }
      }
    }
    return max > 0 ? max : 1000 // Default if no data
  }, [monthlyData, hiddenCategories])

  // Chart dimensions
  const width = 900
  const height = 300
  const padding = { top: 20, right: 30, bottom: 50, left: 70 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Scales
  const xScale = (monthIndex) => padding.left + (monthIndex * chartWidth) / 11
  const yScale = (value) => padding.top + chartHeight - (value / maxValue) * chartHeight

  // Generate Y-axis ticks
  const yTicks = 5
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxValue / yTicks) * i)

  // Toggle category visibility
  function toggleCategory(catId) {
    setHiddenCategories(prev => {
      const next = new Set(prev)
      if (next.has(catId)) {
        next.delete(catId)
      } else {
        next.add(catId)
      }
      return next
    })
  }

  // Deselect all categories
  function deselectAll() {
    const allCatIds = new Set(activeCategories.map(cat => cat.id))
    setHiddenCategories(allCatIds)
  }

  // Select all categories
  function selectAll() {
    setHiddenCategories(new Set())
  }

  // Generate line path for a category
  function getLinePath(catId) {
    const points = monthlyData.map((m, i) => {
      const x = xScale(i)
      const y = yScale(m.totals[catId] || 0)
      return `${x},${y}`
    })
    return `M ${points.join(' L ')}`
  }

  // Generate points for a category
  function getPoints(catId) {
    return monthlyData.map((m, i) => ({
      x: xScale(i),
      y: yScale(m.totals[catId] || 0),
      value: m.totals[catId] || 0,
      month: m.month
    }))
  }

  // Categories that have data (sorted alphabetically)
  const activeCategories = categories.filter(cat => {
    return monthlyData.some(m => (m.totals[cat.id] || 0) > 0)
  }).sort((a, b) => a.name.localeCompare(b.name))

  // Average combined monthly total for visible categories
  const avgMonthlyTotal = useMemo(() => {
    const visibleCats = activeCategories.filter(cat => !hiddenCategories.has(cat.id))
    if (visibleCats.length === 0) return 0
    const now = new Date()
    const cutoff = year === now.getFullYear() ? now.getMonth() + 1 : 12
    const relevantMonths = monthlyData.filter(m => m.month <= cutoff)
    if (relevantMonths.length === 0) return 0
    const total = relevantMonths.reduce((sum, m) =>
      sum + visibleCats.reduce((s, cat) => s + (m.totals[cat.id] || 0), 0), 0
    )
    return total / relevantMonths.length
  }, [monthlyData, activeCategories, hiddenCategories, year])

  if (activeCategories.length === 0) {
    return (
      <div className="year-line-chart year-line-chart--empty">
        <p className="text-muted">No expense data to display</p>
      </div>
    )
  }

  const allHidden = activeCategories.length > 0 && activeCategories.every(cat => hiddenCategories.has(cat.id))

  return (
    <div className="year-line-chart">
      {/* Category toggles */}
      <div className="year-line-chart__toggles">
        <button
          className="year-line-chart__toggle-all-btn"
          onClick={allHidden ? selectAll : deselectAll}
        >
          {allHidden ? 'Select All' : 'Deselect All'}
        </button>
        {activeCategories.map(cat => (
          <button
            key={cat.id}
            className={`year-line-chart__toggle${hiddenCategories.has(cat.id) ? ' year-line-chart__toggle--hidden' : ''}`}
            onClick={() => toggleCategory(cat.id)}
            style={{
              '--toggle-color': cat.color,
              borderColor: cat.color,
              backgroundColor: hiddenCategories.has(cat.id) ? 'transparent' : `${cat.color}20`
            }}
          >
            <span
              className="year-line-chart__toggle-dot"
              style={{ backgroundColor: cat.color }}
            />
            <span className="year-line-chart__toggle-label">{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Chart */}
      <svg viewBox={`0 0 ${width} ${height}`} className="year-line-chart__svg" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {yTickValues.map((val, i) => (
          <line
            key={i}
            x1={padding.left}
            y1={yScale(val)}
            x2={width - padding.right}
            y2={yScale(val)}
            stroke="var(--color-border)"
            strokeDasharray="2,2"
            opacity="0.5"
          />
        ))}

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="var(--color-text-muted)"
        />

        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="var(--color-text-muted)"
        />

        {/* X-axis labels */}
        {MONTH_SHORT.map((name, i) => (
          <text
            key={i}
            x={xScale(i)}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            fill="var(--color-text-muted)"
            fontSize="11"
          >
            {name}
          </text>
        ))}

        {/* Y-axis labels */}
        {yTickValues.map((val, i) => (
          <text
            key={i}
            x={padding.left - 8}
            y={yScale(val) + 4}
            textAnchor="end"
            fill="var(--color-text-muted)"
            fontSize="10"
          >
            R{formatCompact(val)}
          </text>
        ))}

        {/* Lines for each category */}
        {activeCategories.map(cat => {
          if (hiddenCategories.has(cat.id)) return null
          const pathD = getLinePath(cat.id)
          const points = getPoints(cat.id)

          return (
            <g key={cat.id}>
              <path
                d={pathD}
                fill="none"
                stroke={cat.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="year-line-chart__line"
              />
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r="4"
                  fill={cat.color}
                  stroke="var(--color-surface)"
                  strokeWidth="2"
                  className="year-line-chart__point"
                >
                  <title>{MONTH_SHORT[p.month - 1]}: R{p.value.toFixed(2)}</title>
                </circle>
              ))}
            </g>
          )
        })}

        {/* Average line for visible categories */}
        {avgMonthlyTotal > 0 && (
          <g className="year-line-chart__avg">
            <line
              x1={padding.left}
              y1={yScale(avgMonthlyTotal)}
              x2={width - padding.right}
              y2={yScale(avgMonthlyTotal)}
              stroke="var(--color-text-muted)"
              strokeWidth="1.5"
              strokeDasharray="6,4"
              opacity="0.7"
            />
            <text
              x={width - padding.right}
              y={yScale(avgMonthlyTotal) - 5}
              textAnchor="end"
              fill="var(--color-text-muted)"
              fontSize="10"
            >
              avg R{formatCompact(avgMonthlyTotal)}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

function formatCompact(amount) {
  if (amount >= 1000) {
    return (amount / 1000).toFixed(1) + 'k'
  }
  return amount.toFixed(0)
}
