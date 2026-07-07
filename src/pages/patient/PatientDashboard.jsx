// src/pages/patient/PatientDashboard.jsx
//
// Premium patient dashboard with:
//  â€¢ Top stat cards (adherence rate, today's doses, streak, missed this week)
//  â€¢ Weekly adherence section: summary cards, stacked bar chart, trend line, insights
//  â€¢ Next dose countdown
//  All data computed client-side from adherenceLogs (no Cloud Functions required).

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  TrendingUp, Pill, Flame, AlertCircle, CheckCircle2,
  XCircle, SkipForward, Lightbulb, BarChart3, ArrowUpRight, ArrowDownRight, Minus, Users
} from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { calculateAdherenceRate } from "../../utils/adherenceStats";
import { useTodaySchedule } from "../../hooks/useTodaySchedule";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
  PieChart, Pie, Cell
} from "recharts";
import "../../styles/dashboard.css";

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function useCountUp(end, duration) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let raf = 0, start = null;
    const dur = duration || 1400;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setCount(Math.floor(eased * Number(end || 0)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [end, duration]);
  return count;
}

function dateStr(d) { return d.toISOString().split("T")[0]; }

function getWeekRange(weeksAgo) {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() - weeksAgo * 7);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { start: dateStr(start), end: dateStr(end) };
}

function dayLabel(ds) {
  return new Date(ds + "T12:00:00").toLocaleDateString([], { weekday: "short" });
}

