import { useNavigate, useLocation } from 'react-router-dom';

function ShieldIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z" />
    </svg>
  );
}

function ScrollIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 3H6a2 2 0 00-2 2v1a2 2 0 002 2h1M16 3h2a2 2 0 012 2v1a2 2 0 01-2 2h-1M8 3v14M16 3v14M8 17H6a2 2 0 000 4h12a2 2 0 000-4h-2" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 6a2 2 0 012-2h7l2 2h7a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
      <line x1="12" y1="6" x2="12" y2="20" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function SkullIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2C7.03 2 3 6.03 3 11c0 2.93 1.36 5.55 3.49 7.25L7 22h10l.51-3.75C19.64 16.55 21 13.93 21 11c0-4.97-4.03-9-9-9z" />
      <line x1="9" y1="17" x2="9" y2="22" />
      <line x1="15" y1="17" x2="15" y2="22" />
      <circle cx="9" cy="11" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

const TABS = [
  { key: 'dashboard', path: '/',           label: 'Dashboard', Icon: ShieldIcon },
  { key: 'quests',    path: '/habits',     label: 'Quests',    Icon: ScrollIcon },
  { key: 'character', path: '/character',  label: 'Character', Icon: PersonIcon },
  { key: 'deeds',     path: '/deeds',      label: 'Deeds',     Icon: StarIcon   },
  { key: 'chronicle', path: '/chronicle',  label: 'Chronicle', Icon: BookIcon   },
  { key: 'boss',      path: '/boss',       label: 'Boss',      Icon: SkullIcon  },
];

export default function BottomNav({ active }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active key from prop or current location
  function isActive(tab) {
    if (active) return tab.key === active;
    if (tab.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(tab.path);
  }

  return (
    <nav className="bottom-nav">
      {TABS.map(({ key, path, label, Icon }) => {
        const tabActive = isActive({ key, path });
        return (
          <button
            key={key}
            className={`bottom-nav-btn${tabActive ? ' active' : ''}`}
            onClick={() => navigate(path)}
          >
            <span className="bottom-nav-icon"><Icon /></span>
            <span className="bottom-nav-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
