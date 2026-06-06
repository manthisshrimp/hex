import { useMemo, useState, useRef, useEffect } from 'react'
import CategoryBadge from './CategoryBadge.jsx'

/**
 * ExpenseList - sortable table of expenses with category colors
 *
 * Props:
 *   expenses - array of Expense objects with categoryId
 *   categories - array of Category objects { id, name, color }
 *   onDelete(expenseId) - called when delete button clicked
 *   onEdit(expenseId, updates) - called when expense is edited
 *   onCopyToNextMonth(expense) - called when user wants to copy expense to next month
 *   deleting - Set of expenseIds currently being deleted
 *   sortKey - current sort key ('day' | 'category')
 *   sortDir - current sort direction ('asc' | 'desc')
 *   onSortChange(key, dir) - called when sort changes
 */
export default function ExpenseList({
  expenses = [],
  categories = [],
  onDelete,
  onEdit,
  onCopyToNextMonth,
  deleting = new Set(),
  sortKey = 'day',
  sortDir = 'asc',
  onSortChange,
}) {
  // State for edit modal and context menu
  const [editingExpense, setEditingExpense] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const contextMenuRef = useRef(null)

  // Close context menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Build category lookup map
  const categoryMap = useMemo(() => {
    const map = {}
    for (const cat of categories) {
      map[cat.id] = cat
    }
    return map
  }, [categories])

  function handleSort(key) {
    if (onSortChange) {
      if (sortKey === key) {
        onSortChange(key, sortDir === 'asc' ? 'desc' : 'asc')
      } else {
        onSortChange(key, 'asc')
      }
    }
  }

  const sorted = useMemo(() => {
    const copy = [...expenses]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'day') {
        cmp = a.day - b.day
      } else if (sortKey === 'category') {
        const catA = categoryMap[a.categoryId]?.name || ''
        const catB = categoryMap[b.categoryId]?.name || ''
        cmp = catA.localeCompare(catB)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [expenses, sortKey, sortDir, categoryMap])

  const totalAmount = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  )

  function sortIcon(key) {
    if (sortKey !== key) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  function handleRowClick(e, expense) {
    // Don't trigger if clicking on a button or interactive element
    if (e.target.closest('button') || e.target.closest('a')) return
    setEditingExpense(expense)
  }

  function handleRowContextMenu(e, expense) {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      expense
    })
  }

  function handleEditSave(updatedExpense) {
    if (onEdit) {
      onEdit(updatedExpense.id, {
        day: updatedExpense.day,
        categoryId: updatedExpense.categoryId,
        description: updatedExpense.description,
        amount: updatedExpense.amount
      })
    }
    setEditingExpense(null)
  }

  function handleCopyToNextMonth() {
    if (contextMenu?.expense && onCopyToNextMonth) {
      onCopyToNextMonth(contextMenu.expense)
    }
    setContextMenu(null)
  }

  if (expenses.length === 0) {
    return (
      <div className="expense-list expense-list--empty">
        <p>No expenses recorded this month.</p>
      </div>
    )
  }

  return (
    <div className="expense-list">
      <div className="expense-list__sort-bar">
        <span className="expense-list__sort-label">Sort by:</span>
        <button
          className={`btn btn--sort${sortKey === 'day' ? ' btn--sort-active' : ''}`}
          onClick={() => handleSort('day')}
        >
          Day{sortIcon('day')}
        </button>
        <button
          className={`btn btn--sort${sortKey === 'category' ? ' btn--sort-active' : ''}`}
          onClick={() => handleSort('category')}
        >
          Category{sortIcon('category')}
        </button>
      </div>

      <div className="expense-list__table-wrapper">
        <table className="expense-table">
          <thead>
            <tr>
              <th className="expense-table__th expense-table__th--day">Day</th>
              <th className="expense-table__th expense-table__th--category">Category</th>
              <th className="expense-table__th expense-table__th--description">Description</th>
              <th className="expense-table__th expense-table__th--amount">Amount</th>
              <th className="expense-table__th expense-table__th--actions"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(expense => {
              const category = categoryMap[expense.categoryId]
              return (
                <tr
                  key={expense.id}
                  className="expense-table__row expense-table__row--clickable"
                  onClick={(e) => handleRowClick(e, expense)}
                  onContextMenu={(e) => handleRowContextMenu(e, expense)}
                  title="Click to edit, right-click for options"
                >
                  <td className="expense-table__td expense-table__td--day">
                    {expense.day}
                  </td>
                  <td className="expense-table__td expense-table__td--category">
                    <CategoryBadge category={category} size="sm" variant="pill" />
                  </td>
                  <td className="expense-table__td expense-table__td--description">
                    {expense.description || <span className="text-muted">—</span>}
                  </td>
                  <td className="expense-table__td expense-table__td--amount">
                    {formatAmount(expense.amount)}
                  </td>
                  <td className="expense-table__td expense-table__td--actions">
                    <span className="expense-table__hint"></span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="expense-table__footer">
              <td colSpan={3} className="expense-table__td expense-table__td--total-label">
                Total
              </td>
              <td className="expense-table__td expense-table__td--total-amount">
                {formatAmount(totalAmount)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Edit Modal */}
      {editingExpense && (
        <ExpenseEditModal
          expense={editingExpense}
          categories={categories}
          onSave={handleEditSave}
          onDelete={onDelete}
          onCopyToNextMonth={onCopyToNextMonth}
          onCancel={() => setEditingExpense(null)}
          deleting={deleting}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="expense-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="expense-context-menu__item"
            onClick={() => {
              setEditingExpense(contextMenu.expense)
              setContextMenu(null)
            }}
          >
            ✎ Edit
          </button>
          <button
            className="expense-context-menu__item"
            onClick={handleCopyToNextMonth}
          >
            📋 Copy to next month
          </button>
          <div className="expense-context-menu__divider" />
          <button
            className="expense-context-menu__item expense-context-menu__item--danger"
            onClick={() => {
              if (onDelete) onDelete(contextMenu.expense.id)
              setContextMenu(null)
            }}
            disabled={deleting.has(contextMenu.expense.id)}
          >
            {deleting.has(contextMenu.expense.id) ? '…' : '✕ Delete'}
          </button>
        </div>
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

/**
 * ExpenseEditModal - Modal for editing an expense
 */
function ExpenseEditModal({ expense, categories, onSave, onDelete, onCopyToNextMonth, onCancel, deleting }) {
  const [form, setForm] = useState({
    day: expense.day,
    categoryId: expense.categoryId,
    description: expense.description || '',
    amount: expense.amount,
  })
  const [errors, setErrors] = useState({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function validate() {
    const errs = {}
    const day = Number(form.day)
    if (!form.day || isNaN(day) || day < 1 || day > 31) {
      errs.day = 'Invalid day'
    }
    if (!form.categoryId) {
      errs.categoryId = 'Category required'
    }
    const amount = Number(form.amount)
    if (!form.amount || isNaN(amount) || amount === 0) {
      errs.amount = 'Invalid amount'
    }
    return errs
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSave({
      ...expense,
      day: Number(form.day),
      categoryId: form.categoryId,
      description: form.description.trim(),
      amount: Number(form.amount),
    })
  }

  function handleDelete() {
    if (showDeleteConfirm) {
      onDelete(expense.id)
      onCancel()
    } else {
      setShowDeleteConfirm(true)
    }
  }

  function handleCopy() {
    if (onCopyToNextMonth) {
      onCopyToNextMonth(expense)
      onCancel()
    }
  }

  const categoryMap = {}
  for (const cat of categories) {
    categoryMap[cat.id] = cat
  }
  const currentCategory = categoryMap[form.categoryId]
  const sortedCategories = [...categories].sort((a, b) => 
    a.name.localeCompare(b.name)
  )

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h3 className="modal__title">Edit Expense</h3>
          <button className="modal__close" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal__body">
          <div className="form-grid">
            <div className="form-field">
              <label className="form-field__label">Day</label>
              <input
                type="number"
                name="day"
                min="1"
                max="31"
                value={form.day}
                onChange={handleChange}
                className={`form-field__input${errors.day ? ' form-field__input--error' : ''}`}
              />
              {errors.day && <span className="form-field__error">{errors.day}</span>}
            </div>

            <div className="form-field">
              <label className="form-field__label">Amount</label>
              <input
                type="number"
                name="amount"
                step="0.01"
                value={form.amount}
                onChange={handleChange}
                className={`form-field__input${errors.amount ? ' form-field__input--error' : ''}`}
                title="Use negative for refunds/credits"
              />
              {errors.amount && <span className="form-field__error">{errors.amount}</span>}
            </div>

            <div className="form-field form-field--wide">
              <label className="form-field__label">Category</label>
              <select
                name="categoryId"
                value={form.categoryId}
                onChange={handleChange}
                className={`form-field__input${errors.categoryId ? ' form-field__input--error' : ''}`}
              >
                {sortedCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && <span className="form-field__error">{errors.categoryId}</span>}
            </div>

            <div className="form-field form-field--wide">
              <label className="form-field__label">Description</label>
              <input
                type="text"
                name="description"
                value={form.description}
                onChange={handleChange}
                className="form-field__input"
                placeholder="Optional description"
              />
            </div>
          </div>
        </form>

        <div className="modal__footer">
          <div className="modal__footer-left">
            {!showDeleteConfirm ? (
              <>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={handleDelete}
                  disabled={deleting.has(expense.id)}
                >
                  Delete
                </button>
                {onCopyToNextMonth && (
                  <button
                    type="button"
                    className="btn btn--icon"
                    onClick={handleCopy}
                    title="Copy to next month"
                    aria-label="Copy to next month"
                  >
                    📅→
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                className="btn btn--danger"
                onClick={handleDelete}
                disabled={deleting.has(expense.id)}
              >
                {deleting.has(expense.id) ? '…' : 'Confirm Delete'}
              </button>
            )}
          </div>
          <div className="modal__footer-right">
            <button type="button" className="btn btn--secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={handleSubmit}>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
