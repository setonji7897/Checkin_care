// src/pages/patient/MedicationDetail.jsx
//
// PURPOSE: Full details + adherence history for a single medication.
// Uses client-side filtering to avoid Firebase index requirements.

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, get, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { ArrowLeft, Pill, Stethoscope, Clock, Utensils, Calendar, CheckCircle2, XCircle, SkipForward } from "lucide-react";
import "../../styles/dashboard.css";

function getFrequencyLabel(freq) {
  if (!freq) return "—";
  if (typeof freq === "object") {
    if (freq.type === "hours" && freq.hours) {
      return "Every " + freq.hours + " hour" + (Number(freq.hours) === 1 ? "" : "s");
    }
    return freq.label || "Custom";
  }
  return freq;
}

function formatDisplayTime(time) {
  if (!time) return "—";
  const parts = time.split(":").map(Number);
  const d = new Date();
  d.setHours(parts[0] || 0, parts[1] || 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const STATUS_STYLES = {
  taken:   { bg: "#ecfdf5", color: "#047857", icon: CheckCircle2,  label: "Taken"   },
  missed:  { bg: "#fef2f2", color: "#b91c1c", icon: XCircle,       label: "Missed"  },
  skipped: { bg: "#fffbeb", color: "#b45309", icon: SkipForward,   label: "Skipped" },
};

export default function MedicationDetail() {
  const { currentUser } = useAuth();
  const { medicationId } = useParams();
  const navigate = useNavigate();

  const [medication, setMedication] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!medicationId) return;

    // Fetch the single medication directly
    get(ref(db, "medications/" + medicationId))
      .then(snap => {
        if (snap.exists()) setMedication(snap.val());
        else setLoading(false);
      })
      .catch(() => setLoading(false));

    // Fetch ALL adherence logs and filter client-side (no Firebase index needed)
    const unsubscribeLogs = onValue(ref(db, "adherenceLogs"), (snap) => {
      const dataList = [];
      if (snap.exists()) {
        snap.forEach(child => {
          const log = child.val();
          if (log.medicationId === medicationId) {
            dataList.push({ id: child.key, ...log });
          }
        });
        dataList.sort((a, b) => {
          const dateCmp = (b.scheduledDate || "").localeCompare(a.scheduledDate || "");
          if (dateCmp !== 0) return dateCmp;
          return (a.scheduledTime || "").localeCompare(b.scheduledTime || "");
        });
      }
      setLogs(dataList);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsubscribeLogs();
  }, [medicationId]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "300px", gap: "1rem", color: "var(--text-muted)" }}>
        <div style={{ width: 38, height: 38, border: "3px solid var(--border)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p>Loading medication detailsâ€¦</p>
      </div>
    );
  }

  if (!medication) {
    return (
      <div style={{ padding: "3rem", textAlign: "center" }}>
        <h3>Medication not found</h3>
        <button className="med-add-btn" style={{ marginTop: "1rem" }} onClick={() => navigate("/patient/medications")}>
          Back to Medications
        </button>
      </div>
    );
  }

  const isPrescribed = medication.source === "clinician" || medication.source === "prescribed";
  const freqLabel = getFrequencyLabel(medication.frequency);
  const allTimes = Array.isArray(medication.reminderTimes)
    ? medication.reminderTimes
    : Array.isArray(medication.reminderTime)
      ? medication.reminderTime
      : medication.reminderTime ? [medication.reminderTime] : [];

  const totalLogs   = logs.length;
  const takenCount  = logs.filter(l => l.status === "taken").length;
  const adherencePct = totalLogs > 0 ? Math.round((takenCount / totalLogs) * 100) : null;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <header className="dash-header">
        <div>
          <button
            onClick={() => navigate("/patient/medications")}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: "none", border: "none", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", marginBottom: "0.5rem", padding: 0 }}
          >
            <ArrowLeft size={16} /> Back to Medications
          </button>
          <h1 style={{ margin: 0 }}>{medication.medicationName || medication.name}</h1>
          <p className="dash-sub">{medication.dosage} · {freqLabel}</p>
        </div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          padding: "0.45rem 1rem", borderRadius: "999px", fontSize: "0.8rem", fontWeight: 800,
          background: isPrescribed ? "rgba(37,99,235,0.1)" : "rgba(107,114,128,0.1)",
          color: isPrescribed ? "#2563eb" : "var(--text-muted)",
          border: "1px solid " + (isPrescribed ? "rgba(37,99,235,0.22)" : "var(--border)")
        }}>
          {isPrescribed ? <Stethoscope size={14} /> : <Pill size={14} />}
          {isPrescribed ? "Clinician Prescribed" : "Self Logged"}
        </span>
      </header>

      {/* Stats row */}
      {adherencePct !== null && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.75rem" }}>
          {[
            { label: "Total Logs",  value: totalLogs,                    color: "#6366f1" },
            { label: "Taken",       value: takenCount,                   color: "#10b981" },
            { label: "Adherence",   value: adherencePct + "%",           color: adherencePct >= 80 ? "#10b981" : adherencePct >= 50 ? "#f59e0b" : "#ef4444" },
          ].map(stat => (
            <div key={stat.label} className="dash-card" style={{ textAlign: "center", padding: "1.25rem" }}>
              <div style={{ fontSize: "1.75rem", fontWeight: 900, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 700, marginTop: "0.25rem" }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Details card */}
      <div className="dash-card" style={{ marginBottom: "1.75rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Schedule Info</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.88rem" }}>
              <Clock size={15} color="#6366f1" />
              <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>Times:</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                {allTimes.filter(Boolean).map(formatDisplayTime).join("  ·  ") || "—"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.88rem" }}>
              <Utensils size={15} color="#10b981" />
              <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>Food:</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{medication.foodInstruction || "—"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.88rem" }}>
              <Calendar size={15} color="#f59e0b" />
              <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>Duration:</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                {medication.startDate || "—"} → {medication.endDate || "Ongoing"}
              </span>
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Frequency</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem" }}>{freqLabel}</div>
          {medication.notes && (
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>{medication.notes}</div>
          )}
        </div>
      </div>

      {/* Adherence history */}
      <h2 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "1rem", color: "var(--text-primary)" }}>Adherence History</h2>
      {logs.length === 0 ? (
        <div className="dash-card" style={{ textAlign: "center", padding: "2.5rem", color: "var(--text-muted)" }}>
          <CheckCircle2 size={36} color="#d1d5db" style={{ marginBottom: "0.75rem" }} />
          <p>No adherence logs yet. Start taking your medication and logs will appear here.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {logs.slice(0, 30).map(log => {
            const s = STATUS_STYLES[log.status] || STATUS_STYLES.missed;
            const Icon = s.icon;
            return (
              <div key={log.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0.85rem 1.25rem", borderRadius: "14px",
                background: "var(--bg-card)", border: "1px solid var(--border)",
                gap: "1rem"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: s.bg, display: "grid", placeItems: "center" }}>
                    <Icon size={16} color={s.color} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>{log.scheduledDate}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Scheduled: {formatDisplayTime(log.scheduledTime)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  {log.takenAt && (
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "right" }}>
                      Taken at<br />
                      <strong>{new Date(log.takenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>
                    </div>
                  )}
                  <span style={{ padding: "0.3rem 0.75rem", borderRadius: "999px", fontSize: "0.73rem", fontWeight: 800, background: s.bg, color: s.color }}>
                    {s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
