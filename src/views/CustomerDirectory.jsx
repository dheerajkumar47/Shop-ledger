import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomers, updateCustomerInfo } from '../services/db';
import { ArrowLeft, Search, Pencil, Check, X } from 'lucide-react';

export default function CustomerDirectory() {
  const [customers, setCustomers] = useState([]);
  const [sort, setSort] = useState('az');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // { original, name, mobile, address }
  const navigate = useNavigate();

  const load = () => getCustomers().then(setCustomers);
  useEffect(() => { load(); }, []);

  const startEdit = (c, e) => {
    e.stopPropagation(); // don't open ledger
    setEditing({ original: c.name, name: c.name, mobile: c.mobile || '', address: c.address || '' });
  };

  const cancelEdit = (e) => { e && e.stopPropagation(); setEditing(null); };

  const saveEdit = async (e) => {
    e.stopPropagation();
    if (!editing.name.trim()) return;
    await updateCustomerInfo(editing.original, {
      name: editing.name.trim(),
      mobile: editing.mobile.trim(),
      address: editing.address.trim(),
    });
    setEditing(null);
    load();
  };

  const sorted = [...customers]
    .sort((a, b) => sort === 'az' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))
    .filter(c =>
      !search.trim() ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.mobile  && c.mobile.includes(search)) ||
      (c.address && c.address.toLowerCase().includes(search.toLowerCase()))
    );

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}>
          <ArrowLeft size={24} color="var(--text-main)" />
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Customer Directory</h2>
          <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-muted)' }}>{customers.length} customer{customers.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => navigate('/add-customer')} className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
          + Add Customer
        </button>
      </div>

      {/* Search + Sort bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input type="text" className="form-control" placeholder="Search by name, number or address..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.25rem', margin: 0 }} />
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {[['az', 'A → Z'], ['za', 'Z → A']].map(([key, label]) => (
            <button key={key} onClick={() => setSort(key)} style={{ padding: '0.4rem 0.9rem', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, background: sort === key ? 'var(--primary)' : 'rgba(0,0,0,0.06)', color: sort === key ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
        {/* Table Head */}
        <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1.5fr 56px', background: 'rgba(79,70,229,0.08)', borderBottom: '2px solid var(--border-color)', padding: '0.75rem 1.25rem', fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <span>#</span><span>Name</span><span>Phone Number</span><span>Address</span><span></span>
        </div>

        {sorted.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {search ? 'No customers match your search.' : 'No customers yet.'}
          </div>
        ) : (
          sorted.map((c, i) => {
            const isEditing = editing && editing.original === c.name;
            return (
              <div key={c.name} style={{ borderBottom: '1px solid var(--border-color)' }}>
                {isEditing ? (
                  /* ── Edit Row ── */
                  <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(79,70,229,0.03)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr auto', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Name"
                        value={editing.name}
                        onChange={e => setEditing({ ...editing, name: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        style={{ margin: 0 }}
                        autoFocus
                      />
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Phone number"
                        value={editing.mobile}
                        onChange={e => setEditing({ ...editing, mobile: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        style={{ margin: 0 }}
                      />
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Address"
                        value={editing.address}
                        onChange={e => setEditing({ ...editing, address: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        style={{ margin: 0 }}
                      />
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button onClick={saveEdit} style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.45rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: '0.82rem' }}>
                          <Check size={14} /> Save
                        </button>
                        <button onClick={cancelEdit} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 8, padding: '0.45rem 0.6rem', cursor: 'pointer' }}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── View Row ── */
                  <div
                    onClick={() => navigate(`/customer/${encodeURIComponent(c.name)}`)}
                    style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1.5fr 56px', padding: '0.9rem 1.25rem', cursor: 'pointer', alignItems: 'center', transition: 'background 0.15s' }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(79,70,229,0.04)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(79,70,229,0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{c.name}</span>
                    </div>
                    <span style={{ fontSize: '0.88rem', color: c.mobile ? 'var(--text-main)' : 'var(--text-muted)' }}>{c.mobile || '—'}</span>
                    <span style={{ fontSize: '0.85rem', color: c.address ? 'var(--text-main)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.address || '—'}</span>
                    <button
                      onClick={e => startEdit(c, e)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.3rem', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Edit customer"
                      onMouseOver={e => { e.currentTarget.style.background = 'rgba(79,70,229,0.1)'; e.currentTarget.style.color = 'var(--primary)'; }}
                      onMouseOut={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {sorted.length > 0 && (
        <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
          Showing {sorted.length} of {customers.length} customers — click any row to open ledger
        </p>
      )}
    </div>
  );
}
