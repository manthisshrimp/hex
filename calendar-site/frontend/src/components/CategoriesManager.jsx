import { useState } from 'react';
import ColorPicker from './ColorPicker';
import { useCategories } from '../hooks/useCategories';
import { importHolidays } from '../api';
import './CategoriesManager.css';

export default function CategoriesManager({ onClose }) {
  const { categories, loading, createCategory, updateCategory, deleteCategory } = useCategories();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [newNonWorking, setNewNonWorking] = useState(false);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editNonWorking, setEditNonWorking] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await createCategory({ name: newName.trim(), color: newColor, isNonWorking: newNonWorking });
      setNewName('');
      setNewColor('#3b82f6');
      setNewNonWorking(false);
      setShowAddForm(false);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setAdding(false);
    }
  }

  function startEdit(cat) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
    setEditNonWorking(!!cat.isNonWorking);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateCategory(editingId, { name: editName.trim(), color: editColor, isNonWorking: editNonWorking });
      setEditingId(null);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this category?')) return;
    setDeletingId(id);
    try {
      await deleteCategory(id);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleImportHolidays() {
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importHolidays();
      setImportResult(`Imported ${result.imported} holidays, ${result.skipped} already existed.`);
    } catch (err) {
      setImportResult(`Error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="cat-manager">
      <div className="cat-manager-header">
        <h2>Categories</h2>
        {onClose && (
          <button className="cat-manager-close" onClick={onClose} title="Close">×</button>
        )}
      </div>

      {!showAddForm ? (
        <div className="cat-manager-add-row">
          <button className="btn-cat-add" onClick={() => setShowAddForm(true)}>
            + New Category
          </button>
        </div>
      ) : (
        <form className="cat-form" onSubmit={handleAdd}>
          <div className="cat-form-fields">
            <input
              type="text"
              className="cat-form-input"
              placeholder="Category name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              disabled={adding}
              autoFocus
              required
            />
            <ColorPicker selectedColor={newColor} onChange={setNewColor} />
            <label className="cat-nonworking-label">
              <input
                type="checkbox"
                checked={newNonWorking}
                onChange={e => setNewNonWorking(e.target.checked)}
                disabled={adding}
              />
              Non-working day
            </label>
          </div>
          <div className="cat-form-actions">
            <button type="submit" className="btn-cat-save" disabled={adding || !newName.trim()}>
              {adding ? 'Adding…' : 'Add'}
            </button>
            <button
              type="button"
              className="btn-cat-cancel"
              onClick={() => { setShowAddForm(false); setNewName(''); setNewColor('#3b82f6'); setNewNonWorking(false); }}
              disabled={adding}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="cat-manager-loading">Loading…</div>
      ) : (
        <div className="cat-list">
          {categories.length === 0 && (
            <p className="cat-list-empty">No categories yet.</p>
          )}
          {categories.map(cat => (
            <div key={cat.id} className={`cat-item ${editingId === cat.id ? 'cat-item--editing' : ''}`}>
              {editingId === cat.id ? (
                <form className="cat-item-edit-form" onSubmit={handleSaveEdit}>
                  <span className="cat-item-swatch" style={{ backgroundColor: editColor }} />
                  <input
                    type="text"
                    className="cat-form-input cat-form-input--inline"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    disabled={saving}
                    required
                    autoFocus
                  />
                  <div className="cat-item-edit-color">
                    <ColorPicker selectedColor={editColor} onChange={setEditColor} />
                  </div>
                  <label className="cat-nonworking-label">
                    <input
                      type="checkbox"
                      checked={editNonWorking}
                      onChange={e => setEditNonWorking(e.target.checked)}
                      disabled={saving}
                    />
                    Non-working day
                  </label>
                  <div className="cat-item-actions">
                    <button type="submit" className="btn-cat-save btn-cat-save--sm" disabled={saving || !editName.trim()}>
                      {saving ? '…' : 'Save'}
                    </button>
                    <button type="button" className="btn-cat-cancel btn-cat-cancel--sm" onClick={() => setEditingId(null)} disabled={saving}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <span className="cat-item-swatch" style={{ backgroundColor: cat.color }} />
                  <span className="cat-item-name">{cat.name}</span>
                  {cat.isNonWorking && <span className="cat-nonworking-badge">off</span>}
                  <div className="cat-item-actions">
                    <button className="btn-cat-icon" onClick={() => startEdit(cat)} title="Edit">✎</button>
                    <button
                      className="btn-cat-icon btn-cat-icon--danger"
                      onClick={() => handleDelete(cat.id)}
                      disabled={deletingId === cat.id}
                      title="Delete"
                    >
                      {deletingId === cat.id ? '…' : '×'}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="cat-manager-actions">
        <button
          className="btn-import-holidays"
          onClick={handleImportHolidays}
          disabled={importing}
        >
          {importing ? 'Importing…' : '🇿🇦 Import SA Public Holidays'}
        </button>
        {importResult && (
          <p className="import-result">{importResult}</p>
        )}
      </div>
    </div>
  );
}
