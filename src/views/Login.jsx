import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login({ onLogin }) {
  const [pin, setPin] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedPin = localStorage.getItem('appPin');
    if (!savedPin) {
      setIsSettingPin(true);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    if (isSettingPin) {
      localStorage.setItem('appPin', pin);
      onLogin(); // Set auth state to true
    } else {
      const savedPin = localStorage.getItem('appPin');
      if (pin === savedPin) {
        onLogin();
      } else {
        setError('Incorrect PIN');
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1.5rem' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '2.5rem 1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--primary)' }}>
          {isSettingPin ? 'Welcome to Shop Ledger' : 'Login'}
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          {isSettingPin ? 'Please set a secure 4+ digit PIN to protect your customer data.' : 'Enter your PIN to access your ledger.'}
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input 
              type="password" 
              className="form-control" 
              placeholder="Enter PIN" 
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.2em' }}
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
            />
          </div>
          
          {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}
          
          <button type="submit" className="btn btn-primary mt-4" style={{ width: '100%' }}>
            {isSettingPin ? 'Set PIN & Continue' : 'Unlock Application'}
          </button>
        </form>
      </div>
    </div>
  );
}