// â”€â”€ Stacked bar tooltip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StackedTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "0.75rem 1rem", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      minWidth: 140, fontSize: "0.82rem"
    }}>
      <p style={{ margin: "0 0 0.5rem", fontWeight: 800, color: "var(--text-primary)" }}>{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: 2 }}>
          <span style={{ color: p.color, fontWeight: 700 }}>{p.name}</span>
          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{p.value}</span>
        </div>
      ))}
      <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4, display: "flex", justifyContent: "space-between", fontWeight: 800, color: "var(--text-primary)" }}>
        <span>Total</span><span>{total}</span>
      </div>
    </div>
  );
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "0.5rem 0.75rem", boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
      fontSize: "0.82rem"
    }}>
      <p style={{ margin: 0, fontWeight: 700, color: "var(--text-primary)" }}>
        {payload[0].payload.label}: <span style={{ color: "#6366f1" }}>{payload[0].value}%</span>
      </p>
    </div>
  );
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function PatientDashboard() {
  const { currentUser, userData } = useAuth();
  const [time, setTime] = useState(new Date());
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { resolvedPatientId, todayDoses, todayLogs } = useTodaySchedule(currentUser);

  useEffect(() => {
    if (!resolvedPatientId) return;
    const unsub = onValue(ref(db, "adherenceLogs"), snap => {
      const list = [];
      snap.forEach(child => {
        const val = child.val();
        if (val.patientId === resolvedPatientId) list.push({ id: child.key, ...val });
      });
      setLogs(list);
    });
    return () => unsub();
  }, [resolvedPatientId]);

  // â”€â”€ Today stats from shared hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const todayStats = useMemo(() => {
    let taken = 0, missed = 0;
    todayDoses.forEach(dose => {
      const s = todayLogs[dose.medicationId + "_" + dose.scheduledTime]?.status;
      if (s === "taken") taken++;
      if (s === "missed") missed++;
    });
    return { total: todayDoses.length, taken, missed };
  }, [todayDoses, todayLogs]);

  // â”€â”€ Next dose â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const nextDose = useMemo(() => {
    const currentMins = time.getHours() * 60 + time.getMinutes();
    return todayDoses.find(dose => {
      const log = todayLogs[dose.medicationId + "_" + dose.scheduledTime];
      if (log) return false;
      const [h, m] = (dose.scheduledTime || "00:00").split(":").map(Number);
      return (h * 60 + m) > currentMins;
    }) || null;
  }, [todayDoses, todayLogs, time]);

  // â”€â”€ Full stats computation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const stats = useMemo(() => {
    const actionable = logs.filter(l => l.status === "taken" || l.status === "missed" || l.status === "skipped");

    // Overall adherence
    const { rate: adherenceRate } = calculateAdherenceRate(logs) || { rate: 0 };

    // Streak
    let streak = 0;
    const checkDate = new Date();
    for (let i = 0; i < 365; i++) {
      const d = dateStr(checkDate);
      if (logs.filter(l => l.scheduledDate === d && l.status === "taken").length === 0) break;
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Missed this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const missedThisWeek = actionable.filter(l =>
      l.status === "missed" && new Date(l.scheduledDate + "T00:00:00") >= weekStart
    ).length;

    // â”€â”€ WEEKLY ADHERENCE SECTION DATA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // This week & last week ranges
    const thisWeek = getWeekRange(0);
    const lastWeek = getWeekRange(1);

    function weekCounts(start, end) {
      const wLogs = actionable.filter(l => l.scheduledDate >= start && l.scheduledDate <= end);
      const taken = wLogs.filter(l => l.status === "taken").length;
      const missed = wLogs.filter(l => l.status === "missed").length;
      const skipped = wLogs.filter(l => l.status === "skipped").length;
      const total = taken + missed + skipped;
      return { taken, missed, skipped, total, pct: total > 0 ? Math.round((taken / total) * 100) : 0 };
    }

    const tw = weekCounts(thisWeek.start, thisWeek.end);
    const lw = weekCounts(lastWeek.start, lastWeek.end);

    const weekSummary = {
      taken:   { count: tw.taken,   pct: tw.total > 0 ? Math.round((tw.taken / tw.total) * 100) : 0,   diff: tw.taken - lw.taken },
      missed:  { count: tw.missed,  pct: tw.total > 0 ? Math.round((tw.missed / tw.total) * 100) : 0,  diff: tw.missed - lw.missed },
      skipped: { count: tw.skipped, pct: tw.total > 0 ? Math.round((tw.skipped / tw.total) * 100) : 0, diff: tw.skipped - lw.skipped },
    };

    // Stacked daily bar chart (last 7 days)
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return dateStr(d);
    });
    const dailyBars = last7.map(ds => {
      const dayLogs = actionable.filter(l => l.scheduledDate === ds);
      return {
        day: dayLabel(ds),
        date: ds,
        taken:   dayLogs.filter(l => l.status === "taken").length,
        missed:  dayLogs.filter(l => l.status === "missed").length,
        skipped: dayLogs.filter(l => l.status === "skipped").length,
        total:   dayLogs.length
      };
    });

    // 4-week trend line
    const trendData = Array.from({ length: 4 }, (_, i) => {
      const w = getWeekRange(3 - i);
      const c = weekCounts(w.start, w.end);
      return { label: "W" + (i + 1), adherence: c.pct };
    });

    // Trend direction
    let trendDirection = "stable";
    if (trendData.length >= 2) {
      const recent = trendData.slice(-2).reduce((s, d) => s + d.adherence, 0) / 2;
      const older  = trendData.slice(0, 2).reduce((s, d) => s + d.adherence, 0) / 2;
      if (recent > older + 5) trendDirection = "improving";
      else if (recent < older - 5) trendDirection = "declining";
    }

    // â”€â”€ Insights â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const insights = [];

    // Best & worst day this week
    const daysWithLogs = dailyBars.filter(d => d.total > 0);
    if (daysWithLogs.length > 0) {
      const best  = daysWithLogs.reduce((a, b) => ((a.taken / a.total) >= (b.taken / b.total) ? a : b));
      const worst = daysWithLogs.reduce((a, b) => ((a.taken / a.total) <= (b.taken / b.total) ? a : b));
      const bestPct  = Math.round((best.taken / best.total) * 100);
      const worstPct = Math.round((worst.taken / worst.total) * 100);

      insights.push({
        icon: "ðŸ†",
        text: "Best day: " + best.day + " (" + bestPct + "% — " + best.taken + " taken)",
        type: "positive"
      });
      if (worst.day !== best.day) {
        insights.push({
          icon: "âš ï¸",
          text: "Worst day: " + worst.day + " (" + worstPct + "% — " + worst.missed + " missed, " + worst.skipped + " skipped)",
          type: "warning"
        });
      }
    }

    // Day-of-week pattern detection (using all logs)
    const dowStats = {};
    actionable.forEach(l => {
      const dow = dayLabel(l.scheduledDate);
      if (!dowStats[dow]) dowStats[dow] = { taken: 0, total: 0 };
      dowStats[dow].total++;
      if (l.status === "taken") dowStats[dow].taken++;
    });
    const weakDays = Object.entries(dowStats)
      .filter(([, s]) => s.total >= 3 && (s.taken / s.total) < 0.5)
      .map(([day]) => day);

    if (weakDays.length > 0) {
      insights.push({
        icon: "ðŸ“Š",
        text: "Pattern: Lower adherence on " + weakDays.join(" & "),
        type: "info"
      });
      insights.push({
        icon: "💡",
        text: "Recommendation: Set a phone alarm for " + weakDays[0] + " mornings",
        type: "tip"
      });
    }

    // Time-of-day pattern
    const morningMissed = actionable.filter(l => {
      if (l.status !== "missed" || !l.scheduledTime) return false;
      const h = parseInt(l.scheduledTime.split(":")[0], 10);
      return h < 10;
    }).length;
    const totalMissed = actionable.filter(l => l.status === "missed").length;
    if (totalMissed > 3 && morningMissed / totalMissed > 0.5) {
      insights.push({
        icon: "ðŸŒ…",
        text: "You miss morning doses (before 10 AM) more often — consider rescheduling",
        type: "tip"
      });
    }

    // Monthly pie
    const thisMonthStr = new Date().toISOString().slice(0, 7);
    const monthLogs    = actionable.filter(l => (l.scheduledDate || "").startsWith(thisMonthStr));
    const monthTaken   = monthLogs.filter(l => l.status === "taken").length;
    const monthMissed  = monthLogs.filter(l => l.status === "missed").length;
    const monthSkipped = monthLogs.filter(l => l.status === "skipped").length;
    const monthPct     = monthLogs.length > 0 ? Math.round((monthTaken / monthLogs.length) * 100) : 0;

    return {
      adherenceRate: adherenceRate || 0,
      streak,
      missedThisWeek,
      weekSummary,
      dailyBars,
      trendData,
      trendDirection,
      insights,
      monthPct,
      pieData: [
        { name: "Taken",   value: monthTaken,   color: "#10B981" },
        { name: "Missed",  value: monthMissed,  color: "#EF4444" },
        { name: "Skipped", value: monthSkipped, color: "#F59E0B" }
      ].filter(item => item.value > 0)
    };
  }, [logs]);

  // â”€â”€ Animated counts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const countAdherence = useCountUp(stats.adherenceRate, 1400);
  const countStreak    = useCountUp(stats.streak, 900);
  const countMissed    = useCountUp(stats.missedThisWeek, 700);
  const countMonth     = useCountUp(stats.monthPct, 1200);

  // â”€â”€ Countdown to next dose â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const nextDoseTime = nextDose ? (() => {
    const d = new Date();
    const [h, m] = (nextDose.scheduledTime || "00:00").split(":").map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  })() : null;
  const diff = nextDoseTime ? Math.max(0, Math.floor((nextDoseTime - time) / 1000)) : 0;
  const hrs  = Math.floor(diff / 3600).toString().padStart(2, "0");
  const mns  = Math.floor((diff % 3600) / 60).toString().padStart(2, "0");
  const scs  = (diff % 60).toString().padStart(2, "0");
  const nextDoseName = nextDose ? (nextDose.medicationName || "Medication") : null;

  const today   = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const greeting = time.getHours() < 12 ? "Good morning" : time.getHours() < 18 ? "Good afternoon" : "Good evening";
  const pieData  = stats.pieData.length ? stats.pieData : [{ name: "No logs", value: 1, color: "var(--border)" }];

  // Summary card helper
  function TrendBadge({ diff, invert }) {
    const improved = invert ? diff < 0 : diff > 0;
    const same = diff === 0;
    const color = same ? "var(--text-muted)" : improved ? "#10b981" : "#ef4444";
    const Icon = same ? Minus : improved ? ArrowUpRight : ArrowDownRight;
    const text = same ? "Same as last week" : (Math.abs(diff) + (improved ? " â†‘" : " â†“") + " vs last week");
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.76rem", fontWeight: 700, color, marginTop: 4 }}>
        <Icon size={13} /> {text}
      </div>
    );
  }

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="page-transition-enter">
      <header className="dash-header">
        <div>
          <h1>{greeting}, {userData ? userData.firstName || "Patient" : "Patient"}</h1>
          <p className="dash-sub">{today} · Here's your health overview</p>
        </div>
      </header>

      {/* â•â•â• TOP STAT CARDS â•â•â• */}
      <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="dash-card wave-3-card" style={{ animationDelay: "200ms" }}>
          <div style={{ padding: "0.75rem", background: "#eff6ff", borderRadius: 12, width: "max-content", marginBottom: "1rem", color: "#2563eb" }}><TrendingUp size={24} /></div>
          <p style={{ margin: "0 0 0.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>Adherence rate</p>
          <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--text-primary)" }}>{countAdherence}%</div>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.85rem" }}>All logged doses</p>
        </div>
        <div className="dash-card wave-3-card" style={{ animationDelay: "260ms" }}>
          <div style={{ padding: "0.75rem", background: "#ecfdf5", borderRadius: 12, width: "max-content", marginBottom: "1rem", color: "#10b981" }}><Pill size={24} /></div>
          <p style={{ margin: "0 0 0.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>Today's doses</p>
          <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--text-primary)" }}>{todayStats.taken}/{todayStats.total}</div>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.85rem" }}>{Math.max(todayStats.total - todayStats.taken, 0)} remaining</p>
        </div>
        <div className="dash-card wave-3-card" style={{ animationDelay: "320ms" }}>
          <div style={{ padding: "0.75rem", background: "#fef3c7", borderRadius: 12, width: "max-content", marginBottom: "1rem", color: "#f59e0b" }}><Flame size={24} /></div>
          <p style={{ margin: "0 0 0.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>Current streak</p>
          <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--text-primary)" }}>{countStreak} <span style={{ fontSize: "1.25rem" }}>days</span></div>
          <p style={{ margin: 0, color: "#10b981", fontSize: "0.85rem" }}>days in a row</p>
        </div>
        <div className="dash-card wave-3-card" style={{ animationDelay: "380ms" }}>
          <div style={{ padding: "0.75rem", background: "#fee2e2", borderRadius: 12, width: "max-content", marginBottom: "1rem", color: "#ef4444" }}><AlertCircle size={24} /></div>
          <p style={{ margin: "0 0 0.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>Missed this week</p>
          <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--text-primary)" }}>{countMissed}</div>
          <p style={{ margin: 0, color: "#ef4444", fontSize: "0.85rem" }}>Last 7 days</p>
        </div>
      </div>

      {/* â•â•â• WEEKLY ADHERENCE SECTION â•â•â• */}
      <Link
        to="/care-triangle"
        className="dash-card wave-3-card"
        style={{
          marginBottom: "1.5rem",
          padding: "1rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          textDecoration: "none",
          background: "linear-gradient(135deg, rgba(13,148,136,0.1), rgba(37,99,235,0.08))",
          border: "1px solid rgba(13,148,136,0.22)",
          animationDelay: "410ms"
        }}
      >
        <div style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          background: "#f0fdfa",
          color: "#0d9488",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0
        }}>
          <Users size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "var(--text-primary)", fontSize: "1rem", fontWeight: 800 }}>
            Care Triangle
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.86rem", marginTop: 2 }}>
            Open the shared room with your caregiver and clinician.
          </div>
        </div>
        <span style={{ color: "#2563eb", fontWeight: 800, fontSize: "0.85rem", whiteSpace: "nowrap" }}>
          Open room
        </span>
      </Link>

      <div className="dash-card wave-3-card" style={{ animationDelay: "440ms", marginBottom: "1.5rem", padding: "1.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <BarChart3 size={20} color="#6366f1" />
            <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.15rem" }}>Weekly Adherence</h3>
          </div>
          <Link to="/patient/history" style={{ color: "#6366f1", textDecoration: "none", fontSize: "0.85rem", fontWeight: 700 }}>View full report →</Link>
        </div>

        {/* â”€â”€ Summary cards â”€â”€ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.85rem", marginBottom: "1.75rem" }}>
          {/* Taken */}
          <div style={{
            background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.04))",
            border: "1.5px solid rgba(16,185,129,0.25)",
            borderRadius: 16, padding: "1.1rem", textAlign: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}>
              <CheckCircle2 size={16} color="#10b981" />
              <span style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#10b981" }}>Taken</span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#065f46", lineHeight: 1 }}>{stats.weekSummary.taken.count}</div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 700, margin: "4px 0" }}>{stats.weekSummary.taken.pct}%</div>
            <TrendBadge diff={stats.weekSummary.taken.diff} />
          </div>
          {/* Missed */}
          <div style={{
            background: "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(153,27,27,0.03))",
            border: "1.5px solid rgba(239,68,68,0.25)",
            borderRadius: 16, padding: "1.1rem", textAlign: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}>
              <XCircle size={16} color="#ef4444" />
              <span style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ef4444" }}>Missed</span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#7f1d1d", lineHeight: 1 }}>{stats.weekSummary.missed.count}</div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 700, margin: "4px 0" }}>{stats.weekSummary.missed.pct}%</div>
            <TrendBadge diff={stats.weekSummary.missed.diff} invert />
          </div>
          {/* Skipped */}
          <div style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(180,83,9,0.03))",
            border: "1.5px solid rgba(245,158,11,0.25)",
            borderRadius: 16, padding: "1.1rem", textAlign: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}>
              <SkipForward size={16} color="#f59e0b" />
              <span style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#f59e0b" }}>Skipped</span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#92400e", lineHeight: 1 }}>{stats.weekSummary.skipped.count}</div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 700, margin: "4px 0" }}>{stats.weekSummary.skipped.pct}%</div>
            <TrendBadge diff={stats.weekSummary.skipped.diff} invert />
          </div>
        </div>

        {/* â”€â”€ Stacked daily bar chart â”€â”€ */}
        <div style={{ marginBottom: "1.75rem" }}>
          <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.82rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Daily breakdown (last 7 days)</h4>
          <div style={{ height: 220, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.dailyBars} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
                <Tooltip cursor={{ fill: "rgba(99,102,241,0.06)" }} content={<StackedTooltip />} />
                <Bar dataKey="taken"   stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="Taken"   isAnimationActive animationDuration={600} animationBegin={400} />
                <Bar dataKey="skipped" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} name="Skipped" isAnimationActive animationDuration={600} animationBegin={500} />
                <Bar dataKey="missed"  stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="Missed"  isAnimationActive animationDuration={600} animationBegin={600} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div style={{ display: "flex", gap: "1.25rem", justifyContent: "center", marginTop: "0.5rem" }}>
            {[{ label: "Taken", color: "#10b981" }, { label: "Missed", color: "#ef4444" }, { label: "Skipped", color: "#f59e0b" }].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 700 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>

        {/* â”€â”€ 4-week trend line â”€â”€ */}
        <div style={{ marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <h4 style={{ margin: 0, fontSize: "0.82rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Adherence trend (4 weeks)</h4>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "0.3rem 0.7rem", borderRadius: 999,
              fontSize: "0.73rem", fontWeight: 800,
              background: stats.trendDirection === "improving" ? "rgba(16,185,129,0.1)" : stats.trendDirection === "declining" ? "rgba(239,68,68,0.1)" : "rgba(107,114,128,0.1)",
              color: stats.trendDirection === "improving" ? "#10b981" : stats.trendDirection === "declining" ? "#ef4444" : "var(--text-muted)"
            }}>
              {stats.trendDirection === "improving" ? "📈 Improving" : stats.trendDirection === "declining" ? "📉 Declining" : "âž¡ï¸ Stable"}
            </span>
          </div>
          <div style={{ height: 180, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} dy={8} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickFormatter={v => v + "%"} />
                <Tooltip content={<TrendTooltip />} />
                <Line
                  type="monotone" dataKey="adherence" stroke="#6366f1" strokeWidth={3}
                  dot={{ r: 5, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: "#6366f1" }}
                  isAnimationActive animationDuration={1200} animationBegin={800}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* â”€â”€ Insights box â”€â”€ */}
        {stats.insights.length > 0 && (
          <div style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(37,99,235,0.04))",
            border: "1.5px solid rgba(99,102,241,0.2)",
            borderRadius: 16, padding: "1.25rem"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.85rem" }}>
              <Lightbulb size={18} color="#6366f1" />
              <h4 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 800, color: "#6366f1" }}>Insights & Recommendations</h4>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
              {stats.insights.map((ins, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: "0.6rem",
                  padding: "0.6rem 0.85rem", borderRadius: 12,
                  background: ins.type === "positive" ? "rgba(16,185,129,0.08)" :
                              ins.type === "warning"  ? "rgba(239,68,68,0.06)" :
                              ins.type === "tip"      ? "rgba(245,158,11,0.06)" : "rgba(99,102,241,0.06)",
                  fontSize: "0.84rem", color: "var(--text-primary)", fontWeight: 600, lineHeight: 1.45
                }}>
                  <span style={{ flexShrink: 0, fontSize: "1rem" }}>{ins.icon}</span>
                  <span>{ins.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* â•â•â• BOTTOM ROW: NEXT DOSE + THIS MONTH â•â•â• */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        {/* Next dose */}
        <div className="dash-card wave-3-card" style={{ animationDelay: "500ms", background: "linear-gradient(135deg, #1e3a8a, #2563eb)", color: "white", border: "none" }}>
          <h4 style={{ margin: "0 0 1rem", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.75)" }}>NEXT DOSE</h4>
          {nextDose ? (
            <>
              <div style={{ fontSize: "2.5rem", fontWeight: 800, fontFamily: "monospace", lineHeight: 1, marginBottom: "0.75rem" }}>
                {hrs}:{mns}:{scs}
              </div>
              <p style={{ margin: "0 0 0.25rem", fontWeight: 500, fontSize: "0.95rem" }}>{nextDoseName} · {nextDose.dosage}</p>
              <p style={{ margin: "0 0 1.5rem", fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>{nextDose.foodInstruction || "Follow label instructions"}</p>
              <Link to="/patient/schedule" className="btn-primary" style={{ width: "100%", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.25)", textDecoration: "none" }}>
                Open Schedule
              </Link>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: "1rem", lineHeight: 1.5 }}>All doses complete for today. âœ…</p>
          )}
        </div>

        {/* This month */}
        <div className="dash-card wave-3-card" style={{ animationDelay: "550ms" }}>
          <h3 style={{ margin: "0 0 1rem", color: "var(--text-primary)" }}>This month</h3>
          <div style={{ height: 160, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius={52} outerRadius={72} paddingAngle={4} dataKey="value" stroke="none" isAnimationActive animationDuration={1200} animationBegin={600}>
                  {pieData.map((entry, index) => (<Cell key={"pie-" + index} fill={entry.color} />))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none" }}>
              <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>{countMonth}%</span>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>adherence</p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.75rem" }}>
            {pieData.map((item) => (
              <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
                  <span style={{ color: "var(--text-muted)" }}>{item.name}</span>
                </div>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
