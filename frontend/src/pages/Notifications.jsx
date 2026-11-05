import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiBell, FiCheckCircle, FiInbox, FiMessageCircle, FiStar, FiAlertCircle, FiCreditCard, FiPackage } from 'react-icons/fi';
import api from '../api/client';
import { Empty, Loader, PageHead } from '../components/ui';
import { useConfirm } from '../components/Confirm';
import { timeAgo } from '../utils/format';

const STYLE = {
  payment: ['var(--success)', FiCreditCard], release: ['var(--teal)', FiPackage],
  request: ['var(--primary)', FiInbox], return: ['var(--teal)', FiCheckCircle], message: ['var(--blue)', FiMessageCircle],
  review: ['var(--sun)', FiStar], admin: ['var(--coral)', FiAlertCircle], info: ['var(--ink-soft)', FiBell]
};

export default function Notifications() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const load = () => api.get('/notifications').then((r) => setData(r.data)).catch(() => setData({ notifications: [], unread_count: 0 }));
  useEffect(() => { load(); }, []);

  const open = async (n) => {
    if (!n.is_read) await api.put(`/notifications/${n.id}/read`).catch(() => {});
    if (n.link) navigate(n.link); else load();
  };
  const readAll = async () => { await api.put('/notifications/read-all'); load(); };
  const clear = async () => {
    if (!(await confirm({ title: 'Clear all notifications?', message: 'This removes every notification from your list.', confirmText: 'Clear all', danger: true }))) return;
    await api.delete('/notifications');
    toast.success('Notifications cleared.');
    load();
  };

  return (
    <>
      <PageHead title="Notifications" subtitle={data ? `${data.unread_count} unread` : ''}>
        <button className="btn btn-ghost btn-sm" onClick={readAll} disabled={!data?.unread_count}>Mark all read</button>
        <button className="btn btn-ghost btn-sm" onClick={clear} disabled={!data?.notifications.length}>Clear all</button>
      </PageHead>
      {!data ? <Loader /> : data.notifications.length === 0 ? (
        <Empty emoji="🔔" title="All quiet" text="We will let you know when something happens." />
      ) : (
        <div className="card card-flush">
          {data.notifications.map((n) => {
            const [color, Icon] = STYLE[n.type] || STYLE.info;
            return (
              <div key={n.id} className={`notif ${n.is_read ? '' : 'unread'}`} onClick={() => open(n)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open(n)}>
                <span className="notif-ico" style={{ background: color }}><Icon /></span>
                <div className="grow">{n.message}<div className="muted small">{timeAgo(n.created_at)}</div></div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
