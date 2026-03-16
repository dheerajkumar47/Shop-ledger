import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Save, Download, Upload } from 'lucide-react';
import { deleteDatabase, exportAllData, importAllData } from '../services/db';

export default function Settings() {
  const navigate = useNavigate();
  const [currency, setCurrency] = useState('Rs');
  const [isSaved, setIsSaved] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    const savedCurrency = localStorage.getItem('appCurrency');
    if (savedCurrency) setCurrency(savedCurrency);
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('appCurrency', currency);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleClearData = async () => {
    if (window.confirm('WARNING: Are you absolutely sure you want to delete ALL data? This will erase all customers, parties, and transactions permanently. This action cannot be undone.')) {
      if (window.confirm('FINAL WARNING: Are you sure? This cannot be reversed.')) {
        await deleteDatabase();
        alert('All data has been cleared. The app will now reload.');
        window.location.reload();
      }
    }
  };

  /* ── EXPORT ─────────────────────────────────────── */
  const handleExport = async () => {
    try {
      const backup = await exportAllData();
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href     = url;
      a.download = `shop-ledger-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  };

  /* ── IMPORT ─────────────────────────────────────── */
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      alert('Please select a valid Shop Ledger backup (.json) file.');
      return;
    }
    if (!window.confirm('This will REPLACE all your current data with the backup. Are you sure?')) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        await importAllData(backup);
        setImportStatus('✅ Data restored successfully! Reloading...');
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        setImportStatus('❌ Import failed. Make sure the file is a valid backup.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="settings-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}>
          <ArrowLeft size={24} color="var(--text-main)" />
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, flex: 1 }}>Settings</h2>
      </div>

      {/* Backup & Restore */}
      <div className="glass-card mb-4" style={{ border: '1px solid rgba(79, 70, 229, 0.2)', background: 'rgba(79, 70, 229, 0.03)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--primary)' }}>
          Data Backup & Restore
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Export saves all customers, transactions, and gala entries to a file on your device. 
          Use Import to restore from that file if you switch devices or accidentally clear the browser.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Export */}
          <button
            onClick={handleExport}
            className="btn btn-primary"
            style={{ width: 'auto', padding: '0.65rem 1.25rem' }}
          >
            <Download size={18} />
            Export Backup (.json)
          </button>

          {/* Import */}
          <button
            onClick={() => fileInputRef.current.click()}
            className="btn"
            style={{ width: 'auto', padding: '0.65rem 1.25rem', background: 'rgba(79,70,229,0.1)', color: 'var(--primary)', border: '1px solid rgba(79,70,229,0.3)' }}
          >
            <Upload size={18} />
            Restore from Backup
          </button>
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleImport}
            style={{ display: 'none' }}
          />
        </div>

        {importStatus && (
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', fontWeight: 500, color: importStatus.startsWith('✅') ? 'var(--success)' : 'var(--danger)' }}>
            {importStatus}
          </p>
        )}
      </div>

      {/* Preferences */}
      <div className="glass-card mb-4">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Preferences</h3>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label htmlFor="currency">Currency Symbol</label>
            <select
              id="currency"
              className="form-control"
              value={currency}
              onChange={(e) => { setCurrency(e.target.value); setIsSaved(false); }}
            >
              <option value="Rs">Rs (Rupees)</option>
              <option value="₹">₹ (INR)</option>
              <option value="$">$ (USD)</option>
              <option value="€">€ (EUR)</option>
              <option value="£">£ (GBP)</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary mt-2">
            <Save size={18} />
            {isSaved ? 'Saved!' : 'Save Preferences'}
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="glass-card" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--danger)' }}>Danger Zone</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Permanently delete all application data including ledgers, customers, and parties.
        </p>
        <button onClick={handleClearData} className="btn" style={{ background: 'var(--danger)', color: 'white' }}>
          <Trash2 size={18} />
          Erase All Data
        </button>
      </div>
    </div>
  );
}
