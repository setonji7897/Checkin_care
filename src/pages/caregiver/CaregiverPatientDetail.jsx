import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, onValue, get } from "firebase/database";
import { db } from "../../firebase/config";
import { ArrowLeft, User, Phone, Mail, FileText, AlertCircle, Clock, ShieldAlert } from "lucide-react";
import { calculatePatientRisk, getPatientName } from "../../utils/backendData";
import "../../styles/dashboard.css";

export default function CaregiverPatientDetail() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [medications, setMedications] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) return;

    const patientRef = ref(db, "patients/" + patientId);
    const unsubPatient = onValue(patientRef, async (snapshot) => {
      if (snapshot.exists()) {
        const patientData = { id: patientId, ...snapshot.val() };
        const linkedUid = patientData.linkedUid || patientId;
        
        // Fetch user info from users/{linkedUid} for details like name, email, phone
        const uSnap = await get(ref(db, "users/" + linkedUid));
        if (uSnap.exists()) {
          const u = uSnap.val();
          patientData.firstName = u.firstName || "";
          patientData.lastName = u.lastName || "";
          patientData.email = u.email || "";
          patientData.phone = u.phone || "";
        }
        setPatient(patientData);
      } else {
        setPatient(null);
      }
      setLoading(false);
    });

    const medsRef = ref(db, "medications");
    const unsubMeds = onValue(medsRef, (snapshot) => {
      const list = [];
      snapshot.forEach((child) => {
        const val = child.val();
        list.push({ id: child.key, ...val });
      });
      setMedications(list);
    });

    const logsRef = ref(db, "adherenceLogs");
    const unsubLogs = onValue(logsRef, (snapshot) => {
      const list = [];
      snapshot.forEach((child) => {
        const val = child.val();
        list.push({ id: child.key, ...val });
      });
      setLogs(list);
    });

    return () => {
      unsubPatient();
      unsubMeds();
      unsubLogs();
    };
  }, [patientId]);

  const filteredMeds = useMemo(() => {
    return medications.filter(med => med.patientId === patientId || (patient?.linkedUid && med.patientId === patient.linkedUid));
  }, [medications, patientId, patient?.linkedUid]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => log.patientId === patientId || (patient?.linkedUid && log.patientId === patient.linkedUid));
  }, [logs, patientId, patient?.linkedUid]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px", color: "var(--text-muted)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 1rem" }} />
          <p style={{ margin: 0, fontSize: "0.9rem" }}>Loading patient details...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="dash-card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
        <AlertCircle size={48} style={{ color: "#ef4444", margin: "0 auto 1rem" }} />
        <h3 style={{ margin: "0 0 0.5rem", color: "var(--text-primary)" }}>Patient not found</h3>
        <p style={{ color: "var(--text-muted)", margin: "0 0 1.5rem" }}>The requested patient record could not be loaded.</p>
        <button onClick={() => navigate("/caregiver/patients")} className="primary-btn">
          Back to Patients
        </button>
      </div>
    );
  }

  const risk = calculatePatientRisk(patientId, filteredLogs, patient?.linkedUid);

  return (
    <>
      <button
        onClick={() => navigate("/caregiver/patients")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontWeight: 500,
          marginBottom: "1rem",
          padding: 0
        }}
      >
        <ArrowLeft size={16} /> Back to Patients
      </button>

      <header className="dash-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1>{getPatientName(patient)}</h1>
          <p className="dash-sub">Patient Detailed Profile & Medications</p>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start", flexWrap: "wrap" }}>
        {/* Adherence & Demographics */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="dash-card">
            <h3 style={{ margin: "0 0 1rem", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <User size={18} /> Personal Details
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block" }}>Full Name</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{getPatientName(patient)}</span>
              </div>
              {patient.email && (
                <div>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block" }}>
                    <Mail size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} /> Email
                  </span>
                  <span style={{ color: "var(--text-primary)" }}>{patient.email}</span>
                </div>
              )}
              {patient.phone && (
                <div>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block" }}>
                    <Phone size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} /> Phone Number
                  </span>
                  <span style={{ color: "var(--text-primary)" }}>{patient.phone}</span>
                </div>
              )}
            </div>
          </div>

          <div className="dash-card">
            <h3 style={{ margin: "0 0 1rem", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ShieldAlert size={18} /> Adherence Status
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                border: `6px solid ${risk.rate >= 80 ? "#10b981" : risk.rate >= 50 ? "#f59e0b" : "#ef4444"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: "1.25rem", color: "var(--text-primary)"
              }}>
                {risk.rate}%
              </div>
              <div>
                <h4 style={{ margin: "0 0 0.25rem", color: "var(--text-primary)" }}>
                  Weekly Adherence: {risk.label}
                </h4>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  Adherence is computed dynamically from patient logs recorded over the last 7 days.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Medications (Read-only) */}
        <div className="dash-card">
          <h3 style={{ margin: "0 0 1rem", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <FileText size={18} /> Prescribed Medications (Read-Only)
          </h3>
          {filteredMeds.length === 0 ? (
            <p style={{ color: "var(--text-muted)", margin: 0 }}>No prescribed medications found for this patient.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {filteredMeds.map((med) => {
                const times = Array.isArray(med.reminderTimes) ? med.reminderTimes
                  : Array.isArray(med.reminderTime) ? med.reminderTime
                  : med.reminderTime ? [med.reminderTime]
                  : med.times ? (Array.isArray(med.times) ? med.times : [med.times])
                  : [];
                return (
                  <div key={med.id} style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "1rem", background: "var(--bg-page)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                      <div>
                        <h4 style={{ margin: "0 0 0.25rem", color: "var(--text-primary)", fontSize: "1rem" }}>{med.medicationName || med.name}</h4>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                          {med.dosage || "No dosage details"}
                        </p>
                      </div>
                      {med.frequency && (
                        <span style={{ fontSize: "0.75rem", background: "var(--border)", color: "var(--text-primary)", padding: "0.25rem 0.5rem", borderRadius: "20px", fontWeight: 600 }}>
                          {typeof med.frequency === "object" ? med.frequency.label : med.frequency}
                        </span>
                      )}
                    </div>
                    {med.notes && (
                      <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                        Note: {med.notes}
                      </p>
                    )}
                    {times.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.75rem", alignItems: "center" }}>
                        <Clock size={12} style={{ color: "var(--text-muted)" }} />
                        {times.map((t, idx) => (
                          <span key={idx} style={{ fontSize: "0.75rem", background: "rgba(99, 102, 241, 0.1)", color: "#6366f1", padding: "0.15rem 0.40rem", borderRadius: "6px", fontWeight: 500 }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </>
  );
}
