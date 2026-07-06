import { useState, useEffect, useMemo } from "react";
import { BarChart3, AlertCircle, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import { getAllPatientsRiskRanked } from "../../services/patientInsightService";
import { useAuth } from "../../contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import "../../styles/dashboard.css";

export default function ClinicianAnalytics() {
  const { currentUser } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    async function loadData() {
      try {
        const data = await getAllPatientsRiskRanked(currentUser.uid);
        setPatients(data);
      } catch (err) {
        console.error("Error loading analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentUser]);

  // Aggregate Population Data
  const { populationTrend, populationDow, avgAdherence } = useMemo(() => {
    if (!patients.length) return { populationTrend: [], populationDow: [], avgAdherence: 0 };
    
    // Trend (weekly average across all patients)
    const trendAcc = [0, 0, 0, 0];
    let validPatients = 0;
    
    let totalAdherence = 0;

    patients.forEach(p => {
      if (p.insights && p.insights.trendData) {
        p.insights.trendData.forEach((pct, i) => { trendAcc[i] += pct; });
        validPatients++;
        totalAdherence += p.insights.adherencePercent;
      }
    });

    const popTrend = trendAcc.map((val, i) => ({
      week: "W" + (i + 1),
      adherence: validPatients ? Math.round(val / validPatients) : 0
    }));

    // Aggregate DOW
    const dowAcc = { "Mon": 0, "Tue": 0, "Wed": 0, "Thu": 0, "Fri": 0, "Sat": 0, "Sun": 0 };
    const dowTotals = { "Mon": 0, "Tue": 0, "Wed": 0, "Thu": 0, "Fri": 0, "Sat": 0, "Sun": 0 };
    
    patients.forEach(p => {
      if (p.insights && p.insights.dailyBars) {
        p.insights.dailyBars.forEach(d => {
          // 'd.day' is short format like 'Mon', 'Tue'
          if (dowAcc[d.day] !== undefined) {
            dowAcc[d.day] += d.taken;
            dowTotals[d.day] += d.total;
          }
        });
      }
    });

    const popDow = Object.keys(dowAcc).map(day => ({
      day,
      adherence: dowTotals[day] ? Math.round((dowAcc[day] / dowTotals[day]) * 100) : 0
    }));

    return { 
      populationTrend: popTrend, 
      populationDow: popDow,
      avgAdherence: validPatients ? Math.round(totalAdherence / validPatients) : 0
    };
  }, [patients]);

  const getRiskColor = (level) => {
    switch (level) {
      case "high": return "#ef4444";
      case "medium": return "#f59e0b";
      case "low": return "#10b981";
      default: return "var(--text-muted)";
    }
  };

  const getTrendIcon = (dir) => {
    if (dir === "improving") return <TrendingUp size={16} color="#10b981" />;
    if (dir === "declining") return <TrendingDown size={16} color="#ef4444" />;
    return <Minus size={16} color="var(--text-muted)" />;
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <Loader2 size={32} className="spin" color="#4f46e5" />
      </div>
    );
  }

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Analytics & Insights</h1>
          <p className="dash-sub">Population health trends and risk stratification</p>
        </div>
      </header>

      {/* Aggregate Stats */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: "1.5rem" }}>
        <div className="dash-card">
          <h3 style={{ margin: "0 0 1rem", fontSize: "0.95rem", color: "var(--text-muted)" }}>Population Adherence</h3>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--text-primary)" }}>{avgAdherence}%</span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Avg across {patients.length} patients</span>
          </div>
          <div style={{ height: 120, marginTop: "1rem" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={populationTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--text-muted)" }} dy={5}/>
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                <Line type="monotone" dataKey="adherence" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dash-card">
          <h3 style={{ margin: "0 0 1rem", fontSize: "0.95rem", color: "var(--text-muted)" }}>Adherence by Day of Week</h3>
          <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>Average daily success rates</p>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={populationDow} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--text-muted)" }} dy={5}/>
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Tooltip cursor={{ fill: "rgba(79,70,229,0.05)" }} contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                <Bar dataKey="adherence" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Patient Risk List */}
      <div className="dash-card">
        <h3 style={{ margin: "0 0 1.5rem", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={20} color="#f59e0b" /> Risk-Stratified Patients
        </h3>
        
        {patients.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No patients assigned.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "0.75rem 0.5rem" }}>Patient</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Risk Level</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Adherence</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Trend (4w)</th>
                <th style={{ padding: "0.75rem 0.5rem", width: "40%" }}>Insight</th>
              </tr>
            </thead>
            <tbody>
              {patients.map(p => {
                const ins = p.insights;
                const sparklineData = ins.trendData.map((val, i) => ({ w: i, val }));
                
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "1rem 0.5rem", fontWeight: 600 }}>
                      <Link to={`/clinician/patients/${p.id}`} style={{ color: "#4f46e5", textDecoration: "none" }}>
                        {p.fullName}
                      </Link>
                    </td>
                    <td style={{ padding: "1rem 0.5rem" }}>
                      <span style={{ 
                        padding: "4px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase",
                        background: getRiskColor(ins.level) + "20", color: getRiskColor(ins.level)
                      }}>
                        {ins.level} Risk
                      </span>
                    </td>
                    <td style={{ padding: "1rem 0.5rem", fontWeight: 700 }}>
                      {ins.adherencePercent}%
                    </td>
                    <td style={{ padding: "1rem 0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {getTrendIcon(ins.trendDirection)}
                        <div style={{ width: 60, height: 24 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={sparklineData}>
                              <Line type="monotone" dataKey="val" stroke={getRiskColor(ins.level)} strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "1rem 0.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      {ins.summary}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
