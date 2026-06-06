import { useState, useEffect } from 'react'
import { setAuthToken, setAuthFailureHandler } from './api'
import AdminAuth from './components/AdminAuth'
import SearchTab from './components/SearchTab'
import TreeTab from './components/TreeTab'
import TodosTab from './components/TodosTab'
import SettingsTab from './components/SettingsTab'
import TodoSetView from './components/TodoSetView'
import './App.css'

// Check for public todo-set share link: ?todo=<id>
const sharedTodoSetId = new URLSearchParams(window.location.search).get('todo')

function App() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('octiron_token'))
  const [activeTab, setActiveTab] = useState('tree')

  useEffect(() => {
    const stored = localStorage.getItem('octiron_token')
    if (stored) {
      setAuthToken(stored)
    }
    setAuthFailureHandler(() => {
      localStorage.removeItem('octiron_token')
      setAuthed(false)
    })
  }, [])

  const handleAuth = (token) => {
    setAuthToken(token)
    setAuthed(true)
  }

  if (sharedTodoSetId) {
    return <TodoSetView id={sharedTodoSetId} />
  }

  if (!authed) {
    return <AdminAuth onAuth={handleAuth} />
  }

  return (
    <div className="app">
      {activeTab === 'search' && <SearchTab />}
      {activeTab === 'tree' && <TreeTab />}
      {activeTab === 'todos' && <TodosTab />}
      {activeTab === 'settings' && <SettingsTab />}
      <nav className="bottom-nav">
        <button onClick={() => setActiveTab('tree')} className={activeTab === 'tree' ? 'active' : ''}>
          <span className="tab-icon">⬡</span>Tree
        </button>
        <button onClick={() => setActiveTab('search')} className={activeTab === 'search' ? 'active' : ''}>
          <span className="tab-icon">⌕</span>Search
        </button>
        <button onClick={() => setActiveTab('todos')} className={activeTab === 'todos' ? 'active' : ''}>
          <span className="tab-icon">✓</span>Todos
        </button>
        <button onClick={() => setActiveTab('settings')} className={activeTab === 'settings' ? 'active' : ''}>
          <span className="tab-icon">⚙</span>Settings
        </button>
      </nav>
    </div>
  )
}

export default App
