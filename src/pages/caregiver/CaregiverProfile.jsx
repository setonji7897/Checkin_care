// src/pages/caregiver/CaregiverProfile.jsx
import { useState, useEffect } from "react";
import { ref, update } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { User, Mail, Phone, Save, ShieldAlert } from "lucide-react";
import "../../styles/dashboard.css";

export default function CaregiverProfile() {
  const { currentUser, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ firstName: "", lastName: "", phone: "", relationship: "" });

  useEffect(() => {
    if (!currentUser || !userData) return;
    setFormData({
      firstName:    userData.firstName    || "",
      lastName:     userData.lastName     || "",
      phone:        userData.phone        || "",
      relationship: userData.relationship || "",
    });
    setLoading(false);
  }, [currentUser, userData]);

  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await update(ref(db, `users/${currentUser.uid}`), {
        firstName:    formData.firstName,
        lastName:     formData.lastName,
        phone:        formData.phone,
        relationship: formData.relationship,
      });
      alert("Profile updated successfully!");
    } catch (err) {
      alert("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-state">Loading profile...</div>;

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>My Profile</h1>
          <p className="dash-sub">Manage your caregiver identity</p>
        </div>
      </header>
      <div className="dash-card">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <section>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
              <User size={18} color="#059669" /> Personal Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>First Name</label>
                <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db' }} required />
              </div>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>Last Name</label>
                <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db' }} required />
              </div>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>Email (Read Only)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: '#f9fafb', color: 'var(--text-muted)' }}><Mail size={16} /> {currentUser.email}</div>
              </div>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>Phone</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
              </div>
            </div>
          </section>

          <section>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
              <ShieldAlert size={18} color="#059669" /> Caregiver Details
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>Primary Relationship to Patient(s)</label>
                <input type="text" name="relationship" value={formData.relationship} onChange={handleInputChange} placeholder="e.g. Son, Daughter, Nurse" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
              </div>
            </div>
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#059669', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              <Save size={18} /> {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
