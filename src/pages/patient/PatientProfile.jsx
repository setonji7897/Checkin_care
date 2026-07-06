// src/pages/patient/PatientProfile.jsx
import { useState, useEffect } from "react";
import { ref, get, update } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { User, Mail, Phone, Calendar, HeartPulse, AlertCircle, Save } from "lucide-react";
import "../../styles/dashboard.css";

export default function PatientProfile() {
  const { currentUser, userData } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patientId, setPatientId] = useState(null);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    age: "",
    gender: "",
    medicalConditions: "",
    emergencyContactName: "",
    emergencyContactPhone: ""
  });

  useEffect(() => {
    if (!currentUser) return;
    
    // Set initial auth user data
    setFormData(prev => ({
      ...prev,
      firstName: userData?.firstName || "",
      lastName: userData?.lastName || "",
      phone: userData?.phone || "",
    }));

    // Fetch patient-specific data
    const fetchPatientData = async () => {
      try {
        const { query, orderByChild, equalTo } = await import("firebase/database");
        const patientQuery = query(ref(db, "patients"), orderByChild("linkedUid"), equalTo(currentUser.uid));
        const snap = await get(patientQuery);
        
        if (snap.exists()) {
          const pId = Object.keys(snap.val())[0];
          const pData = snap.val()[pId];
          setPatientId(pId);
          
          setFormData(prev => ({
            ...prev,
            age: pData.age || "",
            gender: pData.gender || "",
            medicalConditions: pData.medicalConditions || "",
            emergencyContactName: pData.emergencyContact?.name || "",
            emergencyContactPhone: pData.emergencyContact?.phone || ""
          }));
        }
      } catch (err) {
        console.error("Error fetching patient data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, [currentUser, userData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // 1. Update general user profile
      const userRef = ref(db, `users/${currentUser.uid}`);
      await update(userRef, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone
      });

      const pId = patientId || currentUser.uid;
      const patientRef = ref(db, `patients/${pId}`);
      await update(patientRef, {
        linkedUid: currentUser.uid,
        age: formData.age,
        gender: formData.gender,
        medicalConditions: formData.medicalConditions,
        emergencyContact: {
          name: formData.emergencyContactName,
          phone: formData.emergencyContactPhone
        }
      });
      
      alert("Profile updated successfully!");
    } catch (err) {
      console.error("Error updating profile:", err);
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
          <p className="dash-sub">Manage your personal and medical information</p>
        </div>
      </header>

      <div className="dash-card">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* General Information */}
          <section>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
              <User size={18} color="#6c63ff" /> Personal Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>First Name</label>
                <input 
                  type="text" 
                  name="firstName" 
                  value={formData.firstName} 
                  onChange={handleInputChange} 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db' }} 
                  required 
                />
              </div>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>Last Name</label>
                <input 
                  type="text" 
                  name="lastName" 
                  value={formData.lastName} 
                  onChange={handleInputChange} 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db' }} 
                  required 
                />
              </div>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>Email (Read Only)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: '#f9fafb', color: 'var(--text-muted)' }}>
                  <Mail size={16} /> {currentUser.email}
                </div>
              </div>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>Phone</label>
                <input 
                  type="tel" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleInputChange} 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db' }} 
                />
              </div>
            </div>
          </section>

          {/* Medical Demographics */}
          <section>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
              <HeartPulse size={18} color="#6c63ff" /> Medical Demographics
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>Age</label>
                <input 
                  type="number" 
                  name="age" 
                  value={formData.age} 
                  onChange={handleInputChange} 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db' }} 
                />
              </div>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>Gender</label>
                <select 
                  name="gender" 
                  value={formData.gender} 
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white' }}
                >
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
              <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>Existing Medical Conditions</label>
                <textarea 
                  name="medicalConditions" 
                  value={formData.medicalConditions} 
                  onChange={handleInputChange} 
                  rows="3"
                  placeholder="e.g. Hypertension, Type 2 Diabetes"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', fontFamily: 'inherit' }} 
                />
              </div>
            </div>
          </section>

          {/* Emergency Contact */}
          <section>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
              <AlertCircle size={18} color="#ef4444" /> Emergency Contact
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>Contact Name</label>
                <input 
                  type="text" 
                  name="emergencyContactName" 
                  value={formData.emergencyContactName} 
                  onChange={handleInputChange} 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db' }} 
                />
              </div>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>Contact Phone</label>
                <input 
                  type="tel" 
                  name="emergencyContactPhone" 
                  value={formData.emergencyContactPhone} 
                  onChange={handleInputChange} 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db' }} 
                />
              </div>
            </div>
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0' }} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              type="submit" 
              disabled={saving}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                background: '#6c63ff', 
                color: 'white', 
                padding: '0.75rem 1.5rem', 
                borderRadius: '8px', 
                border: 'none', 
                fontWeight: 600, 
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1
              }}
            >
              <Save size={18} /> {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
