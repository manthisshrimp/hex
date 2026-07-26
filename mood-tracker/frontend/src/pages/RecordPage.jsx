import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { entries as entriesAPI } from '../api';

const FEELINGS = [
  { value: 'angry',           label: 'angry',           icon: '😡', color: '#ef4444' },
  { value: 'irritable',       label: 'irritable',       icon: '😤', color: '#f97316' },
  { value: 'stressed',        label: 'stressed',        icon: '😫', color: '#8b5cf6' },
  { value: 'anxious',         label: 'anxious',         icon: '😰', color: '#38bdf8' },
  { value: 'overstimulated',  label: 'over-stimulated', icon: '🤯', color: '#f59e0b' },
  { value: 'understimulated', label: 'under-stimulated', icon: '😑', color: '#78716c' },
  { value: 'tired',           label: 'tired',           icon: '😴', color: '#64748b' },
  { value: 'sad',             label: 'sad',             icon: '😢', color: '#6366f1' },
  { value: 'lonely',          label: 'lonely',          icon: '🫂', color: '#94a3b8' },
];

const MOOD_LEVELS = [
  { value: '7', icon: '🚀', color: '#3b82f6', label: 'to the moon' },
  { value: '6', icon: '😁', color: '#14b8a6', label: 'upbeat' },
  { value: '5', icon: '🙂', color: '#22c55e', label: 'breezy' },
  { value: '4', icon: '😐', color: '#94a3b8', label: 'flat' },
  { value: '3', icon: '😔', color: '#eab308', label: 'weary' },
  { value: '2', icon: '😞', color: '#f97316', label: 'shadowed' },
  { value: '1', icon: '🛌', color: '#ef4444', label: 'buried' },
];

const DRIVE_LEVELS = [
  { value: '7', icon: '🔥', color: '#3b82f6', label: 'unstoppable' },
  { value: '6', icon: '💪', color: '#14b8a6', label: 'keen' },
  { value: '5', icon: '👍', color: '#22c55e', label: 'willing' },
  { value: '4', icon: '😐', color: '#94a3b8', label: 'coasting' },
  { value: '3', icon: '😪', color: '#eab308', label: 'dragging' },
  { value: '2', icon: '🪫', color: '#f97316', label: 'empty' },
  { value: '1', icon: '🧱', color: '#ef4444', label: 'immovable' },
];

const byValue = levels => Object.fromEntries(levels.map(l => [l.value, l]));
const META = {
  feeling: byValue(FEELINGS),
  mood: byValue(MOOD_LEVELS),
  drive: byValue(DRIVE_LEVELS),
};
const UNKNOWN = { icon: '❓', color: '#999', label: '?' };

const getEntryMeta = entry => META[entry.type]?.[entry.value] || UNKNOWN;

