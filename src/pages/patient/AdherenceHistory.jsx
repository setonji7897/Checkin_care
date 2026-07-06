// src/pages/patient/AdherenceHistory.jsx
//
// PURPOSE: Summary and historical log viewer for patient adherence compliance.

import { useState, useEffect } from "react";
import { ref, onValue, get } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { calculateAdherenceRate } from "../../utils/adherenceStats";
import { useNavigate } from "react-router-dom";
import { formatTime12Hour } from "../../utils/formatTime";
import "../../styles/dashboard.css";

export default function AdherenceHistory() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(7); // default 7 days filter
  const [stats, setStats] = useState({ rate: null, taken: 0, missed: 0, skipped: 0 });

  useEffect(() => {
    if (!currentUser) return;
    let unsubscribeLogs = null;

    get(ref(db, "patients")).then(patientsSnap => {
      let patientIdRef = currentUser.uid;
      if (patientsSnap.exists()) {
        patientsSnap.forEach(child => {
          const val = child.val();
          if (val.linkedUid === currentUser.uid) patientIdRef = child.key;
        });
      }
      console.log("ðŸ“Š History: resolved patientId =", patientIdRef);

      // Fetch ALL logs and filter client-side — no Firebase index needed
      unsubscribeLogs = onValue(ref(db, "adherenceLogs"), (logsSnap) => {
        const list = [];
        if (logsSnap.exists()) {
          logsSnap.forEach(child => {
            const val = child.val();
            if (val.patientId === patientIdRef) {
              list.push({ id: child.key, ...val });
            }
          });
        }
        list.sort((a, b) => {
          const dtA = (a.scheduledDate || "") + "T" + (a.scheduledTime || "");
          const dtB = (b.scheduledDate || "") + "T" + (b.scheduledTime || "");
          return dtB.localeCompare(dtA);
        });
        setLogs(list);
        console.log("ðŸ“Š History: loaded", list.length, "logs");
        setLoading(false);
      }, (err) => {
        console.error("History logs error:", err);
        setLoading(false);
      });
    }).catch(err => {
      console.error("History: patient resolve error:", err);
      setLoading(false);
    });

    return () => { if (unsubscribeLogs) unsubscribeLogs(); };
  }, [currentUser]);

  // Recalculate stats whenever date range selection or logs update
  useEffect(() => {
    const rangeDateLimit = new Date();
    rangeDateLimit.setDate(rangeDateLimit.getDate() - rangeDays);
    const limitString = rangeDateLimit.toISOString().split("T")[0];

    const filtered = logs.filter(l => l.scheduledDate >= limitString);
    setStats(calculateAdherenceRate(filtered));
  }, [logs, rangeDays]);

  // Helper to group logs by scheduled date
  const getGroupedLogs = () => {
    const grouped = {};
    const rangeDateLimit = new Date();
    rangeDateLimit.setDate(rangeDateLimit.getDate() - 30); // Max 30 days history display
    const limitString = rangeDateLimit.toISOString().split("T")[0];

    const displayLogs = logs.filter(l => l.scheduledDate >= limitString);

    displayLogs.forEach(log => {
      const dateKey = log.scheduledDate;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(log);
    });

    return grouped;
  };

  const groupedLogs = getGroupedLogs();

  return (
    <>
      <header className="dash-header">
          <div>
            <h1>Adherence &amp; History</h1>
            <p className="dash-sub">Monitor your compliance score and log checklists</p>
          </div>
        </header>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <span style={{ fontSize: "1.2rem", color: "var(--text-muted)" }}>Recalculating statistics...</span>
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="coming-soon-grid" style={{ marginBottom: "2rem" }}>
              <div className="dash-card placeholder-card" style={{ borderLeft: "6px solid #6c63ff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3>Adherence Compliance</h3>
                  <select 
                    value={rangeDays} 
                    onChange={e => setRangeDays(Number(e.target.value))}
                    style={{ padding: "0.25rem 0.5rem", borderRadius: "8px", border: "1px solid #d1d5db" }}
                  >
                    <option value={7}>Last 7 Days</option>
                    <option value={30}>Last 30 Days</option>
                  </select>
                </div>
                <span style={{ 
                  fontSize: "3rem", 
                  fontWeight: 800, 
                  color: stats.rate === null ? "var(--text-muted)" : (stats.rate >= 80 ? "#10b981" : (stats.rate >= 50 ? "#f59e0b" : "#ef4444")) 
                }}>
                  {stats.rate !== null ? `${stats.rate}%` : "No data"}
                </span>
                <div style={{ display: "flex", gap: "1rem", fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                  <span>Taken: <strong>{stats.taken}</strong></span>
                  <span>Missed: <strong>{stats.missed}</strong></span>
                  <span>Skipped: <strong>{stats.skipped}</strong></span>
                </div>
              </div>
            </div>

            {/* Daily logs feed */}
            <h2>Daily Log History</h2>
            {Object.keys(groupedLogs).length === 0 ? (
              <p style={{ color: "var(--text-muted)", marginTop: "0.5rem" }}>No adherence logs recorded in the last 30 days.</p>
            ) : (
              <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {Object.keys(groupedLogs).map(dateStr => {
                  const dateObject = new Date(dateStr);
                  const formattedDate = dateObject.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                  
                  return (
                    <div key={dateStr} className="dash-card" style={{ padding: "1.5rem" }}>
                      <h3 style={{ borderBottom: "1px solid #f0eeff", paddingBottom: "0.5rem", marginBottom: "1rem", fontSize: "1rem", color: "#6c63ff" }}>
                        📅 {formattedDate}
                      </h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {groupedLogs[dateStr].map(log => (
                          <div key={log.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <strong style={{ fontSize: "1.05rem" }}>{log.medicationName}</strong>
                              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>Slot: {formatTime12Hour(log.scheduledTime)}</span>
                            </div>
                            <span style={{ 
                              padding: "0.25rem 0.6rem", 
                              borderRadius: "20px", 
                              fontSize: "0.75rem", 
                              fontWeight: 700,
                              background: log.status === "taken" ? "#ecfdf5" : (log.status === "missed" ? "#fef2f2" : "#fffbeb"),
                              color: log.status === "taken" ? "#047857" : (log.status === "missed" ? "#b91c1c" : "#b45309")
                            }}>
                              {log.status.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
    </>
  );
}
