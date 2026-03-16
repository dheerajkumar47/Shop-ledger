import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTransactionsByCustomer, addTransaction, deleteTransaction } from '../services/db';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { Download, Trash2, Plus, Minus, ArrowLeft } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function CustomerDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [allTransactions, setAllTransactions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [startDate, setStartDate] = useState(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [creditAmount, setCreditAmount] = useState('');
  const [debitAmount, setDebitAmount] = useState('');
  const [debitItem, setDebitItem] = useState('');
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, [name, startDate, endDate]);

  const loadTransactions = async () => {
    const all = await getTransactionsByCustomer(name);
    setAllTransactions(all);
    
    if (!startDate || !endDate) return;

    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));

    const filtered = all.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= start && txDate <= end;
    });

    const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
    setTransactions(sorted);
  };

  const handleAddCredit = async (e) => {
    e.preventDefault();
    if (!creditAmount || Number(creditAmount) <= 0) return;
    
    setIsSubmitting(true);
    await addTransaction({
      storeName: name,
      itemName: 'Payment Received',
      amount: creditAmount,
      type: 'credit',
      date: new Date(entryDate).toISOString()
    });
    setCreditAmount('');
    setIsSubmitting(false);
    loadTransactions();
  };

  const handleAddDebit = async (e) => {
    e.preventDefault();
    if (!debitAmount || Number(debitAmount) <= 0 || !debitItem) return;
    
    setIsSubmitting(true);
    await addTransaction({
      storeName: name,
      itemName: debitItem,
      amount: debitAmount,
      type: 'debit',
      date: new Date(entryDate).toISOString()
    });
    setDebitAmount('');
    setDebitItem('');
    setIsSubmitting(false);
    loadTransactions();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this entry?')) {
      await deleteTransaction(id);
      loadTransactions();
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica");

    // Header
    doc.setFontSize(20);
    doc.text(`Statement for: ${name}`, 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Period: ${format(parseISO(startDate), 'dd MMM yyyy')} to ${format(parseISO(endDate), 'dd MMM yyyy')}`, 14, 30);
    doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy, h:mm a')}`, 14, 36);
    doc.text(`Total Pending Udhar: Rs ${totalPending.toFixed(2)}`, 14, 42);

    // Sort ascending for chronological statement
    const chronological = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    const tableColumn = ["Date", "Details", "Debit (Udhar)", "Credit (Payment)"];
    const tableRows = [];

    chronological.forEach(tx => {
      const txData = [
        format(new Date(tx.date), 'dd/MM/yyyy h:mm a'),
        tx.itemName,
        tx.type === 'debit' ? `Rs ${tx.amount}` : '-',
        tx.type === 'credit' ? `Rs ${tx.amount}` : '-'
      ];
      tableRows.push(txData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`Statement_${name}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  // Calculations
  const totalDebit = allTransactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalCredit = allTransactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalPending = totalDebit - totalCredit;

  return (
    <div className="customer-detail-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}>
          <ArrowLeft size={24} color="var(--text-main)" />
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, flex: 1 }}>{name}</h2>
        <button onClick={generatePDF} className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
          <Download size={18} />
          PDF
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="stat-card" style={{ background: totalPending > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }}>
          <div className="stat-label">Pending Udhar Balance</div>
          <div className="stat-value" style={{ color: totalPending > 0 ? 'var(--danger)' : 'var(--success)', fontSize: '2rem' }}>
            Rs {totalPending.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="glass-card mb-4 mt-4" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Give Udhar (Add Item)</h3>
          <form onSubmit={handleAddDebit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Item Details..." 
              value={debitItem}
              onChange={(e) => setDebitItem(e.target.value)}
              style={{ flex: 2, minWidth: '150px' }}
              required
            />
            <input 
              type="number" 
              className="form-control" 
              placeholder="Amount..." 
              value={debitAmount}
              onChange={(e) => setDebitAmount(e.target.value)}
              style={{ flex: 1, minWidth: '100px' }}
              required
              min="1"
            />
            <input
              type="datetime-local"
              className="form-control"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              style={{ flex: 1, minWidth: '150px' }}
              required
            />
            <button type="submit" className="btn btn-primary" style={{ width: 'auto', background: 'var(--danger)' }} disabled={isSubmitting}>
              <Minus size={18} /> Give
            </button>
          </form>
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Receive Payment (Credit)</h3>
          <form onSubmit={handleAddCredit} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="number" 
              className="form-control" 
              placeholder="Amount..." 
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              style={{ flex: 1 }}
              required
              min="1"
            />
            <input
              type="datetime-local"
              className="form-control"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              style={{ flex: 1, minWidth: '150px' }}
              required
            />
            <button type="submit" className="btn btn-primary" style={{ width: 'auto', background: 'var(--success)' }} disabled={isSubmitting}>
              <Plus size={18} /> Recv
            </button>
          </form>
        </div>
      </div>

      <div className="glass-card mb-4 mt-4" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label>Start Date</label>
            <input 
              type="date" 
              className="form-control" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label>End Date</label>
            <input 
              type="date" 
              className="form-control" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
            />
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: '1.5rem' }}>Ledger Records ({transactions.length} entries for period)</h3>
      
      <div className="transaction-list">
        {transactions.length === 0 ? (
          <p className="text-center text-muted mt-4">No records found.</p>
        ) : (
          transactions.map(tx => (
            <div key={tx.id} className="transaction-item" style={{ borderLeft: `4px solid ${tx.type === 'credit' ? 'var(--success)' : 'var(--danger)'}`}}>
              <div className="tx-details" style={{ flex: 1 }}>
                <h4>{tx.itemName}</h4>
                <p>{format(new Date(tx.date), 'dd MMM yyyy, h:mm a')}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="tx-amount" style={{ color: tx.type === 'credit' ? 'var(--success)' : 'var(--danger)' }}>
                  {tx.type === 'credit' ? '-' : '+'}Rs {tx.amount}
                </div>
                <button onClick={() => handleDelete(tx.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
