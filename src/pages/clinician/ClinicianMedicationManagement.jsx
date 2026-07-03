import { useState, useEffect, useMemo } from "react";
import { Search, ChevronDown, ChevronRight, Pill, AlertTriangle, CalendarPlus, XCircle, Edit, Save, X } from "lucide-react";
import { ref, onValue, update, child } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import "../../styles/dashboard.css"; // assuming standard dash styles

// Helpers
function dateStr(d) { return d.toISOString().split("T")[0]; }

export default function ClinicianMedicationManagement() {
  const { currentUser } = useAuth();
  const [patients, setPatients] = useState({});
  const [medications, setMedications] = useState([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({});
  const [editingMed, setEditingMed] = useState(null);

  // Fetch data
  useEffect(() => {
    if (!currentUser) return;
    const clinicianId = currentUser.uid;

    const unsubPatients = onValue(ref(db, "patients"), snap => {
      const pMap = {};
      snap.forEach(child => {
        const p = child.val();
        if (p.clinicianId === clinicianId || p.clinicianUid === clinicianId) {
          pMap[child.key] = p;
        }
      });
      setPatients(pMap);
    });

    const unsubMeds = onValue(ref(db, "medications"), snap => {
      const list = [];
      snap.forEach(child => {
        list.push({ id: child.key, ...child.val() });
      });
      setMedications(list);
    });

    return () => { unsubPatients(); unsubMeds(); };
  }, [currentUser]);

  // Derived data
  const { myPatientsMeds, endingSoon } = useMemo(() => {
    const pKeys = Object.keys(patients);
    let myMeds = medications.filter(m => pKeys.includes(m.patientId));
    
    // Sort medications: active first, then discontinued
    myMeds.sort((a, b) => {
      if (a.status === "discontinued" && b.status !== "discontinued") return 1;
      if (a.status !== "discontinued" && b.status === "discontinued") return -1;
      return 0;
    });

    // Check ending soon
    const now = new Date();
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    const todayStr = dateStr(now);
    const futureStr = dateStr(in7Days);

    const expiring = myMeds.filter(m => 
      m.status !== "discontinued" && 
      m.endDate && 
      m.endDate >= todayStr && 
      m.endDate <= futureStr
    );

    return { myPatientsMeds: myMeds, endingSoon: expiring };
  }, [patients, medications]);

  // Grouping and Filtering
  const groupedAndFiltered = useMemo(() => {
    const query = search.toLowerCase();
    const grouped = {};
    
    myPatientsMeds.forEach(med => {
      const pName = (patients[med.patientId]?.fullName || "").toLowerCase();
      const mName = (med.medicationName || med.name || "").toLowerCase();
      
      if (pName.includes(query) || mName.includes(query)) {
        if (!grouped[med.patientId]) grouped[med.patientId] = [];
        grouped[med.patientId].push(med);
      }
    });
    
    return grouped;
  }, [myPatientsMeds, patients, search]);

  function toggleExpand(pid) {
    setExpanded(prev => ({ ...prev, [pid]: !prev[pid] }));
  }

  async function handleDiscontinue(medId) {
    if (!window.confirm("Are you sure you want to discontinue this medication? It will remain in history but be removed from the patient's active schedule.")) return;
    await update(ref(db, "medications/" + medId), { status: "discontinued" });
  }

  function handleRenew(med) {
    // Open edit modal prefilled, extending endDate by 30 days
    const currentEnd = med.endDate ? new Date(med.endDate) : new Date();
    currentEnd.setDate(currentEnd.getDate() + 30);
    setEditingMed({
      ...med,
      endDate: dateStr(currentEnd)
    });
  }

  function handleEdit(med) {
    setEditingMed({ ...med });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingMed) return;
    const { id, ...data } = editingMed;
    await update(ref(db, "medications/" + id), data);
    setEditingMed(null);
  }

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Medication Management</h1>
          <p className="dash-sub">Centralised prescription control</p>
        </div>
      </header>

      {/* Ending Soon Section */}
      {endingSoon.length > 0 && (
        <div className="dash-card" style={{ marginBottom: "1.5rem", borderLeft: "4px solid #f59e0b" }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, color: "#b45309", margin: "0 0 1rem" }}>
            <AlertTriangle size={20} /> Ending Soon (Next 7 Days)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {endingSoon.map(med => (
              <div key={"exp-" + med.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", background: "#fef3c7", borderRadius: 8 }}>
                <div>
                  <strong>{med.medicationName || med.name}</strong> ({med.dosage})
                  <div style={{ fontSize: "0.85rem", color: "#92400e" }}>
                    Patient: {patients[med.patientId]?.fullName} | Ends: {med.endDate}
                  </div>
                </div>
                {med.source !== "self" ? (
                  <button onClick={() => handleRenew(med)} className="btn-primary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>
                    <CalendarPlus size={14} style={{ marginRight: 4 }}/> Renew
                  </button>
                ) : (
                  <span style={{ fontSize: "0.8rem", color: "#92400e", fontStyle: "italic" }}>Self-prescribed</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and List */}
      <div className="dash-card">
        <div style={{ position: "relative", marginBottom: "1.5rem" }}>
          <Search size={18} color="#64748b" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Search by patient or medication name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "0.75rem 1rem 0.75rem 2.5rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
          />
        </div>

        {Object.keys(groupedAndFiltered).length === 0 ? (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem 0" }}>No medications found matching your search.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {Object.keys(groupedAndFiltered).map(patientId => {
              const meds = groupedAndFiltered[patientId];
              const p = patients[patientId];
              const isExpanded = expanded[patientId];

              return (
                <div key={patientId} style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  <button
                    onClick={() => toggleExpand(patientId)}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem", background: "var(--bg-card)", border: "none", borderBottom: isExpanded ? "1px solid var(--border)" : "none", cursor: "pointer", color: "var(--text-primary)" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#e0e7ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                        {p?.fullName?.charAt(0)}
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontWeight: 600 }}>{p?.fullName}</div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{meds.length} medications</div>
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown size={20} color="#64748b" /> : <ChevronRight size={20} color="#64748b" />}
                  </button>
                  
                  {isExpanded && (
                    <div style={{ padding: "1rem", background: "rgba(0,0,0,0.02)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                        <thead>
                          <tr style={{ color: "var(--text-muted)", borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                            <th style={{ padding: "0.5rem", width: "25%" }}>Medication</th>
                            <th style={{ padding: "0.5rem" }}>Dosage</th>
                            <th style={{ padding: "0.5rem" }}>Frequency</th>
                            <th style={{ padding: "0.5rem" }}>Start / End</th>
                            <th style={{ padding: "0.5rem" }}>Status</th>
                            <th style={{ padding: "0.5rem", textAlign: "right" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {meds.map(med => {
                            const isDiscontinued = med.status === "discontinued";
                            const isSelf = med.source === "self";
                            const rowStyle = isDiscontinued ? { opacity: 0.6, background: "rgba(0,0,0,0.04)" } : {};
                            
                            return (
                              <tr key={med.id} style={{ borderBottom: "1px solid var(--border)", ...rowStyle }}>
                                <td style={{ padding: "0.75rem 0.5rem", fontWeight: 600 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <Pill size={14} color={isDiscontinued ? "#94a3b8" : "#4f46e5"} /> 
                                    {med.medicationName || med.name}
                                  </div>
                                </td>
                                <td style={{ padding: "0.75rem 0.5rem" }}>{med.dosage}</td>
                                <td style={{ padding: "0.75rem 0.5rem" }}>{med.frequency?.type || med.frequency || "Daily"}</td>
                                <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem" }}>
                                  <div>S: {med.startDate || "N/A"}</div>
                                  <div>E: {med.endDate || "Ongoing"}</div>
                                </td>
                                <td style={{ padding: "0.75rem 0.5rem" }}>
                                  {isDiscontinued ? (
                                    <span style={{ padding: "2px 6px", borderRadius: 4, background: "#f1f5f9", color: "#64748b", fontSize: "0.75rem", fontWeight: "bold" }}>Discontinued</span>
                                  ) : (
                                    <span style={{ padding: "2px 6px", borderRadius: 4, background: "#dcfce7", color: "#166534", fontSize: "0.75rem", fontWeight: "bold" }}>Active</span>
                                  )}
                                  {isSelf && <div style={{ fontSize: "0.7rem", color: "#8b5cf6", marginTop: 4, fontWeight: "bold" }}>Self-prescribed</div>}
                                </td>
                                <td style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>
                                  {!isDiscontinued && !isSelf && (
                                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                                      <button onClick={() => handleEdit(med)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#4f46e5" }} title="Edit">
                                        <Edit size={16} />
                                      </button>
                                      <button onClick={() => handleDiscontinue(med.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444" }} title="Discontinue">
                                        <XCircle size={16} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingMed && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "var(--bg-card)", padding: "1.5rem", borderRadius: 12, width: "100%", maxWidth: 500 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "var(--text-primary)" }}>Edit Medication</h3>
              <button onClick={() => setEditingMed(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20}/></button>
            </div>
            
            <form onSubmit={saveEdit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: "bold" }}>Medication Name</label>
                <input type="text" value={editingMed.medicationName || editingMed.name || ""} onChange={e => setEditingMed({...editingMed, medicationName: e.target.value})} style={{ width: "100%", padding: "0.6rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} required />
              </div>
              <div style={{ display: "flex", gap: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: "bold" }}>Dosage</label>
                  <input type="text" value={editingMed.dosage || ""} onChange={e => setEditingMed({...editingMed, dosage: e.target.value})} style={{ width: "100%", padding: "0.6rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: "bold" }}>End Date</label>
                  <input type="date" value={editingMed.endDate || ""} onChange={e => setEditingMed({...editingMed, endDate: e.target.value})} style={{ width: "100%", padding: "0.6rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                </div>
              </div>
              
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                <button type="button" onClick={() => setEditingMed(null)} style={{ padding: "0.5rem 1rem", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: "0.5rem 1rem", borderRadius: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <Save size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}