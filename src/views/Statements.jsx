import { useState, useEffect } from 'react';
import { getAllTransactions, deleteTransaction, getCustomers } from '../services/db';
import { format, parseISO, startOfDay, endOfDay, isBefore } from 'date-fns';
import { Download, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Statements() {
  const [transactions, setTransactions] = useState([]);
  const [reportData, setReportData] = useState({ prevBalance: 0, periodDebit: 0, periodCredit: 0 });
  const [startDate, setStartDate] = useState(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd')); // default to 1st of month
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCustomers = async () => {
      const allC = await getCustomers();
      setCustomers(allC);
    };
    fetchCustomers();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [startDate, endDate, selectedCustomer]);

  const loadTransactions = async () => {
    const all = await getAllTransactions();
    
    if (!startDate || !endDate) return;

    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));

    // Calculate Previous Balance (everything before start date)
    let pDebit = 0;
    let pCredit = 0;
    
    const periodTxs = [];
    let prDebit = 0;
    let prCredit = 0;

    all.forEach(tx => {
      const txDate = new Date(tx.date);
      const amt = Number(tx.amount);
      
      if (selectedCustomer && tx.storeName !== selectedCustomer) return;

      if (isBefore(txDate, start)) {
        if (tx.type === 'credit') pCredit += amt;
        else pDebit += amt;
      } else if (txDate >= start && txDate <= end) {
        periodTxs.push(tx);
        if (tx.type === 'credit') prCredit += amt;
        else prDebit += amt;
      }
    });

    setReportData({
      prevBalance: pDebit - pCredit,
      periodDebit: prDebit,
      periodCredit: prCredit
    });

    setTransactions(periodTxs.sort((a, b) => new Date(b.date) - new Date(a.date))); // newest first
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      await deleteTransaction(id);
      loadTransactions(); // refresh
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica");

    // Header
    doc.setFontSize(20);
    doc.setFontSize(20);
    doc.text(`Shop Ledger Statement${selectedCustomer ? ` for ${selectedCustomer}` : ''}`, 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Period: ${format(parseISO(startDate), 'dd MMM yyyy')} to ${format(parseISO(endDate), 'dd MMM yyyy')}`, 14, 30);
    doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy, h:mm a')}`, 14, 36);
    
    // Summary
    doc.setFontSize(12);
    doc.text(`Summary:`, 14, 46);
    doc.setFontSize(10);
    doc.text(`Previous Pending Balance: Rs ${reportData.prevBalance.toFixed(2)}`, 14, 52);
    doc.text(`Period Udhar Taken: Rs ${reportData.periodDebit.toFixed(2)}`, 14, 58);
    doc.text(`Period Payments Received: Rs ${reportData.periodCredit.toFixed(2)}`, 14, 64);
    
    const finalBalance = reportData.prevBalance + reportData.periodDebit - reportData.periodCredit;
    doc.text(`Total Final Pending: Rs ${finalBalance.toFixed(2)}`, 14, 70);

    // Sort ascending for chronological statement
    const chronological = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    const tableColumn = ["Date", "Customer", "Items", "Debit (Udhar)", "Credit (Payment)"];
    const tableRows = [];

    chronological.forEach(tx => {
      const txData = [
        format(new Date(tx.date), 'dd/MM/yyyy h:mm a'),
        tx.storeName,
        tx.itemName,
        tx.type === 'debit' ? `Rs ${tx.amount}` : '-',
        tx.type === 'credit' ? `Rs ${tx.amount}` : '-'
      ];
      tableRows.push(txData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 76,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`Statement_${selectedCustomer || 'Global'}_${format(parseISO(startDate), 'yyyyMMdd')}_to_${format(parseISO(endDate), 'yyyyMMdd')}.pdf`);
  };

  const finalBalance = reportData.prevBalance + reportData.periodDebit - reportData.periodCredit;

  return (
    <div className="statements-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}>
            <ArrowLeft size={24} color="var(--text-main)" />
          </button>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Statements</h2>
        </div>
        <button onClick={generatePDF} className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
          <Download size={18} />
          Export
        </button>
      </div>
      
      <div className="glass-card mb-4" style={{ padding: '1rem' }}>
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
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label>Customer (Optional)</label>
            <input 
              type="text"
              list="statement-customers"
              className="form-control" 
              placeholder="All Customers" 
              value={selectedCustomer} 
              onChange={(e) => setSelectedCustomer(e.target.value)} 
            />
            <datalist id="statement-customers">
              {customers.map(c => <option key={c.name} value={c.name} />)}
            </datalist>
          </div>
        </div>
      </div>



      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>Period Details ({transactions.length} entries)</h3>

      <div className="transaction-list" style={{ marginTop: 0 }}>
        {transactions.length === 0 ? (
          <p className="text-center text-muted mt-4">No records found for this period.</p>
        ) : (
          transactions.map(tx => (
            <div key={tx.id} className="transaction-item" style={{ display: 'flex', borderLeft: `4px solid ${tx.type === 'credit' ? 'var(--success)' : 'transparent'}` }}>
              <div className="tx-details" style={{ flex: 1 }}>
                <h4>{tx.storeName}</h4>
                <p>{tx.itemName} • {format(new Date(tx.date), 'dd MMM yyyy, h:mm a')}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="tx-amount" style={{ color: tx.type === 'credit' ? 'var(--success)' : 'var(--danger)' }}>
                  {tx.type === 'credit' ? '-' : ''}Rs {tx.amount}
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
