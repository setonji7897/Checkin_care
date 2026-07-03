import { useEffect, useMemo, useState } from "react";
import { ref, query, orderByChild, equalTo, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { Users, AlertTriangle, Activity, CalendarClock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { calculateAdherence } from "../../utils/backendData";
import "../../styles/dashboard.css";

export default function CaregiverDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [patients, setPatients] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    const patientsQuery = query(ref(db, "patients"), orderByChild("caregiverId"), equalTo(currentUser.uid));
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
    return () => {
      unsubPatients();
      unsubLogs();
    };
  }, [currentUser]);

  const stats = useMemo(() => {
    const patientIds = patients.map(p => p.id);
    const patientLogs = logs.filter(log => patientIds.includes(log.patientId));
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const todayStr = new Date().toISOString().split("T")[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const needingAttention = patients.filter(patient =>
      logs.some(log =>
        log.patientId === patient.id &&
        log.status === "missed" &&
        new Date(log.scheduledDate).getTime() >= dayAgo
      )
    ).length;

    const missedToday = patientLogs.filter(log => log.scheduledDate === todayStr && log.status === "missed").length;
    const weekLogs = patientLogs.filter(log => new Date(log.scheduledDate) >= weekAgo);
    const weeklyAdherence = calculateAdherence(weekLogs).rate;

    return { needingAttention, missedToday, weeklyAdherence };
  }, [patients, logs]);

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Caregiver Dashboard</h1>
          <p className="dash-sub">Overview of your assigned patients</p>
        </div>
      </header>
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Users size={32} color="#059669" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Assigned Patients</h3>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{patients.length}</span>
        </div>
        <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <AlertTriangle size={32} color="#ef4444" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Need Attention</h3>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.needingAttention}</span>
        </div>
        <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <CalendarClock size={32} color="#ef4444" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Missed Today</h3>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.missedToday}</span>
        </div>
        <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Activity size={32} color="#6c63ff" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Weekly Adherence</h3>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.weeklyAdherence}%</span>
        </div>
      </div>
      <div className="dash-card">
        <h3 style={{ margin: '0 0 1rem' }}>Patients Needing Attention</h3>
        {stats.needingAttention === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No assigned patients have missed doses in the last 24 hours.</p>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>{stats.needingAttention} patient(s) need follow-up.</p>
        )}
        <button className="btn-primary" onClick={() => navigate("/caregiver/patients")}>View Patients</button>
      </div>
    </>
  );
}
