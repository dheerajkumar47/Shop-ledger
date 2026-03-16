import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addCustomer } from '../services/db';
import { ArrowLeft } from 'lucide-react';

export default function AddCustomer() {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsSubmitting(true);
    await addCustomer({ name: name.trim(), mobile: mobile.trim() });
    setIsSubmitting(false);
    navigate('/');
  };

  return (
    <div className="add-entry-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}>
          <ArrowLeft size={24} color="var(--text-main)" />
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, flex: 1 }}>Add New Customer</h2>
      </div>
      
      <div className="glass-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Customer Name</label>
            <input 
              type="text" 
              id="name" 
              className="form-control" 
              placeholder="E.g. Ali"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="mobile">Mobile Number (Optional)</label>
            <input 
              type="text" 
              id="mobile" 
              className="form-control" 
              placeholder="E.g. 0300-1234567"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </div>
          
          <button type="submit" className="btn btn-primary mt-4" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Customer'}
          </button>
        </form>
      </div>
    </div>
  );
}
