import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addTransaction } from '../services/db';
import { ArrowLeft } from 'lucide-react';

export default function AddEntry() {
  const [storeName, setStoreName] = useState('');
  const [itemName, setItemName] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!storeName || !itemName || !amount) return;
    
    setIsSubmitting(true);
    
    try {
      await addTransaction({
        storeName,
        itemName,
        amount: Number(amount)
      });
      navigate('/');
    } catch (err) {
      console.error('Failed to add transaction', err);
      // fallback just in case
      alert('Error saving data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="add-entry-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}>
          <ArrowLeft size={24} color="var(--text-main)" />
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, flex: 1 }}>New Udhar Entry</h2>
      </div>
      
      <div className="glass-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="storeName">Customer / Store Name</label>
            <input 
              type="text" 
              id="storeName" 
              className="form-control" 
              placeholder="E.g. Ali general store"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="itemName">Item Taken</label>
            <input 
              type="text" 
              id="itemName" 
              className="form-control" 
              placeholder="E.g. 5x Sugar packets"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="amount">Amount (Rupees)</label>
            <input 
              type="number" 
              id="amount" 
              className="form-control" 
              placeholder="E.g. 150"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className="btn btn-primary mt-4" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Entry'}
          </button>
        </form>
      </div>
    </div>
  );
}
