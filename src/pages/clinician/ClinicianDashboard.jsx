import { useEffect, useMemo, useState } from "react";
import { Users, Activity, AlertTriangle, Pill } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ref, query, orderByChild, equalTo, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import "../../styles/dashboard.css";

function adherenceFor(patientId, logs, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const patientLogs = logs.filter(log => {
    if (log.patientId !== patientId || log.status === "upcoming") return false;
    return !days || new Date(log.scheduledDate) >= cutoff;
  });
  const taken = patientLogs.filter(log => log.status === "taken").length;
  return patientLogs.length ? Math.round((taken / patientLogs.length) * 100) : 0;
}

export default function ClinicianDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [patients, setPatients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [medications, setMedications] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    const patientsQuery = query(ref(db, "patients"), orderByChild("clinicianId"), equalTo(currentUser.uid));
    const unsubPatients = onValue(patientsQuery, (snapshot) => {
      const list = [];
      snapshot.forEach(child => list.push({ id: child.key, ...child.val() }));
      setPatients(list);
    });
    const unsubLogs = onValue(ref(db, "adherenceLogs"), (snapshot) => {
      const list = [];
      snapshot.forEach(child => list.push({ id: child.key, ...child.val() }));
      setLogs(list);
    });
    const unsubMeds = onValue(ref(db, "medications"), (snapshot) => {
      const list = [];
      snapshot.forEach(child => list.push({ id: child.key, ...child.val() }));
      setMedications(list.filter(med => med.clinicianId === currentUser.uid));
    });
    return () => {
      unsubPatients();
      unsubLogs();
      unsubMeds();
    };
  }, [currentUser]);

  const stats = useMemo(() => {
    const rates = patients.map(patient => adherenceFor(patient.id, logs, 0));
    const averageAdherence = rates.length ? Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length) : 0;
    const highRisk = patients.filter(patient => adherenceFor(patient.id, logs, 7) < 60).length;
    const recentMeds = medications
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);
    return { averageAdherence, highRisk, recentMeds };
  }, [patients, logs, medications]);

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Clinician Dashboard</h1>
          <p className="dash-sub">Practice overview and high-risk alerts</p>
        </div>
      </header>
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Users size={32} color="#2563eb" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Patients</h3>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{patients.length}</span>
        </div>
        <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Activity size={32} color="#10b981" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Avg Adherence</h3>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.averageAdherence}%</span>
        </div>
        <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <AlertTriangle size={32} color="#ef4444" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>High Risk Patients</h3>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.highRisk}</span>
        </div>
      </div>
      <div className="dash-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0 }}>Recent Medication Changes</h3>
          <button className="btn-primary" onClick={() => navigate("/clinician/patients/add")}>Add New Patient</button>
        </div>
        {stats.recentMeds.length === 0 ? (
          <p style={{ color: "var(--text-muted)", margin: 0 }}>No recent medication changes from your account.</p>
        ) : stats.recentMeds.map(med => (
          <div key={med.id} style={{ display: "flex", gap: "0.75rem", alignItems: "center", padding: "0.75rem 0", borderTop: "1px solid var(--border)" }}>
            <Pill size={18} color="#2563eb" />
            <div>
              <strong style={{ color: "var(--text-primary)" }}>{med.medicationName || med.name || "Medication"}</strong>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.85rem" }}>{med.dosage || "No dosage"} · {med.createdAt ? new Date(med.createdAt).toLocaleDateString() : "No date"}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
