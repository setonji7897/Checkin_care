// src/pages/clinician/PatientList.jsx
//
// PURPOSE: Real-time overview of patients assigned to the active clinician.

import { useState, useEffect, useMemo } from "react";
import { Users, Bell, MessageSquare, Plus } from "lucide-react";
import { ref, query, orderByChild, equalTo, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { calculatePatientRisk, getPatientName, getPatientUid, writeUserNotification } from "../../utils/backendData";
import { getOrCreateConversation } from "../../utils/messageUtils";
import "../../styles/dashboard.css";

export default function PatientList() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sentReminders, setSentReminders] = useState({});

  useEffect(() => {
    if (!currentUser) return;

    const patientsQuery = query(
      ref(db, "patients"),
      orderByChild("clinicianId"),
      equalTo(currentUser.uid)
    );

    const unsubPatients = onValue(patientsQuery, (snapshot) => {
      const dataList = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          dataList.push({ id: child.key, ...child.val() });
        });
      }
      setPatients(dataList);
      setLoading(false);
    }, (error) => {
      console.error("Firebase query failed in PatientList:", error);
      setLoading(false);
    });

    const unsubLogs = onValue(ref(db, "adherenceLogs"), (snapshot) => {
      const list = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => list.push({ id: child.key, ...child.val() }));
      }
      setLogs(list);
    });

    return () => {
      unsubPatients();
      unsubLogs();
    };
  }, [currentUser]);

  const rows = useMemo(() => patients.map(patient => {
    const risk = calculatePatientRisk(patient.id, logs, patient.linkedUid);
    const todayStr = new Date().toISOString().split("T")[0];
    const todayLogs = logs.filter(log => 
      (log.patientId === patient.id || (patient.linkedUid && log.patientId === patient.linkedUid)) && 
      log.scheduledDate === todayStr
    );
    const taken = todayLogs.filter(log => log.status === "taken").length;
    return { 
      patient, 
      risk, 
      todayText: todayLogs.length ? `${taken}/${todayLogs.length} taken today` : "No doses logged today" 
    };
  }), [patients, logs]);

  const sendReminder = async (e, patient) => {
    e.stopPropagation(); // prevent card click
    try {
      await writeUserNotification(getPatientUid(patient, patient.id), {
        type: "reminder",
        title: "Clinician reminder",
        body: "Please check your medication schedule.",
        actionRoute: "/patient/schedule"
      });
      setSentReminders(prev => ({ ...prev, [patient.id]: true }));
      setTimeout(() => {
        setSentReminders(prev => ({ ...prev, [patient.id]: false }));
      }, 2500);
    } catch (err) {
      console.error("Error sending reminder:", err);
    }
  };

  const startMessage = async (e, patient) => {
    e.stopPropagation(); // prevent card click
    const patientUid = getPatientUid(patient, patient.id);
    await getOrCreateConversation(
      currentUser.uid,
      "clinician",
      patientUid,
      "patient",
      userData?.firstName || "Clinician",
      getPatientName(patient)
    );
    navigate("/clinician/messages");
  };

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>My Patients</h1>
          <p className="dash-sub">Clinician: {currentUser?.email}</p>
        </div>
        <button 
          className="primary-btn" 
          style={{ padding: "0.6rem 1.2rem", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
          onClick={() => navigate("/clinician/patients/add")}
        >
          <Plus size={18} /> Add Patient
        </button>
      </header>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <span style={{ fontSize: "1.2rem", color: "var(--text-muted)" }}>Loading patients list...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="dash-card" style={{ textAlign: "center", padding: "3rem" }}>
          <span style={{ fontSize: "3rem" }}>👥</span>
          <h3 style={{ margin: "1rem 0 0.5rem 0" }}>No patients yet</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>Click "Add Patient" to set up your first clinical profile.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {rows.map(({ patient, risk, todayText }) => (
            <div 
              key={patient.id} 
              className="dash-card" 
              style={{ cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
              onClick={() => navigate(`/clinician/patients/${patient.id}`)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 30px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.03)";
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ padding: '1rem', background: '#eff6ff', borderRadius: '50%', color: '#2563eb' }}>
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: "0 0 0.25rem", color: "var(--text-primary)" }}>{getPatientName(patient)}</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                      <span className="condition-tag" style={{ display: "inline-block", padding: "2px 8px", borderRadius: "999px", backgroundColor: "#0f766e", color: "white", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.02em" }}>
                        {patient.medicalCondition || "General"}
                      </span>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{todayText}</span>
                    </div>
                    <p style={{ margin: 0, color: risk.color, fontWeight: 700, fontSize: "0.9rem" }}>{risk.rate}% adherence · {risk.label}</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end", flex: "0 0 auto" }} className="patient-card-actions">
                  <button 
                    onClick={(e) => sendReminder(e, patient)} 
                    disabled={sentReminders[patient.id]}
                    className="primary-btn" 
                    style={{ 
                      padding: "0.55rem 1rem", 
                      whiteSpace: "nowrap", 
                      minWidth: "fit-content", 
                      fontSize: "0.875rem",
                      background: sentReminders[patient.id] ? "#10b981" : undefined,
                      borderColor: sentReminders[patient.id] ? "#10b981" : undefined,
                      cursor: sentReminders[patient.id] ? "default" : "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <Bell size={16} /> {sentReminders[patient.id] ? "Sent ✓" : "Send Reminder"}
                  </button>
                  <button onClick={(e) => startMessage(e, patient)} className="outline-btn" style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1rem", whiteSpace: "nowrap", minWidth: "fit-content" }}><MessageSquare size={16} /> Message</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
