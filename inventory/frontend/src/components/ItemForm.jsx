import { useState } from 'react'
import { createItem, updateItem } from '../api'
import './ItemForm.css'

export default function ItemForm({ item, parentId, allItems, onSave, onCancel }) {
  const [name, setName] = useState(item?.name ?? '')
  const [selectedParentId, setSelectedParentId] = useState(
    item ? (item.parentId ?? '') : (parentId ?? '')
  )
  const [requiredQty, setRequiredQty] = useState(item?.requiredQuantity ?? 1)
  const [tags, setTags] = useState(item?.tags?.join(', ') ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const parsedTags = tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    const data = {
      name: name.trim(),
      parentId: selectedParentId || null,
      requiredQuantity: Number(requiredQty),
      tags: parsedTags,
      notes: notes.trim() || null,
    }

    try {
      let result
      if (item) {
        result = await updateItem(item.id, data)
      } else {
        result = await createItem(data)
      }
      onSave(result)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  // Exclude the item being edited from the parent selector to avoid cycles
  const parentOptions = allItems.filter(i => i.id !== item?.id)

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
        <div className="modal-header">
          <h3>{item ? 'Edit Item' : 'Add Item'}</h3>
          <div className="modal-header-actions">
            <button type="submit" className="modal-save-btn" disabled={saving}>{item ? 'Save' : 'Add'}</button>
            <button type="button" className="modal-cancel-btn" onClick={onCancel}>✕</button>
          </div>
        </div>
          <div className="form-field">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-field">
            <label>Parent</label>
            <select
              value={selectedParentId}
              onChange={e => setSelectedParentId(e.target.value)}
            >
              <option value="">(none — root item)</option>
              {parentOptions.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Required qty</label>
            <input
              type="number"
              min="1"
              value={requiredQty}
              onChange={e => setRequiredQty(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="e.g. first-aid, tool"
            />
          </div>

          <div className="form-field">
            <label>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows="3"
              placeholder="Optional notes"
            />
          </div>

          {error && <p className="form-error">{error}</p>}
        </form>
      </div>
    </div>
  )
}
