import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiPackage, FiRepeat, FiInbox, FiHeart, FiStar, FiAlertTriangle, FiPlus, FiCompass, FiClock, FiCheck, FiX, FiCreditCard } from 'react-icons/fi';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Empty, Loader, PageHead, Thumb, thumbBackground } from '../components/ui';
import { fmtDate, money, timeAgo } from '../utils/format';

export default function Dashboard() {
  const { user, isVerified, isAdmin } = useAuth();
  const [data, setData] = useState(null);

  const load = () => api.get('/dashboard').then((r) => setData(r.data)).catch((e) => toast.error(errorMessage(e)));
  useEffect(() => { load(); }, []);

  const respond = async (id, action) => {
    try {
      await api.put(`/borrows/${id}/respond`, { action });
      toast.success(action === 'accept' ? 'Request accepted!' : 'Request declined.');
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (!data) return <Loader />;
  const { stats } = data;

  return (
    <>
      <PageHead title={`Hey ${user.full_name.split(' ')[0]} 👋`} subtitle="Here is what is happening with your campus sharing.">
        <Link to="/browse" className="btn btn-ghost"><FiCompass /> Browse</Link>
        {isVerified && <Link to="/resources/new" className="btn btn-sun"><FiPlus /> List an item</Link>}
      </PageHead>

      {!isVerified && !isAdmin && (
        <div className="banner" role="status">
          <FiAlertTriangle />
          <div>Your account is waiting for admin verification. You can browse and save items now, and list or borrow once you are verified.</div>
        </div>
      )}

      {stats.to_release > 0 && (
        <div className="banner" role="status">
          <FiPackage />
          <div>{stats.to_release} item{stats.to_release > 1 ? 's are' : ' is'} ready to hand over. <Link to="/requests">Release {stats.to_release > 1 ? 'them' : 'it'}</Link></div>
        </div>
      )}

      <div className="stats">
        <div className="stat bg-violet"><FiPackage /><div className="num">{stats.my_resources}</div><div className="lbl">My listings</div></div>
        <div className="stat bg-coral"><FiRepeat /><div className="num">{stats.borrowing_now}</div><div className="lbl">Borrowing now</div></div>
        <div className="stat bg-teal"><FiInbox /><div className="num">{stats.incoming_pending}</div><div className="lbl">Requests to answer</div></div>
        <div className="stat bg-sun"><FiHeart /><div className="num">{stats.saved_items}</div><div className="lbl">Saved items</div></div>
        <Link to="/wallet" className="stat bg-blue" style={{ display: 'block' }}><FiCreditCard /><div className="num" style={{ fontSize: '1.8rem' }}>{money(stats.wallet_balance)}</div><div className="lbl">Wallet balance · earned {money(stats.earnings)}</div></Link>
        <div className="stat bg-pink"><FiStar /><div className="num">{stats.avg_rating ?? '-'}</div><div className="lbl">{stats.total_reviews} review{stats.total_reviews === 1 ? '' : 's'}</div></div>
      </div>

      <div className="form-grid" style={{ alignItems: 'start' }}>
        <section className="card" aria-labelledby="due">
          <div className="card-title"><h3 id="due"><FiClock style={{ verticalAlign: '-2px' }} /> Return soon</h3><Link to="/requests" className="small">All requests</Link></div>
          {data.due_soon.length === 0 ? (
            <p className="muted">Nothing on loan right now. <Link to="/browse">Find something to borrow</Link></p>
          ) : (
            <div className="stack">
              {data.due_soon.map((d) => (
                <Link key={d.id} to={`/resources/${d.resource_id}`} className="row" style={{ color: 'var(--ink)' }}>
                  <div className="req-thumb" style={{ background: thumbBackground(d.category_color), width: 56, height: 56, fontSize: '1.4rem', borderRadius: 14 }}>
                    <Thumb src={d.image_url} icon={d.category_icon} alt="" />
                  </div>
                  <div className="grow">
                    <div style={{ fontWeight: 800 }}>{d.title}</div>
                    <div className="muted small">from {d.owner_name} · due {fmtDate(d.due_date)}</div>
                  </div>
                  <span className={`pill ${d.days_left < 0 ? 'pill-overdue' : d.days_left <= 1 ? 'pill-borrowed' : 'pill-available'}`}>
                    {d.days_left < 0 ? `${-d.days_left}d late` : d.days_left === 0 ? 'Today' : `${d.days_left}d left`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="inc">
          <div className="card-title"><h3 id="inc"><FiInbox style={{ verticalAlign: '-2px' }} /> Waiting for your reply</h3><Link to="/requests" className="small">Manage</Link></div>
          {data.incoming.length === 0 ? (
            <p className="muted">No pending requests. 🎉</p>
          ) : (
            <div className="stack">
              {data.incoming.map((r) => (
                <div key={r.id} className="row wrap">
                  <div className="grow">
                    <div style={{ fontWeight: 800 }}>{r.borrower_name} <span className="muted">wants</span> {r.title}</div>
                    <div className="muted small">{fmtDate(r.borrow_date)} to {fmtDate(r.due_date)}</div>
                  </div>
                  <button className="btn btn-teal btn-sm" onClick={() => respond(r.id, 'accept')} aria-label="Accept"><FiCheck /> Accept</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => respond(r.id, 'reject')} aria-label="Decline"><FiX /></button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 22 }} aria-labelledby="act">
        <h3 id="act" style={{ marginBottom: 12 }}>Recent activity</h3>
        {data.recent_activity.length === 0 ? (
          <Empty emoji="🌱" title="Nothing yet" text="Your notifications will show up here as you start sharing." />
        ) : (
          data.recent_activity.map((n) => (
            <Link key={n.id} to={n.link || '/notifications'} className={`notif ${n.is_read ? '' : 'unread'}`} style={{ borderRadius: 12 }}>
              <div className="grow">{n.message}<div className="muted small">{timeAgo(n.created_at)}</div></div>
            </Link>
          ))
        )}
      </section>
    </>
  );
}
