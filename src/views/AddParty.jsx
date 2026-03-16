import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addParty } from '../services/db';
import { ArrowLeft } from 'lucide-react';

export default function AddParty() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [partyNumber, setPartyNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsSubmitting(true);
    await addParty({ 
      name: name.trim(), 
      address: address.trim(),
      partyNumber: partyNumber.trim()
    });
    setIsSubmitting(false);
    navigate('/');
  };

  return (
    <div className="add-entry-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}>
          <ArrowLeft size={24} color="var(--text-main)" />
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, flex: 1 }}>Add New Party</h2>
      </div>
      
      <div className="glass-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Party Name</label>
            <input 
              type="text" 
              id="name" 
              className="form-control" 
              placeholder="E.g. Imran Wholesalers"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="address">Address</label>
            <input 
              type="text" 
              id="address" 
              className="form-control" 
              placeholder="E.g. Main Market, Shop 42"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="partyNumber">Party Number / Mobile</label>
            <input 
              type="text" 
              id="partyNumber" 
              className="form-control" 
              placeholder="E.g. 0300-1234567"
              value={partyNumber}
              onChange={(e) => setPartyNumber(e.target.value)}
            />
          </div>
          
          <button type="submit" className="btn btn-primary mt-4" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Party'}
          </button>
        </form>
      </div>
    </div>
  );
}
