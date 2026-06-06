import { createContext, useContext, useState, useCallback } from 'react';

const SnackbarContext = createContext(null);

export function SnackbarProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const show = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    const notification = { id, message, type, duration };
    
    setNotifications(prev => [...prev, notification]);
    
    // Auto-remove after duration
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
    
    return id;
  }, []);

  const remove = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <SnackbarContext.Provider value={{ show, remove }}>
      {children}
      <div className="snackbar-container">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`snackbar snackbar--${n.type}`}
            onClick={() => remove(n.id)}
          >
            <span className="snackbar__message">{n.message}</span>
            <button 
              className="snackbar__close" 
              onClick={(e) => { e.stopPropagation(); remove(n.id); }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within SnackbarProvider');
  }
  return context;
}
