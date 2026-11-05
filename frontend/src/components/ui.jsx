import { useEffect } from 'react';
import { FiStar, FiX } from 'react-icons/fi';
import { avatarColor, initials, iconFor, STATUS_LABEL } from '../utils/format';

export function Avatar({ name, src, size = '' }) {
  if (src) return <img className={`avatar ${size}`} src={src} alt={name} />;
  return <span className={`avatar ${size}`} style={{ background: avatarColor(name) }} aria-hidden="true">{initials(name)}</span>;
}

export function Stars({ value = 0, size = 16 }) {
  return (
    <span className="stars" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <FiStar key={i} size={size} className={i <= Math.round(value) ? '' : 'off'} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }) {
  return (
    <div className="star-input" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" className={i <= value ? 'on' : ''} onClick={() => onChange(i)} aria-label={`${i} star${i > 1 ? 's' : ''}`}>
          <FiStar />
        </button>
      ))}
    </div>
  );
}

export function StatusPill({ status, overdue }) {
  if (overdue) return <span className="pill pill-overdue">Overdue</span>;
  return <span className={`pill pill-${status}`}>{STATUS_LABEL[status] || status}</span>;
}

export function CategoryChip({ name, color, icon }) {
  const Icon = iconFor(icon);
  return <span className="cat-chip" style={{ background: color }}><Icon size={13} />{name}</span>;
}

// Colored placeholder (or photo) used on cards and detail pages.
export function Thumb({ src, icon, alt = '' }) {
  const Icon = iconFor(icon);
  if (src) return <img src={src} alt={alt} loading="lazy" />;
  return <Icon className="ph" style={{ filter: 'drop-shadow(0 3px 0 rgba(0,0,0,.12))' }} aria-hidden="true" />;
}

export const thumbBackground = (color = '#8d99ae') => `linear-gradient(135deg, ${color}, ${color}cc)`;

export function Loader() {
  return <div className="loader" role="status" aria-label="Loading"><div className="spinner" /></div>;
}

export function Empty({ emoji = '🔍', title, text, children }) {
  return (
    <div className="empty card">
      <div className="emoji" aria-hidden="true">{emoji}</div>
      <h3>{title}</h3>
      {text && <p className="muted" style={{ maxWidth: 420 }}>{text}</p>}
      {children}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={wide ? { maxWidth: 680 } : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><FiX /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1 style={{ fontSize: '2rem' }}>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="row wrap">{children}</div>}
    </div>
  );
}
