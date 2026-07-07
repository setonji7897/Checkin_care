// src/pages/clinician/PatientDetail.jsx
//
// PURPOSE: Complete detail view of a single patient for clinicians. Includes profile,
// medications prescribed vs self-prescribed, real-time adherence rate calculations,
// assignments configuration controls, and history logs.

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, onValue, get, query, orderByChild, equalTo, set, update } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { calculateAdherenceRate } from "../../utils/adherenceStats";
import "../../styles/dashboard.css";

// ─── helpers ────────────────────────────────────────────────────────────────
const FREQUENCIES = ["Daily", "Twice Daily", "Three Times Daily", "Weekly", "As Needed"];
const FOOD_INSTRUCTIONS = ["Take after food", "Take before food", "Take with water", "No restriction"];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  const diff = Math.floor((end - today) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function PatientDetail() {
  const { currentUser } = useAuth();
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient]           = useState(null);
  const [medications, setMedications]   = useState([]);
  const [adherenceStats, setAdherenceStats] = useState({ rate: null, taken: 0, missed: 0, skipped: 0 });
  const [logs, setLogs]                 = useState([]);
  const [loading, setLoading]           = useState(true);

  // ── Caregiver assignment ───────────────────────────────────────────────────
  const [caregiverEmail, setCaregiverEmail]   = useState("");
  const [assignedCaregiver, setAssignedCaregiver] = useState(null);
  const [assignError, setAssignError]         = useState("");
  const [assignSuccess, setAssignSuccess]     = useState("");
  const [assignLoading, setAssignLoading]     = useState(false);
  // Confirmation modal state
  const [showAssignWarning, setShowAssignWarning] = useState(false);
  const [pendingCg, setPendingCg]             = useState(null); // { id, ...userData }

  // ── Edit medication state ──────────────────────────────────────────────────
  const [editingMedId, setEditingMedId]   = useState(null);
  const [editForm, setEditForm]           = useState({});
  const [editLoading, setEditLoading]     = useState(false);

  // ── Discontinue confirmation ───────────────────────────────────────────────
  const [discontinuingMedId, setDiscontinuingMedId] = useState(null);

  // ── Renew end-date state ───────────────────────────────────────────────────
  const [renewingMedId, setRenewingMedId] = useState(null);
  const [renewDate, setRenewDate]         = useState("");

  // ── Data subscriptions ────────────────────────────────────────────────────
  useEffect(() => {
    if (!patientId) return;

    const unsubscribePatient = onValue(ref(db, `patients/${patientId}`), snap => {
      if (snap.exists()) setPatient(snap.val());
    });

    const medsQuery = query(ref(db, "medications"), orderByChild("patientId"), equalTo(patientId));
    const unsubscribeMeds = onValue(medsQuery, snap => {
      const list = [];
      if (snap.exists()) {
        snap.forEach(child => list.push({ id: child.key, ...child.val() }));
      }
      setMedications(list);
    });

    const logsQuery = query(ref(db, "adherenceLogs"), orderByChild("patientId"), equalTo(patientId));
    const unsubscribeLogs = onValue(logsQuery, snap => {
      const list = [];
      if (snap.exists()) {
        snap.forEach(child => list.push({ id: child.key, ...child.val() }));
      }
      list.sort((a, b) => {
        const dA = `${a.scheduledDate}T${a.scheduledTime}`;
        const dB = `${b.scheduledDate}T${b.scheduledTime}`;
        return dB.localeCompare(dA);
      });
      setLogs(list);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const limitStr = sevenDaysAgo.toISOString().split("T")[0];
      setAdherenceStats(calculateAdherenceRate(list.filter(l => l.scheduledDate >= limitStr)));
    });

    const unsubscribeAssign = onValue(ref(db, `caregiverAssignments/${patientId}`), async snap => {
      if (snap.exists()) {
        const { caregiverId } = snap.val();
        const cgSnap = await get(ref(db, `users/${caregiverId}`));
        if (cgSnap.exists()) setAssignedCaregiver({ id: caregiverId, ...cgSnap.val() });
      } else {
        setAssignedCaregiver(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribePatient();
      unsubscribeMeds();
      unsubscribeLogs();
      unsubscribeAssign();
    };
  }, [patientId]);

  // ── Caregiver assignment — phase 1: lookup ────────────────────────────────
  async function handleAssignCaregiver(e) {
    e.preventDefault();
    setAssignError("");
    setAssignSuccess("");
    if (!caregiverEmail.trim()) { setAssignError("Email is required."); return; }
    setAssignLoading(true);
    try {
      const snapshot = await get(
        query(ref(db, "users"), orderByChild("email"), equalTo(caregiverEmail.trim().toLowerCase()))
      );
      if (!snapshot.exists()) {
        setAssignError("No user account found with this email.");
        return;
      }
      const usersObj = snapshot.val();
      const cgId     = Object.keys(usersObj)[0];
      const cgData   = usersObj[cgId];

      // FIX: schema uses roles: { caregiver: true }, not role: "caregiver"
      if (!cgData.roles?.caregiver) {
        const roleLabel = Object.keys(cgData.roles || {}).join(", ") || "unknown";
        setAssignError(`That account is registered as "${roleLabel}". Only Caregiver accounts can be assigned.`);
        return;
      }

      const resolved = { id: cgId, ...cgData };

      if (assignedCaregiver) {
        // Already assigned — show confirmation before overwriting
        setPendingCg(resolved);
        setShowAssignWarning(true);
      } else {
        await commitAssignment(resolved);
      }
    } catch (err) {
      console.error(err);
      setAssignError("Failed to look up caregiver. Please check your connection.");
    } finally {
      setAssignLoading(false);
    }
  }

  // ── Caregiver assignment — phase 2: commit ────────────────────────────────
  async function commitAssignment(cg) {
    try {
      await set(ref(db, `caregiverAssignments/${patientId}`), { caregiverId: cg.id });
      const name = cg.firstName ? `${cg.firstName} ${cg.lastName || ""}`.trim() : cg.email;
      setAssignSuccess(`Patient successfully assigned to caregiver: ${name}`);
      setCaregiverEmail("");
    } catch (err) {
      console.error(err);
      setAssignError("Failed to record caregiver assignment.");
    } finally {
      setShowAssignWarning(false);
      setPendingCg(null);
    }
  }

  // ── Edit medication ────────────────────────────────────────────────────────
  function startEdit(med) {
    setEditingMedId(med.id);
    setEditForm({
      dosage:        med.dosage        || "",
      frequency:     typeof med.frequency === "object" ? med.frequency.label : (med.frequency || "Daily"),
      foodInstruction: med.foodInstruction || "No restriction",
      endDate:       med.endDate       || "",
      reminderTime:  Array.isArray(med.reminderTime)
                       ? med.reminderTime.join(", ")
                       : (med.reminderTime || ""),
    });
  }

  async function saveEdit(medId) {
    setEditLoading(true);
    try {
      const times = editForm.reminderTime.split(",").map(t => t.trim()).filter(Boolean);
      await update(ref(db, `medications/${medId}`), {
        dosage:          editForm.dosage,
        frequency:       editForm.frequency,
        foodInstruction: editForm.foodInstruction,
        endDate:         editForm.endDate || null,
        reminderTime:    times.length === 1 ? times[0] : times,
      });
      setEditingMedId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setEditLoading(false);
    }
  }

  // ── Discontinue medication (soft-delete) ──────────────────────────────────
  async function confirmDiscontinue(medId) {
    try {
      await update(ref(db, `medications/${medId}`), { status: "discontinued" });
    } catch (err) {
      console.error(err);
    } finally {
      setDiscontinuingMedId(null);
    }
  }

  // ── Renew medication ───────────────────────────────────────────────────────
  async function confirmRenew(medId) {
    try {
      await update(ref(db, `medications/${medId}`), { endDate: renewDate || null });
      setRenewingMedId(null);
      setRenewDate("");
    } catch (err) {
      console.error(err);
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const endingSoonMeds = medications.filter(med => {
    if (!med.endDate || med.status === "discontinued") return false;
    const d = daysUntil(med.endDate);
    return d !== null && d >= 0 && d <= 7;
  });

  const adherenceColor =
    adherenceStats.rate === null  ? "var(--text-muted)"
    : adherenceStats.rate >= 80   ? "#10b981"
    : adherenceStats.rate >= 50   ? "#f59e0b"
    : "#ef4444";

  if (loading) {
    return <div style={{ padding: "3rem", textAlign: "center" }}>Loading Patient Details…</div>;
  }

  return (
    <>
      {/* ── Header ── */}
      <header className="dash-header">
        <div>
          <h1>{patient?.fullName}</h1>
          <p className="dash-sub">DOB: {patient?.dateOfBirth} | Condition: {patient?.medicalCondition}</p>
        </div>
        <button
          className="submit-btn"
          style={{ padding: "0.6rem 1.2rem", fontSize: "0.9rem" }}
          onClick={() => navigate(`/clinician/patients/${patientId}/add-medication`)}
        >
          ➕ Prescribe Medication
        </button>
      </header>

      {/* ── Stats row ── */}
      <section className="coming-soon-grid" style={{ marginBottom: "2rem" }}>
        {/* 7-Day Adherence */}
        <div className="dash-card placeholder-card" style={{ borderLeft: "6px solid #6c63ff" }}>
          <h3>7-Day Adherence</h3>
          <span style={{ fontSize: "2.5rem", fontWeight: 800, color: adherenceColor }}>
            {adherenceStats.rate !== null ? `${adherenceStats.rate}%` : "No data"}
          </span>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Taken: {adherenceStats.taken} | Missed: {adherenceStats.missed} | Skipped: {adherenceStats.skipped}
          </p>
        </div>

        {/* Caregiver Assignment */}
        <div className="dash-card placeholder-card">
          <h3>Caregiver Assignment</h3>

          {assignedCaregiver ? (
            <p>
              🟢 Assigned to:{" "}
              <strong>
                {assignedCaregiver.firstName
                  ? `${assignedCaregiver.firstName} ${assignedCaregiver.lastName || ""}`.trim()
                  : assignedCaregiver.fullName || "—"}
              </strong>{" "}
              ({assignedCaregiver.email})
            </p>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>No caregiver assigned yet.</p>
          )}

          <form onSubmit={handleAssignCaregiver} style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <input
              type="email"
              placeholder="caregiver@email.com"
              value={caregiverEmail}
              onChange={e => setCaregiverEmail(e.target.value)}
              style={{
                padding: "0.4rem 0.8rem", border: "1.5px solid var(--border)",
                borderRadius: "10px", flex: 1, fontSize: "0.85rem",
                background: "var(--input-bg)", color: "var(--text-primary)"
              }}
            />
            <button type="submit" className="submit-btn"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
              disabled={assignLoading}
            >
              {assignLoading ? "Checking…" : "Assign"}
            </button>
          </form>
          {assignError   && <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "0.3rem" }}>{assignError}</p>}
          {assignSuccess && <p style={{ color: "#10b981", fontSize: "0.75rem", marginTop: "0.3rem" }}>{assignSuccess}</p>}
        </div>
      </section>

      {/* ── Caregiver overwrite confirmation modal ── */}
      {showAssignWarning && pendingCg && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500
        }}>
          <div className="dash-card" style={{
            maxWidth: 460, width: "90%", padding: "2rem",
            background: "var(--bg-card)", borderRadius: 20,
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
          }}>
            <h3 style={{ marginBottom: "1rem", color: "#f59e0b" }}>⚠️ Replace Caregiver?</h3>
            <p style={{ marginBottom: "0.75rem", lineHeight: 1.6 }}>
              This patient is already assigned to{" "}
              <strong>
                {assignedCaregiver.firstName
                  ? `${assignedCaregiver.firstName} ${assignedCaregiver.lastName || ""}`.trim()
                  : assignedCaregiver.email}
              </strong>{" "}
              ({assignedCaregiver.email}).
            </p>
            <p style={{ marginBottom: "1.5rem", lineHeight: 1.6 }}>
              Assigning{" "}
              <strong>
                {pendingCg.firstName
                  ? `${pendingCg.firstName} ${pendingCg.lastName || ""}`.trim()
                  : pendingCg.email}
              </strong>{" "}
              will <strong>replace</strong> this assignment. The previous caregiver will lose access to this patient.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                className="outline-btn"
                onClick={() => { setShowAssignWarning(false); setPendingCg(null); }}
              >
                Cancel
              </button>
              <button
                className="submit-btn"
                style={{ background: "#f59e0b" }}
                onClick={() => commitAssignment(pendingCg)}
              >
                Yes, Replace Caregiver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ending Soon section ── */}
      {endingSoonMeds.length > 0 && (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ color: "#f59e0b", marginBottom: "0.75rem" }}>⚠️ Ending Soon</h2>
          <div style={{
            border: "2px solid #f59e0b", borderRadius: 16, overflow: "hidden",
            background: "rgba(245,158,11,0.05)"
          }}>
            {endingSoonMeds.map((med, idx) => {
              const days = daysUntil(med.endDate);
              return (
                <div key={med.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "1rem 1.25rem", gap: "1rem", flexWrap: "wrap",
                  borderTop: idx > 0 ? "1px solid rgba(245,158,11,0.2)" : "none"
                }}>
                  <div>
                    <strong style={{ color: "var(--text-primary)" }}>{med.medicationName}</strong>
                    <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      Ends: {med.endDate}{" "}
                      <span style={{ color: days === 0 ? "#ef4444" : "#f59e0b", fontWeight: 700 }}>
                        ({days === 0 ? "Today!" : `${days} day${days === 1 ? "" : "s"} left`})
                      </span>
                    </p>
                  </div>
                  {renewingMedId === med.id ? (
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <input
                        type="date"
                        value={renewDate}
                        onChange={e => setRenewDate(e.target.value)}
                        style={{
                          padding: "0.35rem 0.6rem", borderRadius: 8,
                          border: "1.5px solid var(--border)",
                          background: "var(--input-bg)", color: "var(--text-primary)"
                        }}
                      />
                      <button className="submit-btn"
                        style={{ padding: "0.35rem 0.8rem", fontSize: "0.82rem" }}
                        onClick={() => confirmRenew(med.id)}
                        disabled={!renewDate}
                      >
                        Confirm
                      </button>
                      <button className="outline-btn"
                        style={{ padding: "0.35rem 0.7rem", fontSize: "0.82rem" }}
                        onClick={() => { setRenewingMedId(null); setRenewDate(""); }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="submit-btn"
                      style={{ padding: "0.4rem 1rem", fontSize: "0.82rem", background: "#f59e0b" }}
                      onClick={() => { setRenewingMedId(med.id); setRenewDate(""); }}
                    >
                      🔄 Renew
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Medication List ── */}
      <section style={{ marginBottom: "2rem" }}>
        <h2>Medication List</h2>
        {medications.length === 0 ? (
          <p style={{ color: "var(--text-muted)", marginTop: "0.5rem" }}>No prescribed medications yet.</p>
        ) : (
          <div className="coming-soon-grid" style={{ marginTop: "1rem" }}>
            {medications.map(med => {
              const isClinician    = med.source === "clinician";
              const isDiscontinued = med.status === "discontinued";
              const isEditing      = editingMedId === med.id;

              return (
                <div key={med.id} className="dash-card placeholder-card"
                  style={{ opacity: isDiscontinued ? 0.65 : 1 }}
                >
                  <h3 style={{ marginBottom: "0.5rem" }}>{med.medicationName}</h3>

                  {isEditing ? (
                    /* ── Inline edit form ── */
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Dosage</label>
                      <input
                        type="text"
                        value={editForm.dosage}
                        onChange={e => setEditForm(f => ({ ...f, dosage: e.target.value }))}
                        style={{
                          padding: "0.4rem 0.6rem", borderRadius: 8,
                          border: "1.5px solid var(--border)",
                          background: "var(--input-bg)", color: "var(--text-primary)"
                        }}
                      />
                      <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Frequency</label>
                      <select
                        value={editForm.frequency}
                        onChange={e => setEditForm(f => ({ ...f, frequency: e.target.value }))}
                        style={{
                          padding: "0.4rem 0.6rem", borderRadius: 8,
                          border: "1.5px solid var(--border)",
                          background: "var(--input-bg)", color: "var(--text-primary)"
                        }}
                      >
                        {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Reminder Time(s)</label>
                      <input
                        type="text"
                        placeholder="08:00 or 08:00, 20:00"
                        value={editForm.reminderTime}
                        onChange={e => setEditForm(f => ({ ...f, reminderTime: e.target.value }))}
                        style={{
                          padding: "0.4rem 0.6rem", borderRadius: 8,
                          border: "1.5px solid var(--border)",
                          background: "var(--input-bg)", color: "var(--text-primary)"
                        }}
                      />
                      <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Instructions</label>
                      <select
                        value={editForm.foodInstruction}
                        onChange={e => setEditForm(f => ({ ...f, foodInstruction: e.target.value }))}
                        style={{
                          padding: "0.4rem 0.6rem", borderRadius: 8,
                          border: "1.5px solid var(--border)",
                          background: "var(--input-bg)", color: "var(--text-primary)"
                        }}
                      >
                        {FOOD_INSTRUCTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                      <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>End Date (optional)</label>
                      <input
                        type="date"
                        value={editForm.endDate}
                        onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))}
                        style={{
                          padding: "0.4rem 0.6rem", borderRadius: 8,
                          border: "1.5px solid var(--border)",
                          background: "var(--input-bg)", color: "var(--text-primary)"
                        }}
                      />
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                        <button className="submit-btn"
                          style={{ flex: 1, padding: "0.45rem", fontSize: "0.82rem" }}
                          onClick={() => saveEdit(med.id)}
                          disabled={editLoading}
                        >
                          {editLoading ? "Saving…" : "Save"}
                        </button>
                        <button className="outline-btn"
                          style={{ flex: 1, padding: "0.45rem", fontSize: "0.82rem" }}
                          onClick={() => setEditingMedId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Normal display ── */
                    <>
                      <p><strong>Dosage:</strong> {med.dosage}</p>
                      <p><strong>Frequency:</strong> {typeof med.frequency === "object" ? med.frequency.label : med.frequency}</p>
                      <p>
                        <strong>Schedule:</strong>{" "}
                        {Array.isArray(med.reminderTime) ? med.reminderTime.join(", ") : med.reminderTime}
                      </p>
                      <p><strong>Instructions:</strong> {med.foodInstruction}</p>
                      {med.endDate && (
                        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                          <strong>End Date:</strong> {med.endDate}
                        </p>
                      )}
                      <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                        {isClinician ? (
                          <span className="coming-soon-tag" style={{ background: "#eff6ff", color: "#2563eb" }}>
                            Clinician Prescribed
                          </span>
                        ) : (
                          <span className="coming-soon-tag" style={{ background: "#f3f4f6", color: "#4b5563" }}>
                            Self Prescribed
                          </span>
                        )}
                        {isDiscontinued && (
                          <span className="coming-soon-tag" style={{ background: "#fef2f2", color: "#b91c1c" }}>
                            Discontinued
                          </span>
                        )}
                      </div>

                      {/* Edit / Discontinue actions — clinician meds only */}
                      {isClinician && !isDiscontinued && (
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                          <button
                            className="outline-btn"
                            style={{ flex: 1, padding: "0.4rem", fontSize: "0.8rem" }}
                            onClick={() => startEdit(med)}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            style={{
                              flex: 1, padding: "0.4rem", fontSize: "0.8rem",
                              border: "1px solid #ef4444", borderRadius: 8,
                              background: "transparent", color: "#ef4444", cursor: "pointer"
                            }}
                            onClick={() => setDiscontinuingMedId(med.id)}
                          >
                            🚫 Discontinue
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Discontinue confirmation modal ── */}
      {discontinuingMedId && (() => {
        const med = medications.find(m => m.id === discontinuingMedId);
        return (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500
          }}>
            <div className="dash-card" style={{
              maxWidth: 420, width: "90%", padding: "2rem",
              background: "var(--bg-card)", borderRadius: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
            }}>
              <h3 style={{ marginBottom: "1rem" }}>Discontinue Medication?</h3>
              <p style={{ marginBottom: "1.5rem", lineHeight: 1.6 }}>
                Are you sure you want to discontinue{" "}
                <strong>{med?.medicationName}</strong>? This will mark it as inactive
                but the record will be preserved.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button className="outline-btn" onClick={() => setDiscontinuingMedId(null)}>Cancel</button>
                <button
                  className="submit-btn"
                  style={{ background: "#ef4444" }}
                  onClick={() => confirmDiscontinue(discontinuingMedId)}
                >
                  Yes, Discontinue
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Adherence Logs Table ── */}
      <section>
        <h2>Recent Adherence Logs (Last 14 Days)</h2>
        {logs.length === 0 ? (
          <p style={{ color: "var(--text-muted)", marginTop: "0.5rem" }}>No adherence logs found.</p>
        ) : (
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 14, overflow: "hidden", marginTop: "1rem"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ background: "var(--bg-page)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "1rem" }}>Date</th>
                  <th style={{ padding: "1rem" }}>Medication</th>
                  <th style={{ padding: "1rem" }}>Scheduled Slot</th>
                  <th style={{ padding: "1rem" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 30).map(log => (
                  <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "1rem" }}>{log.scheduledDate}</td>
                    <td style={{ padding: "1rem" }}><strong>{log.medicationName}</strong></td>
                    <td style={{ padding: "1rem" }}>{log.scheduledTime}</td>
                    <td style={{ padding: "1rem" }}>
                      <span style={{
                        padding: "0.25rem 0.6rem", borderRadius: 20,
                        fontSize: "0.75rem", fontWeight: 700,
                        background: log.status === "taken" ? "#ecfdf5" : log.status === "missed" ? "#fef2f2" : "#fffbeb",
                        color:      log.status === "taken" ? "#047857" : log.status === "missed" ? "#b91c1c" : "#b45309"
                      }}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
