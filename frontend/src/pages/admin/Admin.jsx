import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiUsers, FiPackage, FiRepeat, FiFlag, FiCheckCircle, FiAlertTriangle, FiStar, FiSearch, FiTrash2, FiCreditCard } from 'react-icons/fi';
import api, { errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Avatar, Empty, Loader, PageHead, StatusPill } from '../../components/ui';
import { useConfirm } from '../../components/Confirm';
import { fmtDate, isOverdue, money, timeAgo } from '../../utils/format';

const useLoad = (url, pick) => {
  const [data, setData] = useState(null);
  const reload = () => api.get(url).then((r) => setData(pick(r.data))).catch((e) => { toast.error(errorMessage(e)); setData([]); });
  useEffect(() => { reload(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
  return [data, reload];
};

function Overview() {
  const [data, setData] = useState(null);
  const [top, setTop] = useState([]);
  const [unverified, setUnverified] = useState([]);

  const load = () =>
    Promise.all([api.get('/admin/reports/summary'), api.get('/admin/reports/top-resources'), api.get('/admin/users')])
      .then(([s, t, u]) => {
        setData(s.data);
        setTop(t.data.top_resources);
        setUnverified(u.data.users.filter((x) => !x.is_verified && x.role === 'student'));
      })
      .catch((e) => toast.error(errorMessage(e)));
  useEffect(() => { load(); }, []);

  const verify = async (u) => {
    try {
      await api.put(`/admin/users/${u.id}/verify`, { is_verified: true });
      toast.success(`${u.full_name} is now verified.`);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (!data) return <Loader />;
  const s = data.summary;
  const maxCat = Math.max(1, ...data.category_distribution.map((c) => c.count));
  const maxMonth = Math.max(1, ...data.monthly_activity.map((m) => m.count));

  return (
    <>
      <div className="stats">
        <div className="stat bg-violet"><FiUsers /><div className="num">{s.total_users}</div><div className="lbl">{s.verified_users} verified</div></div>
        <div className="stat bg-coral"><FiPackage /><div className="num">{s.total_resources}</div><div className="lbl">{s.available_resources} available</div></div>
        <div className="stat bg-teal"><FiRepeat /><div className="num">{s.total_borrows}</div><div className="lbl">{s.active_borrows} on loan now</div></div>
        <div className="stat bg-sun"><FiStar /><div className="num">{s.avg_rating}</div><div className="lbl">{s.total_reviews} reviews</div></div>
        <div className="stat bg-pink"><FiFlag /><div className="num">{s.open_reports}</div><div className="lbl">open reports</div></div>
        <div className="stat bg-blue"><FiAlertTriangle /><div className="num">{s.overdue_borrows}</div><div className="lbl">overdue loans</div></div>
        <div className="stat bg-teal"><FiCreditCard /><div className="num" style={{ fontSize: '1.8rem' }}>{money(s.held_funds)}</div><div className="lbl">held in deposits · {money(s.total_deposited)} added in {s.deposit_count} top-up{s.deposit_count === 1 ? '' : 's'}</div></div>
      </div>

      <section className="card" style={{ marginBottom: 22 }} aria-labelledby="unv">
        <div className="card-title">
          <h3 id="unv">Awaiting verification ({unverified.length})</h3>
          <Link to="/admin/users" className="small">All users</Link>
        </div>
        {unverified.length === 0 ? (
          <p className="muted">Everyone is verified. 🎉</p>
        ) : (
          <div className="stack">
            {unverified.map((u) => (
              <div key={u.id} className="row wrap">
                <Avatar name={u.full_name} src={u.profile_image} />
                <div className="grow">
                  <Link to={`/profile/${u.id}`} style={{ fontWeight: 800 }}>{u.full_name}</Link>
                  <div className="muted small">{u.email}{u.college_id ? ` · ${u.college_id}` : ''}{u.department ? ` · ${u.department}` : ''} · joined {fmtDate(u.created_at)}</div>
                </div>
                <button className="btn btn-teal btn-sm" onClick={() => verify(u)}><FiCheckCircle /> Verify</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="form-grid" style={{ alignItems: 'start' }}>
        <section className="card">
          <h3 style={{ marginBottom: 14 }}>Items by category</h3>
          {data.category_distribution.map((c) => (
            <div key={c.category} className="bar-row">
              <span>{c.category}</span>
              <div className="bar"><span style={{ width: `${(c.count / maxCat) * 100}%`, background: c.color }} /></div>
              <span>{c.count}</span>
            </div>
          ))}
        </section>
        <section className="card">
          <h3 style={{ marginBottom: 6 }}>Requests per month</h3>
          {data.monthly_activity.length === 0 ? <p className="muted">No activity yet.</p> : (
            <div className="col-chart">
              {data.monthly_activity.map((m) => (
                <div key={m.month}>
                  {m.count}
                  <div className="col" style={{ height: `${(m.count / maxMonth) * 100}%` }} />
                  <span className="muted">{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 22 }}>
        <h3 style={{ marginBottom: 10 }}>Most borrowed items</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Owner</th><th>Status</th><th>Views</th><th>Requests</th></tr></thead>
            <tbody>
              {top.map((t) => (
                <tr key={t.id}>
                  <td><Link to={`/resources/${t.id}`}>{t.title}</Link></td><td>{t.owner_name}</td>
                  <td><StatusPill status={t.availability_status} /></td><td>{t.views}</td><td><strong>{t.borrow_count}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Users() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [users, reload] = useLoad(`/admin/users?search=${encodeURIComponent(query)}`, (d) => d.users);
  const [filter, setFilter] = useState('all');

  const act = async (fn, msg) => {
    try { await fn(); toast.success(msg); reload(); } catch (err) { toast.error(errorMessage(err)); }
  };

  const shown = (users || []).filter((u) => filter === 'all' || (filter === 'unverified' ?!u.is_verified && u.role === 'student' : filter === 'suspended' ? !u.is_active : true));

  return (
    <>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }} role="search">
        <div className="input-icon grow"><FiSearch /><input className="input" placeholder="Search name, email or college ID" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" /></div>
        <div className="tabs" style={{ margin: 0 }}>
          {['all', 'unverified', 'suspended'].map((f) => <button type="button" key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>{f}</button>)}
        </div>
      </form>
      {!users ? <Loader /> : shown.length === 0 ? <Empty emoji="👥" title="No users match" /> : (
        <div className="card card-flush table-wrap">
          <table>
            <thead><tr><th>User</th><th>Department</th><th>Items</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="row">
                      <Avatar name={u.full_name} src={u.profile_image} size="sm" />
                      <div><Link to={`/profile/${u.id}`}>{u.full_name}</Link><div className="muted small">{u.email}</div></div>
                    </div>
                  </td>
                  <td>{u.department || '-'}</td><td>{u.resource_count}</td><td>{fmtDate(u.created_at)}</td>
                  <td>
                    <div className="row wrap" style={{ gap: 6 }}>
                      {u.role === 'admin' && <span className="pill pill-pending">Admin</span>}
                      <span className={`pill ${u.is_verified ? 'pill-available' : 'pill-borrowed'}`}>{u.is_verified ? 'Verified' : 'Unverified'}</span>
                      {!u.is_active && <span className="pill pill-rejected">Suspended</span>}
                    </div>
                  </td>
                  <td>
                    {u.role !== 'admin' && (
                      <div className="row wrap" style={{ gap: 6 }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => act(() => api.put(`/admin/users/${u.id}/verify`, { is_verified: !u.is_verified }), u.is_verified ? 'Verification removed.' : 'User verified.')}>
                          <FiCheckCircle /> {u.is_verified ? 'Unverify' : 'Verify'}
                        </button>
                        {u.id !== me.id && (
                          <button className="btn btn-sm btn-ghost" onClick={() => act(() => api.put(`/admin/users/${u.id}/status`, { is_active: !u.is_active }), u.is_active ? 'Account suspended.' : 'Account reactivated.')}>
                            {u.is_active ? 'Suspend' : 'Reactivate'}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Resources() {
  const confirm = useConfirm();
  const [items, reload] = useLoad('/admin/resources', (d) => d.resources);
  const remove = async (r) => {
    if (!(await confirm({ title: 'Delete this listing?', message: `"${r.title}" and its loan history will be permanently removed.`, confirmText: 'Delete', danger: true }))) return;
    try { await api.delete(`/admin/resources/${r.id}`); toast.success('Listing deleted.'); reload(); } catch (err) { toast.error(errorMessage(err)); }
  };
  if (!items) return <Loader />;
  return (
    <div className="card card-flush table-wrap">
      <table>
        <thead><tr><th>Item</th><th>Category</th><th>Owner</th><th>Status</th><th>Requests</th><th>Listed</th><th /></tr></thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <td><Link to={`/resources/${r.id}`}>{r.title}</Link></td>
              <td><span className="cat-chip" style={{ background: r.category_color }}>{r.category_name}</span></td>
              <td>{r.owner_name}</td><td><StatusPill status={r.availability_status} /></td><td>{r.borrow_count}</td><td>{fmtDate(r.created_at)}</td>
              <td><button className="btn btn-sm btn-ghost" onClick={() => remove(r)} aria-label={`Delete ${r.title}`}><FiTrash2 /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Borrows() {
  const [rows] = useLoad('/admin/borrows', (d) => d.borrows);
  if (!rows) return <Loader />;
  if (!rows.length) return <Empty emoji="🔁" title="No loans yet" />;
  return (
    <div className="card card-flush table-wrap">
      <table>
        <thead><tr><th>Item</th><th>Borrower</th><th>Owner</th><th>Dates</th><th>Status</th><th>Requested</th></tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td>{b.resource_title}</td><td>{b.borrower_name}</td><td>{b.owner_name}</td>
              <td>{fmtDate(b.borrow_date)} to {fmtDate(b.due_date)}</td>
              <td><StatusPill status={b.status} overdue={isOverdue(b)} /></td><td>{timeAgo(b.requested_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Payments() {
  const [rows] = useLoad('/admin/payments', (d) => d.payments);
  if (!rows) return <Loader />;
  if (!rows.length) return <Empty emoji="💳" title="No wallet activity yet" text="Deposits, holds, refunds and rental earnings will appear here." />;
  return (
    <div className="card card-flush table-wrap">
      <table>
        <thead><tr><th>User</th><th>Type</th><th>Amount</th><th>Balance after</th><th>Item</th><th>Note</th><th>Date</th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{p.user_name}</td>
              <td><span className={`pill pill-${p.type === 'hold' ? 'held' : p.type === 'deposit' ? 'success' : 'pending'}`} style={{ textTransform: 'capitalize' }}>{p.type}</span></td>
              <td><strong style={{ color: Number(p.amount) < 0 ? 'var(--danger)' : 'var(--success)' }}>{Number(p.amount) < 0 ? '-' : '+'}{money(Math.abs(p.amount))}</strong></td>
              <td>{money(p.balance_after)}</td>
              <td>{p.resource_title || '-'}</td>
              <td className="small muted">{p.note || ''}</td>
              <td>{fmtDate(p.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Flags() {
  const confirm = useConfirm();
  const [reports, reload] = useLoad('/admin/flags', (d) => d.reports);
  const resolve = async (r, status, remove_listing = false) => {
    if (remove_listing && !(await confirm({ title: 'Remove this listing?', message: `"${r.resource_title}" will be deleted permanently and its owner will be notified.`, confirmText: 'Remove listing', danger: true }))) return;
    try { await api.put(`/admin/flags/${r.id}`, { status, remove_listing }); toast.success(`Report ${status}.`); reload(); } catch (err) { toast.error(errorMessage(err)); }
  };
  if (!reports) return <Loader />;
  if (!reports.length) return <Empty emoji="🕊️" title="No reports" text="The community is behaving. Nice." />;
  return (
    <div className="stack">
      {reports.map((r) => (
        <article key={r.id} className="card">
          <div className="row wrap between">
            <div>
              <div className="row wrap"><h3><Link to={`/resources/${r.resource_id}`}>{r.resource_title}</Link></h3><StatusPill status={r.status} /></div>
              <div className="muted small">Reported by {r.reporter_name} · {timeAgo(r.created_at)} · owner {r.owner_name}</div>
            </div>
            <span className="pill pill-rejected">{r.reason}</span>
          </div>
          {r.details && <div className="req-note">{r.details}</div>}
          {r.status === 'open' && (
            <div className="row wrap" style={{ marginTop: 14 }}>
              <button className="btn btn-sm btn-danger" onClick={() => resolve(r, 'resolved', true)}>Remove listing</button>
              <button className="btn btn-sm btn-teal" onClick={() => resolve(r, 'resolved')}>Mark resolved</button>
              <button className="btn btn-sm btn-ghost" onClick={() => resolve(r, 'dismissed')}>Dismiss</button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

export default function Admin() {
  const tabs = [
    { to: '/admin', label: 'Overview', end: true },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/resources', label: 'Listings' },
    { to: '/admin/borrows', label: 'Loans' },
    { to: '/admin/payments', label: 'Deposits' },
    { to: '/admin/reports', label: 'Reports' }
  ];
  return (
    <>
      <PageHead title="Control room" subtitle="Keep the community safe, verified and thriving." />
      <nav className="tabs" aria-label="Admin sections">
        {tabs.map((t) => <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>{t.label}</NavLink>)}
      </nav>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="users" element={<Users />} />
        <Route path="resources" element={<Resources />} />
        <Route path="borrows" element={<Borrows />} />
        <Route path="payments" element={<Payments />} />
        <Route path="reports" element={<Flags />} />
      </Routes>
    </>
  );
}
