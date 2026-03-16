import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Save } from 'lucide-react';

export default function Profile({ onLogout, onProfileUpdate }) {
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState({
    shopName: 'Heer general store',
    ownerName: '',
    mobileNumber: '',
    address: ''
  });

  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const savedProfile = localStorage.getItem('shopProfile');
    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
    setIsSaved(false);
  };

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('shopProfile', JSON.stringify(profile));
    setIsSaved(true);
    
    // Notify App.jsx so header updates
    if (onProfileUpdate) {
      onProfileUpdate(profile.shopName);
    }
    
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to lock the application?')) {
      onLogout();
    }
  };

  return (
    <div className="profile-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}>
          <ArrowLeft size={24} color="var(--text-main)" />
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, flex: 1 }}>Shop Profile</h2>
        <button onClick={handleLogout} className="btn" style={{ width: 'auto', padding: '0.5rem 1rem', background: 'var(--danger)', color: 'white' }}>
          <LogOut size={18} />
          Lock App
        </button>
      </div>

      <div className="glass-card">
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label htmlFor="shopName">Shop / Business Name</label>
            <input 
              type="text" 
              id="shopName"
              name="shopName"
              className="form-control" 
              value={profile.shopName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="ownerName">Owner Name (Optional)</label>
            <input 
              type="text" 
              id="ownerName"
              name="ownerName"
              className="form-control" 
              value={profile.ownerName}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="mobileNumber">Contact Number (Optional)</label>
            <input 
              type="tel" 
              id="mobileNumber"
              name="mobileNumber"
              className="form-control" 
              value={profile.mobileNumber}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="address">Shop Address (Optional)</label>
            <textarea 
              id="address"
              name="address"
              className="form-control" 
              value={profile.address}
              onChange={handleChange}
              rows="3"
            />
          </div>

          <button type="submit" className="btn btn-primary mt-4">
            <Save size={18} />
            {isSaved ? 'Saved Successfully!' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
