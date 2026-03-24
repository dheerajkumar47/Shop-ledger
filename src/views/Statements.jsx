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
    doc.setFontSize(18);
    doc.text(`Shop Ledger Statement${selectedCustomer ? ` — ${selectedCustomer}` : ''}`, 14, 22);
    doc.setFontSize(10);
    doc.text(`Period: ${format(parseISO(startDate), 'dd MMM yyyy')} to ${format(parseISO(endDate), 'dd MMM yyyy')}`, 14, 30);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy')}`, 14, 36);

    // Group by customer
    const grouped = {};
    transactions.forEach(tx => {
      if (!grouped[tx.storeName]) grouped[tx.storeName] = { debit: 0, credit: 0 };
      if (tx.type === 'debit') grouped[tx.storeName].debit += Number(tx.amount);
      else grouped[tx.storeName].credit += Number(tx.amount);
    });

    const tableColumn = ['Customer', 'Total Udhar (Rs)', 'Total Paid (Rs)', 'Net Pending (Rs)'];
    const tableRows = Object.entries(grouped)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, d]) => [
        name,
        d.debit.toFixed(2),
        d.credit.toFixed(2),
        (d.debit - d.credit).toFixed(2)
      ]);

    // Totals row
    const grandDebit  = Object.values(grouped).reduce((s, d) => s + d.debit, 0);
    const grandCredit = Object.values(grouped).reduce((s, d) => s + d.credit, 0);
    tableRows.push(['TOTAL', grandDebit.toFixed(2), grandCredit.toFixed(2), (grandDebit - grandCredit).toFixed(2)]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 42,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [79, 70, 229] },
      foot: [],
      didParseCell: (data) => {
        // Bold the totals row
        if (data.row.index === tableRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    doc.save(`Statement_${selectedCustomer || 'All'}_${format(parseISO(startDate), 'yyyyMMdd')}.pdf`);
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



      {/* Group by customer */}
      {(() => {
        const grouped = {};
        transactions.forEach(tx => {
          const key = tx.storeName;
          if (!grouped[key]) grouped[key] = { debit: 0, credit: 0, entries: 0 };
          if (tx.type === 'debit') grouped[key].debit += Number(tx.amount);
          else grouped[key].credit += Number(tx.amount);
          grouped[key].entries += 1;
        });
        const rows = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));

        return (
          <>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>
              Period Details ({rows.length} customer{rows.length !== 1 ? 's' : ''})
            </h3>
            {rows.length === 0 ? (
              <p className="text-center text-muted mt-4">No records found for this period.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {rows.map(([customerName, data]) => {
                  const net = data.debit - data.credit;
                  return (
                    <div
                      key={customerName}
                      className="glass-card"
                      onClick={() => navigate(`/customer/${encodeURIComponent(customerName)}`)}
                      style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.25rem', cursor: 'pointer', borderLeft: `4px solid ${net > 0 ? 'var(--danger)' : 'var(--success)'}`, transition: 'transform 0.15s' }}
                      onMouseOver={e => e.currentTarget.style.transform = 'translateX(3px)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'translateX(0)'}
                    >
                      {/* Avatar */}
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(79,70,229,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', flexShrink: 0, marginRight: '1rem' }}>
                        {customerName.charAt(0).toUpperCase()}
                      </div>

                      {/* Name + stats */}
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>{customerName}</h4>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          <span>📦 Udhar: <strong style={{ color: 'var(--danger)' }}>Rs {data.debit.toLocaleString()}</strong></span>
                          <span>✅ Paid: <strong style={{ color: 'var(--success)' }}>Rs {data.credit.toLocaleString()}</strong></span>
                          <span style={{ color: 'var(--text-muted)' }}>{data.entries} entries</span>
                        </div>
                      </div>

                      {/* Net balance */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Net Pending</p>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: net > 0 ? 'var(--danger)' : 'var(--success)' }}>
                          Rs {Math.abs(net).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
