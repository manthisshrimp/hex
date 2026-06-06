import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSnackbar } from './Snackbar.jsx'
import { getCategories, createCategory, updateCategory, deleteCategory } from '../api.js'
import ColorPicker from './ColorPicker.jsx'
import CategoryBadge from './CategoryBadge.jsx'

/**
 * CategoriesManager - Page for managing expense categories
 *
 * Props:
 *   authToken: string - Authentication token
 */
export default function CategoriesManager({ authToken }) {
  const navigate = useNavigate()
  const snackbar = useSnackbar()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Form state for adding new category
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#22c55e')
  const [adding, setAdding] = useState(false)
  
  // Editing state
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [saving, setSaving] = useState(false)
  
  // Deleting state
  const [deletingId, setDeletingId] = useState(null)

  // Load categories
  const loadCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getCategories()
      const sortedCategories = (data.categories || []).sort((a, b) => 
        a.name.localeCompare(b.name)
      )
      setCategories(sortedCategories)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  // Handle add category
  async function handleAdd(e) {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    
    setAdding(true)
    try {
      await createCategory(
        { name: newCategoryName.trim(), color: newCategoryColor }
      )
      setNewCategoryName('')
      setNewCategoryColor('#22c55e')
      setShowAddForm(false)
      await loadCategories()
      snackbar.show('Category added', 'success')
    } catch (err) {
      snackbar.show(`Error: ${err.message}`, 'error')
    } finally {
      setAdding(false)
    }
  }

  // Handle start editing
  function handleStartEdit(category) {
    setEditingId(category.id)
    setEditName(category.name)
    setEditColor(category.color)
  }

  // Handle save edit
  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!editName.trim()) return
    
    setSaving(true)
    try {
      await updateCategory(
        editingId,
        { name: editName.trim(), color: editColor }
      )
      setEditingId(null)
      await loadCategories()
      snackbar.show('Category updated', 'success')
    } catch (err) {
      snackbar.show(`Error: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Handle cancel edit
  function handleCancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditColor('')
  }

  // Handle delete
  async function handleDelete(categoryId) {
    if (!confirm('Delete this category? This cannot be undone.')) return
    
    setDeletingId(categoryId)
    try {
      await deleteCategory(categoryId)
      await loadCategories()
      snackbar.show('Category deleted', 'success')
    } catch (err) {
      if (err.message.includes('in use') || err.message.includes('409')) {
        snackbar.show('Cannot delete: Category is in use by expenses', 'error', 5000)
      } else {
        snackbar.show(`Error: ${err.message}`, 'error')
      }
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="page-loading">
        <p>Loading categories…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-error">
        <p>Error: {error}</p>
        <button className="btn btn--primary" onClick={loadCategories}>Retry</button>
        <Link to="/" className="btn btn--secondary">Back Home</Link>
      </div>
    )
  }

  return (
    <div className="categories-manager">
      {/* Header */}
      <header className="categories-manager__header">
        <div className="categories-manager__nav-top">
          <button onClick={() => navigate(-1)} className="btn btn--ghost">
            ← Back
          </button>
        </div>
        <h1 className="categories-manager__title">Manage Categories</h1>
        <p className="categories-manager__help">
          Add, edit, or remove expense categories. Changes apply to all years.
        </p>
      </header>

      {/* Add Category Button */}
      {!showAddForm && (
        <div className="categories-manager__add-section">
          <button
            className="btn btn--primary"
            onClick={() => setShowAddForm(true)}
          >
            + Add New Category
          </button>
        </div>
      )}

      {/* Add Category Form */}
      {showAddForm && (
        <form className="category-form category-form--add" onSubmit={handleAdd}>
          <h3 className="category-form__title">Add New Category</h3>
          
          <div className="category-form__fields">
            <div className="form-field">
              <label className="form-field__label" htmlFor="new-cat-name">
                Category Name
              </label>
              <input
                id="new-cat-name"
                type="text"
                className="form-field__input"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Gym Membership"
                required
                disabled={adding}
              />
            </div>

            <div className="form-field">
              <label className="form-field__label">Color</label>
              <ColorPicker
                color={newCategoryColor}
                onChange={setNewCategoryColor}
                disabled={adding}
              />
            </div>
          </div>

          <div className="category-form__actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={adding || !newCategoryName.trim()}
            >
              {adding ? 'Adding…' : 'Add Category'}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setShowAddForm(false)
                setNewCategoryName('')
                setNewCategoryColor('#22c55e')
              }}
              disabled={adding}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Categories List */}
      <div className="categories-list">
        <h2 className="categories-list__title">
          Categories ({categories.length})
        </h2>
        
        {categories.length === 0 ? (
          <p className="categories-list__empty">
            No categories yet. Add your first category above.
          </p>
        ) : (
          <div className="categories-list__grid">
            {categories.map((category) => (
              <div
                key={category.id}
                className={`category-card ${editingId === category.id ? 'category-card--editing' : ''}`}
              >
                {editingId === category.id ? (
                  // Edit Mode
                  <form className="category-card__edit-form" onSubmit={handleSaveEdit}>
                    <div className="category-card__edit-color">
                      <ColorPicker
                        color={editColor}
                        onChange={setEditColor}
                        disabled={saving}
                      />
                    </div>
                    <div className="category-card__edit-name">
                      <input
                        type="text"
                        className="form-field__input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Category name"
                        required
                        disabled={saving}
                      />
                    </div>
                    <div className="category-card__edit-actions">
                      <button
                        type="submit"
                        className="btn btn--primary btn--sm"
                        disabled={saving || !editName.trim()}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={handleCancelEdit}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  // View Mode
                  <>
                    <div className="category-card__header">
                      <CategoryBadge category={category} size="md" />
                    </div>
                    <div className="category-card__actions">
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => handleStartEdit(category)}
                        title="Edit category"
                      >
                        ✎
                      </button>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => handleDelete(category.id)}
                        disabled={deletingId === category.id}
                        title="Delete category"
                      >
                        {deletingId === category.id ? '…' : '×'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
