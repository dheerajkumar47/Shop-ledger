import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Save } from 'lucide-react';
import { deleteDatabase } from '../services/db';

export default function Settings() {
  const navigate = useNavigate();
  const [currency, setCurrency] = useState('Rs');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const savedCurrency = localStorage.getItem('appCurrency');
    if (savedCurrency) {
      setCurrency(savedCurrency);
    }
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('appCurrency', currency);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleClearData = async () => {
    if (window.confirm('WARNING: Are you absolutely sure you want to delete ALL data? This will erase all customers, parties, and transactions permanently. This action cannot be undone.')) {
      if (window.confirm('FINAL WARNING: Type OK to proceed with complete data wipe.')) {
        await deleteDatabase();
        alert('All data has been cleared. The app will now reload.');
        window.location.reload();
      }
    }
  };

  return (
    <div className="settings-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}>
          <ArrowLeft size={24} color="var(--text-main)" />
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, flex: 1 }}>Settings</h2>
      </div>

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
