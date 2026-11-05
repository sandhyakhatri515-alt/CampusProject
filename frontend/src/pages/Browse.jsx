import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import ResourceCard from '../components/ResourceCard';
import SearchBox from '../components/SearchBox';
import { Empty, PageHead } from '../components/ui';
import { useLookups } from '../context/LookupContext';
import { iconFor } from '../utils/format';
import { toggleSaved } from '../utils/actions';

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [result, setResult] = useState(null);
  const [searchText, setSearchText] = useState(params.get('search') || '');

  const category = params.get('category') || '';
  const status = params.get('status') || '';
  const condition = params.get('condition') || '';
  const location = params.get('location') || '';
  const { conditions, locations } = useLookups();
  const sort = params.get('sort') || 'newest';
  const search = params.get('search') || '';
  const page = parseInt(params.get('page'), 10) || 1;

  useEffect(() => { api.get('/categories').then((r) => setCategories(r.data.categories)).catch(() => {}); }, []);
  useEffect(() => { setSearchText(search); }, [search]);

  useEffect(() => {
    let alive = true;
    setResult(null);
    api.get('/resources', { params: { category, status, condition, location, sort, search, page, limit: 12 } })
      .then((r) => alive && setResult(r.data))
      .catch(() => alive && setResult({ resources: [], total: 0, pages: 0 }));
    return () => { alive = false; };
  }, [category, status, condition, location, sort, search, page]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries({ page: '', ...changes }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };

  const onSave = async (r) => {
    const saved = await toggleSaved(r);
    setResult((cur) => ({ ...cur, resources: cur.resources.map((x) => (x.id === r.id ? { ...x, is_saved: saved } : x)) }));
  };

  const clear = () => { setSearchText(''); setParams({}); };
  const hasFilters = category || status || condition || location || search;

  return (
    <>
      <PageHead title="Browse items" subtitle="Everything your campus is sharing, in one place." />

      <div className="toolbar">
        <SearchBox className="grow" value={searchText} onChange={setSearchText} onSubmit={() => update({ search: searchText.trim() })} placeholder="Search by name, description or location" />
        <select className="select" value={location} onChange={(e) => update({ location: e.target.value })} aria-label="Pick-up location">
          <option value="">Any location</option>
          {locations.map((l) => <option key={l.name} value={l.name}>{l.name} ({l.count})</option>)}
        </select>
        <select className="select" value={status} onChange={(e) => update({ status: e.target.value })} aria-label="Availability">
          <option value="">Any availability</option>
          <option value="available">Available now</option>
          <option value="borrowed">On loan</option>
        </select>
        <select className="select" value={condition} onChange={(e) => update({ condition: e.target.value })} aria-label="Condition">
          <option value="">Any condition</option>
          {conditions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select className="select" value={sort} onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })} aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="popular">Most viewed</option>
          <option value="title">A to Z</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      <div className="chips" style={{ marginBottom: 24 }} role="group" aria-label="Categories">
        <button className={`chip ${!category ? 'active' : ''}`} onClick={() => update({ category: '' })}>All</button>
        {categories.map((c) => {
          const Icon = iconFor(c.icon);
          return (
            <button key={c.slug} className={`chip ${category === c.slug ? 'active' : ''}`} onClick={() => update({ category: c.slug })}>
              <Icon /> {c.name}
            </button>
          );
        })}
      </div>

      {!result ? (
        <div className="grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" />)}</div>
      ) : result.resources.length === 0 ? (
        <Empty emoji="🔭" title="Nothing found" text="Try a different search or clear the filters.">
          {hasFilters && <button className="btn" onClick={clear}>Clear filters</button>}
        </Empty>
      ) : (
        <>
          <p className="muted small" style={{ marginBottom: 14 }}>{result.total} item{result.total === 1 ? '' : 's'}</p>
          <div className="grid">
            {result.resources.map((r) => <ResourceCard key={r.id} resource={r} onToggleSave={onSave} />)}
          </div>
          {result.pages > 1 && (
            <div className="row" style={{ justifyContent: 'center', marginTop: 30 }}>
              <button className="btn btn-ghost" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Previous</button>
              <span className="muted">Page {page} of {result.pages}</span>
              <button className="btn btn-ghost" disabled={page >= result.pages} onClick={() => update({ page: String(page + 1) })}>Next</button>
            </div>
          )}
        </>
      )}
    </>
  );
}
