import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AdminIcon } from './AdminIcon';

const ROLES = ['President', 'Vice President', 'Secretary', 'Technical Lead', 'Design Lead', 'Marketing Lead', 'Member'];
const empty = { name: '', role: 'Member', branch: '', year: '', section: '', email: '', linkedin: '', photo: '' };

export function CoreTeamForm({ member, onClose }) {
  const [form, setForm] = useState(member || empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(member || empty);
  }, [member]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      set('photo', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (member) {
        await api.coreTeam.update(member.id, form);
      } else {
        await api.coreTeam.add(form);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Unable to save member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{member ? 'Edit Core Team Member' : 'Add Core Team Member'}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close"><AdminIcon name="X" size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="form">
          <div className="form-row">
            <label>Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div className="form-row">
            <label>Role</label>
            <select value={form.role} onChange={e => set('role', e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>Branch</label>
            <input value={form.branch} onChange={e => set('branch', e.target.value)} placeholder="e.g. CSE" />
          </div>
          <div className="form-row">
            <label>Year</label>
            <input value={form.year} onChange={e => set('year', e.target.value)} placeholder="e.g. 2nd Year" />
          </div>
          <div className="form-row">
            <label>Section</label>
            <input value={form.section} onChange={e => set('section', e.target.value)} placeholder="e.g. A" />
          </div>
          <div className="form-row">
            <label>Email</label>
            <input value={form.email} onChange={e => set('email', e.target.value)} type="email" />
          </div>
          <div className="form-row">
            <label>LinkedIn URL</label>
            <input value={form.linkedin} onChange={e => set('linkedin', e.target.value)} type="url" />
          </div>
          <div className="form-row">
            <label>Photo</label>
            <input type="file" accept="image/*" onChange={handleFileChange} />
            {form.photo && (
              <img src={form.photo} alt="Preview" style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', marginTop: 8 }} />
            )}
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : member ? 'Update Member' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
