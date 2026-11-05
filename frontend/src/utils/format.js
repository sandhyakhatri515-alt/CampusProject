import {
  FiCamera, FiPercent, FiTablet, FiMonitor, FiBookOpen, FiActivity, FiTarget, FiBox
} from 'react-icons/fi';

// Category icons are stored by name in the database.
export const CATEGORY_ICONS = { FiCamera, FiPercent, FiTablet, FiMonitor, FiBookOpen, FiActivity, FiTarget, FiBox };
export const iconFor = (name) => CATEGORY_ICONS[name] || FiBox;

export const money = (n) => {
  const v = Number(n) || 0;
  return `Rs ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};
export const receiptNo = (id) => `DEP-${String(id).padStart(6, '0')}`;
export const priceLabel = (perDay) => (Number(perDay) > 0 ? `${money(perDay)}/day` : 'Free');

export const daysInclusive = (from, to) =>
  Math.max(1, Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000) + 1);

export const STATUS_LABEL = {
  available: 'Available', reserved: 'Reserved', borrowed: 'On loan', unavailable: 'Hidden',
  accepted: 'Accepted', pending: 'Pending', rejected: 'Declined', returned: 'Returned', cancelled: 'Cancelled',
  open: 'Open', resolved: 'Resolved', dismissed: 'Dismissed'
};

const dateOnly = (d) => (typeof d === 'string' ? d.slice(0, 10) : d);

export const fmtDate = (d) => {
  if (!d) return '-';
  const dt = new Date(dateOnly(d).length === 10 ? `${dateOnly(d)}T00:00:00` : d);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const fmtDateTime = (d) =>
  new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(d);
};

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const isOverdue = (req) => req.status === 'borrowed' && dateOnly(req.due_date) < todayStr();

const AVATAR_COLORS = ['#7c5cff', '#ff6b6b', '#2ec4b6', '#4d96ff', '#f15bb5', '#e08a00'];
export const avatarColor = (name = '') => AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
