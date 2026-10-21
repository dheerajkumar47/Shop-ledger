import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Download, Undo2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { planSheetImport, finalizePlan, applySheetImport, getImportBatches, undoImportBatch, deleteImportedEntry } from '../services/db';

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

const PREVIEW_LIMIT = 300;

// Shrinks a sheet's range to the cells actually used; Excel often reports
// a range down to row 1,048,576, which makes reading very slow
function trimRange(sheet) {
  if (!sheet['!ref']) return;
  const range = XLSX.utils.decode_range(sheet['!ref']);
  let maxR = range.s.r, maxC = range.s.c;
  for (const key in sheet) {
    if (key[0] === '!') continue;
    const { r, c } = XLSX.utils.decode_cell(key);
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  range.e.r = maxR;
  range.e.c = maxC;
  sheet['!ref'] = XLSX.utils.encode_range(range);
}

// The tab whose first row looks most like Date | Name | Detail | Amount
// (a workbook may also hold pivot or summary tabs); falls back to the first tab
function pickSheet(wb) {
  let best = wb.SheetNames[0], bestScore = 0;
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet['!ref']) continue;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const header = [];
    for (let c = range.s.c; c <= Math.min(range.e.c, range.s.c + 20); c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c })];
      if (cell) header.push(String(cell.v).toLowerCase());
    }
    const score = [/date/, /name|customer/, /amount|amt/, /detail|item|description|particular/].filter(re => header.some(h => re.test(h))).length;
    if (score > bestScore) { best = name; bestScore = score; }
  }
  return best;
}

// Reads the data tab into { rows, errors, sheetName }. Header row is optional;
// without one the columns are taken as Date | Name | Detail | Amount.
// A minus amount is a payment received, anything else is udhar.
function parseWorkbook(data) {
  const wb = XLSX.read(data, { type: 'array', cellText: false, cellHTML: false, cellNF: false, cellStyles: false });
  const sheetName = pickSheet(wb);
  const sheet = wb.Sheets[sheetName];
  trimRange(sheet);
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
    if (isNaN(rawAmount) || String(r[cols.amount]).trim() === '') { errors.push(`Row ${excelRow}: invalid amount "${r[cols.amount]}"`); continue; }
    if (rawAmount === 0) { errors.push(`Row ${excelRow}: amount is 0 (${name})`); continue; }

    rows.push({ rowIndex: i, ymd, name, detail, amount: Math.abs(rawAmount), type: rawAmount < 0 ? 'credit' : 'debit' });
  }
  return { rows, errors, sheetName };
}

