import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiGrid } from 'react-icons/fi';
import api from '../api/client';

// Search input with live suggestions (matching items and categories).
export default function SearchBox({ value, onChange, onSubmit, placeholder = 'Search...', className = '' }) {
  const navigate = useNavigate();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState({ resources: [], categories: [] });
  const [active, setActive] = useState(-1);
  const wrapRef = useRef(null);

  // Debounced lookup; the cleanup drops stale responses.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) return undefined;
    let alive = true;
    const t = setTimeout(() => {
      api.get('/resources/suggest', { params: { q } })
        .then((r) => { if (alive) { setItems(r.data); setActive(-1); } })
        .catch(() => {});
    }, 220);
    return () => { alive = false; clearTimeout(t); };
  }, [value]);

  useEffect(() => {
    const onDoc = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const options = value.trim().length < 2 ? [] : [
    ...items.categories.map((c) => ({ key: `c${c.slug}`, label: c.name, hint: 'Category', to: `/browse?category=${c.slug}`, category: true })),
    ...items.resources.map((r) => ({ key: `r${r.id}`, label: r.title, hint: r.category_name, to: `/resources/${r.id}` }))
  ];

  const go = (opt) => { setOpen(false); navigate(opt.to); };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') return setOpen(false);
    if (!options.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % options.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? options.length - 1 : a - 1)); }
    if (e.key === 'Enter' && active >= 0) { e.preventDefault(); go(options[active]); }
  };

  return (
    <div ref={wrapRef} className={`searchbox ${className}`}>
      <form className="input-icon" role="search" onSubmit={(e) => { e.preventDefault(); setOpen(false); onSubmit(); }}>
        <FiSearch />
        <input
          className="input" value={value} placeholder={placeholder} aria-label="Search"
          role="combobox" aria-expanded={open && options.length > 0} aria-controls={listId} aria-autocomplete="list"
          autoComplete="off"
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </form>
      {open && options.length > 0 && (
        <ul id={listId} className="card suggest" role="listbox">
          {options.map((o, i) => (
            <li key={o.key} role="option" aria-selected={i === active} className={i === active ? 'active' : ''}
              onMouseDown={(e) => { e.preventDefault(); go(o); }} onMouseEnter={() => setActive(i)}>
              {o.category ? <FiGrid /> : <FiSearch />}
              <span className="grow">{o.label}</span>
              <span className="muted small">{o.hint}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
