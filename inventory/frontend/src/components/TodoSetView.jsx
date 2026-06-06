import { useState, useEffect } from 'react'
import { getTodoSet, markTodoSetItemDone } from '../api'
import './TodoSetView.css'

export default function TodoSetView({ id, onBack }) {
  const [set, setSet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getTodoSet(id)
      .then(setSet)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  async function handleDone(itemId) {
    try {
      const updated = await markTodoSetItemDone(id, itemId)
      setSet(updated)
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) return <div className="todo-set-view"><p className="tsv-status">Loading…</p></div>
  if (error) return <div className="todo-set-view"><p className="tsv-error">{error}</p></div>
  if (!set) return null

  const total = set.items.length
  const done = set.items.filter(i => i.done).length
  const allDone = done === total

  return (
    <div className="todo-set-view">
      <div className="tsv-header">
        {onBack && (
          <button className="tsv-back-btn" onClick={onBack}>← Back</button>
        )}
        <div className="tsv-title">Restock: {set.locationName}</div>
        <div className="tsv-meta">{done}/{total} done</div>
      </div>
      <div className="tsv-body">
        {allDone && (
          <div className="tsv-complete">All items done!</div>
        )}
        {set.items.map(item => (
          <div key={item.id} className={`tsv-item${item.done ? ' done' : ''}`}>
            <div className="tsv-item-info">
              <span className="tsv-item-name">{item.itemName}</span>
              {item.path && <span className="tsv-item-path">{item.path}</span>}
              <span className="tsv-item-qty">
                Need {item.requiredQuantity} · had {item.actualQuantity}
              </span>
            </div>
            {!item.done ? (
              <button className="tsv-done-btn" onClick={() => handleDone(item.id)}>✓</button>
            ) : (
              <span className="tsv-done-label">✓</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
