import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getYears, createYear } from '../api.js'

const now = new Date()
const CURRENT_YEAR = now.getFullYear()
const CURRENT_MONTH = now.getMonth() + 1

export default function YearsList({ authToken }) {
  const [years, setYears] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Add-year dialog state
  const [showAddYear, setShowAddYear] = useState(false)
  const [newYear, setNewYear] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

  // ── Load years ───────────────────────────────────────────────────────────────
  async function loadYears() {
    setLoading(true)
    setError(null)
    try {
      const data = await getYears()
      setYears(data.years || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadYears()
  }, [])

  // ── Add year ─────────────────────────────────────────────────────────────────
  async function handleAddYear(e) {
    e.preventDefault()
    const yearNum = Number(newYear)
    if (!newYear || isNaN(yearNum) || !Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
      setAddError('Enter a valid year between 2000 and 2100.')
      return
    }
    setAddError('')
    setAdding(true)
    try {
      await createYear(yearNum)
      setNewYear('')
      setShowAddYear(false)
      await loadYears()
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAdding(false)
    }
  }

  function handleCancelAdd() {
    setShowAddYear(false)
    setNewYear('')
    setAddError('')
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-loading">
        <p>Loading years…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-error">
        <p>Error: {error}</p>
        <button className="btn btn--primary" onClick={loadYears}>Retry</button>
      </div>
    )
  }

  return (
    <div className="years-list">
      {/* ── Header ── */}
      <header className="years-list__header">
        <div className="years-list__header-actions">
          <Link
            to={`/month/${CURRENT_YEAR}/${CURRENT_MONTH}`}
            className="btn btn--secondary"
          >
            This Month
          </Link>
          {!showAddYear && (
            <button className="btn btn--primary" onClick={() => setShowAddYear(true)}>
              + New Year
            </button>
          )}
        </div>
      </header>

      {/* ── Add Year Form ── */}
      {showAddYear && (
        <form className="add-year-form" onSubmit={handleAddYear}>
          <span className="add-year-form__label">Add Year</span>
          <input
            className={`form-field__input add-year-form__input${addError ? ' form-field__input--error' : ''}`}
            type="number"
            min="2000"
            max="2100"
            placeholder={String(new Date().getFullYear())}
            value={newYear}
            onChange={e => { setNewYear(e.target.value); setAddError('') }}
            autoFocus
          />
          {addError && <span className="form-field__error">{addError}</span>}
          <button type="submit" className="btn btn--primary" disabled={adding}>
            {adding ? 'Creating…' : 'Create'}
          </button>
          <button type="button" className="btn btn--secondary" onClick={handleCancelAdd} disabled={adding}>
            Cancel
          </button>
        </form>
      )}

      {/* ── Year cards ── */}
      {years.length === 0 ? (
        <div className="years-list__empty">
          <p>No years yet.</p>
          <p className="text-muted">Click <strong>+ New Year</strong> to get started.</p>
        </div>
      ) : (
        <div className="years-list__grid">
          {years.map(y => (
            <YearCard key={y.year} data={y} />
          ))}
        </div>
      )}
    </div>
  )
}

function YearCard({ data }) {
  const { year, totalIncome, totalExpenses, remainder } = data
  const remainderPositive = remainder >= 0

  return (
    <Link to={`/year/${year}`} className="year-card">
      <div className="year-card__year">{year}</div>
      <div className="year-card__stats">
        <div className="year-card__stat">
          <span className="year-card__stat-label">Income</span>
          <span className="year-card__stat-value">{formatAmount(totalIncome)}</span>
        </div>
        <div className="year-card__stat">
          <span className="year-card__stat-label">Expenses</span>
          <span className="year-card__stat-value year-card__stat-value--expenses">
            {formatAmount(totalExpenses)}
          </span>
        </div>
        <div className="year-card__stat">
          <span className="year-card__stat-label">Remainder</span>
          <span className={`year-card__stat-value${remainderPositive ? ' year-card__stat-value--positive' : ' year-card__stat-value--negative'}`}>
            {remainderPositive ? '' : '−'}{formatAmount(Math.abs(remainder))}
          </span>
        </div>
      </div>
    </Link>
  )
}

function formatAmount(amount) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
