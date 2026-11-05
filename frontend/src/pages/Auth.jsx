import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiMail, FiUser, FiRepeat, FiPhone, FiHash, FiBookOpen } from 'react-icons/fi';
import PasswordInput from '../components/PasswordInput';
import { DataList, useLookups } from '../context/LookupContext';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/client';

function Side({ title, text }) {
  return (
    <aside className="auth-side">
      <Link to="/" className="brand" style={{ color: '#fff', padding: 0, position: 'relative' }}>
        <span className="brand-mark" style={{ background: '#fff', color: 'var(--primary)', boxShadow: 'none' }}><FiRepeat size={22} /></span>CampusShare
      </Link>
      <div style={{ position: 'relative' }}>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <p style={{ position: 'relative', fontSize: '0.9rem' }}>Borrow what you need. Lend what you don't use.</p>
    </aside>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.full_name.split(' ')[0]}!`);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Login failed.'));
    } finally {
      setBusy(false);
    }
  };

  const fill = (email, password) => setForm({ email, password });

  return (
    <div className="auth">
      <Side title="Good to see you again!" text="Log in to check your requests, chat with owners and find what you need this week." />
      <main className="auth-main">
        <form className="auth-box stack" onSubmit={submit}>
          <div>
            <h1 style={{ fontSize: '2.2rem' }}>Log in</h1>
            <p className="muted">New here? <Link to="/register">Create an account</Link></p>
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <div className="input-icon"><FiMail />
              <input id="email" type="email" className="input" required autoComplete="email" placeholder="you@campus.edu" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <PasswordInput id="password" required autoComplete="current-password" placeholder="Your password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <button className="btn btn-lg btn-block" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
          <div className="demo">
            Try a demo account:{' '}
            <button type="button" onClick={() => fill('alice@campus.edu', 'alice123')}>Student</button> ·{' '}
            <button type="button" onClick={() => fill('admin@campus.edu', 'admin123')}>Admin</button>
          </div>
        </form>
      </main>
    </div>
  );
}

export function Register() {
  const { register } = useAuth();
  const { departments } = useLookups();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '', college_id: '', department: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register(form);
      toast.success('Welcome aboard! An admin will verify you soon.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Registration failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <Side title="Join your campus community" text="Create a free account, get verified by an admin, then borrow and lend with classmates you can trust." />
      <main className="auth-main">
        <form className="auth-box stack" onSubmit={submit}>
          <div>
            <h1 style={{ fontSize: '2.2rem' }}>Create account</h1>
            <p className="muted">Already a member? <Link to="/login">Log in</Link></p>
          </div>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <div className="input-icon"><FiUser /><input id="name" className="input" required value={form.full_name} onChange={set('full_name')} autoComplete="name" /></div>
          </div>
          <div className="field">
            <label htmlFor="remail">Email</label>
            <div className="input-icon"><FiMail /><input id="remail" type="email" className="input" required value={form.email} onChange={set('email')} autoComplete="email" /></div>
          </div>
          <div className="field">
            <label htmlFor="rpass">Password</label>
            <PasswordInput id="rpass" required minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" />
            <span className="hint">At least 8 characters.</span>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="cid">College ID</label>
              <div className="input-icon"><FiHash /><input id="cid" className="input" value={form.college_id} onChange={set('college_id')} /></div>
            </div>
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <div className="input-icon"><FiPhone /><input id="phone" className="input" type="tel" inputMode="numeric" required maxLength={10} pattern="\d{10}" title="Enter exactly 10 digits" placeholder="10-digit number"
                value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} autoComplete="tel" /></div>
            </div>
          </div>
          <div className="field">
            <label htmlFor="dept">Department</label>
            <div className="input-icon"><FiBookOpen /><input id="dept" className="input" list="department-options" value={form.department} onChange={set('department')} placeholder="Pick one or type yours" /></div>
            <DataList id="department-options" items={departments} />
          </div>
          <button className="btn btn-lg btn-block" disabled={busy}>{busy ? 'Creating...' : 'Create my account'}</button>
        </form>
      </main>
    </div>
  );
}
