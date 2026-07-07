import { useEffect, useMemo, useState } from "react";
import { FileText, Printer, Calendar, User } from "lucide-react";
import { ref, onValue, get } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { calculateAdherence, getPatientName } from "../../utils/backendData";
import "../../styles/dashboard.css";

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function getDateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export default function CaregiverReports() {
  const { currentUser } = useAuth();
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [startDate, setStartDate] = useState(getDateNDaysAgo(7));
  const [endDate, setEndDate] = useState(getTodayStr());
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Load assigned patients
  useEffect(() => {
    if (!currentUser) return;
    const assignQuery = query(
      ref(db, "caregiverAssignments"),
      orderByChild("caregiverId"),
      equalTo(currentUser.uid)
    );
    const unsub = onValue(assignQuery, async (snapshot) => {
      const ids = [];
      snapshot.forEach(child => ids.push(child.key));
      const list = [];
      for (const pid of ids) {
        const pSnap = await get(ref(db, "patients/" + pid));
        if (pSnap.exists()) {
          const patientData = { id: pid, ...pSnap.val() };
          const linkedUid = patientData.linkedUid || pid;
          const uSnap = await get(ref(db, "users/" + linkedUid));
          if (uSnap.exists()) {
            const u = uSnap.val();
            patientData.firstName = u.firstName || "";
            patientData.lastName = u.lastName || "";
          }
          list.push(patientData);
        }
      }
      setPatients(list);
      if (list.length > 0 && !selectedPatientId) setSelectedPatientId(list[0].id);
    });
    return () => unsub();
  }, [currentUser]);

  // Load all adherence logs and filter client-side for the selected patient.
  // Using a full-node onValue (no server-side query) avoids the need for a
  // deployed Firebase index and is proven to work in this project.
  useEffect(() => {
    if (!selectedPatientId) return;
    setLoadingLogs(true);
    const unsub = onValue(ref(db, "adherenceLogs"), (snapshot) => {
      const list = [];
      snapshot.forEach(child => {
        const log = { id: child.key, ...child.val() };
        if (log.patientId === selectedPatientId) list.push(log);
      });
      setLogs(list);
      setLoadingLogs(false);
    });
    return () => unsub();
  }, [selectedPatientId]);

  // Compute report data
  const report = useMemo(() => {
    if (!selectedPatientId || !startDate || !endDate) return null;

    const periodLogs = logs.filter(l => l.scheduledDate >= startDate && l.scheduledDate <= endDate);
    const { taken, total, rate } = calculateAdherence(periodLogs);
    const missed = periodLogs.filter(l => l.status === "missed").length;
    const skipped = periodLogs.filter(l => l.status === "skipped").length;

    // Prior period (same length, immediately before)
    const days = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000));
    const priorEnd = new Date(startDate);
    priorEnd.setDate(priorEnd.getDate() - 1);
    const priorEndStr = priorEnd.toISOString().split("T")[0];
    const priorStart = new Date(priorEnd);
    priorStart.setDate(priorStart.getDate() - (days - 1));
    const priorStartStr = priorStart.toISOString().split("T")[0];
    const priorLogs = logs.filter(l => l.scheduledDate >= priorStartStr && l.scheduledDate <= priorEndStr);
    const { rate: priorRate } = calculateAdherence(priorLogs);
    const diff = priorRate !== null ? rate - priorRate : null;

    // Per-day breakdown
    const byDay = {};
    periodLogs.forEach(l => {
      if (!byDay[l.scheduledDate]) byDay[l.scheduledDate] = { taken: 0, missed: 0, skipped: 0 };
      if (l.status === "taken") byDay[l.scheduledDate].taken++;
      else if (l.status === "missed") byDay[l.scheduledDate].missed++;
      else if (l.status === "skipped") byDay[l.scheduledDate].skipped++;
    });

    const dayEntries = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));

    let bestDay = null, worstDay = null;
    dayEntries.forEach(([date, d]) => {
      if (!bestDay || d.taken > byDay[bestDay].taken) bestDay = date;
      if (!worstDay || d.missed > byDay[worstDay].missed) worstDay = date;
    });

    const patient = patients.find(p => p.id === selectedPatientId);

    return { patient, taken, missed, skipped, total, rate, priorRate, diff, dayEntries, bestDay, worstDay, days };
  }, [logs, selectedPatientId, startDate, endDate, patients]);

  return (
    <>
      <header className="dash-header no-print">
        <div>
          <h1>Reports</h1>
          <p className="dash-sub">Generate compliance summaries</p>
        </div>
      </header>

      {/* Controls */}
      <div className="dash-card no-print" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.35rem" }}>
              <User size={13} style={{ verticalAlign: "middle", marginRight: "4px" }} /> Patient
            </label>
            <select
              value={selectedPatientId}
              onChange={e => setSelectedPatientId(e.target.value)}
              style={{ width: "100%", padding: "0.55rem 0.75rem", border: "1.5px solid var(--border)", borderRadius: "10px", fontSize: "0.9rem", fontFamily: "inherit", background: "var(--bg-card)" }}
            >
              {patients.length === 0 && <option value="">No patients assigned</option>}
              {patients.map(p => (
                <option key={p.id} value={p.id}>{getPatientName(p)}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.35rem" }}>
              <Calendar size={13} style={{ verticalAlign: "middle", marginRight: "4px" }} /> From
            </label>
            <input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)}
              style={{ width: "100%", padding: "0.55rem 0.75rem", border: "1.5px solid var(--border)", borderRadius: "10px", fontSize: "0.9rem", fontFamily: "inherit", background: "var(--bg-card)" }} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.35rem" }}>
              <Calendar size={13} style={{ verticalAlign: "middle", marginRight: "4px" }} /> To
            </label>
            <input type="date" value={endDate} min={startDate} max={getTodayStr()} onChange={e => setEndDate(e.target.value)}
              style={{ width: "100%", padding: "0.55rem 0.75rem", border: "1.5px solid var(--border)", borderRadius: "10px", fontSize: "0.9rem", fontFamily: "inherit", background: "var(--bg-card)" }} />
          </div>

          <button
            onClick={() => window.print()}
            disabled={!report}
            className="primary-btn"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem", whiteSpace: "nowrap" }}
          >
            <Printer size={16} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Report Preview */}
      {!report || loadingLogs ? (
        <div className="dash-card">
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            {patients.length === 0 ? "No patients assigned yet." : loadingLogs ? "Loading report data..." : "Select a patient and date range to generate a report."}
          </p>
        </div>
      ) : (
        <div id="print-report">
          {/* Print header — only visible when printing */}
          <div className="print-only" style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ margin: "0 0 0.25rem" }}>CheckIn Care — Adherence Report</h2>
            <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>Generated: {new Date().toLocaleDateString()}</p>
          </div>

          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            <div className="dash-card" style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 0.25rem", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Patient</p>
              <p style={{ margin: 0, fontWeight: 700, color: "var(--text-primary)" }}>{getPatientName(report.patient)}</p>
            </div>
            <div className="dash-card" style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 0.25rem", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Period</p>
              <p style={{ margin: 0, fontWeight: 700, color: "var(--text-primary)", fontSize: "0.85rem" }}>{startDate} → {endDate}</p>
            </div>
            <div className="dash-card" style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 0.25rem", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Adherence</p>
              <span style={{
                fontSize: "1.75rem", fontWeight: 800,
                color: report.rate >= 80 ? "#10b981" : report.rate >= 50 ? "#f59e0b" : "#ef4444"
              }}>{report.rate}%</span>
              {report.diff !== null && (
                <p style={{ margin: "0.15rem 0 0", fontSize: "0.8rem", color: report.diff >= 0 ? "#10b981" : "#ef4444" }}>
                  {report.diff >= 0 ? "▲" : "▼"} {Math.abs(report.diff)}% vs prior period
                </p>
              )}
            </div>
            <div className="dash-card" style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 0.25rem", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Taken</p>
              <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#10b981" }}>{report.taken}</span>
            </div>
            <div className="dash-card" style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 0.25rem", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Missed</p>
              <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#ef4444" }}>{report.missed}</span>
            </div>
            <div className="dash-card" style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 0.25rem", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Skipped</p>
              <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#f59e0b" }}>{report.skipped}</span>
            </div>
          </div>

          {/* Best / Worst day */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <div className="dash-card">
              <p style={{ margin: "0 0 0.25rem", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Best Day</p>
              <p style={{ margin: 0, fontWeight: 700, color: "#10b981" }}>
                {report.bestDay ? `${report.bestDay} (${report.dayEntries.find(([d]) => d === report.bestDay)?.[1].taken ?? 0} doses taken)` : "No data"}
              </p>
            </div>
            <div className="dash-card">
              <p style={{ margin: "0 0 0.25rem", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Worst Day</p>
              <p style={{ margin: 0, fontWeight: 700, color: "#ef4444" }}>
                {report.worstDay ? `${report.worstDay} (${report.dayEntries.find(([d]) => d === report.worstDay)?.[1].missed ?? 0} missed)` : "No data"}
              </p>
            </div>
          </div>

          {/* Day-by-day breakdown */}
          <div className="dash-card">
            <h3 style={{ margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <FileText size={18} /> Day-by-Day Breakdown
            </h3>
            {report.dayEntries.length === 0 ? (
              <p style={{ color: "var(--text-muted)", margin: 0 }}>No adherence records in this date range.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-page)", borderBottom: "2px solid var(--border)" }}>
                      <th style={{ padding: "0.6rem 1rem", textAlign: "left", fontWeight: 600, color: "var(--text-muted)" }}>Date</th>
                      <th style={{ padding: "0.6rem 1rem", textAlign: "center", fontWeight: 600, color: "#10b981" }}>Taken</th>
                      <th style={{ padding: "0.6rem 1rem", textAlign: "center", fontWeight: 600, color: "#ef4444" }}>Missed</th>
                      <th style={{ padding: "0.6rem 1rem", textAlign: "center", fontWeight: 600, color: "#f59e0b" }}>Skipped</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.dayEntries.map(([date, d]) => (
                      <tr key={date} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.6rem 1rem", color: "var(--text-primary)", fontWeight: 500 }}>{date}</td>
                        <td style={{ padding: "0.6rem 1rem", textAlign: "center", color: "#10b981", fontWeight: 700 }}>{d.taken}</td>
                        <td style={{ padding: "0.6rem 1rem", textAlign: "center", color: "#ef4444", fontWeight: 700 }}>{d.missed}</td>
                        <td style={{ padding: "0.6rem 1rem", textAlign: "center", color: "#f59e0b", fontWeight: 700 }}>{d.skipped}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          .dash-card { box-shadow: none !important; border: 1px solid #ddd !important; }
        }
        .print-only { display: none; }
      `}</style>
    </>
  );
}
