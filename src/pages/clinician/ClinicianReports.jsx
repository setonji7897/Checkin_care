import { useState, useEffect } from "react";
import { FileText, Download, Users, User, Calendar } from "lucide-react";
import { getAllPatientsRiskRanked } from "../../services/patientInsightService";
import { useAuth } from "../../contexts/AuthContext";
import "../../styles/dashboard.css";

export default function ClinicianReports() {
  const { currentUser } = useAuth();
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    async function loadData() {
      try {
        const data = await getAllPatientsRiskRanked(currentUser.uid);
        setPatients(data);
      } catch (err) {
        console.error("Error loading for reports:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentUser]);

  function handlePrint() {
    window.print();
  }

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const ReportView = () => {
    if (selectedPatientId === "all") {
      // Aggregate report
      const totalPatients = patients.length;
      const highRisk = patients.filter(p => p.insights.level === "high").length;
      const avgAdherence = totalPatients ? Math.round(patients.reduce((s, p) => s + p.insights.adherencePercent, 0) / totalPatients) : 0;
      
      return (
        <div id="report-content" style={{ padding: "2rem", background: "white", color: "#0f172a", borderRadius: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)" }}>
          <h2 style={{ borderBottom: "2px solid #e2e8f0", paddingBottom: "1rem", marginBottom: "2rem", fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>Population Adherence Report</h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
            <div style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "#334155" }}>
              <p style={{ margin: "0 0 0.5rem" }}><strong>Generated on:</strong> {new Date().toLocaleDateString()}</p>
              <p style={{ margin: 0 }}><strong>Clinician:</strong> {currentUser.displayName || currentUser.email}</p>
            </div>
            <div style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "#334155" }}>
              <p style={{ margin: "0 0 0.5rem" }}><strong>Total Patients:</strong> {totalPatients}</p>
              <p style={{ margin: "0 0 0.5rem" }}><strong>Average Adherence:</strong> {avgAdherence}%</p>
              <p style={{ margin: 0 }}><strong>High Risk Patients:</strong> {highRisk}</p>
            </div>
          </div>

          <div style={{ width: "100%", overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "#475569" }}>Patient</th>
                  <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "#475569" }}>Risk Level</th>
                  <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "#475569" }}>Adherence</th>
                  <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "#475569" }}>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {patients.map(p => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "0.85rem 1rem", fontWeight: 600, color: "#0f172a" }}>{p.fullName}</td>
                    <td style={{ padding: "0.85rem 1rem", textTransform: "uppercase", fontWeight: 700, color: p.insights.level === "high" ? "#ef4444" : p.insights.level === "medium" ? "#f59e0b" : "#10b981" }}>{p.insights.level}</td>
                    <td style={{ padding: "0.85rem 1rem", fontWeight: 600, color: "#0f172a" }}>{p.insights.adherencePercent}%</td>
                    <td style={{ padding: "0.85rem 1rem", color: "#475569", lineHeight: 1.45 }}>{p.insights.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (!selectedPatient) return null;

    const ins = selectedPatient.insights;
    return (
      <div id="report-content" style={{ padding: "2rem", background: "white", color: "#0f172a", borderRadius: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)" }}>
        <h2 style={{ borderBottom: "2px solid #e2e8f0", paddingBottom: "1rem", marginBottom: "2rem", fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>Patient Adherence Report</h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
          <div style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "#334155" }}>
            <p style={{ margin: "0 0 0.5rem" }}><strong>Patient:</strong> {selectedPatient.fullName}</p>
            <p style={{ margin: 0 }}><strong>DOB:</strong> {selectedPatient.dateOfBirth || "N/A"}</p>
          </div>
          <div style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "#334155" }}>
            <p style={{ margin: "0 0 0.5rem" }}><strong>Generated on:</strong> {new Date().toLocaleDateString()}</p>
            <p style={{ margin: 0 }}><strong>Clinician:</strong> {currentUser.displayName || currentUser.email}</p>
          </div>
        </div>

        <div style={{ marginBottom: "2rem", padding: "1.25rem 1.5rem", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700, color: "#334155" }}>Clinical Summary</h3>
          <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600, color: "#0f172a", lineHeight: 1.5 }}>{ins.summary}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
          <div style={{ padding: "1.1rem", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
            <h4 style={{ margin: "0 0 0.5rem", color: "#64748b", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase" }}>Overall Adherence</h4>
            <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#0f172a" }}>{ins.adherencePercent}%</div>
          </div>
          <div style={{ padding: "1.1rem", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
            <h4 style={{ margin: "0 0 0.5rem", color: "#64748b", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase" }}>Risk Stratification</h4>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, textTransform: "uppercase", color: ins.level === "high" ? "#ef4444" : ins.level === "medium" ? "#f59e0b" : "#10b981" }}>{ins.level}</div>
          </div>
          <div style={{ padding: "1.1rem", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
            <h4 style={{ margin: "0 0 0.5rem", color: "#64748b", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase" }}>Recent Trend</h4>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, textTransform: "capitalize", color: ins.trendDirection === "improving" ? "#10b981" : ins.trendDirection === "declining" ? "#ef4444" : "#475569" }}>{ins.trendDirection}</div>
          </div>
        </div>

        <h3 style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem", marginBottom: "1rem", fontSize: "1.1rem", fontWeight: 700 }}>Weekly Adherence Stats</h3>
        <div style={{ width: "100%", overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: "2rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "#475569" }}>Week</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "#475569" }}>Adherence %</th>
              </tr>
            </thead>
            <tbody>
              {ins.trendData.map((pct, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "0.85rem 1rem", color: "#334155" }}>Week {i + 1} {i === 3 ? "(Most Recent)" : ""}</td>
                  <td style={{ padding: "0.85rem 1rem", fontWeight: 600, color: "#0f172a" }}>{pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {ins.bestDay && ins.worstDay && (
          <div style={{ padding: "1.25rem 1.5rem", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700, color: "#334155" }}>Day of Week Insights</h3>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.92rem", color: "#334155" }}><strong>Best adhering day:</strong> <span style={{ color: "#10b981", fontWeight: 700 }}>{ins.bestDay}</span></p>
            <p style={{ margin: 0, fontSize: "0.92rem", color: "#334155" }}><strong>Lowest adhering day:</strong> <span style={{ color: "#ef4444", fontWeight: 700 }}>{ins.worstDay}</span></p>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-content, #report-content * { visibility: visible; }
          #report-content { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
        }
      `}</style>

      <header className="dash-header no-print">
        <div>
          <h1>Clinical Reports</h1>
          <p className="dash-sub">Export patient adherence and outcome summaries</p>
        </div>
        <div>
          <button onClick={handlePrint} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Download size={18} /> Export as PDF
          </button>
        </div>
      </header>

      <div className="dash-card no-print" style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ margin: "0 0 1rem", color: "var(--text-primary)" }}>Report Configuration</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", fontWeight: "bold", color: "var(--text-muted)" }}>Target Subject</label>
            <div style={{ position: "relative" }}>
              <Users size={16} color="var(--text-muted)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <select 
                value={selectedPatientId} 
                onChange={(e) => setSelectedPatientId(e.target.value)}
                style={{ width: "100%", padding: "0.65rem 1rem 0.65rem 2.2rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text-primary)", outline: "none" }}
              >
                <option value="all">All Patients (Population Report)</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.fullName}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", fontWeight: "bold", color: "var(--text-muted)" }}>Date Range</label>
            <div style={{ position: "relative" }}>
              <Calendar size={16} color="var(--text-muted)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <select disabled style={{ width: "100%", padding: "0.65rem 1rem 0.65rem 2.2rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", opacity: 0.8, outline: "none" }}>
                <option>Last 4 Weeks (Auto-generated)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "1rem", background: "var(--bg-card)", marginBottom: "2rem" }}>
        <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold", textAlign: "center" }}>Report Preview</p>
        {loading ? (
          <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Loading report data...</p>
        ) : (
          <ReportView />
        )}
      </div>
    </>
  );
}
