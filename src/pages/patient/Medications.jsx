// src/pages/patient/Medications.jsx
// Premium card-based medication catalog with glassmorphism, animations, and rich info display.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ref, query, orderByChild, equalTo, onValue, get, remove } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { formatTime12Hour } from "../../utils/formatTime";
import { Plus, Pencil, Trash2, Lock, Pill, Clock, Utensils, Stethoscope, Sparkles, Search, Filter } from "lucide-react";
import "../../styles/dashboard.css";

// Palette for medication card accent colours (cycles through these)
const CARD_ACCENTS = [
  { border: "#6366f1", glow: "rgba(99,102,241,0.18)", chip: "rgba(99,102,241,0.12)", text: "#6366f1" },
  { border: "#10b981", glow: "rgba(16,185,129,0.18)", chip: "rgba(16,185,129,0.12)", text: "#10b981" },
  { border: "#f59e0b", glow: "rgba(245,158,11,0.18)", chip: "rgba(245,158,11,0.12)", text: "#d97706" },
  { border: "#ec4899", glow: "rgba(236,72,153,0.18)", chip: "rgba(236,72,153,0.12)", text: "#ec4899" },
  { border: "#14b8a6", glow: "rgba(20,184,166,0.18)", chip: "rgba(20,184,166,0.12)", text: "#14b8a6" },
  { border: "#8b5cf6", glow: "rgba(139,92,246,0.18)", chip: "rgba(139,92,246,0.12)", text: "#8b5cf6" },
];

function getAccent(idx) {
  return CARD_ACCENTS[idx % CARD_ACCENTS.length];
}

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

function getScheduledTimes(med) {
  const times =
    Array.isArray(med.reminderTimes) ? med.reminderTimes :
    Array.isArray(med.reminderTime)  ? med.reminderTime  :
    med.reminderTime ? [med.reminderTime] : [];
  return times.filter(Boolean).map(formatTime12Hour).join("  ·  ");
}

