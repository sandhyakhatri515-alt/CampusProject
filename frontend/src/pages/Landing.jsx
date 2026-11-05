import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiRepeat } from 'react-icons/fi';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { iconFor } from '../utils/format';

const STEPS = [
  ['Sign up and get verified', 'Create an account with your college details. An admin verifies you.'],
  ['Add a deposit', 'Put money in your wallet. It is held when you borrow and refunded when you return the item.'],
  ['Find and request an item', 'Search for what you need, pick your dates and send a request to the owner.'],
  ['Collect, return and review', 'The owner hands it over. After you return it, rate each other.']
];

export default function Landing() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.get('/categories').then((r) => setCategories(r.data.categories)).catch(() => {});
  }, []);

  return (
    <div>
      <nav className="land-nav row" style={{ justifyContent: 'space-between' }} aria-label="Site">
        <Link to="/" className="brand" style={{ padding: 0 }}><span className="brand-mark"><FiRepeat size={22} /></span>CampusResourceShare</Link>
        <div className="row">
          {user ? (
            <Link to="/dashboard" className="btn">Go to dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline">Log in</Link>
              <Link to="/register" className="btn">Sign up</Link>
            </>
          )}
        </div>
      </nav>

      <header className="land-hero">
        <h1>Borrow and lend resources on campus</h1>
        <p>CampusResourceShare lets verified students share cameras, calculators, books and lab equipment with each other. Borrowers put down a refundable deposit, so owners can lend with confidence.</p>
        <div className="row wrap">
          {user ? (
            <Link to="/browse" className="btn btn-lg">Browse items</Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-lg">Log in</Link>
              <Link to="/register" className="btn btn-outline btn-lg">Create an account</Link>
            </>
          )}
        </div>
      </header>

      <section className="land-section" aria-labelledby="how">
        <h2 id="how">How it works</h2>
        <p className="sub">Four simple steps.</p>
        <div className="land-steps">
          {STEPS.map(([title, text], i) => (
            <div key={title} className="card land-step">
              <div className="no">{i + 1}</div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {categories.length > 0 && (
        <section className="land-section" aria-labelledby="cats">
          <h2 id="cats">What you can borrow</h2>
          <p className="sub">Log in to browse items in each category.</p>
          <div className="land-cats">
            {categories.map((c) => {
              const Icon = iconFor(c.icon);
              return (
                <Link key={c.slug} to={user ? `/browse?category=${c.slug}` : '/login'} className="land-cat">
                  <Icon /> {c.name}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {!user && (
        <section className="land-section">
          <div className="land-cta">
            <h2>Ready to start?</h2>
            <p>Log in if you already have an account, or sign up in a minute.</p>
            <div className="row wrap" style={{ justifyContent: 'center' }}>
              <Link to="/login" className="btn btn-lg">Log in</Link>
              <Link to="/register" className="btn btn-outline btn-lg">Sign up</Link>
            </div>
          </div>
        </section>
      )}

      <footer className="footer">© {new Date().getFullYear()} CampusResourceShare</footer>
    </div>
  );
}
