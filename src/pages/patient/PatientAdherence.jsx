import { useState, useEffect, useMemo } from "react";
import { ref, query, orderByChild, equalTo, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from "recharts";
import { Award, Target, TrendingUp, AlertCircle, Pill } from "lucide-react";
import {
  calculateBestStreak,
  calculateCurrentStreak,
  resolvePatientIdForUser
} from "../../utils/backendData";
import { calculateAdherenceRate as calculateAdherence } from "../../utils/adherenceStats";
import "../../styles/dashboard.css";

const COLORS = {
  taken: "#10b981",
  missed: "#ef4444",
  skipped: "#f59e0b",
  late: "#2563eb"
};

export default function PatientAdherence() {
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    let unsubscribe = null;
    resolvePatientIdForUser(currentUser.uid).then(patientId => {
      const logsRef = ref(db, "adherenceLogs");
      unsubscribe = onValue(logsRef, (snapshot) => {
        const items = [];
        snapshot.forEach((child) => {
          if (child.val().patientId === patientId) {
            items.push({ id: child.key, ...child.val() });
          }
        });
        items.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
        setLogs(items);
        setLoading(false);
      });
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser]);

  const data = useMemo(() => {
    const adherence = calculateAdherence(logs);
    const currentStreak = calculateCurrentStreak(logs);
    const bestStreak = calculateBestStreak(logs);
    const missedLogs = logs.filter(log => log.status === "missed");
    const missedByMed = missedLogs.reduce((acc, log) => {
      const name = log.medicationName || "Medication";
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
    const mostMissed = Object.entries(missedByMed).sort((a, b) => b[1] - a[1])[0];

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split("T")[0];
    });
    const weeklyData = last7Days.map(dateStr => {
      const dayLogs = logs.filter(log => log.scheduledDate === dateStr);
      const { rate } = calculateAdherence(dayLogs);
      return {
        day: new Date(dateStr).toLocaleDateString([], { weekday: "short" }),
        rate
      };
    });

    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthLogs = logs.filter(log => (log.scheduledDate || "").startsWith(thisMonth));
    const monthlyCounts = ["taken", "missed", "skipped", "late"].map(status => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      status,
      value: monthLogs.filter(log => log.status === status).length,
      color: COLORS[status]
    })).filter(item => item.value > 0);

    const trendData = Array.from({ length: 8 }, (_, i) => {
      const end = new Date();
      end.setDate(end.getDate() - ((7 - i) * 7));
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      const weekLogs = logs.filter(log => {
        const d = new Date(log.scheduledDate);
        return d >= start && d <= end;
      });
      return {
        week: "W" + (i + 1),
        rate: calculateAdherence(weekLogs).rate
      };
    });

    return {
      adherence,
      currentStreak,
      bestStreak,
      totalMissed: missedLogs.length,
      mostMissedName: mostMissed ? mostMissed[0] : "None",
      mostMissedCount: mostMissed ? mostMissed[1] : 0,
      weeklyData,
      monthlyCounts: monthlyCounts.length ? monthlyCounts : [{ name: "No logs", status: "none", value: 1, color: "#cbd5e1" }],
      trendData
    };
  }, [logs]);

  if (loading) return <div className="loading-state">Loading adherence data...</div>;

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Adherence Insights</h1>
          <p className="dash-sub">Track your progress and compliance streaks</p>
        </div>
      </header>

      {logs.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <TrendingUp size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
          <h2 style={{ color: 'var(--text-primary)' }}>No data available yet</h2>
          <p style={{ color: 'var(--text-muted)' }}>Check off some medications to start tracking your adherence.</p>
        </div>
      ) : (
        <>
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: '2rem' }}>
            <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Target size={32} color="#6c63ff" style={{ marginBottom: '0.5rem' }} />
              <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Overall Adherence</h3>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{data.adherence.rate}%</span>
            </div>
            <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Award size={32} color="#f59e0b" style={{ marginBottom: '0.5rem' }} />
              <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Current Streak</h3>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{data.currentStreak}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Best: {data.bestStreak}</span>
            </div>
            <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <AlertCircle size={32} color="#ef4444" style={{ marginBottom: '0.5rem' }} />
              <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Missed Doses</h3>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{data.totalMissed}</span>
            </div>
            <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Pill size={32} color="#2563eb" style={{ marginBottom: '0.5rem' }} />
              <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Most Missed</h3>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.5rem' }}>{data.mostMissedName}</span>
              {data.mostMissedCount > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Missed {data.mostMissedCount} times</span>}
            </div>
          </div>

          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            <div className="dash-card">
              <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Last 7 Days</h3>
              <div style={{ height: 280, width: '100%' }}>
                <ResponsiveContainer>
                  <BarChart data={data.weeklyData}>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={(v) => v + "%"} />
                    <Tooltip formatter={(value) => [value + "%", "Adherence"]} />
                    <Bar dataKey="rate" radius={[8, 8, 8, 8]} isAnimationActive>
                      {data.weeklyData.map((entry, index) => (
                        <Cell key={"bar-" + index} fill={entry.rate >= 90 ? "#10b981" : entry.rate >= 70 ? "#2563eb" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="dash-card">
              <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>This Month</h3>
              <div style={{ height: 280, position: "relative" }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.monthlyCounts} dataKey="value" innerRadius={70} outerRadius={100} paddingAngle={4} isAnimationActive>
                      {data.monthlyCounts.map((entry, index) => <Cell key={"pie-" + index} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", flexDirection: "column" }}>
                  <strong style={{ fontSize: "1.75rem", color: "var(--text-primary)" }}>{data.adherence.rate}%</strong>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>overall</span>
                </div>
              </div>
            </div>

            <div className="dash-card" style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>8 Week Trend</h3>
              <div style={{ height: 300, width: '100%' }}>
                <ResponsiveContainer>
                  <LineChart data={data.trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="week" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => v + "%"} />
                    <Tooltip formatter={(value) => [value + "%", "Adherence"]} />
                    <Line type="monotone" dataKey="rate" stroke="#2563eb" strokeWidth={3} dot={{ r: 5, fill: '#2563eb' }} activeDot={{ r: 8 }} isAnimationActive />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
