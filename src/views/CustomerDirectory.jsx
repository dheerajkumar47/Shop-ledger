import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomers, getAllTransactions, removeClearedCustomers } from '../services/db';
import { ArrowLeft, Search, Pencil, Check, X, Download, UserMinus } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function CustomerDirectory() {
  const [customers, setCustomers] = useState([]);
  const [duemap, setDuemap] = useState({});   // { name: netPending }
  const [sort, setSort] = useState('az');
  const [search, setSearch] = useState('');
  const [dueFilter, setDueFilter] = useState('all'); // 'all' | 'due' (non-zero) | 'zero'
  const [editing, setEditing] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearMsg, setClearMsg] = useState('');
  const navigate = useNavigate();

  const load = async () => {
    const [custs, allTx] = await Promise.all([getCustomers(), getAllTransactions()]);
    setCustomers(custs);
    // Build due map
    const map = {};
    for (const tx of allTx) {
      if (!map[tx.storeName]) map[tx.storeName] = 0;
      map[tx.storeName] += tx.type === 'debit' ? Number(tx.amount) : -Number(tx.amount);
    }
    setDuemap(map);
  };

  useEffect(() => { load(); }, []);

  // Customers at exactly Rs 0 (fully paid, or a name with no entries)
  const cleared = customers.filter(c => Math.abs(duemap[c.name] || 0) < 0.005);

  const removeCleared = async () => {
    const n = await removeClearedCustomers();
    setConfirmClear(false);
    setClearMsg(`Removed ${n} cleared customer${n !== 1 ? 's' : ''}.`);
    load();
  };

  const startEdit = (c, e) => {
    e.stopPropagation();
    setEditing({ original: c.name, name: c.name, mobile: c.mobile || '', address: c.address || '' });
  };
  const cancelEdit = (e) => { e && e.stopPropagation(); setEditing(null); };
  const saveEdit = async (e) => {
    e.stopPropagation();
    if (!editing.name.trim()) return;
    const { updateCustomerInfo } = await import('../services/db');
    await updateCustomerInfo(editing.original, {
      name: editing.name.trim(), mobile: editing.mobile.trim(), address: editing.address.trim()
    });
    setEditing(null);
    load();
  };

  const sorted = [...customers]
    .sort((a, b) => sort === 'az' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))
    .filter(c => {
      const isZero = Math.abs(duemap[c.name] || 0) < 0.005;
      return dueFilter === 'all' || (dueFilter === 'due' ? !isZero : isZero);
    })
    .filter(c =>
      !search.trim() ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.mobile  && c.mobile.includes(search)) ||
      (c.address && c.address.toLowerCase().includes(search.toLowerCase()))
    );

  // ── PDF export ──────────────────────────────────────────────
  const generatePDF = () => {
    const doc = new jsPDF();
    const shopName = (() => { try { return JSON.parse(localStorage.getItem('shopProfile') || '{}').shopName || 'Shop Ledger'; } catch { return 'Shop Ledger'; } })();

    doc.setFont('helvetica');
    doc.setFontSize(18);
    doc.text(shopName, 14, 18);
    doc.setFontSize(12);
    doc.text('Customer Directory', 14, 26);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 33);
    doc.text(`Total customers: ${customers.length}`, 14, 39);

    const rows = [...customers]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c, i) => {
        const due = duemap[c.name] || 0;
        return [
          i + 1,
          c.name,
          c.mobile || '—',
          c.address || '—',
          due > 0 ? `Rs ${due.toFixed(2)}` : due < 0 ? `Overpaid Rs ${Math.abs(due).toFixed(2)}` : 'Clear',
        ];
      });

    const grandDue = customers.reduce((s, c) => s + Math.max(duemap[c.name] || 0, 0), 0);
    rows.push(['', 'TOTAL PENDING', '', '', `Rs ${grandDue.toFixed(2)}`]);

    autoTable(doc, {
      head: [['#', 'Customer Name', 'Phone', 'Address', 'Due Amount']],
      body: rows,
      startY: 45,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
      columnStyles: { 4: { fontStyle: 'bold' } },
      didParseCell: data => {
        if (data.row.index === rows.length - 1) data.cell.styles.fontStyle = 'bold';
      }
    });

    doc.save(`CustomerDirectory_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div style={{ maxWidth: 1060, margin: '0 auto', padding: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}>
          <ArrowLeft size={24} color="var(--text-main)" />
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Customer Directory</h2>
          <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-muted)' }}>{customers.length} customer{customers.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={generatePDF} className="btn" style={{ width: 'auto', padding: '0.5rem 1rem', background: 'rgba(79,70,229,0.1)', color: 'var(--primary)', border: '1px solid rgba(79,70,229,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Download size={16} /> PDF
        </button>
        <button onClick={() => navigate('/add-customer')} className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
          + Add Customer
        </button>
      </div>

      {cleared.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(100,116,139,0.07)', border: '1px solid rgba(100,116,139,0.25)' }}>
          <span style={{ flex: 1, minWidth: 220, fontSize: '0.88rem' }}>
            {confirmClear
              ? <>Delete <b>{cleared.length}</b> customer{cleared.length !== 1 ? 's' : ''} with Rs 0 due and their old (fully paid) entries? This cannot be undone.</>
              : <><b>{cleared.length}</b> customer{cleared.length !== 1 ? 's have' : ' has'} Rs 0 due (udhar fully cleared).</>}
          </span>
          {confirmClear ? (
            <>
              <button onClick={removeCleared} className="btn" style={{ width: 'auto', padding: '0.45rem 0.9rem', fontSize: '0.85rem', background: 'var(--danger)', color: '#fff' }}>Yes, remove {cleared.length}</button>
              <button onClick={() => setConfirmClear(false)} className="btn" style={{ width: 'auto', padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}>Cancel</button>
            </>
          ) : (
            <button onClick={() => { setConfirmClear(true); setClearMsg(''); }} className="btn" style={{ width: 'auto', padding: '0.45rem 0.9rem', fontSize: '0.85rem', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserMinus size={15} /> Remove cleared customers
            </button>
          )}
        </div>
      )}
      {clearMsg && <p style={{ marginBottom: '1rem', fontSize: '0.88rem', fontWeight: 500, color: 'var(--success)' }}>✅ {clearMsg}</p>}

      {/* Search + Sort bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input type="text" className="form-control" placeholder="Search by name, number or address..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.25rem', margin: 0 }} />
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {[['all', 'All'], ['due', 'Due only'], ['zero', 'Rs 0 only']].map(([key, label]) => (
            <button key={key} onClick={() => setDueFilter(key)} style={{ padding: '0.4rem 0.9rem', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, background: dueFilter === key ? 'var(--primary)' : 'rgba(0,0,0,0.06)', color: dueFilter === key ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
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
        {/* Head */}
        <div style={{ display: 'grid', gridTemplateColumns: '46px 1fr 140px 1.4fr 120px 52px', background: 'rgba(79,70,229,0.08)', borderBottom: '2px solid var(--border-color)', padding: '0.75rem 1.25rem', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <span>#</span><span>Name</span><span>Phone</span><span>Address</span><span>Due Amount</span><span></span>
        </div>

        {sorted.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {search || dueFilter !== 'all' ? 'No customers match your search or filter.' : 'No customers yet.'}
          </div>
        ) : (
          sorted.map((c, i) => {
            const due = duemap[c.name] || 0;
            const isEditing = editing && editing.original === c.name;
            return (
              <div key={c.name} style={{ borderBottom: '1px solid var(--border-color)' }}>
                {isEditing ? (
                  <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(79,70,229,0.03)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1.4fr auto', gap: '0.5rem', alignItems: 'center' }}>
                      <input type="text" className="form-control" placeholder="Name" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} onClick={e => e.stopPropagation()} style={{ margin: 0 }} autoFocus />
                      <input type="text" className="form-control" placeholder="Phone" value={editing.mobile} onChange={e => setEditing({ ...editing, mobile: e.target.value })} onClick={e => e.stopPropagation()} style={{ margin: 0 }} />
                      <input type="text" className="form-control" placeholder="Address" value={editing.address} onChange={e => setEditing({ ...editing, address: e.target.value })} onClick={e => e.stopPropagation()} style={{ margin: 0 }} />
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
                  <div
                    onClick={() => navigate(`/customer/${encodeURIComponent(c.name)}`)}
                    style={{ display: 'grid', gridTemplateColumns: '46px 1fr 140px 1.4fr 120px 52px', padding: '0.9rem 1.25rem', cursor: 'pointer', alignItems: 'center', transition: 'background 0.15s' }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(79,70,229,0.04)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(79,70,229,0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.name}</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', color: c.mobile ? 'var(--text-main)' : 'var(--text-muted)' }}>{c.mobile || '—'}</span>
                    <span style={{ fontSize: '0.82rem', color: c.address ? 'var(--text-main)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.address || '—'}</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: due > 0 ? 'var(--danger)' : due < 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                      {due > 0 ? `Rs ${due.toLocaleString()}` : due < 0 ? `+Rs ${Math.abs(due).toLocaleString()}` : 'Clear'}
                    </span>
                    <button onClick={e => startEdit(c, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.3rem', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Edit" onMouseOver={e => { e.currentTarget.style.background = 'rgba(79,70,229,0.1)'; e.currentTarget.style.color = 'var(--primary)'; }} onMouseOut={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                      <Pencil size={15} />
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
