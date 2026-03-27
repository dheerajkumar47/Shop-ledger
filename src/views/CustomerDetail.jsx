import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTransactionsByCustomer, addTransaction, deleteTransaction, updateTransaction, deleteCustomer, getCustomers, updateCustomerInfo } from '../services/db';
import { format, parseISO, startOfDay, endOfDay, isBefore } from 'date-fns';
import { Download, Trash2, Plus, Minus, ArrowLeft, Pencil, Check, X, UserX } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function CustomerDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [allTransactions, setAllTransactions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [startDate, setStartDate] = useState(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [creditAmount, setCreditAmount] = useState('');
  const [debitAmount, setDebitAmount] = useState('');
  const [debitItem, setDebitItem] = useState('');
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editAddress, setEditAddress] = useState('');

  useEffect(() => {
    loadTransactions();
    loadCustomerInfo();
  }, [name, startDate, endDate]);

  const loadCustomerInfo = async () => {
    const all = await getCustomers();
    const found = all.find(c => c.name === name);
    setCustomerInfo(found || null);
  };

  const loadTransactions = async () => {
    const all = await getTransactionsByCustomer(name);
    setAllTransactions(all);
    if (!startDate || !endDate) return;
    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));
    const filtered = all.filter(tx => {
      const d = new Date(tx.date);
      return d >= start && d <= end;
    });
    setTransactions([...filtered].sort((a, b) => new Date(b.date) - new Date(a.date)));
  };

  const handleAddCredit = async (e) => {
    e.preventDefault();
    if (!creditAmount || Number(creditAmount) <= 0) return;
    setIsSubmitting(true);
    await addTransaction({ storeName: name, itemName: 'Payment Received', amount: creditAmount, type: 'credit', date: new Date(entryDate).toISOString() });
    setCreditAmount('');
    setIsSubmitting(false);
    loadTransactions();
  };

  const handleAddDebit = async (e) => {
    e.preventDefault();
    if (!debitAmount || Number(debitAmount) <= 0 || !debitItem) return;
    setIsSubmitting(true);
    await addTransaction({ storeName: name, itemName: debitItem, amount: debitAmount, type: 'debit', date: new Date(entryDate).toISOString() });
    setDebitAmount(''); setDebitItem('');
    setIsSubmitting(false);
    loadTransactions();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this entry?')) {
      await deleteTransaction(id);
      loadTransactions();
    }
  };

  const handleDeleteCustomer = async () => {
    if (window.confirm(`Delete customer "${name}" and ALL their records? This cannot be undone.`)) {
      await deleteCustomer(name);
      navigate('/');
    }
  };

  const handleEditCustomer = () => {
    setEditName(customerInfo?.name || name);
    setEditMobile(customerInfo?.mobile || '');
    setEditAddress(customerInfo?.address || '');
    setEditingCustomer(true);
  };

  const handleCustomerSave = async () => {
    const newName = editName.trim();
    if (!newName) return;
    await updateCustomerInfo(name, { name: newName, mobile: editMobile.trim(), address: editAddress.trim() });
    setEditingCustomer(false);
    if (newName !== name) {
      navigate(`/customer/${encodeURIComponent(newName)}`, { replace: true });
    } else {
      loadCustomerInfo();
    }
  };

  const handleEditSave = async () => {
    if (!editingTx) return;
    await updateTransaction({ ...editingTx, amount: Number(editingTx.amount), date: new Date(editingTx.date).toISOString() });
    setEditingTx(null);
    loadTransactions();
  };

  // ── Calculations ────────────────────────────────────────────
  const periodStart = startDate ? startOfDay(parseISO(startDate)) : null;

  const prevDebit  = allTransactions.filter(t => t.type === 'debit'  && periodStart && isBefore(new Date(t.date), periodStart)).reduce((s, t) => s + Number(t.amount), 0);
  const prevCredit = allTransactions.filter(t => t.type === 'credit' && periodStart && isBefore(new Date(t.date), periodStart)).reduce((s, t) => s + Number(t.amount), 0);
  const prevBalance = prevDebit - prevCredit;

  const totalDebit   = allTransactions.filter(t => t.type === 'debit').reduce((s, t) => s + Number(t.amount), 0);
  const totalCredit  = allTransactions.filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0);
  const totalPending = totalDebit - totalCredit;

  // ── PDF (same format as Statements page) ───────────────────
  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFont('helvetica');

    const shopName = (() => { try { return JSON.parse(localStorage.getItem('shopProfile') || '{}').shopName || 'Shop Ledger'; } catch { return 'Shop Ledger'; } })();

    doc.setFontSize(18);
    doc.text(`${shopName}`, 14, 18);
    doc.setFontSize(12);
    doc.text(`Customer Statement — ${name}`, 14, 26);
    doc.setFontSize(10);
    doc.text(`Period: ${format(parseISO(startDate), 'dd MMM yyyy')} to ${format(parseISO(endDate), 'dd MMM yyyy')}`, 14, 33);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy')}`, 14, 39);
    if (customerInfo?.mobile)  doc.text(`Mobile: ${customerInfo.mobile}`, 14, 45);
    if (customerInfo?.address) doc.text(`Address: ${customerInfo.address}`, 14, 51);

    const startY = (customerInfo?.address ? 57 : customerInfo?.mobile ? 51 : 45) + 9;

    // Previous balance row + period entries
    const chronological = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    const tableRows = [];

    if (prevBalance !== 0) {
      tableRows.push([
        `Before ${format(parseISO(startDate), 'dd MMM yyyy')}`,
        'Previous Balance',
        prevBalance > 0 ? `Rs ${prevBalance.toFixed(2)}` : '-',
        prevBalance < 0 ? `Rs ${Math.abs(prevBalance).toFixed(2)}` : '-',
        `Rs ${prevBalance.toFixed(2)}`,
      ]);
    }

    let runningBalance = prevBalance;
    chronological.forEach(tx => {
      if (tx.type === 'debit')  runningBalance += Number(tx.amount);
      else                      runningBalance -= Number(tx.amount);
      tableRows.push([
        format(new Date(tx.date), 'dd MMM yyyy'),
        tx.itemName,
        tx.type === 'debit'  ? `Rs ${tx.amount}` : '-',
        tx.type === 'credit' ? `Rs ${tx.amount}` : '-',
        `Rs ${runningBalance.toFixed(2)}`,
      ]);
    });

    // Totals row
    const periodDebit  = chronological.filter(t => t.type === 'debit').reduce((s, t) => s + Number(t.amount), 0);
    const periodCredit = chronological.filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0);
    const finalNet = prevBalance + periodDebit - periodCredit;
    tableRows.push(['', 'NET PENDING', '', '', `Rs ${finalNet.toFixed(2)}`]);

    // Bold "Total Due" summary line above the table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const dueLabel = finalNet > 0
      ? `Total Due: Rs ${finalNet.toFixed(2)}`
      : finalNet < 0
        ? `Overpaid: Rs ${Math.abs(finalNet).toFixed(2)}`
        : 'Total Due: Clear (Rs 0.00)';
    doc.text(dueLabel, 14, startY - 4);
    doc.setFont('helvetica', 'normal');

    autoTable(doc, {
      head: [['Date', 'Details', 'Debit (Udhar)', 'Credit (Payment)', 'Balance']],
      body: tableRows,
      startY,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
      columnStyles: { 4: { fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.row.index === tableRows.length - 1) data.cell.styles.fontStyle = 'bold';
      }
    });

    doc.save(`Statement_${name}_${format(parseISO(startDate), 'yyyyMMdd')}.pdf`);
  };

  return (
    <div className="customer-detail-container">

      {/* Header */}
      {editingCustomer ? (
        // ── Edit Customer Mode ──
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Edit Customer Info</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input type="text" className="form-control" placeholder="Customer Name" value={editName} onChange={e => setEditName(e.target.value)} />
            <input type="text" className="form-control" placeholder="Mobile Number (Optional)" value={editMobile} onChange={e => setEditMobile(e.target.value)} />
            <input type="text" className="form-control" placeholder="Address (Optional)" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button onClick={handleCustomerSave} className="btn btn-primary" style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={16} /> Save Changes
              </button>
              <button onClick={() => setEditingCustomer(false)} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <X size={16} /> Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        // ── View Mode ──
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}>
            <ArrowLeft size={24} color="var(--text-main)" />
          </button>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>{name}</h2>
            {customerInfo?.mobile  && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>📞 {customerInfo.mobile}</p>}
            {customerInfo?.address && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>📍 {customerInfo.address}</p>}
          </div>
          <button onClick={handleEditCustomer} className="btn" style={{ width: 'auto', padding: '0.5rem 1rem', background: 'rgba(79,70,229,0.1)', color: 'var(--primary)', border: '1px solid rgba(79,70,229,0.3)' }} title="Edit Customer">
            <Pencil size={16} />
          </button>
          <button onClick={generatePDF} className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
            <Download size={18} /> PDF
          </button>
          <button onClick={handleDeleteCustomer} className="btn" style={{ width: 'auto', padding: '0.5rem 1rem', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }} title="Delete Customer">
            <UserX size={18} />
          </button>
        </div>
      )}

      {/* Balance card */}
      <div className="stats-grid" style={{ gridTemplateColumns: '1fr', marginBottom: '1rem' }}>
        <div className="stat-card" style={{ background: totalPending > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)' }}>
          <div className="stat-label">Total Pending Udhar (All Time)</div>
          <div className="stat-value" style={{ color: totalPending > 0 ? 'var(--danger)' : 'var(--success)', fontSize: '2rem' }}>
            Rs {totalPending.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Entry forms */}
      <div className="glass-card mb-4" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Debit */}
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Give Udhar (Add Item)</h3>
          <form onSubmit={handleAddDebit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input type="number" className="form-control" placeholder="Amount (Rs)" value={debitAmount} onChange={e => setDebitAmount(e.target.value)} style={{ flex: 1, minWidth: '100px' }} required min="1" />
            <input type="text" className="form-control" placeholder="Item Details..." value={debitItem} onChange={e => setDebitItem(e.target.value)} style={{ flex: 2, minWidth: '150px' }} required />
            <input type="date" className="form-control" value={entryDate} onChange={e => setEntryDate(e.target.value)} style={{ flex: 1, minWidth: '130px' }} required />
            <button type="submit" className="btn btn-primary" style={{ width: 'auto', background: 'var(--danger)' }} disabled={isSubmitting}><Minus size={18} /> Give</button>
          </form>
        </div>

        {/* Credit */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Receive Payment (Credit)</h3>
          <form onSubmit={handleAddCredit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input type="number" className="form-control" placeholder="Amount (Rs)" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} style={{ flex: 1, minWidth: '100px' }} required min="1" />
            <input type="date" className="form-control" value={entryDate} onChange={e => setEntryDate(e.target.value)} style={{ flex: 1, minWidth: '130px' }} required />
            <button type="submit" className="btn btn-primary" style={{ width: 'auto', background: 'var(--success)' }} disabled={isSubmitting}><Plus size={18} /> Recv</button>
          </form>
        </div>
      </div>

      {/* Date filter */}
      <div className="glass-card mb-4" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label>Start Date</label>
            <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label>End Date</label>
            <input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: '1.5rem' }}>Ledger Records ({transactions.length} entries)</h3>

      <div className="transaction-list">
        {/* Previous Balance Row */}
        {prevBalance !== 0 && (
          <div className="transaction-item" style={{ borderLeft: `4px solid ${prevBalance > 0 ? 'var(--danger)' : 'var(--success)'}`, background: 'rgba(79,70,229,0.04)' }}>
            <div className="tx-details" style={{ flex: 1 }}>
              <h4 style={{ color: 'var(--primary)' }}>Previous Balance</h4>
              <p>Before {format(parseISO(startDate), 'dd MMM yyyy')}</p>
            </div>
            <div className="tx-amount" style={{ color: prevBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {prevBalance > 0 ? '+' : '-'}Rs {Math.abs(prevBalance).toFixed(2)}
            </div>
          </div>
        )}

        {transactions.length === 0 ? (
          <p className="text-center text-muted mt-4">No records for this period.</p>
        ) : (
          transactions.map(tx => (
            <div key={tx.id} className="transaction-item" style={{ borderLeft: `4px solid ${tx.type === 'credit' ? 'var(--success)' : 'var(--danger)'}`, flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
              {editingTx && editingTx.id === tx.id ? (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type="number" className="form-control" value={editingTx.amount} onChange={e => setEditingTx({ ...editingTx, amount: e.target.value })} style={{ flex: 1, minWidth: 90 }} min="1" />
                  <input type="text" className="form-control" value={editingTx.itemName} onChange={e => setEditingTx({ ...editingTx, itemName: e.target.value })} style={{ flex: 2, minWidth: 120 }} placeholder="Item name" />
                  <input type="date" className="form-control" value={format(new Date(editingTx.date), 'yyyy-MM-dd')} onChange={e => setEditingTx({ ...editingTx, date: e.target.value })} style={{ flex: 1, minWidth: 130 }} />
                  <button onClick={handleEditSave} style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.4rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Check size={16} /> Save</button>
                  <button onClick={() => setEditingTx(null)} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 8, padding: '0.4rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><X size={16} /> Cancel</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div className="tx-details" style={{ flex: 1 }}>
                    <h4>{tx.itemName}</h4>
                    <p>{format(new Date(tx.date), 'dd MMM yyyy')}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="tx-amount" style={{ color: tx.type === 'credit' ? 'var(--success)' : 'var(--danger)' }}>
                      {tx.type === 'credit' ? '-' : '+'}Rs {tx.amount}
                    </div>
                    <button onClick={() => setEditingTx({ ...tx })} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }} title="Edit"><Pencil size={16} /></button>
                    <button onClick={() => handleDelete(tx.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }} title="Delete"><Trash2 size={16} /></button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
