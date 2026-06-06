import { useState, useEffect, useRef } from 'react'
import { getCategories } from '../api.js'

const EMPTY_FORM = {
  day: '',
  categoryId: '',
  description: '',
  amount: '',
}

/**
 * ExpenseForm - compact inline form to add a new expense
 *
 * Props:
 *   onSave(expense) - called with { day, categoryId, description, amount }
 *   onCancel() - called when user cancels
 *   saving - boolean, disables form while saving
 *   initialData - optional { day, categoryId, description, amount } for editing
 *   stayOpen - boolean, if true keeps form open after save for rapid entry
 */
export default function ExpenseForm({ onSave, onCancel, saving, initialData = null, stayOpen = true }) {
  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [form, setForm] = useState(initialData || EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const dayInputRef = useRef(null)

  // Load categories on mount
  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await getCategories()
        const sortedCategories = (data.categories || []).sort((a, b) => 
          a.name.localeCompare(b.name)
        )
        setCategories(sortedCategories)
        if (!initialData && sortedCategories.length > 0) {
          setForm(prev => ({ ...prev, categoryId: sortedCategories[0].id }))
        }
      } catch (err) {
        console.error('Failed to load categories:', err)
      } finally {
        setCategoriesLoading(false)
      }
    }
    loadCategories()
  }, [initialData])

  // Focus day input when form loads (only for new entries, not editing)
  useEffect(() => {
    if (!initialData && dayInputRef.current && !categoriesLoading) {
      dayInputRef.current.focus()
    }
  }, [categoriesLoading, initialData])

  useEffect(() => {
    if (initialData) {
      setForm(initialData)
    }
  }, [initialData])

  function validate() {
    const errs = {}
    const day = Number(form.day)
    if (!form.day || isNaN(day) || day < 1 || day > 31) {
      errs.day = 'Invalid'
    }
    if (!form.categoryId) {
      errs.categoryId = 'Required'
    }
    const amount = Number(form.amount)
    if (!form.amount || isNaN(amount) || amount === 0) {
      errs.amount = 'Invalid'
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
      day: Number(form.day),
      categoryId: form.categoryId,
      description: form.description.trim(),
      amount: Number(form.amount),
    })
    
    // If stayOpen mode, clear form for next entry (keep category) and refocus
    if (stayOpen && !initialData) {
      const savedCategory = form.categoryId
      setForm({
        day: '',
        categoryId: savedCategory,
        description: '',
        amount: '',
      })
      setErrors({})
      // Refocus day input after a short delay to let DOM update
      setTimeout(() => {
        dayInputRef.current?.focus()
      }, 50)
    }
  }

  if (categoriesLoading) {
    return (
      <div className="expense-form expense-form--inline">
        <span className="text-muted">Loading…</span>
      </div>
    )
  }

  return (
    <form className="expense-form expense-form--inline" onSubmit={handleSubmit} noValidate>
      <div className="expense-form__row">
        {/* Day */}
        <input
          ref={dayInputRef}
          className={`expense-form__input expense-form__input--day${errors.day ? ' form-field__input--error' : ''}`}
          type="number"
          name="day"
          min="1"
          max="31"
          placeholder="Day"
          value={form.day}
          onChange={handleChange}
          disabled={saving}
          title={errors.day || 'Day of month (1–31)'}
        />

        {/* Category */}
        <select
          className={`expense-form__input expense-form__input--category${errors.categoryId ? ' form-field__input--error' : ''}`}
          name="categoryId"
          value={form.categoryId}
          onChange={handleChange}
          disabled={saving}
          title={errors.categoryId || 'Category'}
        >
          <option value="">Category…</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* Description */}
        <input
          className="expense-form__input expense-form__input--description"
          type="text"
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={handleChange}
          disabled={saving}
        />

        {/* Amount */}
        <input
          className={`expense-form__input expense-form__input--amount${errors.amount ? ' form-field__input--error' : ''}`}
          type="number"
          name="amount"
          step="0.01"
          placeholder="Amount"
          value={form.amount}
          onChange={handleChange}
          disabled={saving}
          title={errors.amount || 'Amount (use negative for refunds/credits)'}
        />

        {/* Actions */}
        <button
          type="submit"
          className="btn btn--primary btn--sm"
          disabled={saving}
        >
          {saving ? '…' : '✓'}
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={onCancel}
          disabled={saving}
        >
          ✕
        </button>
      </div>
    </form>
  )
}
