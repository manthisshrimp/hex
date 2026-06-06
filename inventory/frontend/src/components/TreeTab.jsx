import { useState, useEffect } from 'react'
import { listItems, deleteItem } from '../api'
import ItemForm from './ItemForm'
import CheckScreen from './CheckScreen'
import './TreeTab.css'

export default function TreeTab() {
  const [items, setItems] = useState([])
  const [expanded, setExpanded] = useState(new Set())
  const [editingItem, setEditingItem] = useState(null)
  const [addingParentId, setAddingParentId] = useState(undefined)
  const [checkLocationId, setCheckLocationId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function loadItems() {
    setLoading(true)
    setError(null)
    try {
      const data = await listItems()
      setItems(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleDelete(id) {
    if (!confirm('Delete this item?')) return
    try {
      await deleteItem(id)
      await loadItems()
    } catch (e) {
      alert('Delete failed: ' + e.message)
    }
  }

  async function handleSave() {
    setEditingItem(null)
    setAddingParentId(undefined)
    await loadItems()
  }

  function handleCancel() {
    setEditingItem(null)
    setAddingParentId(undefined)
  }

  function renderItems(parentId, depth = 0) {
    const children = items
      .filter(i => (i.parentId ?? null) === (parentId ?? null))
      .sort((a, b) => {
        if (a.hasChildren !== b.hasChildren) return a.hasChildren ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    return children.map(item => (
      <div key={item.id}>
        <div
          className={`tree-item depth-${depth}${!item.hasChildren ? ' leaf' : ''}`}
          style={{ paddingLeft: depth * 20 + 8, cursor: item.hasChildren ? 'pointer' : 'default' }}
          onClick={() => item.hasChildren && toggleExpand(item.id)}
        >
          {item.hasChildren && (
            <span className="expand-btn">
              {expanded.has(item.id) ? '▼' : '▶'}
            </span>
          )}
          {!item.hasChildren && <span className="expand-spacer" />}
          <span className="tree-item-name">{item.name}</span>
          {item.requiredQuantity > 1 && (
            <span className="tree-item-qty">×{item.requiredQuantity}</span>
          )}
          {item.tags?.map(t => (
            <span key={t} className="item-tag">{t}</span>
          ))}
          <div className="tree-item-actions" onClick={e => e.stopPropagation()}>
            <button onClick={() => setEditingItem(item)}>✏</button>
            <button onClick={() => handleDelete(item.id)}>×</button>
            <button onClick={() => setAddingParentId(item.id)}>+child</button>
            {item.hasChildren && (
              <button onClick={() => setCheckLocationId(item.id)}>Check</button>
            )}
          </div>
        </div>
        {expanded.has(item.id) && renderItems(item.id, depth + 1)}
      </div>
    ))
  }

  return (
    <div className="tree-tab">
      <div className="tree-header">
        <h2>Items</h2>
        <button className="add-btn" onClick={() => setAddingParentId(null)}>+ Add item</button>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && renderItems(null)}

      {(editingItem !== null || addingParentId !== undefined) && (
        <ItemForm
          item={editingItem}
          parentId={addingParentId}
          allItems={items}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
      {checkLocationId && (
        <CheckScreen locationId={checkLocationId} onClose={() => setCheckLocationId(null)} />
      )}
    </div>
  )
}
