import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiSend } from 'react-icons/fi';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Modal, StarInput, Loader } from './ui';
import { useLookups } from '../context/LookupContext';
import { addDays, daysInclusive, fmtDateTime, money, todayStr } from '../utils/format';

export function RequestModal({ resource, onClose, onDone }) {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ borrow_date: todayStr(), due_date: addDays(todayStr(), Math.min(2, resource.max_borrow_days - 1)), request_message: '' });
  const [busy, setBusy] = useState(false);
  const maxDue = addDays(form.borrow_date, resource.max_borrow_days - 1);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const days = daysInclusive(form.borrow_date, form.due_date);
  const fee = Number(resource.price_per_day) * days;
  const deposit = Number(resource.deposit_amount) || 0;
  const total = fee + deposit;
  const balance = Number(user?.wallet_balance) || 0;
  const shortfall = Math.max(0, total - balance);

  const addMoney = async () => {
    setBusy(true);
    try {
      await api.post('/wallet/deposit', { amount: Math.max(10, Math.ceil(shortfall)) });
      await refreshUser();
      toast.success('Deposit recorded.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (shortfall > 0) return;
    setBusy(true);
    try {
      await api.post('/borrows', { resource_id: resource.id, ...form });
      await refreshUser();
      toast.success('Request sent! Your deposit is held until the request is settled.');
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Borrow "${resource.title}"`} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="bd">Pick-up date</label>
            <input id="bd" type="date" className="input" min={todayStr()} value={form.borrow_date} required
              onChange={(e) => setForm((f) => ({ ...f, borrow_date: e.target.value, due_date: e.target.value > f.due_date ? e.target.value : f.due_date }))} />
          </div>
          <div className="field">
            <label htmlFor="dd">Return by</label>
            <input id="dd" type="date" className="input" min={form.borrow_date} max={maxDue} value={form.due_date} onChange={set('due_date')} required />
          </div>
        </div>
        <p className="hint">This item can be borrowed for up to {resource.max_borrow_days} day{resource.max_borrow_days > 1 ? 's' : ''}.</p>

        <div className="fee-lines">
          <div><span>{fee > 0 ? `Rental fee (${days} day${days > 1 ? 's' : ''} × ${money(resource.price_per_day)})` : 'Rental fee'}</span><strong>{fee > 0 ? money(fee) : 'Free'}</strong></div>
          <div><span>Refundable security deposit</span><strong>{deposit > 0 ? money(deposit) : 'None'}</strong></div>
          <div className="total"><span>Deposit to hold now</span><strong>{money(total)}</strong></div>
          <div><span>Your balance</span><strong className={shortfall > 0 ? 'bad' : ''}>{money(balance)}</strong></div>
        </div>
        {total > 0 && (
          <p className="hint">
            This amount is set aside from your balance when you send the request. It is refunded if the request is declined or cancelled.
            The rental fee goes to the owner when they hand the item over, and the security deposit comes back when the owner confirms the return.
          </p>
        )}
        {shortfall > 0 && (
          <div className="banner" role="alert">
            <div>You need {money(shortfall)} more to borrow this item. <Link to="/wallet" onClick={onClose}>Open wallet</Link></div>
            <button type="button" className="btn btn-sun btn-sm" onClick={addMoney} disabled={busy}>Deposit {money(Math.max(10, Math.ceil(shortfall)))}</button>
          </div>
        )}

        <div className="field">
          <label htmlFor="msg">Message to the owner</label>
          <textarea id="msg" className="textarea" maxLength={500} placeholder="Say hi and tell them what you need it for..." value={form.request_message} onChange={set('request_message')} />
        </div>
        <button className="btn btn-lg" disabled={busy || shortfall > 0}>{busy ? 'Working...' : total > 0 ? `Send request and hold ${money(total)}` : 'Send request'}</button>
      </form>
    </Modal>
  );
}

export function ReviewModal({ request, otherName, onClose, onDone }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/reviews', { borrow_request_id: request.id, rating, comment });
      toast.success('Thanks for your review!');
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Rate ${otherName}`} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="muted">How was your experience with "{request.resource_title}"?</p>
        <StarInput value={rating} onChange={setRating} />
        <div className="field">
          <label htmlFor="rc">Comment (optional)</label>
          <textarea id="rc" className="textarea" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Was the item as described? Was pick-up easy?" />
        </div>
        <button className="btn btn-sun btn-lg" disabled={busy}>{busy ? 'Saving...' : 'Submit review'}</button>
      </form>
    </Modal>
  );
}

export function ReportModal({ resource, onClose }) {
  const { report_reasons: REASONS } = useLookups();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/reports', { resource_id: resource.id, reason: reason || REASONS[0], details });
      toast.success(data.message);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Report this listing" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="rr">Reason</label>
          <select id="rr" className="select" value={reason || REASONS[0] || ''} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rd">Details</label>
          <textarea id="rd" className="textarea" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Tell the admins what is wrong." />
        </div>
        <button className="btn btn-coral" disabled={busy}>{busy ? 'Sending...' : 'Submit report'}</button>
      </form>
    </Modal>
  );
}

export function ChatModal({ request, otherName, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const load = () => api.get(`/messages/${request.id}`).then((r) => alive && setMessages(r.data.messages)).catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => { alive = false; clearInterval(t); };
  }, [request.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post(`/messages/${request.id}`, { body });
      setMessages((m) => [...(m || []), data.message]);
      setBody('');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal title={`Chat with ${otherName}`} onClose={onClose}>
      <p className="muted small" style={{ marginTop: -8, marginBottom: 10 }}>About "{request.resource_title}"</p>
      {messages === null ? <Loader /> : (
        <div className="chat" aria-live="polite">
          {messages.length === 0 && <p className="muted center" style={{ margin: 'auto' }}>No messages yet. Say hello 👋</p>}
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.sender_id === user.id ? 'me' : 'them'}`}>
              {m.body}
              <small>{fmtDateTime(m.created_at)}</small>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
      <form className="row" onSubmit={send}>
        <input className="input" value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} placeholder="Type a message..." aria-label="Message" />
        <button className="btn" disabled={sending || !body.trim()} aria-label="Send message"><FiSend /></button>
      </form>
    </Modal>
  );
}
