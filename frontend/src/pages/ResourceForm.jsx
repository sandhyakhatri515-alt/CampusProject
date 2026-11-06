import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiImage } from 'react-icons/fi';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Loader, PageHead } from '../components/ui';
import { DataList, useLookups } from '../context/LookupContext';

const EMPTY = { title: '', description: '', category: '', condition_status: 'good', location: '', max_borrow_days: 7, price_per_day: 0, deposit_amount: 0, availability_status: 'available' };

export default function ResourceForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const { user, isVerified, isAdmin } = useAuth();
  const { conditions, locations, refresh: refreshLookups } = useLookups();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    api.get('/categories').then((r) => {
      setCategories(r.data.categories);
      if (!editing) setForm((f) => ({ ...f, category: r.data.categories[0]?.slug || '' }));
    });
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    api.get(`/resources/${id}`)
      .then(({ data }) => {
        const r = data.resource;
        if (r.owner_id !== user.id && !isAdmin) {
          toast.error('You can only edit your own listings.');
          return navigate('/my-listings');
        }
        setLocked(['borrowed', 'reserved'].includes(r.availability_status));
        setForm({
          title: r.title, description: r.description || '', category: r.category, condition_status: r.condition_status,
          location: r.location || '', max_borrow_days: r.max_borrow_days, price_per_day: Number(r.price_per_day), deposit_amount: Number(r.deposit_amount),
          availability_status: r.availability_status
        });
        setPreview(r.image_url);
      })
      .catch((e) => { toast.error(errorMessage(e)); navigate('/my-listings'); })
      .finally(() => setLoading(false));
  }, [id, editing, user.id, isAdmin, navigate]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error('Image must be under 5MB.');
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (editing && k === 'availability_status' && locked) return;
        body.append(k, v);
      });
      if (file) body.append('image', file);
      const { data } = editing ? await api.put(`/resources/${id}`, body) : await api.post('/resources', body);
      toast.success(data.message);
      refreshLookups(); // a newly typed pick-up spot should appear in the lists right away
      navigate('/my-listings');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loader />;
  if (!editing && !isVerified) {
    return (
      <div className="empty card"><div className="emoji">🔒</div><h3>Verification needed</h3>
        <p className="muted">An admin needs to verify your account before you can list items.</p><Link to="/dashboard" className="btn">Back home</Link></div>
    );
  }

  return (
    <>
      <PageHead title={editing ? 'Edit listing' : 'List an item'} subtitle="Great photos and clear details get borrowed faster." />
      <form className="card stack" style={{ maxWidth: 780 }} onSubmit={submit}>
        <div className="dropzone" onClick={() => inputRef.current.click()} role="button" tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current.click()}>
          {preview ? <img src={preview} alt="Preview" /> : <FiImage size={36} />}
          <strong>{preview ? 'Click to change photo' : 'Add a photo'}</strong>
          <span className="small">JPG, PNG, GIF or WebP · max 5MB</span>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onChange={pickFile} />
        </div>

        <div className="field">
          <label htmlFor="title">Title</label>
          <input id="title" className="input" required maxLength={200} value={form.title} onChange={set('title')} placeholder="e.g. Canon DSLR with 18-55mm lens" />
        </div>
        <div className="field">
          <label htmlFor="desc">Description</label>
          <textarea id="desc" className="textarea" value={form.description} onChange={set('description')} placeholder="What is included? Any care instructions?" />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="cat">Category</label>
            <select id="cat" className="select" value={form.category} onChange={set('category')} required>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cond">Condition</label>
            <select id="cond" className="select" value={form.condition_status} onChange={set('condition_status')}>
              {conditions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="loc">Pick-up location</label>
            <input id="loc" className="input" list="location-options" maxLength={150} value={form.location} onChange={set('location')} placeholder="Pick one or type a new spot" />
            <DataList id="location-options" items={locations} />
          </div>
          <div className="field">
            <label htmlFor="days">Maximum loan (days)</label>
            <input id="days" type="number" min={1} max={60} className="input" value={form.max_borrow_days} onChange={set('max_borrow_days')} />
          </div>
          <div className="field full">
            <label htmlFor="price">Rental fee per day (Rs)</label>
            <input id="price" type="number" min={0} max={100000} step="1" className="input" value={form.price_per_day} onChange={set('price_per_day')} />
            <span className="hint">Enter 0 to lend for free. The fee is taken from the borrower's deposit balance and paid to you when you hand the item over.</span>
          </div>
          <div className="field full">
            <label htmlFor="deposit">Security deposit (Rs)</label>
            <input id="deposit" type="number" min={0} max={100000} step="1" className="input" value={form.deposit_amount} onChange={set('deposit_amount')} />
            <span className="hint">Refundable. Borrowers must hold this amount before they can request the item, and get it back when you confirm the return. Enter 0 for no deposit.</span>
          </div>
          {editing && (
            <div className="field full">
              <label htmlFor="avail">Visibility</label>
              <select id="avail" className="select" value={form.availability_status} onChange={set('availability_status')} disabled={locked}>
                {locked && <option value={form.availability_status}>{form.availability_status === 'reserved' ? 'Reserved' : 'On loan'}</option>}
                <option value="available">Available to borrow</option>
                <option value="unavailable">Hidden (not available)</option>
              </select>
              {locked && <span className="hint">This item is reserved or on loan. Finish or cancel the request from Requests to change this.</span>}
            </div>
          )}
        </div>
        <div className="row">
          <button className="btn btn-lg" disabled={busy}>{busy ? 'Saving...' : editing ? 'Save changes' : 'Publish listing'}</button>
          <button type="button" className="btn btn-ghost btn-lg" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </>
  );
}
