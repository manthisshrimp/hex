import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getYear, getCategories } from '../api.js'
import YearLineChart from './YearLineChart.jsx'
import CategoryPieChart from './CategoryPieChart.jsx'
import DescriptionBreakdown from './DescriptionBreakdown.jsx'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function YearView({ authToken }) {
  const { year } = useParams()
  const yearNum = Number(year)

  const [yearData, setYearData] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('pie') // chart tab switcher

  // ── Load year and categories ─────────────────────────────────────────────────
  async function loadYear() {
    setLoading(true)
    setError(null)
    try {
      const [data, catsData] = await Promise.all([
        getYear(yearNum),
        getCategories()
      ])
      setYearData(data)
      setCategories(catsData.categories || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadYear()
  }, [yearNum])

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-loading">
        <p>Loading {yearNum}…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-error">
        <p>Error: {error}</p>
        <button className="btn btn--primary" onClick={loadYear}>Retry</button>
        <Link to="/" className="btn btn--secondary">← All Years</Link>
      </div>
    )
  }

  // Compute year-level totals
  const totalIncome = yearData.months.reduce((sum, m) => sum + (m.income || 0), 0)
  const totalExpenses = yearData.months.reduce(
    (sum, m) => sum + m.expenses.reduce((s, e) => s + (e.amount || 0), 0),
    0
  )
  const yearRemainder = totalIncome - totalExpenses
  const allExpenses = yearData.months.flatMap(m => m.expenses)

  return (
    <div className="year-view">
      {/* ── Header ── */}
      <header className="year-view__header">
        <div className="year-view__nav-top">
          <Link to="/" className="btn btn--ghost">← All Years</Link>
        </div>
        <div className="year-view__title-row">
          <h1 className="year-view__title">{yearNum}</h1>
        </div>

        {/* Annual summary */}
        <div className="year-view__annual-summary">
          <div className="annual-stat">
            <span className="annual-stat__label">Total Income</span>
            <span className="annual-stat__value">{formatAmount(totalIncome)}</span>
          </div>
          <div className="annual-stat">
            <span className="annual-stat__label">Total Expenses</span>
            <span className="annual-stat__value annual-stat__value--expenses">
              {formatAmount(totalExpenses)}
            </span>
          </div>
          <div className="annual-stat">
            <span className="annual-stat__label">Annual Remainder</span>
            <span className={`annual-stat__value${yearRemainder >= 0 ? ' annual-stat__value--positive' : ' annual-stat__value--negative'}`}>
              {yearRemainder >= 0 ? '' : '−'}{formatAmount(Math.abs(yearRemainder))}
            </span>
          </div>
        </div>
      </header>

      {/* ── Charts (tabbed on mobile, stacked on desktop) ── */}
      <section className="year-view__chart-section">
        <div className="year-view__tabs" role="tablist">
          {[
            ['line', 'Trend'],
            ['pie', 'Categories'],
            ['breakdown', 'Descriptions'],
          ].map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              className={`year-view__tab${activeTab === key ? ' is-active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={`year-view__panel${activeTab === 'line' ? ' is-active' : ''}`}>
          <YearLineChart
            months={yearData.months}
            categories={categories}
            year={yearNum}
          />
        </div>

        <div className={`year-view__panel year-view__pie-row${activeTab === 'pie' ? ' is-active' : ''}`}>
          <CategoryPieChart
            expenses={allExpenses}
            categories={categories}
            remainder={yearRemainder}
            size={280}
            layout="horizontal"
          />
        </div>

        <div className={`year-view__panel${activeTab === 'breakdown' ? ' is-active' : ''}`}>
          <DescriptionBreakdown expenses={allExpenses} categories={categories} />
        </div>
      </section>

      {/* ── Month grid ── */}
      <div className="year-view__grid">
        {yearData.months.map(m => (
          <MonthCard key={m.month} month={m} year={yearNum} />
        ))}
      </div>
    </div>
  )
}

function MonthCard({ month, year }) {
  const income = month.income || 0
  const totalExpenses = month.expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  const remainder = income - totalExpenses
  const hasData = income > 0 || month.expenses.length > 0
  const remainderPositive = remainder >= 0

  return (
    <Link
      to={`/month/${year}/${month.month}`}
      className={`month-card${hasData ? ' month-card--has-data' : ''}`}
    >
      <div className="month-card__name">{MONTH_NAMES[month.month - 1]}</div>

      <div className="month-card__stats">
        <div className="month-card__stat">
          <span className="month-card__stat-label">Income</span>
          <span className="month-card__stat-value">
            {income > 0 ? formatAmount(income) : <span className="month-card__not-set">Not set</span>}
          </span>
        </div>

        <div className="month-card__stat">
          <span className="month-card__stat-label">Expenses</span>
          <span className="month-card__stat-value month-card__stat-value--expenses">
            {month.expenses.length > 0
              ? `${formatAmount(totalExpenses)} (${month.expenses.length})`
              : <span className="month-card__not-set">None</span>
            }
          </span>
        </div>

        <div className="month-card__stat">
          <span className="month-card__stat-label">Remainder</span>
          <span className={`month-card__stat-value${hasData
            ? remainderPositive
              ? ' month-card__stat-value--positive'
              : ' month-card__stat-value--negative'
            : ''
          }`}>
            {hasData
              ? `${remainderPositive ? '' : '−'}${formatAmount(Math.abs(remainder))}`
              : <span className="month-card__not-set">—</span>
            }
          </span>
        </div>
      </div>
    </Link>
  )
}

function formatAmount(amount) {
  return 'R' + new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
