import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiEdit2, FiMail, FiPhone, FiBookOpen, FiHash, FiCamera } from 'react-icons/fi';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ResourceCard from '../components/ResourceCard';
import PasswordInput from '../components/PasswordInput';
import { DataList, useLookups } from '../context/LookupContext';
import { Avatar, Empty, Loader, Stars } from '../components/ui';
import { fmtDate, timeAgo } from '../utils/format';

export default function Profile() {
  const { id } = useParams();
  const { user: me, setUser, isAdmin } = useAuth();
  const { departments, refresh: refreshLookups } = useLookups();
  const userId = id ? parseInt(id, 10) : me.id;
  const own = userId === me.id;
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current_password: '', new_password: '' });
  const fileRef = useRef(null);

  const load = () => {
    setProfile(null);
    setError('');
    Promise.all([
      api.get(`/users/${userId}`),
      api.get(`/reviews/user/${userId}`),
      api.get('/resources', { params: { owner_id: userId, limit: 8 } })
    ]).then(([u, r, res]) => {
      setProfile(u.data.user);
      setReviews(r.data.reviews);
      setItems(res.data.resources);
    }).catch((e) => setError(errorMessage(e, 'Could not load this profile.')));
  };
  useEffect(load, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = () => {
    setForm({ full_name: profile.full_name, phone: profile.phone || '', college_id: profile.college_id || '', department: profile.department || '', bio: profile.bio || '' });
    setEditing(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v));
      if (file) body.append('profile_image', file);
      const { data } = await api.put('/users/profile', body);
      setUser(data.user);
      toast.success('Profile updated!');
      refreshLookups();
      setEditing(false);
      setFile(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    try {
      await api.put('/auth/password', pw);
      toast.success('Password changed.');
      setPw({ current_password: '', new_password: '' });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (error) return <div className="empty card"><div className="emoji">🙈</div><h3>{error}</h3><Link to="/browse" className="btn">Back</Link></div>;
  if (!profile) return <Loader />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const showContact = own || isAdmin;

  return (
    <>
      <div className="card card-flush" style={{ marginBottom: 22 }}>
        <div className="profile-cover" />
        <div style={{ padding: '0 26px 24px' }}>
          <div className="profile-head" style={{ marginTop: -48 }}>
            <Avatar name={profile.full_name} src={profile.profile_image} size="lg" />
            <div className="grow" style={{ paddingTop: 52 }}>
              <h1 style={{ fontSize: '2rem' }}>{profile.full_name} {profile.is_verified && <FiCheckCircle style={{ color: 'var(--teal)', verticalAlign: '-3px' }} title="Verified" />}</h1>
              <div className="row wrap muted small" style={{ fontWeight: 700 }}>
                {profile.department && <span><FiBookOpen /> {profile.department}</span>}
                <span>Joined {fmtDate(profile.created_at)}</span>
                {profile.role === 'admin' && <span className="pill pill-pending">Admin</span>}
              </div>
            </div>
            {own && !editing && <button className="btn btn-ghost" onClick={startEdit}><FiEdit2 /> Edit profile</button>}
          </div>
          {profile.bio && !editing && <p style={{ marginTop: 14 }}>{profile.bio}</p>}
          {showContact && !editing && (
            <div className="row wrap muted small" style={{ marginTop: 12, fontWeight: 700 }}>
              {profile.email && <span><FiMail /> {profile.email}</span>}
              {profile.phone && <span><FiPhone /> {profile.phone}</span>}
              {profile.college_id && <span><FiHash /> {profile.college_id}</span>}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <form className="card stack" style={{ marginBottom: 22 }} onSubmit={save}>
          <h3>Edit profile</h3>
          <div className="row">
            <Avatar name={form.full_name || '?'} src={file ? URL.createObjectURL(file) : profile.profile_image} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current.click()}><FiCamera /> Change photo</button>
            <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/gif,image/webp" onChange={(e) => setFile(e.target.files[0] || null)} />
          </div>
          <div className="form-grid">
            <div className="field"><label htmlFor="pn">Full name</label><input id="pn" className="input" required value={form.full_name} onChange={set('full_name')} /></div>
            <div className="field"><label htmlFor="pd">Department</label><input id="pd" className="input" list="department-options" value={form.department} onChange={set('department')} /><DataList id="department-options" items={departments} /></div>
            <div className="field"><label htmlFor="pp">Phone</label><input id="pp" className="input" type="tel" inputMode="numeric" maxLength={10} pattern="\d{10}" title="Enter exactly 10 digits" placeholder="10-digit number"
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></div>
            <div className="field"><label htmlFor="pc">College ID</label><input id="pc" className="input" value={form.college_id} onChange={set('college_id')} /></div>
            <div className="field full"><label htmlFor="pb">About me</label><textarea id="pb" className="textarea" maxLength={500} value={form.bio} onChange={set('bio')} /></div>
          </div>
          <div className="row">
            <button className="btn" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setEditing(false); setFile(null); }}>Cancel</button>
          </div>
        </form>
      )}

      <div className="stats">
        <div className="stat bg-pink"><div className="num">{profile.avg_rating ?? '-'}</div><div className="lbl">Average rating</div></div>
        <div className="stat bg-violet"><div className="num">{profile.resources_shared}</div><div className="lbl">Items shared</div></div>
        <div className="stat bg-teal"><div className="num">{profile.lent_count}</div><div className="lbl">Times lent</div></div>
        <div className="stat bg-sun"><div className="num">{profile.borrowed_count}</div><div className="lbl">Times borrowed</div></div>
      </div>

      <div className="form-grid" style={{ alignItems: 'start' }}>
        <section className="card" aria-labelledby="rev">
          <div className="card-title"><h3 id="rev">Reviews ({profile.total_reviews})</h3>{profile.avg_rating && <Stars value={profile.avg_rating} />}</div>
          {reviews.length === 0 ? <p className="muted">No reviews yet.</p> : reviews.map((rv) => (
            <div key={rv.id} className="review">
              <div className="row">
                <Avatar name={rv.reviewer_name} src={rv.reviewer_image} size="sm" />
                <strong className="grow">{rv.reviewer_name}</strong>
                <span className="muted small">{timeAgo(rv.created_at)}</span>
              </div>
              <Stars value={rv.rating} size={13} />
              {rv.comment && <p className="small" style={{ marginTop: 4 }}>{rv.comment}</p>}
              <p className="muted small">for “{rv.resource_title}”</p>
            </div>
          ))}
        </section>

        {own && (
          <form className="card stack" onSubmit={changePassword}>
            <h3>Change password</h3>
            <div className="field"><label htmlFor="cp">Current password</label><PasswordInput id="cp" lockIcon={false} required autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></div>
            <div className="field"><label htmlFor="np">New password</label><PasswordInput id="np" lockIcon={false} required minLength={8} autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></div>
            <button className="btn" style={{ alignSelf: 'flex-start' }}>Update password</button>
          </form>
        )}
      </div>

      <h2 style={{ margin: '30px 0 16px' }}>{own ? 'My listings' : `${profile.full_name.split(' ')[0]}'s items`}</h2>
      {items.length === 0 ? <Empty emoji="📭" title="No items shared yet" /> : (
        <div className="grid">{items.map((r) => <ResourceCard key={r.id} resource={r} />)}</div>
      )}
    </>
  );
}
