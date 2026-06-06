import { useState, useEffect } from 'react'
import { listTags } from '../api'
import './SettingsTab.css'

export default function SettingsTab() {
  const [tags, setTags] = useState([])

  useEffect(() => {
    listTags().then(setTags).catch(() => {})
  }, [])

  function handleLogout() {
    localStorage.removeItem('octiron_token')
    window.location.reload()
  }

  return (
    <div className="tab-content settings-tab">
      <h2>Settings</h2>

      <section className="settings-section">
        <h3>Account</h3>
        <button className="logout-btn" onClick={handleLogout}>Log out</button>
      </section>

      <section className="settings-section">
        <h3>Tags</h3>
        <p className="settings-hint">Tags are managed on individual items via the Tree view.</p>
        {tags.length > 0 && (
          <div className="tags-list">
            {tags.map(tag => (
              <span key={tag} className="item-tag">{tag}</span>
            ))}
          </div>
        )}
        {tags.length === 0 && <p className="settings-hint">No tags yet.</p>}
      </section>
    </div>
  )
}
