import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getAllTransactions, getCustomers } from '../services/db';
import { format, isToday } from 'date-fns';
import { Users, Truck, Search, FileText, ArrowRight, ChevronRight } from 'lucide-react';

export default function Dashboard() {
  const [todayTransactions, setTodayTransactions] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const fetchInitialData = async () => {
      const allTx = await getAllTransactions();
      setAllTransactions(allTx);
      const todayTx = allTx.filter(tx => isToday(new Date(tx.date)));
      setTodayTransactions(todayTx.reverse());

      const allC = await getCustomers();
      setCustomers(allC);
    };
    fetchInitialData();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const exists = customers.find(c => c.name.toLowerCase() === searchQuery.trim().toLowerCase());
      if (exists) {
        navigate(`/customer/${encodeURIComponent(exists.name)}`);
      } else {
        alert("Customer not found. Please add them via 'Add New Customer' first.");
      }
    }
  };

  // Udhar stats
  const dailyUdhar = todayTransactions
    .filter(tx => tx.type === 'debit')
    .reduce((s, tx) => s + Number(tx.amount), 0);

  const totalDebit  = allTransactions.filter(tx => tx.type === 'debit').reduce((s, tx) => s + Number(tx.amount), 0);
  const totalCredit = allTransactions.filter(tx => tx.type === 'credit').reduce((s, tx) => s + Number(tx.amount), 0);
  const totalUdharPending = totalDebit - totalCredit;

  const actionCard = (to, icon, label, color) => (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div
        className="glass-card"
        style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', borderLeft: `3px solid ${color}` }}
        onMouseOver={e => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(79,70,229,0.12)'; }}
        onMouseOut={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = ''; }}
      >
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', flex: 1 }}>{label}</span>
        <ChevronRight size={18} color="var(--text-muted)" />
      </div>
    </Link>
  );

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>

      {/* ── LEFT SIDEBAR ─────────────────────────────────────── */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '1.5rem' }}>

        {/* Quick Search */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Search size={18} color="var(--primary)" />
            <h3 style={{ fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>Search Customer</h3>
          </div>
          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input
              type="text"
              list="customer-list"
              className="form-control"
              placeholder="Customer name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <datalist id="customer-list">
              {customers.map(c => <option key={c.name} value={c.name} />)}
            </datalist>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem' }}>Open Ledger →</button>
          </form>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0.25rem' }}>Quick Actions</p>
          {actionCard('/add-customer', <Users size={20} color="var(--primary)" />, 'Add New Customer', 'var(--primary)')}
          {actionCard('/add-party',    <Truck size={20} color="#8b5cf6" />,         'Add New Party',     '#8b5cf6')}
          {actionCard('/statements',   <FileText size={20} color="#0ea5e9" />,       'View Statements',   '#0ea5e9')}
        </div>

        {/* Registered Customers */}
        {customers.length > 0 && (
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Customers ({customers.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 240, overflowY: 'auto' }}>
              {customers.map(c => (
                <div
                  key={c.name}
                  onClick={() => navigate(`/customer/${encodeURIComponent(c.name)}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.25rem', cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(79,70,229,0.06)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(79,70,229,0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</p>
                    {c.mobile  && <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>📞 {c.mobile}</p>}
                    {c.address && <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>📍 {c.address}</p>}
                  </div>
                  <ArrowRight size={14} color="var(--text-muted)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Udhar Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem', borderTop: '3px solid var(--danger)' }}>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Today's Total Udhar Given</p>
            <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: 'var(--danger)' }}>Rs {dailyUdhar.toLocaleString()}</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{todayTransactions.filter(tx => tx.type === 'debit').length} entries today</p>
          </div>
          <div className="glass-card" style={{ padding: '1.25rem', borderTop: `3px solid ${totalUdharPending <= 0 ? 'var(--success)' : 'var(--primary)'}` }}>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total Udhar Pending (All Customers)</p>
            <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: totalUdharPending <= 0 ? 'var(--success)' : 'var(--primary)' }}>Rs {totalUdharPending.toLocaleString()}</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{customers.length} customers</p>
          </div>
        </div>

        {/* Today's Udhar Entries */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Today's Udhar Entries ({todayTransactions.length})</p>
            <Link to="/statements" style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>View All →</Link>
          </div>
          {todayTransactions.length === 0 ? (
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0 }}>No udhar entries yet today.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {todayTransactions.slice(0, 8).map(tx => (
                <div
                  key={tx.id}
                  className="glass-card"
                  onClick={() => navigate(`/customer/${encodeURIComponent(tx.storeName)}`)}
                  style={{ display: 'flex', alignItems: 'center', padding: '0.875rem 1.25rem', cursor: 'pointer', borderLeft: `4px solid ${tx.type === 'credit' ? 'var(--success)' : 'var(--danger)'}`, transition: 'transform 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.transform = 'translateX(3px)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'translateX(0)'}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.925rem' }}>{tx.storeName}</p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tx.itemName} · {format(new Date(tx.date), 'h:mm a')}</p>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: tx.type === 'credit' ? 'var(--success)' : 'var(--danger)' }}>
                    {tx.type === 'credit' ? '−' : '+'}Rs {tx.amount}
                  </span>
                </div>
              ))}
              {todayTransactions.length > 8 && (
                <Link to="/statements" style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--primary)', textDecoration: 'none', padding: '0.5rem' }}>
                  + {todayTransactions.length - 8} more entries
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Customer Directory */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Customer Directory ({customers.length})</p>
            <Link to="/add-customer" style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>+ Add New →</Link>
          </div>
          {customers.length === 0 ? (
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0 }}>No customers yet. Add your first customer.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {customers.map(c => (
                <div
                  key={c.name}
                  className="glass-card"
                  onClick={() => navigate(`/customer/${encodeURIComponent(c.name)}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1rem', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(79,70,229,0.12)'; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(79,70,229,0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</p>
                    {c.mobile  && <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>📞 {c.mobile}</p>}
                    {c.address && <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📍 {c.address}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
