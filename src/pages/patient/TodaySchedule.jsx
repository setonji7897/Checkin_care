// src/pages/patient/TodaySchedule.jsx
//
// Premium timeline schedule — uses shared useTodaySchedule hook so the
// dose list is ALWAYS identical to what the Dashboard sees.

import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, CheckCircle2, Clock3, Loader2,
  Pill, Plus, Sparkles, SkipForward, TimerReset
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { logAdherence } from "../../utils/adherenceLogger";
import { useTodaySchedule } from "../../hooks/useTodaySchedule";
import "../../styles/dashboard.css";

// â”€â”€ Status display config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STATUS_META = {
  upcoming: {
    label: "Upcoming", icon: Clock3,
    color: "#6366f1", glow: "rgba(99,102,241,0.3)",
    chipBg: "rgba(99,102,241,0.12)",
    surface: "linear-gradient(135deg, rgba(99,102,241,0.13), rgba(37,99,235,0.07))"
  },
  taken: {
    label: "Taken", icon: CheckCircle2,
    color: "#10b981", glow: "rgba(16,185,129,0.32)",
    chipBg: "rgba(16,185,129,0.13)",
    surface: "linear-gradient(135deg, rgba(16,185,129,0.16), rgba(5,150,105,0.07))"
  },
  missed: {
    label: "Missed", icon: AlertTriangle,
    color: "#ef4444", glow: "rgba(239,68,68,0.32)",
    chipBg: "rgba(239,68,68,0.13)",
    surface: "linear-gradient(135deg, rgba(239,68,68,0.16), rgba(153,27,27,0.06))"
  },
  skipped: {
    label: "Skipped", icon: SkipForward,
    color: "#f59e0b", glow: "rgba(245,158,11,0.3)",
    chipBg: "rgba(245,158,11,0.14)",
    surface: "linear-gradient(135deg, rgba(245,158,11,0.16), rgba(180,83,9,0.06))"
  }
};

