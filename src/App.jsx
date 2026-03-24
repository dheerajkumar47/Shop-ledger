import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { UserCircle, Settings as SettingsIcon } from 'lucide-react';

// Placeholders for views
import Dashboard from './views/Dashboard';
import AddEntry from './views/AddEntry';
import Statements from './views/Statements';
import CustomerDetail from './views/CustomerDetail';
import AddCustomer from './views/AddCustomer';
import AddParty from './views/AddParty';
import Login from './views/Login';
import Profile from './views/Profile';
import Settings from './views/Settings';

const Header = ({ shopName }) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        window.history.back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="header" style={{ padding: '1rem 2rem' }}>
      <Link to="/" style={{ textDecoration: 'none' }}>
        <h1 style={{ cursor: 'pointer' }}>{shopName}</h1>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', color: 'var(--text-muted)' }}>
        <Link to="/profile" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', color: 'inherit', textDecoration: 'none' }}>
          <UserCircle size={24} />
          <span style={{ fontSize: '0.75rem' }}>Profile</span>
        </Link>
        <Link to="/settings" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', color: 'inherit', textDecoration: 'none' }}>
          <SettingsIcon size={24} />
          <span style={{ fontSize: '0.75rem' }}>Settings</span>
        </Link>
      </div>
    </header>
  );
};


function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [shopName, setShopName] = useState('Heer general store');

  useEffect(() => {
    // Check if profile exists to load name
    const savedProfile = localStorage.getItem('shopProfile');
    if (savedProfile) {
      setShopName(JSON.parse(savedProfile).shopName || 'Heer general store');
    }
  }, []);

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <Router>
      <div className="app-container">
        <Header shopName={shopName} />
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/add" element={<AddEntry />} />
            <Route path="/add-customer" element={<AddCustomer />} />
            <Route path="/add-party" element={<AddParty />} />
            <Route path="/statements" element={<Statements />} />
            <Route path="/customer/:name" element={<CustomerDetail />} />
            <Route path="/profile" element={<Profile onLogout={() => setIsAuthenticated(false)} onProfileUpdate={setShopName} />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
