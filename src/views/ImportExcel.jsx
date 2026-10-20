import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { planSheetImport, applySheetImport } from '../services/db';

const CREDIT_WORDS = /\b(recei?ved?|recieved?|payment|paid|jama)\b/i;

const pad = (n) => String(n).padStart(2, '0');

// Accepts Excel serial dates, Date objects and day-first strings (20/10/2026, 20-10-26, 2026-10-20)
function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : null;
  }
  if (value instanceof Date && !isNaN(value)) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return valid(y, +m[2], +m[1]);
  }
  return null;
}

function valid(y, mo, d) {
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

const formatYmd = (ymd) => ymd.split('-').reverse().join('/');

// Reads the first sheet into { rows, errors }. Header row is optional;
// without one the columns are taken as Date | Name | Detail | Amount.
function parseWorkbook(data) {
  const wb = XLSX.read(data, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

  let cols = { date: 0, name: 1, detail: 2, amount: 3 };
  let start = 0;
  const first = (grid[0] || []).map(c => String(c).toLowerCase().trim());
  if (first.some(c => /date|name|detail|item|amount/.test(c))) {
    const find = (re, fallback) => { const i = first.findIndex(c => re.test(c)); return i >= 0 ? i : fallback; };
    cols = {
      date: find(/date/, 0),
      name: find(/name|customer/, 1),
      detail: find(/detail|item|description|particular/, 2),
      amount: find(/amount|amt|rs|price/, 3),
    };
    start = 1;
  }

  const rows = [];
  const errors = [];
  for (let i = start; i < grid.length; i++) {
    const r = grid[i];
    if (!r || r.every(c => String(c).trim() === '')) continue;
    const excelRow = i + 1;
    const ymd = parseDate(r[cols.date]);
    const name = String(r[cols.name] ?? '').trim().replace(/\s+/g, ' ');
    const detail = String(r[cols.detail] ?? '').trim().replace(/\s+/g, ' ');
    const rawAmount = typeof r[cols.amount] === 'number' ? r[cols.amount] : Number(String(r[cols.amount]).replace(/[^0-9.-]/g, ''));

    if (!ymd) { errors.push(`Row ${excelRow}: invalid date "${r[cols.date]}"`); continue; }
    if (!name) { errors.push(`Row ${excelRow}: customer name missing`); continue; }
    if (!rawAmount || isNaN(rawAmount)) { errors.push(`Row ${excelRow}: invalid amount "${r[cols.amount]}"`); continue; }

    const isCredit = rawAmount < 0 || CREDIT_WORDS.test(detail);
    rows.push({ rowIndex: i, ymd, name, detail, amount: Math.abs(rawAmount), type: isCredit ? 'credit' : 'debit' });
  }
  return { rows, errors };
}

export default function ImportExcel() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [plan, setPlan] = useState(null);
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setStatus('');
    setPlan(null);
    try {
      const { rows, errors } = parseWorkbook(await file.arrayBuffer());
      setErrors(errors);
      setPlan(await planSheetImport(rows));
    } catch {
      setErrors([]);
      setStatus('❌ Could not read this file. Please upload an Excel (.xlsx / .xls) or .csv file.');
    }
  };

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await applySheetImport(plan);
      setStatus(`✅ Imported ${plan.toAdd.length} entries${plan.newCustomers.length ? ` and added ${plan.newCustomers.length} new customers` : ''}.`);
      setPlan(null);
    } catch (err) {
      setStatus('❌ Import failed: ' + err.message);
    }
    setBusy(false);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Date', 'Name', 'Detail', 'Amount'],
      ['20/10/2026', 'Bhavesh kumar', 'Chips and chocolates', 50],
      ['20/10/2026', 'Vijay kumar', 'Sting', 90],
      ['21/10/2026', 'Bhavesh kumar', 'Received', 100],
    ]);
    ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Udhar');
    XLSX.writeFile(wb, 'daily-udhar-template.xlsx');
  };

  const totals = plan ? plan.toAdd.reduce((t, r) => { t[r.type] += r.amount; return t; }, { debit: 0, credit: 0 }) : null;

  return (
    <div className="settings-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}>
          <ArrowLeft size={24} color="var(--text-main)" />
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, flex: 1 }}>Upload Daily Excel</h2>
      </div>

      <div className="glass-card mb-4" style={{ border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.03)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--success)' }}>Sheet format</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Columns: <b>Date | Name | Detail | Amount</b> (date as DD/MM/YYYY). Write <b>Received</b> in Detail for a payment.
          New customer names are added automatically. You can upload the same sheet every day — entries already imported are skipped, only new rows are added.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => fileRef.current.click()} className="btn btn-primary" style={{ width: 'auto', padding: '0.65rem 1.25rem' }}>
            <Upload size={18} /> Choose Excel File
          </button>
          <button onClick={downloadTemplate} className="btn" style={{ width: 'auto', padding: '0.65rem 1.25rem', background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Download size={18} /> Download Template
          </button>
          <input type="file" accept=".xlsx,.xls,.csv" ref={fileRef} onChange={handleFile} style={{ display: 'none' }} />
        </div>
        {fileName && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileSpreadsheet size={16} /> {fileName}
          </p>
        )}
      </div>

      {status && (
        <div className="glass-card mb-4">
          <p style={{ fontWeight: 500, color: status.startsWith('✅') ? 'var(--success)' : 'var(--danger)' }}>{status}</p>
          {status.startsWith('✅') && (
            <button onClick={() => navigate('/customer-directory')} className="btn btn-primary mt-4" style={{ width: 'auto', padding: '0.6rem 1.2rem' }}>
              Open Customer Directory
            </button>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <div className="glass-card mb-4" style={{ border: '1px solid rgba(239,68,68,0.3)' }}>
          <p style={{ fontWeight: 600, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <AlertTriangle size={18} /> {errors.length} row(s) ignored
          </p>
          <ul style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: '1.25rem' }}>
            {errors.slice(0, 20).map(e => <li key={e}>{e}</li>)}
            {errors.length > 20 && <li>…and {errors.length - 20} more</li>}
          </ul>
        </div>
      )}

      {plan && (
        <div className="glass-card mb-4">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Preview</h3>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.9rem', marginBottom: '1rem' }}>
            <span><b>{plan.toAdd.length}</b> new entries</span>
            <span style={{ color: 'var(--text-muted)' }}><b>{plan.skipped}</b> already imported (skipped)</span>
            <span style={{ color: 'var(--danger)' }}>Udhar: <b>Rs {totals.debit.toLocaleString()}</b></span>
            <span style={{ color: 'var(--success)' }}>Received: <b>Rs {totals.credit.toLocaleString()}</b></span>
          </div>
          {plan.newCustomers.length > 0 && (
            <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              <b>New customers to add ({plan.newCustomers.length}):</b> {plan.newCustomers.join(', ')}
            </p>
          )}

          {plan.toAdd.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Nothing new in this sheet — everything is already in the ledger.</p>
          ) : (
            <>
              <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border, #e5e7eb)', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(79,70,229,0.06)', textAlign: 'left' }}>
                      <th style={{ padding: '0.6rem' }}>Date</th>
                      <th style={{ padding: '0.6rem' }}>Name</th>
                      <th style={{ padding: '0.6rem' }}>Detail</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.toAdd.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border, #e5e7eb)' }}>
                        <td style={{ padding: '0.5rem 0.6rem' }}>{formatYmd(r.ymd)}</td>
                        <td style={{ padding: '0.5rem 0.6rem' }}>{r.name}</td>
                        <td style={{ padding: '0.5rem 0.6rem' }}>{r.detail}</td>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 600, color: r.type === 'credit' ? 'var(--success)' : 'var(--danger)' }}>
                          {r.type === 'credit' ? '−' : '+'}Rs {r.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={handleConfirm} disabled={busy} className="btn btn-primary mt-4">
                <CheckCircle size={18} /> {busy ? 'Importing...' : `Import ${plan.toAdd.length} Entries`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
