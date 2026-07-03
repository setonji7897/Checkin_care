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
        <div id="report-content" style={{ padding: "2rem", background: "white", color: "black", borderRadius: 12 }}>
          <h2 style={{ borderBottom: "2px solid #e2e8f0", paddingBottom: "1rem", marginBottom: "2rem" }}>Population Adherence Report</h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
            <div>
              <p><strong>Generated on:</strong> {new Date().toLocaleDateString()}</p>
              <p><strong>Clinician:</strong> {currentUser.displayName || currentUser.email}</p>
            </div>
            <div>
              <p><strong>Total Patients:</strong> {totalPatients}</p>
              <p><strong>Average Adherence:</strong> {avgAdherence}%</p>
              <p><strong>High Risk Patients:</strong> {highRisk}</p>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1", textAlign: "left" }}>
                <th style={{ padding: "0.75rem" }}>Patient</th>
                <th style={{ padding: "0.75rem" }}>Risk Level</th>
                <th style={{ padding: "0.75rem" }}>Adherence</th>
                <th style={{ padding: "0.75rem" }}>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {patients.map(p => (
                <tr key={p.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "0.75rem", fontWeight: 600 }}>{p.fullName}</td>
                  <td style={{ padding: "0.75rem", textTransform: "uppercase" }}>{p.insights.level}</td>
                  <td style={{ padding: "0.75rem" }}>{p.insights.adherencePercent}%</td>
                  <td style={{ padding: "0.75rem", fontSize: "0.85rem", color: "#475569" }}>{p.insights.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (!selectedPatient) return null;

    const ins = selectedPatient.insights;
    return (
      <div id="report-content" style={{ padding: "2rem", background: "white", color: "black", borderRadius: 12 }}>
        <h2 style={{ borderBottom: "2px solid #e2e8f0", paddingBottom: "1rem", marginBottom: "2rem" }}>Patient Adherence Report</h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
          <div>
            <p><strong>Patient:</strong> {selectedPatient.fullName}</p>
            <p><strong>DOB:</strong> {selectedPatient.dateOfBirth || "N/A"}</p>
          </div>
          <div>
            <p><strong>Generated on:</strong> {new Date().toLocaleDateString()}</p>
            <p><strong>Clinician:</strong> {currentUser.displayName || currentUser.email}</p>
          </div>
        </div>

        <div style={{ marginBottom: "2rem", padding: "1.5rem", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 1rem" }}>Clinical Summary</h3>
          <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>{ins.summary}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
          <div style={{ padding: "1rem", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            <h4 style={{ margin: "0 0 0.5rem", color: "#64748b" }}>Overall Adherence</h4>
            <div style={{ fontSize: "2rem", fontWeight: 800 }}>{ins.adherencePercent}%</div>
          </div>
          <div style={{ padding: "1rem", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            <h4 style={{ margin: "0 0 0.5rem", color: "#64748b" }}>Risk Stratification</h4>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, textTransform: "uppercase" }}>{ins.level}</div>
          </div>
          <div style={{ padding: "1rem", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            <h4 style={{ margin: "0 0 0.5rem", color: "#64748b" }}>Recent Trend</h4>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, textTransform: "capitalize" }}>{ins.trendDirection}</div>
          </div>
        </div>

        <h3 style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem", marginBottom: "1rem" }}>Weekly Adherence Stats</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "2rem" }}>
          <thead>
            <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
              <th style={{ padding: "0.75rem" }}>Week</th>
              <th style={{ padding: "0.75rem" }}>Adherence %</th>
            </tr>
          </thead>
          <tbody>
            {ins.trendData.map((pct, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "0.75rem" }}>Week {i + 1} (Recent)</td>
                <td style={{ padding: "0.75rem" }}>{pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        {ins.bestDay && ins.worstDay && (
          <div>
            <h3 style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem", marginBottom: "1rem" }}>Day of Week Insights</h3>
            <p><strong>Best adhering day:</strong> {ins.bestDay}</p>
            <p><strong>Lowest adhering day:</strong> {ins.worstDay}</p>
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

      <header className="dash-header">
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

      <div className="dash-card" style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ margin: "0 0 1rem", color: "var(--text-primary)" }}>Report Configuration</h3>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", fontWeight: "bold", color: "var(--text-muted)" }}>Target Subject</label>
            <div style={{ position: "relative" }}>
              <Users size={16} color="#64748b" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
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
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", fontWeight: "bold", color: "var(--text-muted)" }}>Date Range</label>
            <div style={{ position: "relative" }}>
              <Calendar size={16} color="#64748b" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <select disabled style={{ width: "100%", padding: "0.65rem 1rem 0.65rem 2.2rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", opacity: 0.8, outline: "none" }}>
                <option>Last 4 Weeks (Auto-generated)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "1rem", background: "#f1f5f9" }}>
        <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#64748b", textTransform: "uppercase", fontWeight: "bold", textAlign: "center" }}>Report Preview</p>
        {loading ? (
          <p style={{ textAlign: "center", color: "#64748b" }}>Loading report data...</p>
        ) : (
          <ReportView />
        )}
      </div>
    </>
  );
}