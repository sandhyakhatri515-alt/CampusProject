import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff } from 'react-icons/fi';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Empty, Loader, PageHead, StatusPill, Thumb, thumbBackground } from '../components/ui';
import { useConfirm } from '../components/Confirm';
import { priceLabel } from '../utils/format';

export default function MyListings() {
  const { user, isVerified } = useAuth();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);

  const load = () => api.get('/resources', { params: { owner_id: user.id, limit: 100 } }).then((r) => setItems(r.data.resources));
  useEffect(() => { load().catch(() => setItems([])); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleHidden = async (r) => {
    try {
      await api.put(`/resources/${r.id}`, { availability_status: r.availability_status === 'unavailable' ? 'available' : 'unavailable' });
      toast.success(r.availability_status === 'unavailable' ? 'Listing is visible again.' : 'Listing hidden.');
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async (r) => {
    if (!(await confirm({ title: 'Delete this listing?', message: `"${r.title}" and its request history will be permanently removed.`, confirmText: 'Delete', danger: true }))) return;
    try {
      await api.delete(`/resources/${r.id}`);
      toast.success('Listing deleted.');
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHead title="My listings" subtitle="Items you are sharing with the campus.">
        {isVerified && <Link to="/resources/new" className="btn btn-sun"><FiPlus /> List an item</Link>}
      </PageHead>

      {!items ? <Loader /> : items.length === 0 ? (
        <Empty emoji="📦" title="You have not listed anything yet" text="Got a spare calculator, camera or textbook? Someone nearby needs it.">
          {isVerified ? <Link to="/resources/new" className="btn">List your first item</Link> : <p className="muted small">You can list items once an admin verifies your account.</p>}
        </Empty>
      ) : (
        <div className="stack">
          {items.map((r) => (
            <div key={r.id} className="card req">
              <Link to={`/resources/${r.id}`} className="req-thumb" style={{ background: thumbBackground(r.category_color) }}>
                <Thumb src={r.image_url} icon={r.category_icon} alt="" />
              </Link>
              <div>
                <Link to={`/resources/${r.id}`} style={{ color: 'var(--ink)' }}><h3>{r.title}</h3></Link>
                <div className="timeline">
                  <span>{r.category_name}</span><span><FiEye /> {r.views} views</span><span>Up to {r.max_borrow_days} days</span><span>{priceLabel(r.price_per_day)}</span>
                </div>
                <div style={{ marginTop: 8 }}><StatusPill status={r.availability_status} /></div>
              </div>
              <div className="req-actions">
                {!['borrowed', 'reserved'].includes(r.availability_status) && (
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleHidden(r)}>
                    {r.availability_status === 'unavailable' ? <><FiEye /> Show</> : <><FiEyeOff /> Hide</>}
                  </button>
                )}
                <Link to={`/resources/${r.id}/edit`} className="btn btn-ghost btn-sm"><FiEdit2 /> Edit</Link>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(r)} aria-label={`Delete ${r.title}`}><FiTrash2 /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
