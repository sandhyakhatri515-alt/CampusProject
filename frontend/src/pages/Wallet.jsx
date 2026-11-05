import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCreditCard, FiShield, FiPlus, FiCheckCircle, FiInfo } from 'react-icons/fi';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Empty, Loader, PageHead } from '../components/ui';
import { fmtDate, money, receiptNo } from '../utils/format';

const QUICK = [100, 500, 1000, 2000];
const TYPE_LABEL = { deposit: 'Deposit', hold: 'Held', refund: 'Refund', earning: 'Rental income' };

// Deposits here are records only. No payment gateway is used and no real money moves;
// each deposit just creates a transaction with a receipt number as proof.
export default function Wallet() {
  const { refreshUser } = useAuth();
  const [data, setData] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const load = () => api.get('/wallet').then((r) => setData(r.data)).catch((e) => toast.error(errorMessage(e)));
  useEffect(() => { load(); }, []);

  const deposit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: res } = await api.post('/wallet/deposit', { amount: Number(amount), note });
      toast.success(res.message);
      setReceipt(res.receipt);
      setAmount('');
      setNote('');
      await Promise.all([load(), refreshUser()]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Loader />;

  return (
    <>
      <PageHead title="Wallet" subtitle="Record a deposit before you borrow. It is held while a request is open and refunded when it is settled." />

      <div className="banner" role="note">
        <FiInfo />
        <div>This is a record only. No real payment is made and no payment gateway is used. Each deposit is saved as a transaction with a receipt number as proof.</div>
      </div>

      <div className="wallet-hero">
        <div className="stat"><FiCreditCard /><div className="num" style={{ fontSize: '1.9rem' }}>{money(data.balance)}</div><div className="lbl">Deposit balance</div></div>
        <div className="stat"><FiShield /><div className="num" style={{ fontSize: '1.9rem' }}>{money(data.held)}</div><div className="lbl">Currently held for requests</div></div>
      </div>

      <section className="card" style={{ marginBottom: 22 }} aria-labelledby="add">
        <div className="card-title"><h3 id="add"><FiPlus style={{ verticalAlign: '-2px' }} /> Record a deposit</h3></div>
        <form className="stack" onSubmit={deposit}>
          <div className="quick-amounts">
            {QUICK.map((q) => (
              <button key={q} type="button" className="btn btn-ghost btn-sm" onClick={() => setAmount(String(q))}>{money(q)}</button>
            ))}
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="amt">Amount (Rs)</label>
              <input id="amt" className="input" type="number" min={10} max={50000} step="1" required placeholder="10 - 50,000"
                value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="note">Note (optional)</label>
              <input id="note" className="input" maxLength={100} placeholder="e.g. Deposit for camera loan" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <div><button className="btn" disabled={busy || !amount}>{busy ? 'Recording...' : 'Record deposit'}</button></div>
          <p className="hint">
            When you send a borrow request, the rental fee plus the item's security deposit is set aside from this balance.
            Declined or cancelled requests are refunded in full. The security deposit is returned when the owner confirms the return.
          </p>
        </form>
      </section>

      {receipt && (
        <section className="card receipt" style={{ marginBottom: 22 }} aria-label="Deposit receipt">
          <div className="row" style={{ gap: 10 }}>
            <FiCheckCircle style={{ color: 'var(--success)', fontSize: '1.5rem' }} />
            <h3>Deposit recorded</h3>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setReceipt(null)}>Dismiss</button>
          </div>
          <div className="fee-lines" style={{ marginTop: 12 }}>
            <div><span>Receipt no.</span><strong>{receiptNo(receipt.id)}</strong></div>
            <div><span>Amount</span><strong>{money(receipt.amount)}</strong></div>
            {receipt.note && <div><span>Note</span><strong>{receipt.note}</strong></div>}
            <div><span>Date</span><strong>{fmtDate(receipt.created_at)}</strong></div>
            <div><span>Balance after</span><strong>{money(receipt.balance_after)}</strong></div>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>Proof of deposit only. No real money was transferred.</p>
        </section>
      )}

      <section className="card card-flush" aria-labelledby="hist">
        <div className="card-title" style={{ padding: '18px 20px 0' }}><h3 id="hist">Transactions</h3></div>
        {data.transactions.length === 0 ? (
          <Empty emoji="🧾" title="No transactions yet" text="Record a deposit to get started, then borrow something from Browse.">
            <Link to="/browse" className="btn">Browse items</Link>
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Receipt</th><th>Date</th><th>Type</th><th>Details</th><th>Amount</th><th>Balance</th></tr></thead>
              <tbody>
                {data.transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="small muted">{receiptNo(t.id)}</td>
                    <td>{fmtDate(t.created_at)}</td>
                    <td>{TYPE_LABEL[t.type] || t.type}</td>
                    <td className="small">{t.note || '-'}{t.resource_title ? <span className="muted"> · {t.resource_title}</span> : null}</td>
                    <td className={Number(t.amount) < 0 ? 'tx-out' : 'tx-in'}>{Number(t.amount) < 0 ? '-' : '+'}{money(Math.abs(t.amount))}</td>
                    <td>{money(t.balance_after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