export default function ImportExcel() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [plan, setPlan] = useState(null);
  const [includeCleared, setIncludeCleared] = useState(false);
  const [manualChoice, setManualChoice] = useState(null); // 'add' | 'skip' for rows matching hand-typed entries
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [sheetName, setSheetName] = useState('');
  const [batches, setBatches] = useState([]);
  const [openBatch, setOpenBatch] = useState(null);
  const [confirmUndo, setConfirmUndo] = useState(null);

  const loadBatches = () => getImportBatches().then(setBatches);
  useEffect(() => { loadBatches(); }, []);

  const handleUndo = async (batch) => {
    await undoImportBatch(batch.id);
    setConfirmUndo(null);
    setOpenBatch(null);
    setStatus(`↩️ Undone: removed ${batch.entries.length} entries from ${batch.fileName || 'that upload'}. Upload the sheet again any time to re-add them.`);
    loadBatches();
  };

  const handleDeleteEntry = async (tx) => {
    await deleteImportedEntry(tx);
    loadBatches();
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setStatus('');
    setPlan(null);
    setManualChoice(null);
    setIncludeCleared(false);
    setErrors([]);
    setSheetName('');
    setReading(true);
    try {
      const data = await file.arrayBuffer();
      await new Promise(r => setTimeout(r, 50)); // let "Reading..." paint before the parse blocks the page
      const { rows, errors, sheetName } = parseWorkbook(data);
      setSheetName(sheetName);
      setErrors(errors);
      setPlan(await planSheetImport(rows));
    } catch {
      setStatus('❌ Could not read this file. Please upload an Excel (.xlsx / .xls) or .csv file.');
    }
    setReading(false);
  };

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await applySheetImport(final, fileName);
      loadBatches();
      setStatus(`✅ Imported ${final.toAdd.length} entries${final.newCustomers.length ? ` and added ${final.newCustomers.length} new customers` : ''}.`);
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
      ['21/10/2026', 'Bhavesh kumar', 'Received', -100],
    ]);
    ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Udhar');
    XLSX.writeFile(wb, 'daily-udhar-template.xlsx');
  };

  const final = plan ? finalizePlan(plan, manualChoice === 'add', includeCleared) : null;
  const needsChoice = plan && plan.manualMatches.length > 0 && !manualChoice;
  const totals = final ? final.toAdd.reduce((t, r) => { t[r.type] += r.amount; return t; }, { debit: 0, credit: 0 }) : null;

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
          Columns: <b>Date | Name | Detail | Amount</b> (date as DD/MM/YYYY). For a payment received, put a minus amount (e.g. <b>-500</b>); every other amount is udhar.
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
            <FileSpreadsheet size={16} /> {fileName}{sheetName && <> · tab “{sheetName}”</>}
            {reading && <b style={{ color: 'var(--primary)' }}> · Reading file… large sheets take a few seconds</b>}
          </p>
        )}
      </div>

      {status && (
        <div className="glass-card mb-4">
          <p style={{ fontWeight: 500, color: status.startsWith('❌') ? 'var(--danger)' : 'var(--success)' }}>{status}</p>
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
            <span><b>{final.toAdd.length}</b> entries to add</span>
            <span style={{ color: 'var(--text-muted)' }}><b>{plan.skipped}</b> already added by an earlier upload</span>
            <span style={{ color: 'var(--danger)' }}>Udhar: <b>Rs {totals.debit.toLocaleString()}</b></span>
            <span style={{ color: 'var(--success)' }}>Received: <b>Rs {totals.credit.toLocaleString()}</b></span>
          </div>
          {final.newCustomers.length > 0 && (
            <p style={{ fontSize: '0.875rem', marginBottom: '1rem', maxHeight: 96, overflowY: 'auto' }}>
              <b>New customers to add ({final.newCustomers.length}):</b> {final.newCustomers.join(', ')}
            </p>
          )}

          {plan.clearedNames.length > 0 && (
            <div style={{ border: '1px solid rgba(100,116,139,0.3)', background: 'rgba(100,116,139,0.06)', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                {plan.clearedNames.length} cleared customer(s) with Rs 0 due {includeCleared ? 'will be added' : 'are not added'} ({plan.clearedRows.length.toLocaleString()} rows)
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                Their udhar is fully paid in the sheet. They are added automatically on a later upload if they take udhar again.
              </p>
              <p style={{ fontSize: '0.82rem', marginBottom: '0.75rem', maxHeight: 96, overflowY: 'auto' }}>{plan.clearedNames.join(', ')}</p>
              <button onClick={() => setIncludeCleared(!includeCleared)} className="btn" style={{ width: 'auto', padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}>
                {includeCleared ? 'Leave them out' : 'Add them anyway'}
              </button>
            </div>
          )}

          {plan.manualMatches.length > 0 && (
            <div style={{ border: '1px solid rgba(245,158,11,0.45)', background: 'rgba(245,158,11,0.07)', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <AlertTriangle size={17} color="#d97706" /> {plan.manualMatches.length} row(s) look the same as entries you typed into the app by hand
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Same date, name, item and amount. If you typed these from this sheet earlier, skip them so they are not counted twice. If the customer really bought it again, add them.
              </p>
              <div style={{ overflowX: 'auto', maxHeight: 220, overflowY: 'auto', marginBottom: '0.75rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <tbody>
                    {plan.manualMatches.slice(0, PREVIEW_LIMIT).map((r, i) => (
                      <tr key={i} style={{ borderTop: i ? '1px solid rgba(245,158,11,0.25)' : 'none' }}>
                        <td style={{ padding: '0.35rem 0.5rem', whiteSpace: 'nowrap' }}>{formatYmd(r.ymd)}</td>
                        <td style={{ padding: '0.35rem 0.5rem' }}>{r.name}</td>
                        <td style={{ padding: '0.35rem 0.5rem' }}>{r.detail}</td>
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>Rs {r.amount}</td>
                      </tr>
                    ))}
                    {plan.manualMatches.length > PREVIEW_LIMIT && (
                      <tr><td colSpan={4} style={{ padding: '0.5rem 0.6rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>…and {(plan.manualMatches.length - PREVIEW_LIMIT).toLocaleString()} more (showing first {PREVIEW_LIMIT})</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {[['skip', `Skip these ${plan.manualMatches.length} (already in the app)`], ['add', `Add these ${plan.manualMatches.length} too (new purchases)`]].map(([val, label]) => (
                  <button key={val} onClick={() => setManualChoice(val)} className="btn"
                    style={{ width: 'auto', padding: '0.5rem 0.9rem', fontSize: '0.85rem', border: `1px solid ${manualChoice === val ? 'var(--primary)' : 'rgba(0,0,0,0.12)'}`, background: manualChoice === val ? 'var(--primary)' : 'white', color: manualChoice === val ? 'white' : 'var(--text-main)' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {final.toAdd.length === 0 && plan.manualMatches.length === 0 && !(plan.clearedNames.length && includeCleared) ? (
            <p style={{ color: 'var(--text-muted)' }}>Nothing to add from this sheet — everything is already in the ledger or left out above.</p>
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
                    {final.toAdd.slice(0, PREVIEW_LIMIT).map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border, #e5e7eb)' }}>
                        <td style={{ padding: '0.5rem 0.6rem' }}>{formatYmd(r.ymd)}</td>
                        <td style={{ padding: '0.5rem 0.6rem' }}>{r.name}</td>
                        <td style={{ padding: '0.5rem 0.6rem' }}>{r.detail}</td>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 600, color: r.type === 'credit' ? 'var(--success)' : 'var(--danger)' }}>
                          {r.type === 'credit' ? '−' : '+'}Rs {r.amount}
                        </td>
                      </tr>
                    ))}
                    {final.toAdd.length > PREVIEW_LIMIT && (
                      <tr><td colSpan={4} style={{ padding: '0.5rem 0.6rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>…and {(final.toAdd.length - PREVIEW_LIMIT).toLocaleString()} more (showing first {PREVIEW_LIMIT})</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button onClick={handleConfirm} disabled={busy || needsChoice || (final.toAdd.length === 0 && final.links.length === 0)} className="btn btn-primary mt-4">
                <CheckCircle size={18} /> {busy ? 'Importing...' : needsChoice ? 'Choose skip or add above' : `Import ${final.toAdd.length} Entries`}
              </button>
            </>
          )}
        </div>
      )}

      {batches.length > 0 && (
        <div className="glass-card mb-4">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Recent Uploads</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Undo removes every entry added by that upload. Open an upload to delete single entries.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {batches.map(b => {
              const isOpen = openBatch === b.id;
              return (
                <div key={b.id} style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', overflowWrap: 'anywhere' }}>{b.fileName || 'Excel upload'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(b.id).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {' · '}{b.entries.length} entries
                        {' · '}<span style={{ color: 'var(--danger)' }}>Udhar Rs {b.debit.toLocaleString()}</span>
                        {b.credit > 0 && <>{' · '}<span style={{ color: 'var(--success)' }}>Received Rs {b.credit.toLocaleString()}</span></>}
                      </div>
                    </div>
                    <button onClick={() => setOpenBatch(isOpen ? null : b.id)} className="btn" style={{ width: 'auto', padding: '0.45rem 0.8rem', fontSize: '0.85rem' }}>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />} Entries
                    </button>
                    {confirmUndo === b.id ? (
                      <>
                        <button onClick={() => handleUndo(b)} className="btn" style={{ width: 'auto', padding: '0.45rem 0.8rem', fontSize: '0.85rem', background: 'var(--danger)', color: 'white' }}>
                          Yes, remove {b.entries.length}
                        </button>
                        <button onClick={() => setConfirmUndo(null)} className="btn" style={{ width: 'auto', padding: '0.45rem 0.8rem', fontSize: '0.85rem' }}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmUndo(b.id)} className="btn" style={{ width: 'auto', padding: '0.45rem 0.8rem', fontSize: '0.85rem', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}>
                        <Undo2 size={16} /> Undo Upload
                      </button>
                    )}
                  </div>
                  {isOpen && (
                    <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto', borderTop: '1px solid var(--border, #e5e7eb)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <tbody>
                          {b.entries.slice(0, PREVIEW_LIMIT).map(tx => (
                            <tr key={tx.id} style={{ borderTop: '1px solid var(--border, #e5e7eb)' }}>
                              <td style={{ padding: '0.45rem 1rem', whiteSpace: 'nowrap' }}>{new Date(tx.date).toLocaleDateString('en-GB')}</td>
                              <td style={{ padding: '0.45rem 0.6rem' }}>{tx.storeName}</td>
                              <td style={{ padding: '0.45rem 0.6rem' }}>{tx.itemName}</td>
                              <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: tx.type === 'credit' ? 'var(--success)' : 'var(--danger)' }}>
                                {tx.type === 'credit' ? '−' : '+'}Rs {tx.amount}
                              </td>
                              <td style={{ padding: '0.45rem 1rem 0.45rem 0.3rem', width: 32 }}>
                                <button onClick={() => handleDeleteEntry(tx)} title="Delete this entry" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                  <Trash2 size={15} color="var(--text-muted)" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {b.entries.length > PREVIEW_LIMIT && (
                            <tr><td colSpan={5} style={{ padding: '0.5rem 0.6rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>…and {(b.entries.length - PREVIEW_LIMIT).toLocaleString()} more (showing first {PREVIEW_LIMIT})</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
