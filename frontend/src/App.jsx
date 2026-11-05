import { Navigate, Route, Routes, useLocation, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { Loader } from './components/ui';
import Landing from './pages/Landing';
import { Login, Register } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Browse from './pages/Browse';
import ResourceDetail from './pages/ResourceDetail';
import ResourceForm from './pages/ResourceForm';
import MyListings from './pages/MyListings';
import Requests from './pages/Requests';
import Saved from './pages/Saved';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Wallet from './pages/Wallet';
import Admin from './pages/admin/Admin';

function RequireAuth({ children, admin }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && !isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

function NotFound() {
  return (
    <div className="empty" style={{ minHeight: '70vh' }}>
      <div className="emoji">🧭</div>
      <h1>Page not found</h1>
      <p className="muted">That page wandered off campus.</p>
      <Link to="/" className="btn">Take me home</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/resources/new" element={<ResourceForm />} />
        <Route path="/resources/:id" element={<ResourceDetail />} />
        <Route path="/resources/:id/edit" element={<ResourceForm />} />
        <Route path="/my-listings" element={<MyListings />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:id" element={<Profile />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/admin/*" element={<RequireAuth admin><Admin /></RequireAuth>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
