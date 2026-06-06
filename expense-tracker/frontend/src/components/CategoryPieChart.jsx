import { useMemo, useState, useRef } from 'react'

/**
 * CategoryPieChart - SVG pie chart showing expense breakdown by category
 * including a remainder slice
 *
 * Props:
 *   expenses - array of Expense objects with categoryId and amount
 *   categories - array of Category objects { id, name, color }
 *   remainder - number (can be negative, will show deficit if so)
 *   size - number (pixel size, default 200)
 *   layout - 'vertical' (legend below) or 'horizontal' (legend beside), default 'vertical'
 */
export default function CategoryPieChart({
  expenses = [],
  categories = [],
  remainder = 0,
  size = 200,
  layout = 'vertical'
}) {
  // Build category map
  const categoryMap = useMemo(() => {
    const map = {}
    for (const cat of categories) {
      map[cat.id] = cat
    }
    return map
  }, [categories])

  // Calculate totals by category
  const categoryTotals = useMemo(() => {
    const totals = {}
    for (const expense of expenses) {
      const catId = expense.categoryId
      if (!totals[catId]) totals[catId] = 0
      totals[catId] += expense.amount
    }
    return totals
  }, [expenses])

  // Build chart data
  const sliceData = useMemo(() => {
    const entries = Object.entries(categoryTotals)
      .map(([catId, amount]) => ({
        label: categoryMap[catId]?.name || 'Unknown',
        color: categoryMap[catId]?.color || '#6b7280',
        amount,
        type: 'expense'
      }))
      .filter(e => e.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    // Calculate total spent (excluding remainder)
    const totalSpent = entries.reduce((sum, e) => sum + e.amount, 0)
    
    // Add remainder slice (only if positive/remaining, not deficit)
    if (remainder > 0) {
      entries.push({
        label: 'Remaining',
        color: 'transparent',
        amount: remainder,
        type: 'remainder'
      })
    }

    const total = entries.reduce((sum, e) => sum + e.amount, 0)
    return { entries, total, totalSpent }
  }, [categoryTotals, categoryMap, remainder])

  const [hoveredIndex, setHoveredIndex] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const svgWrapperRef = useRef(null)

  function handleMouseMove(e) {
    if (!svgWrapperRef.current) return
    const rect = svgWrapperRef.current.getBoundingClientRect()
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  // Generate SVG paths
  const center = size / 2
  const radius = (size - 20) / 2

  function polarToCartesian(cx, cy, r, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180
    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy + r * Math.sin(angleInRadians)
    }
  }

  function describeArc(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle)
    const end = polarToCartesian(cx, cy, r, startAngle)
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'

    return [
      'M', cx, cy,
      'L', start.x, start.y,
      'A', r, r, 0, largeArcFlag, 0, end.x, end.y,
      'Z'
    ].join(' ')
  }

  // Calculate slice paths
  let currentAngle = 0
  const slices = sliceData.entries.map(entry => {
    const angle = (entry.amount / sliceData.total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    return {
      ...entry,
      d: describeArc(center, center, radius, startAngle, endAngle),
      startAngle,
      endAngle
    }
  })

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  const isHorizontal = layout === 'horizontal'
  
  // Calculate 100% angle for deficit indicator
  const hasDeficit = remainder < 0
  const percentAt100 = hasDeficit ? (sliceData.totalSpent / (sliceData.totalSpent + Math.abs(remainder))) : 0
  const angleAt100 = percentAt100 * 360

  const hoveredSlice = hoveredIndex !== null ? slices[hoveredIndex] : null

  return (
    <div className={`category-pie-chart${isHorizontal ? ' category-pie-chart--horizontal' : ''}`}>
      <div
        ref={svgWrapperRef}
        className="category-pie-chart__svg-wrapper"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIndex(null)}
      >
      <svg viewBox={`0 0 ${size} ${size}`} className="category-pie-chart__svg" style={{ width: size, height: size }}>
        {slices.map((slice, index) => (
          <path
            key={index}
            d={slice.d}
            fill={slice.color}
            stroke="var(--color-surface)"
            strokeWidth="2"
            className="category-pie-chart__slice"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
        
        {/* Red line indicator for 100% point when deficit exists */}
        {hasDeficit && (
          <line
            x1={center}
            y1={center}
            x2={center + radius * Math.cos((angleAt100 - 90) * Math.PI / 180)}
            y2={center + radius * Math.sin((angleAt100 - 90) * Math.PI / 180)}
            stroke="#ef4444"
            strokeWidth="3"
            className="category-pie-chart__deficit-indicator"
          />
        )}
        {/* Center hole for donut style */}
        <circle cx={center} cy={center} r={radius * 0.5} fill="var(--color-surface)" />
        {/* Center label showing total */}
        <text
          x={center}
          y={center - 8}
          textAnchor="middle"
          className="category-pie-chart__total-label"
          fill="var(--color-text-muted)"
          fontSize={size > 240 ? "14" : "12"}
        >
          Spent
        </text>
        <text
          x={center}
          y={center + (size > 240 ? 14 : 10)}
          textAnchor="middle"
          className="category-pie-chart__total"
          fill="var(--color-text)"
          fontSize={size > 240 ? "18" : "14"}
          fontWeight="600"
        >
          {formatAmount(totalExpenses)}
        </text>
      </svg>
      {hoveredSlice && (
        <div
          className="pie-tooltip"
          style={{ left: tooltipPos.x + 14, top: tooltipPos.y - 10 }}
        >
          <span className="pie-tooltip__label">{hoveredSlice.label}</span>
          <span className="pie-tooltip__amount">{formatAmount(hoveredSlice.amount)}</span>
          <span className="pie-tooltip__pct">
            {((hoveredSlice.amount / sliceData.total) * 100).toFixed(1)}%
          </span>
        </div>
      )}
      </div>

      {/* Legend */}
      <div className="category-pie-chart__legend">
        {slices.map((slice, index) => (
          <div key={index} className="category-pie-chart__legend-item">
            <span
              className="category-pie-chart__legend-color"
              style={{ backgroundColor: slice.color }}
            />
            <span className="category-pie-chart__legend-label">{slice.label}</span>
            <span className="category-pie-chart__legend-amount">{formatAmount(slice.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatAmount(amount) {
  return 'R' + new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
