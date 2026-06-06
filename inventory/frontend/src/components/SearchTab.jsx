import { useState, useEffect, useRef } from 'react'
import { searchItems, listItems } from '../api'
import './SearchTab.css'

export default function SearchTab() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = query.trim() ? await searchItems(query) : await listItems()
        setResults(data)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  return (
    <div className="tab-content search-tab">
      <input
        className="search-input"
        type="search"
        placeholder="Search items..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        autoFocus
      />
      {loading && <p className="search-status">Searching...</p>}
      {error && <p className="search-error">{error}</p>}
      <ul className="item-list">
        {results.map(item => (
          <li key={item.id} className="item-card">
            <div className="item-name">{item.name}</div>
            {item.path && <div className="item-path">{item.path}</div>}
            <div className="item-meta">
              {item.requiredQuantity > 1 && <span className="item-qty">×{item.requiredQuantity}</span>}
              {item.tags?.map(tag => <span key={tag} className="item-tag">{tag}</span>)}
            </div>
          </li>
        ))}
      </ul>
      {!loading && results.length === 0 && query && (
        <p className="search-status">No results for "{query}"</p>
      )}
    </div>
  )
}
