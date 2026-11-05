import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCheck, FiX, FiMessageCircle, FiStar, FiCornerUpLeft, FiCalendar, FiCreditCard, FiPackage, FiShield } from 'react-icons/fi';
import api, { errorMessage } from '../api/client';
import { Empty, Loader, PageHead, StatusPill, Thumb, thumbBackground } from '../components/ui';
import { ChatModal, ReviewModal } from '../components/modals';
import { useConfirm } from '../components/Confirm';
import { useAuth } from '../context/AuthContext';
import { fmtDate, isOverdue, money, timeAgo } from '../utils/format';

// Money still held for this request: fee until the item is released, deposit until it is returned.
const heldAmount = (r) => (r.fee_status === 'held' ? Number(r.total_fee) : 0) + (r.deposit_status === 'held' ? Number(r.deposit_amount) : 0);

export default function Requests() {
  const confirm = useConfirm();
  const { refreshUser } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'sent' ? 'sent' : 'received';
  const [received, setReceived] = useState(null);
  const [sent, setSent] = useState(null);
  const [chat, setChat] = useState(null);
  const [review, setReview] = useState(null);

  const load = () =>
    Promise.all([api.get('/borrows/received'), api.get('/borrows/sent')])
      .then(([a, b]) => { setReceived(a.data.requests); setSent(b.data.requests); })
      .catch((e) => toast.error(errorMessage(e)));
  useEffect(() => { load(); }, []);

  const act = async (fn, okMsg) => {
    try {
      await fn();
      toast.success(okMsg);
      load();
      refreshUser(); // the wallet balance changes on refunds and payouts
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const respond = (r, action) => act(() => api.put(`/borrows/${r.id}/respond`, { action }), action === 'accept' ? 'Request accepted!' : 'Request declined. The borrower was refunded.');
  const markReturned = (r) => act(() => api.put(`/borrows/${r.id}/return`), 'Return confirmed. The security deposit was refunded to the borrower.');
  const release = (r) => act(() => api.put(`/borrows/${r.id}/release`), 'Item released to the borrower.');
  const cancel = async (r) => {
    const ok = await confirm({
      title: r.status === 'accepted' ? 'Cancel this reservation?' : 'Cancel this request?',
      message: r.status === 'accepted' ? `"${r.resource_title}" will become available again.` : `The owner of "${r.resource_title}" will no longer see it. Your held money is refunded.`,
      confirmText: 'Cancel request', cancelText: 'Keep it', danger: true
    });
    if (ok) act(() => api.put(`/borrows/${r.id}/cancel`), 'Request cancelled.');
  };

  const list = tab === 'received' ? received : sent;
  const pendingCount = received?.filter((r) => r.status === 'pending').length || 0;

  return (
    <>
      <PageHead title="Requests" subtitle="Everything you have lent out or asked to borrow." />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'received'} className={`tab ${tab === 'received' ? 'active' : ''}`} onClick={() => setParams({})}>
          Incoming {pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}
        </button>
        <button role="tab" aria-selected={tab === 'sent'} className={`tab ${tab === 'sent' ? 'active' : ''}`} onClick={() => setParams({ tab: 'sent' })}>My requests</button>
      </div>

      {!list ? <Loader /> : list.length === 0 ? (
        <Empty emoji={tab === 'received' ? '📬' : '🛒'} title={tab === 'received' ? 'No incoming requests' : 'You have not borrowed anything yet'}
          text={tab === 'received' ? 'When someone asks to borrow your items, it will show up here.' : 'Find something useful and send your first request.'}>
          {tab === 'sent' && <Link to="/browse" className="btn">Browse items</Link>}
        </Empty>
      ) : (
        <div className="stack">
          {list.map((r) => {
            const incoming = tab === 'received';
            const other = incoming ? r.borrower_name : r.owner_name;
            const overdue = isOverdue(r);
            return (
              <article key={r.id} className="card req">
                <Link to={`/resources/${r.resource_id}`} className="req-thumb" style={{ background: thumbBackground(r.category_color) }}>
                  <Thumb src={r.resource_image} icon={r.category_icon} alt="" />
                </Link>
                <div>
                  <div className="row wrap">
                    <Link to={`/resources/${r.resource_id}`} style={{ color: 'var(--ink)' }}><h3>{r.resource_title}</h3></Link>
                    <StatusPill status={r.status} overdue={overdue} />
                    {heldAmount(r) > 0 && <span className="pill pill-held"><FiShield /> {money(heldAmount(r))} held</span>}
                    {Number(r.deposit_amount) > 0 && r.deposit_status === 'refunded' && r.status === 'returned' && <span className="pill pill-paid">Deposit refunded</span>}
                  </div>
                  <div className="muted small" style={{ fontWeight: 700 }}>
                    {incoming ? <>Requested by <Link to={`/profile/${r.borrower_id}`}>{other}</Link>{r.borrower_department ? ` · ${r.borrower_department}` : ''}</> : <>Owner: <Link to={`/profile/${r.owner_id}`}>{other}</Link></>}
                    {' · '}{timeAgo(r.requested_at)}
                  </div>
                  <div className="timeline">
                    <span><FiCalendar /> {fmtDate(r.borrow_date)} to {fmtDate(r.due_date)}</span>
                    <span><FiCreditCard /> {Number(r.total_fee) > 0 ? `Fee ${money(r.total_fee)}` : 'Free'}{Number(r.deposit_amount) > 0 ? ` + ${money(r.deposit_amount)} deposit` : ''}</span>
                    {r.returned_at && <span><FiCornerUpLeft /> Returned {fmtDate(r.returned_at)}</span>}
                  </div>
                  {r.request_message && <div className="req-note">“{r.request_message}”</div>}
                </div>
                <div className="req-actions">
                  {incoming && r.status === 'pending' && (
                    <>
                      <button className="btn btn-teal btn-sm" onClick={() => respond(r, 'accept')}><FiCheck /> Accept</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => respond(r, 'reject')}><FiX /> Decline</button>
                    </>
                  )}
                  {!incoming && r.status === 'accepted' && <span className="pill pill-accepted">Waiting for owner to release</span>}
                  {incoming && r.status === 'accepted' && (
                    <button className="btn btn-teal btn-sm" onClick={() => release(r)}><FiPackage /> Release item{Number(r.total_fee) > 0 ? ` (+${money(r.total_fee)})` : ''}</button>
                  )}
                  {((!incoming && r.status === 'pending') || r.status === 'accepted') && (
                    <button className="btn btn-ghost btn-sm" onClick={() => cancel(r)}>Cancel</button>
                  )}
                  {incoming && r.status === 'borrowed' && (
                    <button className="btn btn-sm" onClick={() => markReturned(r)}><FiCornerUpLeft /> Confirm return</button>
                  )}
                  {!incoming && r.status === 'borrowed' && <span className="pill pill-borrowed">Owner confirms the return</span>}
                  {r.status === 'returned' && !r.reviewed && (
                    <button className="btn btn-sun btn-sm" onClick={() => setReview({ request: r, other })}><FiStar /> Review</button>
                  )}
                  {['pending', 'accepted', 'borrowed', 'returned'].includes(r.status) && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setChat({ request: r, other })}>
                      <FiMessageCircle /> Chat{r.message_count > 0 ? ` (${r.message_count})` : ''}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {chat && <ChatModal request={chat.request} otherName={chat.other} onClose={() => { setChat(null); load(); }} />}
      {review && <ReviewModal request={review.request} otherName={review.other} onClose={() => setReview(null)} onDone={() => { setReview(null); load(); }} />}
    </>
  );
}
