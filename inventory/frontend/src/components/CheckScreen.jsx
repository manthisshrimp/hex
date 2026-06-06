import { useState, useRef } from 'react'
import { createCheck, submitCheck } from '../api'
import './CheckScreen.css'

function ShareButton({ todoSetId }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}${window.location.pathname}?todo=${todoSetId}`
  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button className={`check-share-btn${copied ? ' copied' : ''}`} onClick={copy}>
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  )
}

export default function CheckScreen({ locationId, onClose }) {
  const [mode, setMode] = useState(null) // null | 'shallow' | 'deep'
  const [check, setCheck] = useState(null)
  const [actuals, setActuals] = useState({})
  const [revealed, setRevealed] = useState(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const inputRefs = useRef({})

  async function startCheck(mode) {
    setMode(mode)
    setLoading(true)
    setError(null)
    try {
      const data = await createCheck(locationId, mode)
      setCheck(data)
      setActuals({})
      setRevealed(new Set())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function confirmItem(item) {
    setActuals(prev => ({ ...prev, [item.id]: item.requiredQuantity }))
    setRevealed(prev => new Set([...prev, item.id]))
  }

  function clearItem(item) {
    setActuals(prev => ({ ...prev, [item.id]: '' }))
    setRevealed(prev => new Set([...prev, item.id]))
    setTimeout(() => inputRefs.current[item.id]?.focus(), 50)
  }

  async function handleSubmit() {
    if (!check) return
    setLoading(true)
    setError(null)
    try {
      const entries = check.items.map(item => ({
        itemId: item.id,
        actualQuantity: revealed.has(item.id)
          ? parseInt(actuals[item.id] || '0', 10)
          : item.requiredQuantity,
      }))
      const data = await submitCheck(check.id, entries)
      setResult(data)
      setSubmitted(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="check-overlay">
      <div className="check-header">
        <button className="back-btn" onClick={onClose}>← Back</button>
        <h2>Check</h2>
      </div>
      <div className="check-body">
        {!mode && (
          <div className="check-mode-picker">
            <button className="check-mode-btn" onClick={() => startCheck('oneLevel')}>
              <span className="check-mode-title">One level</span>
              <span className="check-mode-desc">Direct contents of this location</span>
            </button>
            <button className="check-mode-btn" onClick={() => startCheck('leaves')}>
              <span className="check-mode-title">Leaves</span>
              <span className="check-mode-desc">Only items with no sub-items, across all depths</span>
            </button>
            <button className="check-mode-btn" onClick={() => startCheck('fullDepth')}>
              <span className="check-mode-title">Full depth</span>
              <span className="check-mode-desc">Everything nested inside</span>
            </button>
          </div>
        )}

        {mode && loading && <p>Loading…</p>}
        {mode && error && <p className="error">{error}</p>}

        {mode && !loading && !submitted && check && (
          <>
            {check.items.length === 0 && (
              <p>No items found in this location.</p>
            )}
            {check.items.map(item => (
              <div key={item.id} className="check-item">
                <div className="check-item-info">
                  <span className="check-item-name">{item.name}</span>
                  {mode !== 'oneLevel' && item.path && (
                    <span className="check-item-path">{item.path}</span>
                  )}
                </div>
                <span className="check-item-required">×{item.requiredQuantity}</span>
                <div className="check-item-controls">
                  <button className="check-confirm-btn" onClick={() => confirmItem(item)}>✓</button>
                  <button className="check-clear-btn" onClick={() => clearItem(item)}>✗</button>
                  {revealed.has(item.id) && (
                    <input
                      type="number"
                      min="0"
                      className="check-actual-input"
                      value={actuals[item.id] ?? ''}
                      ref={el => { inputRefs.current[item.id] = el }}
                      onChange={e => setActuals(prev => ({ ...prev, [item.id]: e.target.value }))}
                    />
                  )}
                </div>
              </div>
            ))}
            {check.items.length > 0 && (
              <button className="submit-check-btn" onClick={handleSubmit}>
                Submit check
              </button>
            )}
          </>
        )}

        {mode && !loading && submitted && result && (
          <>
            {result.todoSetId && (
              <div className="check-todo-set-banner">
                <div className="check-todo-set-label">
                  {result.entries.filter(e => e.actualQuantity < e.requiredQuantity).length} shortfall{result.entries.filter(e => e.actualQuantity < e.requiredQuantity).length !== 1 ? 's' : ''} — todo set created
                </div>
                <ShareButton todoSetId={result.todoSetId} />
              </div>
            )}
            {result.entries.map(entry => {
              const pass = entry.actualQuantity >= entry.requiredQuantity
              const item = check.items.find(i => i.id === entry.itemId)
              const name = item ? item.name : entry.itemId
              return (
                <div key={entry.id} className="check-result-item">
                  <span className={pass ? 'check-pass' : 'check-fail'}>
                    {pass ? '✓' : '✗'}
                  </span>
                  <span style={{ flex: 1 }}>{name}</span>
                  <span style={{ color: '#6b7280', fontSize: 13 }}>
                    {entry.actualQuantity} / {entry.requiredQuantity}
                  </span>
                </div>
              )
            })}
            <button className="done-btn" onClick={onClose}>Done</button>
          </>
        )}
      </div>
    </div>
  )
}
