import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { UserCircle, Settings as SettingsIcon, Search, X, Menu } from 'lucide-react';
import { getCustomers } from './services/db';

import Dashboard from './views/Dashboard';
import AddEntry from './views/AddEntry';
import Statements from './views/Statements';
import CustomerDetail from './views/CustomerDetail';
import AddCustomer from './views/AddCustomer';
import AddParty from './views/AddParty';
import Login from './views/Login';
import Profile from './views/Profile';
import Settings from './views/Settings';
import CustomerDirectory from './views/CustomerDirectory';

/* ─── Global Header ─────────────────────────────────────────── */
function Header({ shopName, customers }) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  // Alt+Left → back
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); window.history.back(); }
      if (e.key === 'Escape') { setSearchOpen(false); setQuery(''); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (searchOpen && inputRef.current) inputRef.current.focus();
  }, [searchOpen]);

  const handleSearch = (e) => {
    e.preventDefault();
    const found = customers.find(c => c.name.toLowerCase() === query.trim().toLowerCase());
    if (found) {
      navigate(`/customer/${encodeURIComponent(found.name)}`);
      setSearchOpen(false); setQuery('');
    } else if (query.trim()) {
      alert('Customer not found.');
    }
  };

  const filtered = query.trim()
    ? customers.filter(c => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];

  return (
    <header className="header" style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', zIndex: 100 }}>
      <Link to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
        <h1 style={{ cursor: 'pointer', fontSize: '1.1rem', margin: 0 }}>{shopName}</h1>
      </Link>

      {/* Search — expands in the middle */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        {searchOpen ? (
          <div style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  ref={inputRef}
                  type="text"
                  list="global-clist"
                  className="form-control"
                  placeholder="Type customer name..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  style={{ paddingLeft: '2rem', margin: 0, height: 38 }}
                />
                <datalist id="global-clist">
                  {customers.map(c => <option key={c.name} value={c.name} />)}
                </datalist>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0.4rem 0.85rem', height: 38 }}>Go</button>
              <button type="button" onClick={() => { setSearchOpen(false); setQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}>
                <X size={18} />
              </button>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border-color)', borderRadius: 24, padding: '0.4rem 1rem', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem' }}
          >
            <Search size={15} /> Search customer...
          </button>
        )}
      </div>

      {/* Right icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', color: 'var(--text-muted)', flexShrink: 0 }}>
        <Link to="/profile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', color: 'inherit', textDecoration: 'none' }}>
          <UserCircle size={22} />
          <span style={{ fontSize: '0.7rem' }}>Profile</span>
        </Link>
        <Link to="/settings" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', color: 'inherit', textDecoration: 'none' }}>
          <SettingsIcon size={22} />
          <span style={{ fontSize: '0.7rem' }}>Settings</span>
        </Link>
      </div>
    </header>
  );
}

/* ─── App ───────────────────────────────────────────────────── */
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [shopName, setShopName] = useState('Heer general store');
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('shopProfile');
    if (saved) setShopName(JSON.parse(saved).shopName || 'Heer general store');
    // Load customers for global search
    import('./services/db').then(({ getCustomers }) => getCustomers().then(setCustomers));
  }, []);

  if (!isAuthenticated) return <Login onLogin={() => setIsAuthenticated(true)} />;

  return (
    <Router>
      <div className="app-container">
        <Header shopName={shopName} customers={customers} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/add" element={<AddEntry />} />
            <Route path="/add-customer" element={<AddCustomer />} />
            <Route path="/add-party" element={<AddParty />} />
            <Route path="/statements" element={<Statements />} />
            <Route path="/customer/:name" element={<CustomerDetail />} />
            <Route path="/customer-directory" element={<CustomerDirectory />} />
            <Route path="/profile" element={<Profile onLogout={() => setIsAuthenticated(false)} onProfileUpdate={setShopName} />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
