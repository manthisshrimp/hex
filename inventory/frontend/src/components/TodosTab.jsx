import { useState, useEffect } from 'react'
import { listTodoSets, deleteTodoSet } from '../api'
import TodoSetView from './TodoSetView'
import './TodosTab.css'

function shareUrl(id) {
  return `${window.location.origin}${window.location.pathname}?todo=${id}`
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function TodosTab() {
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(null)
  const [viewingId, setViewingId] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setSets(await listTodoSets())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id) {
    if (!confirm('Delete this todo set?')) return
    try {
      await deleteTodoSet(id)
      setSets(prev => prev.filter(s => s.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleCopy(id) {
    await navigator.clipboard.writeText(shareUrl(id))
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  if (viewingId) {
    return <TodoSetView id={viewingId} onBack={() => { setViewingId(null); load() }} />
  }

  return (
    <div className="tab-content todos-tab">
      <div className="todos-header">
        <h2>Todo sets</h2>
      </div>
      {loading && <p className="status">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && sets.length === 0 && (
        <p className="empty">No todo sets yet — submit a check with shortfalls to create one</p>
      )}
      {sets.map(set => {
        const total = set.items.length
        const done = set.items.filter(i => i.done).length
        const allDone = done === total
        return (
          <div key={set.id} className={`todo-set-card${allDone ? ' all-done' : ''}`} onClick={() => setViewingId(set.id)} style={{ cursor: 'pointer' }}>
            <div className="tsc-top">
              <span className="tsc-location">{set.locationName}</span>
              <span className="tsc-progress">{done}/{total}</span>
            </div>
            <div className="tsc-date">{formatDate(set.createdAt)}</div>
            <ul className="tsc-items">
              {set.items.map(item => (
                <li key={item.id} className={item.done ? 'tsc-item done' : 'tsc-item'}>
                  <span className={item.done ? 'tsc-check done' : 'tsc-check'}>
                    {item.done ? '✓' : '○'}
                  </span>
                  <span className="tsc-item-name">{item.itemName}</span>
                  <span className="tsc-item-qty">×{item.requiredQuantity}</span>
                </li>
              ))}
            </ul>
            <div className="tsc-actions" onClick={e => e.stopPropagation()}>
              <button
                className={`tsc-share-btn${copied === set.id ? ' copied' : ''}`}
                onClick={() => handleCopy(set.id)}
              >
                {copied === set.id ? 'Copied!' : 'Copy link'}
              </button>
              <button className="tsc-delete-btn" onClick={() => handleDelete(set.id)}>Delete</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
