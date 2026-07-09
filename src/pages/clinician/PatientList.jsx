// src/pages/clinician/PatientList.jsx
//
// PURPOSE: Real-time overview of patients assigned to the active clinician, with search, filter, and risk sorting.

import { useState, useEffect, useMemo } from "react";
import { Users, Bell, MessageSquare, Plus } from "lucide-react";
import { ref, query, orderByChild, equalTo, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { calculatePatientRisk, getPatientName, getPatientUid, writeUserNotification } from "../../utils/backendData";
import { getOrCreateConversation } from "../../utils/messageUtils";
import "../../styles/dashboard.css";

export default function PatientList() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [patients, setPatients] = useState([]);
  const [rawLogsMap, setRawLogsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [sentReminders, setSentReminders] = useState({});

  // Search & Filter & Sort States
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [sortBy, setSortBy] = useState("risk-desc");

  // Read initial filter from dashboard stat card navigation
  useEffect(() => {
    if (location.state?.initialFilter) {
      setRiskFilter(location.state.initialFilter);
    }
  }, [location.state]);

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

    return () => {
      unsubPatients();
    };
  }, [currentUser]);

  // Subscribe to logs per patient dynamically to comply with child-restricted security rules
  useEffect(() => {
    if (patients.length === 0) return;

    console.warn("[DEBUG] Starting logs subscriptions for patients:", patients.map(p => p.id));
    const unsubs = [];

    patients.forEach(patient => {
      // 1. Logs by patient record key
      const keyQuery = query(ref(db, "adherenceLogs"), orderByChild("patientId"), equalTo(patient.id));
      const unsubKey = onValue(keyQuery, snap => {
        const list = [];
        if (snap.exists()) {
          snap.forEach(child => list.push({ id: child.key, ...child.val() }));
        }
        console.warn(`[DEBUG] Key logs for patient ${patient.fullName} (${patient.id}):`, list.length, JSON.stringify(list));
        setRawLogsMap(prev => ({ ...prev, [`${patient.id}_key`]: list }));
      }, (err) => {
        console.error(`[DEBUG] Error fetching key logs for patient ${patient.fullName}:`, err);
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
          console.warn(`[DEBUG] Uid logs for patient ${patient.fullName} (${patient.linkedUid}):`, list.length, JSON.stringify(list));
          setRawLogsMap(prev => ({ ...prev, [`${patient.id}_uid`]: list }));
        }, (err) => {
          console.error(`[DEBUG] Error fetching uid logs for patient ${patient.fullName}:`, err);
        });
        unsubs.push(unsubUid);
      }
    });

    return () => {
      console.log("[DEBUG] Cleaning up logs subscriptions");
      unsubs.forEach(unsub => unsub());
    };
  }, [patients]);

  // Merge key-based and UID-based logs per patient
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

  const rows = useMemo(() => patients.map(patient => {
    const patientLogs = logsByPatient[patient.id] || [];
    const risk = calculatePatientRisk(patient.id, patientLogs, patient.linkedUid);
    const todayStr = new Date().toISOString().split("T")[0];
    const todayLogs = patientLogs.filter(log => 
      (log.patientId === patient.id || (patient.linkedUid && log.patientId === patient.linkedUid)) && 
      log.scheduledDate === todayStr
    );
    const taken = todayLogs.filter(log => log.status === "taken").length;
    return { 
      patient, 
      risk, 
      todayText: todayLogs.length ? `${taken}/${todayLogs.length} taken today` : "No doses logged today" 
    };
  }), [patients, logsByPatient]);

  // Apply Search, Filters, and Sorting to rows list
  const filteredAndSortedRows = useMemo(() => {
    // 1. Filter
    const filtered = rows.filter(({ patient, risk }) => {
      const name = getPatientName(patient).toLowerCase();
      const condition = (patient.medicalCondition || "").toLowerCase();
      const search = searchTerm.toLowerCase();
      const matchesSearch = name.includes(search) || condition.includes(search);

      const matchesFilter = riskFilter === "All" || risk.label === riskFilter;

      return matchesSearch && matchesFilter;
    });

    // 2. Sort
    const riskWeight = { "High Risk": 3, "Watch": 2, "Stable": 1 };

    return filtered.sort((a, b) => {
      if (sortBy === "risk-desc") {
        const wA = riskWeight[a.risk.label] || 0;
        const wB = riskWeight[b.risk.label] || 0;
        if (wA !== wB) return wB - wA; // highest risk first
        return a.risk.rate - b.risk.rate; // lowest adherence first
      }
      if (sortBy === "name-asc") {
        return getPatientName(a.patient).localeCompare(getPatientName(b.patient));
      }
      if (sortBy === "name-desc") {
        return getPatientName(b.patient).localeCompare(getPatientName(a.patient));
      }
      if (sortBy === "adherence-asc") {
        return a.risk.rate - b.risk.rate;
      }
      if (sortBy === "adherence-desc") {
        return b.risk.rate - a.risk.rate;
      }
      return 0;
    });
  }, [rows, searchTerm, riskFilter, sortBy]);

  const sendReminder = async (e, patient) => {
    e.stopPropagation();
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

  const startMessage = (e, patient) => {
    e.stopPropagation();
    navigate(`/care-triangle?patientId=${patient.id}`);
  };

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

      {/* Search, Filter, Sort Controls */}
      <div 
        style={{ 
          display: "flex", 
          gap: "1rem", 
          marginBottom: "1.5rem", 
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg-card)",
          padding: "1rem",
          borderRadius: "16px",
          border: "1px solid var(--border)",
          boxShadow: "var(--card-shadow)"
        }}
      >
        <div style={{ flex: 1, minWidth: "240px" }}>
          <input
            type="text"
            placeholder="Search by patient name or condition..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "0.6rem 1rem",
              borderRadius: "10px",
              border: "1.5px solid var(--border)",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
              fontSize: "0.9rem"
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              style={{
                padding: "0.6rem 1rem",
                borderRadius: "10px",
                border: "1.5px solid var(--border)",
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                fontSize: "0.9rem",
                cursor: "pointer"
              }}
            >
              <option value="All">All Risk Levels</option>
              <option value="High Risk">High Risk</option>
              <option value="Watch">Watch</option>
              <option value="Stable">Stable</option>
            </select>
          </div>
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: "0.6rem 1rem",
                borderRadius: "10px",
                border: "1.5px solid var(--border)",
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                fontSize: "0.9rem",
                cursor: "pointer"
              }}
            >
              <option value="risk-desc">Sort: Risk Level (Highest First)</option>
              <option value="name-asc">Sort: Name (A-Z)</option>
              <option value="name-desc">Sort: Name (Z-A)</option>
              <option value="adherence-asc">Sort: Adherence (Lowest First)</option>
              <option value="adherence-desc">Sort: Adherence (Highest First)</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "5rem" }}>
          <span style={{ fontSize: "1.2rem", color: "var(--text-muted)" }}>Loading patients list...</span>
        </div>
      ) : patients.length === 0 ? (
        <div className="dash-card" style={{ textAlign: "center", padding: "3rem" }}>
          <span style={{ fontSize: "3rem" }}>👥</span>
          <h3 style={{ margin: "1rem 0 0.5rem 0" }}>No patients yet</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>Click "Add Patient" to set up your first clinical profile.</p>
          <button className="primary-btn" onClick={() => navigate("/clinician/patients/add")}>
            Add Patient
          </button>
        </div>
      ) : filteredAndSortedRows.length === 0 ? (
        <div className="dash-card" style={{ textAlign: "center", padding: "3rem" }}>
          <span style={{ fontSize: "3rem" }}>🔍</span>
          <h3 style={{ margin: "1rem 0 0.5rem 0" }}>No matching patients</h3>
          <p style={{ color: "var(--text-muted)" }}>Try adjusting your search query or risk filter.</p>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "1.5rem"
        }}>
          {filteredAndSortedRows.map(({ patient, risk, todayText }) => {
            const name = getPatientName(patient);
            const initials = getInitials(name);
            const colors = getAvatarBgColor(name);
            return (
              <div 
                key={patient.id} 
                className="dash-card" 
                style={{ 
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "transform 0.15s, box-shadow 0.15s",
                  minWidth: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 30px rgba(0,0,0,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.03)";
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                  <div style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    backgroundColor: colors.bg,
                    color: colors.text,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "1rem",
                    flexShrink: 0
                  }}>
                    {initials}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 style={{ margin: "0 0 0.25rem", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                      <span className="condition-tag" style={{ display: "inline-block", padding: "2px 8px", borderRadius: "999px", backgroundColor: "#0f766e", color: "white", fontSize: "0.75rem", fontWeight: 600 }}>
                        {patient.medicalCondition || "General"}
                      </span>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{todayText}</span>
                    </div>
                    <p style={{ margin: 0, color: risk.color, fontWeight: 700, fontSize: "0.9rem" }}>
                      {risk.rate}% adherence · {risk.label}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", width: "100%", justifyContent: "flex-end", marginTop: "1.25rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }} className="patient-card-actions">
                  <button 
                    onClick={() => navigate(`/clinician/patients/${patient.id}`)}
                    className="outline-btn"
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1rem", fontSize: "0.85rem", whiteSpace: "nowrap", flex: "1 1 auto", justifyContent: "center" }}
                  >
                    View
                  </button>
                  <button 
                    onClick={(e) => startMessage(e, patient)} 
                    className="outline-btn" 
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1rem", fontSize: "0.85rem", whiteSpace: "nowrap", flex: "1 1 auto", justifyContent: "center" }}
                  >
                    <MessageSquare size={16} /> Message
                  </button>
                  <button 
                    onClick={(e) => sendReminder(e, patient)} 
                    disabled={sentReminders[patient.id]}
                    className="primary-btn" 
                    style={{ 
                      padding: "0.55rem 1rem", 
                      fontSize: "0.85rem", 
                      whiteSpace: "nowrap", 
                      flex: "1 1 auto", 
                      justifyContent: "center",
                      background: sentReminders[patient.id] ? "#10b981" : undefined,
                      borderColor: sentReminders[patient.id] ? "#10b981" : undefined,
                      cursor: sentReminders[patient.id] ? "default" : "pointer"
                    }}
                  >
                    <Bell size={16} /> {sentReminders[patient.id] ? "Sent ✓" : "Remind"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
