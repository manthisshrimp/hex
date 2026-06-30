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

const TABS = [
  { key: 'dashboard', path: '/',           label: 'Dashboard', Icon: ShieldIcon },
  { key: 'quests',    path: '/habits',     label: 'Quests',    Icon: ScrollIcon },
  { key: 'character', path: '/character',  label: 'Character', Icon: PersonIcon },
  { key: 'deeds',     path: '/deeds',      label: 'Deeds',     Icon: StarIcon   },
  { key: 'chronicle', path: '/chronicle',  label: 'Chronicle', Icon: BookIcon   },
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
