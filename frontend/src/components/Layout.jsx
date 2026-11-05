import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  FiHome, FiCompass, FiPackage, FiRepeat, FiHeart, FiUser, FiBell, FiLogOut, FiMenu,
  FiMoon, FiSun, FiShield, FiPlus, FiInbox, FiCheckCircle, FiMessageCircle, FiStar, FiAlertCircle, FiCreditCard
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { Avatar } from './ui';
import SearchBox from './SearchBox';
import { timeAgo } from '../utils/format';

const NOTIF_STYLE = {
  request: ['var(--primary)', FiInbox],
  return: ['var(--teal)', FiCheckCircle],
  message: ['var(--blue)', FiMessageCircle],
  payment: ['var(--success)', FiCreditCard],
  release: ['var(--teal)', FiPackage],
  review: ['var(--sun)', FiStar],
  admin: ['var(--coral)', FiAlertCircle],
  info: ['var(--ink-soft)', FiBell]
};

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unread_count: 0 });
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    api.get('/notifications').then((r) => setData(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const openItem = async (n) => {
    if (!n.is_read) await api.put(`/notifications/${n.id}/read`).catch(() => {});
    setOpen(false);
    load();
    if (n.link) navigate(n.link);
  };

  const readAll = async () => {
    await api.put('/notifications/read-all').catch(() => {});
    load();
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={() => { setOpen(!open); if (!open) load(); }} aria-label={`Notifications, ${data.unread_count} unread`} aria-expanded={open}>
        <FiBell />
        {data.unread_count > 0 && <span className="dot-badge">{data.unread_count > 9 ? '9+' : data.unread_count}</span>}
      </button>
      {open && (
        <div className="card dropdown">
          <div className="dropdown-head">
            <h3>Notifications</h3>
            {data.unread_count > 0 && <button className="btn btn-ghost btn-sm" onClick={readAll}>Mark all read</button>}
          </div>
          <div className="dropdown-list">
            {data.notifications.length === 0 && <p className="muted center" style={{ padding: 28 }}>You are all caught up 🎉</p>}
            {data.notifications.slice(0, 8).map((n) => {
              const [color, Icon] = NOTIF_STYLE[n.type] || NOTIF_STYLE.info;
              return (
                <div key={n.id} className={`notif ${n.is_read ? '' : 'unread'}`} onClick={() => openItem(n)} role="button" tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && openItem(n)}>
                  <span className="notif-ico" style={{ background: color }}><Icon /></span>
                  <div className="grow">
                    <div>{n.message}</div>
                    <div className="muted small">{timeAgo(n.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="center" style={{ padding: 10 }}>
            <Link to="/notifications" onClick={() => setOpen(false)}>See all</Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');
  const [pendingIn, setPendingIn] = useState(0);

  useEffect(() => { setMenu(false); }, [location.pathname]);

  useEffect(() => {
    api.get('/dashboard').then((r) => setPendingIn(r.data.stats.incoming_pending + r.data.stats.to_release)).catch(() => {});
  }, [location.pathname]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch { /* storage unavailable */ }
  };

  const submitSearch = () => {
    navigate(`/browse${query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ''}`);
  };

  const nav = [
    { to: '/dashboard', icon: FiHome, label: 'Home' },
    { to: '/browse', icon: FiCompass, label: 'Browse' },
    { to: '/my-listings', icon: FiPackage, label: 'My Listings' },
    { to: '/requests', icon: FiRepeat, label: 'Requests', count: pendingIn },
    { to: '/wallet', icon: FiCreditCard, label: 'Wallet' },
    { to: '/saved', icon: FiHeart, label: 'Saved' },
    { to: `/profile`, icon: FiUser, label: 'Profile' }
  ];

  return (
    <div className="shell">
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <aside className={`sidebar ${menu ? 'open' : ''}`} aria-label="Main navigation">
        <Link to="/dashboard" className="brand"><span className="brand-mark"><FiRepeat size={22} /></span>CampusResourceShare</Link>
        <div className="sidebar-nav">
          {nav.map(({ to, icon: Icon, label, count }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon /> {label} {count > 0 && <span className="nav-count">{count}</span>}
            </NavLink>
          ))}
          {isAdmin && (
            <>
              <div className="nav-section">Admin</div>
              <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><FiShield /> Control room</NavLink>
            </>
          )}
        </div>
        <div className="sidebar-foot">
          {!isAdmin && <Link to="/resources/new" className="btn btn-block"><FiPlus /> List an item</Link>}
          <div className="row" style={{ padding: '4px 4px' }}>
            <Avatar name={user.full_name} src={user.profile_image} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.full_name}</div>
              <div className="muted small">{isAdmin ? 'Administrator' : user.is_verified ? 'Verified student' : 'Awaiting verification'}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-block logout-btn" onClick={() => { logout(); navigate('/'); }}><FiLogOut /> Log out</button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenu(true)} aria-label="Open menu"><FiMenu /></button>
          <SearchBox className="search" value={query} onChange={setQuery} onSubmit={submitSearch} placeholder="Search cameras, calculators, books..." />
          <div className="grow" />
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle dark mode">{dark ? <FiSun /> : <FiMoon />}</button>
          <NotificationBell />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Quick navigation">
        {[nav[0], nav[1], nav[3], nav[4], nav[5]].map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}><Icon />{label}</NavLink>
        ))}
      </nav>
    </div>
  );
}
