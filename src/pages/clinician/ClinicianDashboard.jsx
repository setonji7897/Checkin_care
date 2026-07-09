// src/pages/clinician/ClinicianDashboard.jsx
//
// PURPOSE: Real-time clinician overview with triaged alert warnings and medication updates.

import { useEffect, useMemo, useState } from "react";
import { Users, Activity, AlertTriangle, Pill } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ref, query, orderByChild, equalTo, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { calculatePatientRisk, evaluatePatientAlerts, getPatientName } from "../../utils/backendData";
import "../../styles/dashboard.css";

export default function ClinicianDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [patients, setPatients] = useState([]);
  const [rawLogsMap, setRawLogsMap] = useState({});
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);

    const patientsQuery = query(ref(db, "patients"), orderByChild("clinicianId"), equalTo(currentUser.uid));
    const unsubPatients = onValue(patientsQuery, (snapshot) => {
      const list = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => list.push({ id: child.key, ...child.val() }));
      }
      setPatients(list);
      setLoading(false);
    }, (err) => {
      console.error("Dashboard error loading patients:", err);
      setLoading(false);
    });

    const unsubMeds = onValue(ref(db, "medications"), (snapshot) => {
      const list = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          const med = child.val();
          if (med.prescribedBy === currentUser.uid || med.clinicianId === currentUser.uid) {
            list.push({ id: child.key, ...med });
          }
        });
      }
      setMedications(list);
    });

    return () => {
      unsubPatients();
      unsubMeds();
    };
  }, [currentUser]);

  // Subscribe to logs per patient dynamically to comply with rules and retrieve full records
  useEffect(() => {
    if (patients.length === 0) return;

    const unsubs = [];
    patients.forEach(patient => {
      // 1. Logs by patient record key
      const keyQuery = query(ref(db, "adherenceLogs"), orderByChild("patientId"), equalTo(patient.id));
      const unsubKey = onValue(keyQuery, snap => {
        const list = [];
        if (snap.exists()) {
          snap.forEach(child => list.push({ id: child.key, ...child.val() }));
        }
        setRawLogsMap(prev => ({ ...prev, [`${patient.id}_key`]: list }));
      });
      unsubs.push(unsubKey);

      // 2. Logs by patient linkedUid (auth UID)
      if (patient.linkedUid && patient.linkedUid !== patient.id) {
        const uidQuery = query(ref(db, "adherenceLogs"), orderByChild("patientId"), equalTo(patient.linkedUid));
        const unsubUid = onValue(uidQuery, snap => {
          const list = [];
          if (snap.exists()) {
            snap.forEach(child => list.push({ id: child.key, ...child.val() }));
          }
          setRawLogsMap(prev => ({ ...prev, [`${patient.id}_uid`]: list }));
        });
        unsubs.push(unsubUid);
      }
    });

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [patients]);

  const logsByPatient = useMemo(() => {
    const map = {};
    patients.forEach(patient => {
      const keyLogs = rawLogsMap[`${patient.id}_key`] || [];
      const uidLogs = rawLogsMap[`${patient.id}_uid`] || [];
      const seen = new Set();
      const merged = [...keyLogs, ...uidLogs].filter(l => {
        if (seen.has(l.id)) return false;
        seen.add(l.id);
        return true;
      });
      map[patient.id] = merged;
    });
    return map;
  }, [patients, rawLogsMap]);

  const stats = useMemo(() => {
    let totalAdherenceSum = 0;
    let highRiskCount = 0;
    const attentionList = [];

    patients.forEach(patient => {
      const patientLogs = logsByPatient[patient.id] || [];
      const risk = calculatePatientRisk(patient.id, patientLogs, patient.linkedUid);
      totalAdherenceSum += risk.rate;
      if (risk.rate < 60) {
        highRiskCount++;
      }

      const alerts = evaluatePatientAlerts(patient.id, patientLogs, medications, patient.linkedUid);
      if (alerts.length > 0) {
        attentionList.push({
          patient,
          reason: alerts[0].message,
          adherence: risk.rate,
          risk
        });
      }
    });

    const averageAdherence = patients.length ? Math.round(totalAdherenceSum / patients.length) : 0;

    const recentMeds = medications
      .slice()
      .sort((a, b) => {
        const timeA = typeof a.createdAt === "number" ? a.createdAt : new Date(a.createdAt || 0).getTime();
        const timeB = typeof b.createdAt === "number" ? b.createdAt : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      })
      .slice(0, 5)
      .map(med => {
        const patient = patients.find(p => p.id === med.patientId || p.linkedUid === med.patientId);
        return {
          ...med,
          patientName: patient ? getPatientName(patient) : "Unknown Patient"
        };
      });

    return {
      averageAdherence,
      highRiskCount,
      attentionList: attentionList.slice(0, 3),
      recentMeds
    };
  }, [patients, logsByPatient, medications]);

  const getInitials = (name) => {
    if (!name) return "";
    return name.split(" ").filter(Boolean).map(n => n[0].toUpperCase()).slice(0, 2).join("");
  };

  const getAvatarBgColor = (name) => {
    const colors = ["#eff6ff", "#f0fdf4", "#fdf2f8", "#fff7ed", "#faf5ff", "#f0fdfa"];
    const textColors = ["#1e40af", "#166534", "#9d174d", "#c2410c", "#6b21a8", "#0f766e"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return { bg: colors[index], text: textColors[index] };
  };

  if (loading) {
    return <div className="loading-state">Loading Clinician Dashboard...</div>;
  }

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Clinician Dashboard</h1>
          <p className="dash-sub">Practice overview and high-risk alerts</p>
        </div>
        <button className="primary-btn" onClick={() => navigate("/clinician/patients/add")}>
          Add New Patient
        </button>
      </header>

      <div className="stats-grid" style={{ marginBottom: "2rem" }}>
        <div 
          className="dash-card" 
          style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}
          onClick={() => navigate("/clinician/patients")}
        >
          <Users size={32} color="#2563eb" style={{ marginBottom: "0.5rem" }} />
          <h3 style={{ margin: "0 0 0.25rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>Total Patients</h3>
          <span style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)" }}>{patients.length}</span>
        </div>

        <div 
          className="dash-card" 
          style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}
          onClick={() => navigate("/clinician/patients")}
        >
          <Activity size={32} color="#10b981" style={{ marginBottom: "0.5rem" }} />
          <h3 style={{ margin: "0 0 0.25rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>Avg Adherence</h3>
          <span style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)" }}>{stats.averageAdherence}%</span>
        </div>

        <div 
          className="dash-card" 
          style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}
          onClick={() => navigate("/clinician/patients", { state: { initialFilter: "High Risk" } })}
        >
          <AlertTriangle size={32} color="#ef4444" style={{ marginBottom: "0.5rem" }} />
          <h3 style={{ margin: "0 0 0.25rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>High Risk Patients</h3>
          <span style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)" }}>{stats.highRiskCount}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
        {/* Needs Attention Panel */}
        <div className="dash-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0 }}>⚠️ Needs Attention</h3>
            <button 
              className="outline-btn" 
              style={{ padding: "0.35rem 0.8rem", fontSize: "0.82rem" }}
              onClick={() => navigate("/clinician/alerts")}
            >
              View All Alerts
            </button>
          </div>

          {stats.attentionList.length === 0 ? (
            <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--text-muted)" }}>
              <span style={{ fontSize: "2rem", display: "block", marginBottom: "0.5rem" }}>🎉</span>
              <p style={{ margin: 0, fontWeight: 600 }}>No patients currently need attention</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {stats.attentionList.map(({ patient, reason, adherence, risk }) => {
                const name = getPatientName(patient);
                const colors = getAvatarBgColor(name);
                const initials = getInitials(name);
                return (
                  <div 
                    key={patient.id} 
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between", 
                      padding: "0.75rem 0", 
                      borderTop: "1px solid var(--border)",
                      gap: "0.75rem"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                      <div style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        backgroundColor: colors.bg,
                        color: colors.text,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        flexShrink: 0
                      }}>
                        {initials}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ color: "var(--text-primary)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {name}
                        </strong>
                        <p style={{ margin: 0, color: "#ef4444", fontSize: "0.82rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {reason}
                        </p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <span style={{ color: risk.color, fontWeight: 700 }}>{adherence}%</span>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>adherence</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Medication Changes */}
        <div className="dash-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0 }}>💊 Recent Medication Changes</h3>
          </div>

          {stats.recentMeds.length === 0 ? (
            <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--text-muted)" }}>
              <p style={{ margin: 0 }}>No recent medication changes from your account.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {stats.recentMeds.map(med => {
                const dateStr = med.createdAt
                  ? new Date(typeof med.createdAt === "number" ? med.createdAt : med.createdAt).toLocaleDateString()
                  : "No date";
                return (
                  <div key={med.id} style={{ display: "flex", gap: "0.75rem", alignItems: "center", padding: "0.75rem 0", borderTop: "1px solid var(--border)" }}>
                    <Pill size={18} color="#2563eb" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" }}>
                        <strong style={{ color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {med.medicationName || med.name || "Medication"}
                        </strong>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", flexShrink: 0 }}>{dateStr}</span>
                      </div>
                      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        Patient: <strong>{med.patientName}</strong> · {med.dosage || "No dosage"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