function getTodayDateString() {
  const d = new Date();
  return (
    d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function formatTime(time) {
  if (!time) return "--:--";
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function minutesFor(time) {
  const [h, m] = (time || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function TodaySchedule() {
  const { currentUser } = useAuth();
  const navigate        = useNavigate();

  // â† shared hook — identical data to Dashboard
  const { resolvedPatientId, todayDoses, todayLogs, loading } = useTodaySchedule(currentUser);

  const todayDateStr  = getTodayDateString();
  const [actionLoading, setActionLoading] = useState({});
  const [now, setNow]                     = useState(new Date());

  // Refresh "now" every 30 s so the "Now" marker stays accurate
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Auto-mark doses as missed if 15+ min past their scheduled time
  useEffect(() => {
    if (loading || !todayDoses.length || !resolvedPatientId) return;
    const currentMins = now.getHours() * 60 + now.getMinutes();
    todayDoses.forEach(async dose => {
      const logKey = dose.medicationId + "_" + dose.scheduledTime;
      if (!todayLogs[logKey] && currentMins - minutesFor(dose.scheduledTime) > 15) {
        const res = await logAdherence({
          patientId:      resolvedPatientId,
          medicationId:   dose.medicationId,
          medicationName: dose.medicationName,
          scheduledTime:  dose.scheduledTime,
          scheduledDate:  todayDateStr,
          status:         "missed"
        });
        if (!res.success) console.error("Auto-missed log failed:", res.error);
      }
    });
  }, [todayDoses, todayLogs, loading, resolvedPatientId, todayDateStr, now]);

  // Summary stats for the header chips
  const scheduleStats = useMemo(() => {
    let taken = 0, missed = 0, skipped = 0;
    todayDoses.forEach(dose => {
      const s = todayLogs[dose.medicationId + "_" + dose.scheduledTime]?.status;
      if (s === "taken")   taken++;
      if (s === "missed")  missed++;
      if (s === "skipped") skipped++;
    });
    return { total: todayDoses.length, taken, missed, skipped };
  }, [todayDoses, todayLogs]);

  // Index in sorted list where the "Now" marker should appear
  const nowInsertIndex = useMemo(() => {
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const idx = todayDoses.findIndex(d => minutesFor(d.scheduledTime) >= currentMins);
    return idx === -1 ? todayDoses.length : idx;
  }, [todayDoses, now]);

  async function updateDoseStatus(dose, status) {
    if (!resolvedPatientId) return;
    if (status === "skipped" && !window.confirm(
      "Skip " + dose.medicationName + " at " + formatTime(dose.scheduledTime) + "?"
    )) return;

    const actionKey = dose.medicationId + "_" + dose.scheduledTime;
    setActionLoading(prev => ({ ...prev, [actionKey]: true }));
    try {
      const res = await logAdherence({
        patientId:      resolvedPatientId,
        medicationId:   dose.medicationId,
        medicationName: dose.medicationName,
        scheduledTime:  dose.scheduledTime,
        scheduledDate:  todayDateStr,
        status
      });
      if (!res.success) throw new Error(res.error || "Failed to save");
    } catch (err) {
      console.error("Error logging dose:", err);
      alert("Failed to log dose. Please try again.");
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  }

  function renderNowMarker(key) {
    return (
      <div key={key} className="premium-now-marker">
        <div className="premium-now-dot" />
        <span>Now · {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
      </div>
    );
  }

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="premium-schedule-page">
      <header className="dash-header premium-schedule-header">
        <div>
          <span className="premium-eyebrow"><Sparkles size={14} /> Daily care timeline</span>
          <h1>Today's Schedule</h1>
          <p className="dash-sub">
            {new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="premium-schedule-summary">
          <div><strong>{scheduleStats.taken}</strong><span>Taken</span></div>
          <div><strong>{scheduleStats.total}</strong><span>Total</span></div>
          <div><strong>{scheduleStats.missed}</strong><span>Missed</span></div>
        </div>
      </header>

      {loading ? (
        <div className="premium-empty-state">
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
          <h3>Loading your medication timeline</h3>
          <p>Preparing today's care schedule from your latest records.</p>
        </div>
      ) : todayDoses.length === 0 ? (
        <div className="premium-empty-state">
          <div className="premium-empty-orb"><Pill size={34} /></div>
          <h3>No medications scheduled for today</h3>
          <p>Your day is clear. Add a medication to build your reminder timeline.</p>
          <button className="premium-primary-action" onClick={() => navigate("/patient/add-medication")}>
            <Plus size={18} /> Add Medication
          </button>
        </div>
      ) : (
        <section className="premium-timeline-wrap">
          <div className="premium-timeline-track" />
          {todayDoses.map((dose, idx) => {
            const logKey       = dose.medicationId + "_" + dose.scheduledTime;
            const loggedAction = todayLogs[logKey];
            const status       = loggedAction?.status || "upcoming";
            const meta         = STATUS_META[status] || STATUS_META.upcoming;
            const StatusIcon   = meta.icon;
            const isPending    = actionLoading[logKey];

            return (
              <div key={logKey + "_" + idx}>
                {idx === nowInsertIndex && renderNowMarker("now-" + idx)}
                <article
                  className={"premium-dose-card premium-dose-" + status}
                  style={{
                    animationDelay: (idx * 70) + "ms",
                    "--status-color":   meta.color,
                    "--status-glow":    meta.glow,
                    "--status-surface": meta.surface
                  }}
                >
                  <div className="premium-timeline-node"><StatusIcon size={19} /></div>

                  <div className="premium-dose-time">
                    <span>{formatTime(dose.scheduledTime)}</span>
                    <small>{dose.scheduledTime}</small>
                  </div>

                  <div className="premium-dose-content">
                    <div className="premium-dose-title-row">
                      <div>
                        <h3>{dose.medicationName}</h3>
                        <p>{dose.dosage}</p>
                      </div>
                      <span className="premium-status-chip" style={{ color: meta.color, background: meta.chipBg }}>
                        <StatusIcon size={14} /> {meta.label}
                      </span>
                    </div>
                    <div className="premium-dose-meta">
                      <span><TimerReset size={14} /> {dose.foodInstruction}</span>
                      <span>{dose.source === "self" ? "Self logged" : "Clinician prescribed"}</span>
                    </div>
                  </div>

                  <div className="premium-dose-actions">
                    {loggedAction || status === "missed" ? (
                      <div className="premium-complete-pill" style={{ color: meta.color, borderColor: meta.color }}>
                        <StatusIcon size={16} /> {meta.label}
                      </div>
                    ) : (
                      <>
                        <button
                          className="premium-skip-button"
                          onClick={() => updateDoseStatus(dose, "skipped")}
                          disabled={isPending}
                        >
                          {isPending ? "..." : "Skip"}
                        </button>
                        <button
                          className="premium-take-button"
                          onClick={() => updateDoseStatus(dose, "taken")}
                          disabled={isPending}
                        >
                          <CheckCircle2 size={17} /> {isPending ? "Saving" : "Take"}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              </div>
            );
          })}
          {nowInsertIndex === todayDoses.length && renderNowMarker("now-end")}
        </section>
      )}
    </div>
  );
}