function getEntryLabel(entry) {
  const meta = META[entry.type]?.[entry.value];
  if (!meta) return `${entry.type} ${entry.value}`;
  return entry.type === 'feeling' ? meta.label : `${entry.type} — ${meta.label}`;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDayHeader(dateStr) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function Circle({ icon, label, color, size = 'lg', onTap }) {
  const [state, setState] = useState('idle'); // 'idle' | 'tapping' | 'failed'

  function handleClick() {
    if (state === 'tapping') return;
    setState('tapping');
    setTimeout(() => setState('idle'), 400);
    onTap().catch(() => {
      setState('failed');
      setTimeout(() => setState('idle'), 600);
    });
  }

  return (
    <div className="circle-wrapper">
      <button
        className={`circle circle-${size} ${state}`}
        style={{ '--circle-color': color }}
        onClick={handleClick}
        aria-label={label || icon}
      >
        <span className="circle-icon">{icon}</span>
      </button>
      {label && <span className="circle-label">{label}</span>}
    </div>
  );
}

export default function RecordPage() {
  const [toast, setToast] = useState(null);
  const [floatingNote, setFloatingNote] = useState(null); // { entryId, color }
  const [noteDialog, setNoteDialog] = useState(null); // { entryId } — for post-record notes
  const [noteText, setNoteText] = useState('');
  const floatingTimerRef = useRef(null);

  // History state
  const [allEntries, setAllEntries] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [selected, setSelected] = useState(null); // entry being edited from history
  const [editNote, setEditNote] = useState('');
  const sentinelRef = useRef(null);
  const historyLoadingRef = useRef(false);
  const historySectionRef = useRef(null);

  function showToast(msg, type = 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function showFloatingNote(entryId, color) {
    if (floatingTimerRef.current) clearTimeout(floatingTimerRef.current);
    setFloatingNote({ entryId, color });
    floatingTimerRef.current = setTimeout(() => setFloatingNote(null), 5000);
  }

  function handleFloatingTap() {
    if (floatingTimerRef.current) clearTimeout(floatingTimerRef.current);
    const entryId = floatingNote.entryId;
    setFloatingNote(null);
    setNoteDialog({ entryId });
  }

  function makeTapHandler(fn, label, color) {
    return async () => {
      try {
        const entry = await fn();
        showFloatingNote(entry.id, color);
        // Prepend new entry to history if already loaded
        setHistoryLoaded(loaded => {
          if (loaded) {
            setAllEntries(prev => [entry, ...prev]);
          }
          return loaded;
        });
      } catch (err) {
        showToast('not saved — tap to retry');
        throw err;
      }
    };
  }

  function closeNoteDialog() {
    setNoteDialog(null);
    setNoteText('');
  }

  async function handleNoteSubmit() {
    const text = noteText.trim();
    const id = noteDialog.entryId;
    closeNoteDialog();
    if (text) {
      try {
        await entriesAPI.addNote(id, text);
        setAllEntries(prev => prev.map(e => e.id === id ? { ...e, note: text } : e));
      } catch { /* mood already saved */ }
    }
  }

  const loadEntries = useCallback(async (before) => {
    if (historyLoadingRef.current) return;
    historyLoadingRef.current = true;
    setHistoryLoading(true);
    try {
      const limit = before ? 20 : 30;
      const data = await entriesAPI.list({ limit, before });
      setAllEntries(prev => before ? [...prev, ...data.entries] : data.entries);
      setHasMore(data.hasMore);
      setHistoryLoaded(true);
    } catch (err) {
      console.error('Failed to load entries', err);
    } finally {
      historyLoadingRef.current = false;
      setHistoryLoading(false);
    }
  }, []);

  // Trigger initial history load when the section scrolls into view
  useEffect(() => {
    if (!historySectionRef.current || historyLoaded) return;
    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (observerEntries[0].isIntersecting) {
          loadEntries();
          observer.disconnect();
        }
      },
      { rootMargin: '150px' }
    );
    observer.observe(historySectionRef.current);
    return () => observer.disconnect();
  }, [historyLoaded, loadEntries]);

  // Infinite scroll sentinel
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (observerEntries[0].isIntersecting && hasMore && !historyLoadingRef.current) {
          setAllEntries(prev => {
            const oldest = prev[prev.length - 1];
            if (oldest) loadEntries(oldest.recordedAt);
            return prev;
          });
        }
      },
      { rootMargin: '100px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadEntries]);

  const grouped = useMemo(() => {
    const groups = [];
    let currentDay = null;
    for (const entry of allEntries) {
      const day = entry.recordedAt.slice(0, 10);
      if (day !== currentDay) {
        currentDay = day;
        groups.push({ type: 'header', day, id: `header-${day}` });
      }
      groups.push({ type: 'entry', entry });
    }
    return groups;
  }, [allEntries]);

  function openDetail(entry) {
    setSelected(entry);
    setEditNote(entry.note || '');
  }

  async function handleSaveNote() {
    const text = editNote.trim();
    const id = selected.id;
    const updated = { ...selected, note: text || undefined };
    setAllEntries(prev => prev.map(e => e.id === id ? updated : e));
    setSelected(null);
    try {
      await entriesAPI.addNote(id, text);
    } catch {
      loadEntries();
    }
  }

  async function handleDelete(id) {
    setAllEntries(prev => prev.filter(e => e.id !== id));
    try {
      await entriesAPI.delete(id);
    } catch {
      loadEntries();
    }
  }

  return (
    <div className="record-page">
      <h1 className="record-title">how are you?</h1>

      <div className="record-columns">
        <div className="feeling-column">
          {FEELINGS.map(f => (
            <div className="feeling-list-item" key={f.value}>
              <Circle
                icon={f.icon}
                color={f.color}
                size="md"
                onTap={makeTapHandler(() => entriesAPI.record({ type: 'feeling', value: f.value }), f.label, f.color)}
              />
              <span className="feeling-list-label">{f.label}</span>
            </div>
          ))}
        </div>

        {[['mood', MOOD_LEVELS], ['drive', DRIVE_LEVELS]].map(([type, levels]) => (
          <div className="scale-column" key={type}>
            <span className="scale-heading">{type}</span>
            {levels.map(l => (
              <Circle
                key={l.value}
                icon={l.icon}
                color={l.color}
                size="sm"
                onTap={makeTapHandler(() => entriesAPI.record({ type, value: l.value }), l.label, l.color)}
              />
            ))}
          </div>
        ))}
      </div>

      {toast && <div className="toast toast-error">{toast.msg}</div>}

      {floatingNote && (
        <button
          className="floating-note-btn"
          onClick={handleFloatingTap}
          aria-label="Add note"
          style={{ color: floatingNote.color, borderTopColor: floatingNote.color }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          add a note
        </button>
      )}

      {noteDialog && (
        <div className="note-overlay" onClick={closeNoteDialog}>
          <div className="note-dialog" onClick={e => e.stopPropagation()}>
            <textarea
              className="note-input"
              placeholder="add a note…"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && closeNoteDialog()}
              rows={3}
              autoFocus
            />
            <div className="note-actions">
              <button className="note-skip" onClick={closeNoteDialog}>skip</button>
              <button className="note-submit" onClick={handleNoteSubmit}>save note</button>
            </div>
          </div>
        </div>
      )}

      <div ref={historySectionRef} className="inline-history">
        <div className="inline-history-heading">history</div>
        <div className="history-list">
          {grouped.map(item => {
            if (item.type === 'header') {
              return (
                <div key={item.id} className="day-header">
                  {formatDayHeader(item.day)}
                </div>
              );
            }
            const { entry } = item;
            const meta = getEntryMeta(entry);
            return (
              <div key={entry.id} className="entry-row entry-row--tappable" onClick={() => openDetail(entry)}>
                <span className="entry-time">{formatTime(entry.recordedAt)}</span>
                <span className="entry-icon">{meta.icon}</span>
                <span className="entry-label" style={{ color: meta.color }}>
                  {getEntryLabel(entry)}
                </span>
                {entry.note && <span className="entry-note-indicator">💬</span>}
                <button
                  className="delete-btn"
                  onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                  aria-label="Delete entry"
                >
                  🗑️
                </button>
              </div>
            );
          })}

          {historyLoading && <div className="loading-indicator">loading…</div>}
          {!hasMore && !historyLoading && allEntries.length > 0 && (
            <div className="end-of-list">that's all</div>
          )}

          <div ref={sentinelRef} style={{ height: 1 }} />
        </div>
      </div>

      {selected && (() => {
        const meta = getEntryMeta(selected);
        const label = getEntryLabel(selected);
        const noteChanged = editNote.trim() !== (selected.note || '');
        return (
          <div className="note-overlay" onClick={() => setSelected(null)}>
            <div className="note-dialog entry-detail" onClick={e => e.stopPropagation()}>
              <div className="entry-detail-header">
                <span className="entry-detail-icon">{meta.icon}</span>
                <span className="entry-detail-label" style={{ color: meta.color }}>{label}</span>
                <span className="entry-detail-time">{formatTime(selected.recordedAt)}</span>
              </div>
              <textarea
                className="note-input"
                placeholder="add a note…"
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && setSelected(null)}
                rows={3}
                autoFocus
              />
              <div className="note-actions">
                <button className="note-skip" onClick={() => setSelected(null)}>cancel</button>
                <button className="note-submit" onClick={handleSaveNote} disabled={!noteChanged}>save</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
