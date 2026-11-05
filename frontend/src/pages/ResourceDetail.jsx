import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiHeart, FiMapPin, FiClock, FiEye, FiEdit2, FiFlag, FiCheckCircle, FiTool, FiArrowLeft, FiTrash2, FiCreditCard, FiShield } from 'react-icons/fi';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Avatar, CategoryChip, Loader, StatusPill, Stars, Thumb, thumbBackground } from '../components/ui';
import { RequestModal, ReportModal } from '../components/modals';
import { useConfirm } from '../components/Confirm';
import { fmtDate, priceLabel } from '../utils/format';
import { useLookups } from '../context/LookupContext';
import { toggleSaved } from '../utils/actions';

export default function ResourceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { conditionLabel } = useLookups();
  const { user, isVerified, isAdmin } = useAuth();
  const [resource, setResource] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  const load = () =>
    api.get(`/resources/${id}`)
      .then((r) => {
        setResource(r.data.resource);
        return api.get(`/reviews/user/${r.data.resource.owner_id}`);
      })
      .then((r) => setReviews(r.data.reviews.slice(0, 3)))
      .catch((e) => setError(errorMessage(e, 'Could not load this item.')));

  useEffect(() => { setResource(null); setError(''); load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="empty card"><div className="emoji">😕</div><h3>{error}</h3><Link to="/browse" className="btn">Back to browse</Link></div>
    );
  }
  if (!resource) return <Loader />;

  const r = resource;
  const isOwner = r.owner_id === user.id;
  const canBorrow = !isOwner && r.availability_status === 'available' && !r.my_request;

  const save = async () => setResource({ ...r, is_saved: await toggleSaved(r) });
  const remove = async () => {
    if (!(await confirm({ title: 'Delete this listing?', message: `"${r.title}" and its request history will be permanently removed.`, confirmText: 'Delete', danger: true }))) return;
    try {
      await api.delete(`/resources/${r.id}`);
      toast.success('Listing deleted.');
      navigate('/my-listings');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}><FiArrowLeft /> Back</button>
      <div className="detail">
        <div className="detail-img" style={{ background: thumbBackground(r.category_color) }}>
          <Thumb src={r.image_url} icon={r.category_icon} alt={r.title} />
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <div className="row wrap">
            <CategoryChip name={r.category_name} color={r.category_color} icon={r.category_icon} />
            <StatusPill status={r.availability_status} />
          </div>
          <h1>{r.title}</h1>
          <p style={{ whiteSpace: 'pre-line' }} className="muted">{r.description || 'The owner has not added a description.'}</p>

          <div className="kv">
            <div><div className="k">Condition</div><div className="v"><FiTool /> {conditionLabel(r.condition_status)}</div></div>
            <div><div className="k">Rental fee</div><div className="v"><FiCreditCard /> {priceLabel(r.price_per_day)}</div></div>
            <div><div className="k">Security deposit</div><div className="v"><FiShield /> {Number(r.deposit_amount) > 0 ? `${money(r.deposit_amount)} (refundable)` : 'None'}</div></div>
            <div><div className="k">Max loan</div><div className="v"><FiClock /> {r.max_borrow_days} day{r.max_borrow_days > 1 ? 's' : ''}</div></div>
            <div><div className="k">Pick-up spot</div><div className="v"><FiMapPin /> {r.location || 'Ask the owner'}</div></div>
            <div><div className="k">Listed</div><div className="v"><FiEye /> {r.views} view{r.views === 1 ? '' : 's'} · {fmtDate(r.created_at)}</div></div>
          </div>

          <div className="row wrap">
            {canBorrow && (
              isVerified
                ? <button className="btn btn-lg" onClick={() => setModal('request')}>Request to borrow</button>
                : <button className="btn btn-lg" disabled title="Your account must be verified first">Verification required</button>
            )}
            {r.my_request && (
              <Link to="/requests" className="btn btn-teal btn-lg"><FiCheckCircle /> {r.my_request.status === 'pending' ? 'Request pending' : r.my_request.status === 'accepted' ? 'Accepted - view request' : 'You have this item'}</Link>
            )}
            {!isOwner && r.availability_status !== 'available' && !r.my_request && <button className="btn btn-lg" disabled>Currently unavailable</button>}
            {!isOwner && (
              <button className="btn btn-ghost" onClick={save} aria-pressed={r.is_saved}>
                <FiHeart style={r.is_saved ? { fill: 'var(--coral)', color: 'var(--coral)' } : undefined} /> {r.is_saved ? 'Saved' : 'Save'}
              </button>
            )}
            {(isOwner || isAdmin) && <Link to={`/resources/${r.id}/edit`} className="btn btn-ghost"><FiEdit2 /> Edit</Link>}
            {(isOwner || isAdmin) && <button className="btn btn-ghost" onClick={remove}><FiTrash2 /> Delete</button>}
          </div>
          {!isVerified && !isOwner && <p className="hint">You can borrow items once an admin verifies your account.</p>}

          <Link to={`/profile/${r.owner_id}`} className="card row" style={{ color: 'var(--ink)' }}>
            <Avatar name={r.owner_name} src={r.owner_image} />
            <div className="grow">
              <div style={{ fontWeight: 800 }}>{r.owner_name} {r.owner_verified && <FiCheckCircle style={{ color: 'var(--teal)', verticalAlign: '-2px' }} title="Verified" />}</div>
              <div className="muted small">{r.owner_department || 'Student'}</div>
            </div>
            {r.owner_avg_rating ? <div className="small center"><Stars value={r.owner_avg_rating} size={14} /><div className="muted">{r.owner_avg_rating} ({r.owner_total_reviews})</div></div> : <span className="muted small">No reviews yet</span>}
          </Link>

          {reviews.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: 6 }}>What people say about {r.owner_name.split(' ')[0]}</h3>
              {reviews.map((rv) => (
                <div key={rv.id} className="review">
                  <div className="row"><strong>{rv.reviewer_name}</strong><Stars value={rv.rating} size={13} /></div>
                  {rv.comment && <p className="muted small">{rv.comment}</p>}
                </div>
              ))}
            </div>
          )}

          {!isOwner && isVerified && (
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setModal('report')}><FiFlag /> Report this listing</button>
          )}
        </div>
      </div>

      {modal === 'request' && <RequestModal resource={r} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      {modal === 'report' && <ReportModal resource={r} onClose={() => setModal(null)} />}
    </>
  );
}