export default function Medications() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [medications, setMedications]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [searchQuery, setSearchQuery]   = useState("");
  const [filterSource, setFilterSource] = useState("all");

  useEffect(() => {
    if (!currentUser) return;

    const patientQuery = query(
      ref(db, "patients"),
      orderByChild("linkedUid"),
      equalTo(currentUser.uid)
    );

    get(patientQuery).then(snap => {
      const patientIdRef = snap.exists() ? Object.keys(snap.val())[0] : currentUser.uid;
      console.log("📋 Fetching ALL medications for:", patientIdRef);

      const unsubscribe = onValue(ref(db, "medications"), (medSnap) => {
        const list = [];
        if (medSnap.exists()) {
          const vals = medSnap.val();
          for (const key in vals) {
            const med = vals[key];
            if (med.patientId === patientIdRef) {
              list.push({ id: key, ...med });
            }
          }
          list.sort((a, b) => {
            const ta = Array.isArray(a.reminderTime) ? a.reminderTime[0] : (a.reminderTime || "");
            const tb = Array.isArray(b.reminderTime) ? b.reminderTime[0] : (b.reminderTime || "");
            return ta.localeCompare(tb);
          });
        }
        setMedications(list);
        setLoading(false);
      }, (err) => {
        console.error("❌ Error:", err);
        setLoading(false);
      });

      return () => unsubscribe();
    }).catch(() => setLoading(false));
  }, [currentUser]);

  const handleDelete = async (e, med) => {
    e.stopPropagation();
    const name = med.medicationName || med.name || "this medication";
    if (!window.confirm("Remove " + name + "? This cannot be undone.")) return;
    await remove(ref(db, "medications/" + med.id));
  };

  const filtered = medications.filter(med => {
    const name = (med.medicationName || med.name || "").toLowerCase();
    const matchesSearch = name.includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterSource === "all" ||
      (filterSource === "self"      && med.source === "self") ||
      (filterSource === "clinician" && (med.source === "clinician" || med.source === "prescribed"));
    return matchesSearch && matchesFilter;
  });

  const counts = {
    all: medications.length,
    self: medications.filter(m => m.source === "self").length,
    clinician: medications.filter(m => m.source === "clinician" || m.source === "prescribed").length,
  };

  return (
    <div className="med-catalog-page">
      {/* ── Header ───────────────────────────────────────────── */}
      <header className="dash-header med-catalog-header">
        <div>
          <span className="premium-eyebrow"><Sparkles size={13} /> Medication Catalog</span>
          <h1>My Medications</h1>
          <p className="dash-sub">Your full prescription &amp; self-logged catalog</p>
        </div>
        <button
          id="add-medication-btn"
          className="med-add-btn"
          onClick={() => navigate("/patient/add-medication")}
        >
          <Plus size={18} /> Add Medication
        </button>
      </header>

      {/* ── Search + Filter Bar ───────────────────────────────── */}
      <div className="med-controls-bar">
        <div className="med-search-wrap">
          <Search size={16} className="med-search-icon" />
          <input
            id="med-search-input"
            type="text"
            placeholder="Search medications..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="med-search-input"
          />
        </div>
        <div className="med-filter-tabs">
          {[
            { key: "all",      label: "All",       count: counts.all },
            { key: "clinician",label: "Prescribed", count: counts.clinician },
            { key: "self",     label: "Self Logged", count: counts.self },
          ].map(tab => (
            <button
              key={tab.key}
              id={"med-filter-" + tab.key}
              className={"med-filter-tab" + (filterSource === tab.key ? " active" : "")}
              onClick={() => setFilterSource(tab.key)}
            >
              {tab.label}
              <span className="med-filter-count">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      {loading ? (
        <div className="med-loading-state">
          <div className="med-loading-spinner" />
          <p>Loading your medication catalog…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="med-empty-state">
          <div className="med-empty-orb"><Pill size={36} /></div>
          <h3>{searchQuery ? "No medications match your search" : "No medications yet"}</h3>
          <p>{searchQuery ? "Try a different search term." : "Add a medication to start tracking your health."}</p>
          {!searchQuery && (
            <button className="med-add-btn" onClick={() => navigate("/patient/add-medication")}>
              <Plus size={17} /> Add Your First Medication
            </button>
          )}
        </div>
      ) : (
        <div className="med-cards-grid">
          {filtered.map((med, idx) => {
            const accent = getAccent(idx);
            const isPrescribed = med.source === "clinician" || med.source === "prescribed";
            const scheduledTimes = getScheduledTimes(med);
            const freqLabel = getFrequencyLabel(med.frequency);

            return (
              <article
                key={med.id}
                id={"med-card-" + med.id}
                className="med-card"
                style={{
                  "--accent": accent.border,
                  "--accent-glow": accent.glow,
                  "--accent-chip": accent.chip,
                  "--accent-text": accent.text,
                  animationDelay: (idx * 60) + "ms"
                }}
                onClick={() => navigate("/patient/medications/" + med.id)}
              >
                {/* Top accent bar */}
                <div className="med-card-accent-bar" />

                {/* Header row */}
                <div className="med-card-header">
                  <div className="med-card-icon">
                    {isPrescribed ? <Stethoscope size={20} /> : <Pill size={20} />}
                  </div>
                  <span className={"med-source-chip" + (isPrescribed ? " prescribed" : " self")}>
                    {isPrescribed ? "Prescribed" : "Self Logged"}
                  </span>
                </div>

                {/* Name */}
                <h3 className="med-card-name">{med.medicationName || med.name}</h3>

                {/* Info rows */}
                <div className="med-card-info">
                  <div className="med-info-row">
                    <span className="med-info-label">Dosage</span>
                    <span className="med-info-value">{med.dosage || "—"}</span>
                  </div>
                  <div className="med-info-row">
                    <span className="med-info-label">Frequency</span>
                    <span className="med-info-value">{freqLabel}</span>
                  </div>
                  {scheduledTimes && (
                    <div className="med-info-row">
                      <span className="med-info-label"><Clock size={12} /> Times</span>
                      <span className="med-info-value med-times">{scheduledTimes}</span>
                    </div>
                  )}
                  {med.foodInstruction && (
                    <div className="med-info-row">
                      <span className="med-info-label"><Utensils size={12} /> Food</span>
                      <span className="med-info-value">{med.foodInstruction}</span>
                    </div>
                  )}
                </div>

                {/* Actions footer */}
                <div className="med-card-footer" onClick={e => e.stopPropagation()}>
                  {!isPrescribed ? (
                    <>
                      <button
                        id={"med-edit-" + med.id}
                        className="med-action-btn edit"
                        title="Edit medication"
                        onClick={e => { e.stopPropagation(); navigate("/patient/add-medication?edit=" + med.id); }}
                      >
                        <Pencil size={15} /> Edit
                      </button>
                      <button
                        id={"med-delete-" + med.id}
                        className="med-action-btn delete"
                        title="Delete medication"
                        onClick={e => handleDelete(e, med)}
                      >
                        <Trash2 size={15} /> Delete
                      </button>
                    </>
                  ) : (
                    <span className="med-locked-label">
                      <Lock size={13} /> Clinician managed
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
