import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useSnackbar } from './Snackbar.jsx'
import { getMonth, getYear, updateIncome, addExpense, deleteExpense, updateExpense, copyExpenseToNextMonth, getCategories } from '../api.js'
import ExpenseList from './ExpenseList.jsx'
import ExpenseForm from './ExpenseForm.jsx'
import CategoryPieChart from './CategoryPieChart.jsx'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function MonthView({ authToken }) {
  const { year, month } = useParams()
  const navigate = useNavigate()
  const snackbar = useSnackbar()

  const yearNum = Number(year)
  const monthNum = Number(month)

  const [monthData, setMonthData] = useState(null)
  const [yearData, setYearData] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Income field state (local, debounce-synced to backend)
  const [incomeInput, setIncomeInput] = useState('')
  const [incomeSaving, setIncomeSaving] = useState(false)
  const incomeTimerRef = useRef(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [formSaving, setFormSaving] = useState(false)

  // Deleting state - track which expense IDs are being deleted
  const [deletingIds, setDeletingIds] = useState(new Set())

  // Sort state - lifted here so it persists across add/delete
  const [sortKey, setSortKey] = useState('day')
  const [sortDir, setSortDir] = useState('asc')

  // ── Load month data, year data, and categories ─────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [monthData, yearData, categoriesData] = await Promise.all([
        getMonth(yearNum, monthNum),
        getYear(yearNum),
        getCategories()
      ])
      setMonthData(monthData)
      setYearData(yearData)
      setCategories(categoriesData.categories || [])
      setIncomeInput(monthData.income != null ? String(monthData.income) : '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [yearNum, monthNum])

  useEffect(() => {
    loadData()
    return () => {
      if (incomeTimerRef.current) clearTimeout(incomeTimerRef.current)
    }
  }, [loadData])

  // ── Income auto-save (debounced 800ms) ───────────────────────────────────────
  function handleIncomeChange(e) {
    const val = e.target.value
    setIncomeInput(val)

    if (incomeTimerRef.current) clearTimeout(incomeTimerRef.current)
    incomeTimerRef.current = setTimeout(async () => {
      const parsed = Number(val)
      if (val === '' || isNaN(parsed) || parsed < 0) return
      setIncomeSaving(true)
      try {
        const updated = await updateIncome(yearNum, monthNum, parsed)
        setMonthData(updated)
      } catch (err) {
        console.error('Failed to save income:', err)
      } finally {
        setIncomeSaving(false)
      }
    }, 800)
  }

  // ── Add expense ──────────────────────────────────────────────────────────────
  async function handleAddExpense(expense) {
    setFormSaving(true)
    try {
      await addExpense(yearNum, monthNum, expense)
      await loadData()
      // Form stays open for rapid entry - ExpenseForm handles clearing fields
    } catch (err) {
      console.error('Failed to add expense:', err)
      snackbar.show(`Error: ${err.message}`, 'error')
    } finally {
      setFormSaving(false)
    }
  }

  // ── Delete expense ───────────────────────────────────────────────────────────
  async function handleDeleteExpense(expenseId) {
    setDeletingIds(prev => new Set([...prev, expenseId]))
    try {
      await deleteExpense(yearNum, monthNum, expenseId)
      setMonthData(prev => ({
        ...prev,
        expenses: prev.expenses.filter(e => e.id !== expenseId),
      }))
    } catch (err) {
      console.error('Failed to delete expense:', err)
      snackbar.show(`Error: ${err.message}`, 'error')
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev)
        next.delete(expenseId)
        return next
      })
    }
  }

  // ── Edit expense ─────────────────────────────────────────────────────────────
  async function handleEditExpense(expenseId, updates) {
    try {
      const updated = await updateExpense(yearNum, monthNum, expenseId, updates)
      setMonthData(prev => ({
        ...prev,
        expenses: prev.expenses.map(e => e.id === expenseId ? updated : e),
      }))
    } catch (err) {
      console.error('Failed to update expense:', err)
      snackbar.show(`Error: ${err.message}`, 'error')
    }
  }

  // ── Copy expense to next month ────────────────────────────────────────────
  async function handleCopyToNextMonth(expense) {
    try {
      await copyExpenseToNextMonth(yearNum, monthNum, expense.id)
      // Show success message
      const nextMonth = monthNum === 12 ? 1 : monthNum + 1
      const nextYear = monthNum === 12 ? yearNum + 1 : yearNum
      snackbar.show(`Copied to ${MONTH_NAMES[nextMonth - 1]} ${nextYear}`, 'success')
    } catch (err) {
      console.error('Failed to copy expense:', err)
      snackbar.show(`Error: ${err.message}`, 'error')
    }
  }

  // ── Navigation helpers ───────────────────────────────────────────────────────
  function prevMonth() {
    if (monthNum === 1) {
      navigate(`/month/${yearNum - 1}/12`)
    } else {
      navigate(`/month/${yearNum}/${monthNum - 1}`)
    }
  }

  function nextMonth() {
    if (monthNum === 12) {
      navigate(`/month/${yearNum + 1}/1`)
    } else {
      navigate(`/month/${yearNum}/${monthNum + 1}`)
    }
  }

  // ── Derived values ───────────────────────────────────────────────────────────
  const income = monthData ? (monthData.income || 0) : 0
  const totalExpenses = monthData
    ? monthData.expenses.reduce((sum, e) => sum + e.amount, 0)
    : 0
  const remainder = income - totalExpenses
  const remainderPositive = remainder >= 0

  // Calculate annual remainder (same calculation as YearView)
  const annualRemainder = yearData?.months
    ? yearData.months.reduce((sum, m) => {
        const monthIncome = m?.income || 0
        const monthExpenses = m?.expenses?.reduce((s, e) => s + (e?.amount || 0), 0) || 0
        return sum + (monthIncome - monthExpenses)
      }, 0)
    : 0
  const annualRemainderPositive = annualRemainder >= 0

  const monthName = MONTH_NAMES[monthNum - 1] || 'Unknown'

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-loading">
        <p>Loading {monthName} {yearNum}…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-error">
        <p>Error: {error}</p>
        <button className="btn btn--primary" onClick={loadData}>Retry</button>
        <Link to={`/year/${yearNum}`} className="btn btn--secondary">Back to {yearNum}</Link>
      </div>
    )
  }

  return (
    <div className="month-view">
      {/* ── Header ── */}
      <header className="month-view__header">
        <div className="month-view__nav-top">
          <Link to={`/year/${yearNum}`} className="btn btn--ghost">
            ← {yearNum}
          </Link>
          <Link to="/categories" className="btn btn--ghost">
            🏷️ Manage Categories
          </Link>
        </div>

        <div className="month-view__title-row">
          <button
            className="btn btn--ghost btn--nav"
            onClick={prevMonth}
            title="Previous month"
            aria-label="Previous month"
          >
            ‹
          </button>
          <h1 className="month-view__title">
            {monthName} <span className="month-view__year">{yearNum}</span>
          </h1>
          <button
            className="btn btn--ghost btn--nav"
            onClick={nextMonth}
            title="Next month"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </header>

      {/* ── Budget Summary with Pie Chart ── */}
      <section className="month-view__summary-section">
        {/* Top: Large Pie Chart with Legend beside it */}
        <div className="month-view__chart-row">
          <CategoryPieChart
            expenses={monthData.expenses}
            categories={categories}
            remainder={remainder}
            size={280}
            layout="horizontal"
          />
        </div>

        {/* Bottom: Income & Remainder side by side */}
        <div className="month-view__budget-row">
          <div className="budget-card budget-card--compact">
            <label className="budget-card__label" htmlFor="income-input">
              Monthly Income
            </label>
            <div className="budget-card__input-row">
              <input
                id="income-input"
                className="budget-card__input budget-card__input--compact"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={incomeInput}
                onChange={handleIncomeChange}
              />
              {incomeSaving && <span className="budget-card__saving">Saving…</span>}
            </div>
          </div>

          <div className={`budget-card budget-card--compact budget-card--combined ${remainderPositive ? '' : 'budget-card--negative'}`}>
            <div className="budget-card__row">
              <span className="budget-card__label">Remaining Budget</span>
              <span className={`budget-card__amount budget-card__amount--compact${remainderPositive ? '' : ' budget-card__amount--negative'}`}>
                {remainderPositive ? '' : '−'}{formatAmount(Math.abs(remainder))}
              </span>
            </div>
            <div className="budget-card__divider" />
            <div className="budget-card__row">
              <span className="budget-card__label budget-card__label--secondary">Annual Remainder</span>
              <span className={`budget-card__amount budget-card__amount--compact budget-card__amount--secondary ${annualRemainderPositive ? '' : 'budget-card__amount--negative'}`}>
                {annualRemainderPositive ? '' : '−'}{formatAmount(Math.abs(annualRemainder))}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Expenses ── */}
      <section className="month-view__expenses">
        <div className="month-view__expenses-header">
          <h2 className="month-view__section-title">
            Expenses
            {monthData.expenses.length > 0 && (
              <span className="month-view__expense-count">
                {' '}({monthData.expenses.length})
              </span>
            )}
          </h2>
          {!showForm && (
            <button
              className="btn btn--primary"
              onClick={() => setShowForm(true)}
            >
              + Add Expense
            </button>
          )}
        </div>

        {showForm && (
          <ExpenseForm
            onSave={handleAddExpense}
            onCancel={() => setShowForm(false)}
            saving={formSaving}
          />
        )}

        <ExpenseList
          expenses={monthData.expenses}
          categories={categories}
          onDelete={handleDeleteExpense}
          onEdit={handleEditExpense}
          onCopyToNextMonth={handleCopyToNextMonth}
          deleting={deletingIds}
          sortKey={sortKey}
          sortDir={sortDir}
          onSortChange={(key, dir) => { setSortKey(key); setSortDir(dir) }}
        />
      </section>
    </div>
  )
}

function formatAmount(amount) {
  return 'R' + new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
