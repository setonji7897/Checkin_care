// src/pages/clinician/ClinicianProfile.jsx
import { useState, useEffect } from "react";
import { ref, get, update } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { User, Mail, Phone, Save, Stethoscope } from "lucide-react";
import "../../styles/dashboard.css";

export default function ClinicianProfile() {
  const { currentUser, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ firstName: "", lastName: "", phone: "", title: "", hospital: "" });
  const [clinicianId, setClinicianId] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    setFormData(prev => ({ ...prev, firstName: userData?.firstName || "", lastName: userData?.lastName || "", phone: userData?.phone || "" }));
    
    const fetchClinicianData = async () => {
      try {
        const { query, orderByChild, equalTo } = await import("firebase/database");
        const q = query(ref(db, "clinicians"), orderByChild("linkedUid"), equalTo(currentUser.uid));
        const snap = await get(q);
        if (snap.exists()) {
          const id = Object.keys(snap.val())[0];
          setClinicianId(id);
          setFormData(prev => ({ ...prev, title: snap.val()[id].title || "", hospital: snap.val()[id].hospital || "" }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchClinicianData();
  }, [currentUser, userData]);

  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await update(ref(db, `users/${currentUser.uid}`), { firstName: formData.firstName, lastName: formData.lastName, phone: formData.phone });
      const clinId = clinicianId || currentUser.uid;
      await update(ref(db, `clinicians/${clinId}`), { 
        linkedUid: currentUser.uid,
        title: formData.title, 
        hospital: formData.hospital 
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
          <p className="dash-sub">Manage your clinical identity and credentials</p>
        </div>
      </header>
      <div className="dash-card">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <section>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
              <User size={18} color="#2563eb" /> Personal Information
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
              <Stethoscope size={18} color="#2563eb" /> Professional Details
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>Professional Title</label>
                <input type="text" name="title" value={formData.title} onChange={handleInputChange} placeholder="e.g. Dr., MD, RN" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
              </div>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>Hospital / Clinic</label>
                <input type="text" name="hospital" value={formData.hospital} onChange={handleInputChange} placeholder="e.g. General Hospital" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
              </div>
            </div>
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#2563eb', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              <Save size={18} /> {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
