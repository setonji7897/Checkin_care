// src/pages/clinician/PatientList.jsx
//
// PURPOSE: Real-time overview of patients assigned to the active clinician.

import { useState, useEffect } from "react";
import { ref, query, orderByChild, equalTo, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/config";
import "../../styles/dashboard.css";

export default function PatientList() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  

  useEffect(() => {
    if (!currentUser) return;

    // Filter patients by active clinician uid
    const patientsQuery = query(
      ref(db, "patients"),
      orderByChild("clinicianId"),
      equalTo(currentUser.uid)
    );

    const unsubscribe = onValue(
      patientsQuery,
      (snapshot) => {
        const dataList = [];
        if (snapshot.exists()) {
          const vals = snapshot.val();
          for (const key in vals) {
            dataList.push({ id: key, ...vals[key] });
          }
        }
        setPatients(dataList);
        setLoading(false);
      },
      (error) => {
        console.error("Firebase query failed in PatientList:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  return (
    <>
      

      
        <header className="dash-header">
          <div>
            <h1>My Patients</h1>
            <p className="dash-sub">Clinician: {currentUser?.email}</p>
          </div>
          <button 
            className="submit-btn" 
            style={{ padding: "0.6rem 1.2rem", fontSize: "0.9rem" }}
            onClick={() => navigate("/clinician/patients/add")}
          >
            ➕ Add Patient
          </button>
        </header>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <span style={{ fontSize: "1.2rem", color: "#6b7280" }}>Loading patients list...</span>
          </div>
        ) : patients.length === 0 ? (
          <div className="dash-card" style={{ textAlign: "center", padding: "3rem" }}>
            <span style={{ fontSize: "3rem" }}>👥</span>
            <h3 style={{ margin: "1rem 0 0.5rem 0" }}>No patients yet</h3>
            <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>Click "Add Patient" to set up your first clinical profile.</p>
          </div>
        ) : (
          <div className="coming-soon-grid">
            {patients.map(p => (
              <div 
                key={p.id} 
                className="dash-card placeholder-card" 
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/clinician/patients/${p.id}`)}
              >
                <span className="card-icon">👤</span>
                <h3>{p.fullName}</h3>
                <p><strong>DOB:</strong> {p.dateOfBirth}</p>
                <p><strong>Condition:</strong> {p.medicalCondition}</p>
                {p.email && <p style={{ fontSize: "0.8rem", color: "#6b7280" }}>{p.email}</p>}
                <span className="coming-soon-tag" style={{ background: "#eff6ff", color: "#2563eb" }}>View Details</span>
              </div>
            ))}
          </div>
        )}
      </>
  );
}
