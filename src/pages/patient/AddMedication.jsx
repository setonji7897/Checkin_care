// src/pages/patient/AddMedication.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ref, push, set, get, query, orderByChild, equalTo } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import "../../styles/dashboard.css";

const FREQUENCIES = [
  { id: "once", label: "Once daily", count: 1 },
  { id: "twice", label: "Twice daily", count: 2 },
  { id: "three", label: "Three times daily", count: 3 },
  { id: "four", label: "Four times daily", count: 4 },
  { id: "hours", label: "Every X hours", count: 1 },
  { id: "prn", label: "As needed (PRN)", count: 0 }
];

const FOOD_INSTRUCTIONS = [
  { id: "before", label: "Before meal" },
  { id: "after", label: "After meal" },
  { id: "with", label: "With meal" },
  { id: "none", label: "No restriction" }
];

export default function AddMedication() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: "",
    doseAmount: "",
    doseUnit: "",
    frequency: "",
    frequencyHours: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    noEndDate: true,
    reminderTimes: [],
    foodInstruction: "",
    notes: ""
  });
  
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [resolvedPatientId, setResolvedPatientId] = useState(null);

  useEffect(() => {
    async function resolvePatientId() {
      if (!currentUser) return;
      try {
        const q = query(ref(db, "patients"), orderByChild("linkedUid"), equalTo(currentUser.uid));
        const snap = await get(q);
        setResolvedPatientId(snap.exists() ? Object.keys(snap.val())[0] : currentUser.uid);
      } catch (err) {
        console.warn("Could not resolve patient profile, falling back to Auth UID", err);
        setResolvedPatientId(currentUser.uid);
      }
    }
    resolvePatientId();
  }, [currentUser]);

  // Refs for scrolling to first error
  const refs = {
    name: useRef(null),
    dosage: useRef(null),
    frequency: useRef(null),
    frequencyHours: useRef(null),
    startDate: useRef(null),
    endDate: useRef(null),
    reminderTimes: useRef([]),
    foodInstruction: useRef(null)
  };

  const handleFrequencyChange = (freqId) => {
    const freq = FREQUENCIES.find(f => f.id === freqId);
    let newTimes = [...formData.reminderTimes];
    if (newTimes.length < freq.count) {
      // Add more times
      while (newTimes.length < freq.count) newTimes.push("09:00");
    } else if (newTimes.length > freq.count) {
      // Remove times
      newTimes = newTimes.slice(0, freq.count);
    }
    
    setFormData(prev => ({
      ...prev,
      frequency: freqId,
      reminderTimes: newTimes
    }));
    
    if (errors.frequency) {
      setErrors(prev => ({ ...prev, frequency: null }));
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Medication name is required";
    if (!formData.doseAmount) newErrors.dosage = "Amount is required";
    if (!formData.doseUnit) newErrors.dosage = "Unit is required";
    if (!formData.frequency) newErrors.frequency = "Frequency is required";
    if (formData.frequency === "hours" && !formData.frequencyHours) {
      newErrors.frequencyHours = "Hours required";
    }
    if (!formData.startDate) newErrors.startDate = "Start date is required";
    if (!formData.noEndDate) {
      if (!formData.endDate) {
        newErrors.endDate = "End date is required";
      } else if (formData.endDate < formData.startDate) {
        newErrors.endDate = "End date must be after start date";
      }
    }
    
    formData.reminderTimes.forEach((time, idx) => {
      if (!time) {
        if (!newErrors.reminderTimes) newErrors.reminderTimes = {};
        newErrors.reminderTimes[idx] = "Time required";
      }
    });

    if (!formData.foodInstruction) newErrors.foodInstruction = "Food instruction is required";

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      // Scroll to first error
      const errorKeys = Object.keys(newErrors);
      const firstKey = errorKeys[0];
      if (firstKey === "reminderTimes") {
        const firstTimeIdx = Object.keys(newErrors.reminderTimes)[0];
        refs.reminderTimes.current[firstTimeIdx]?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (refs[firstKey]?.current) {
        refs[firstKey].current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    setSaving(true);
    try {
      const freqObj = FREQUENCIES.find(f => f.id === formData.frequency);
      const newMedRef = push(ref(db, "medications"));
      
      console.log("Saving medication with patientId:", resolvedPatientId);
      const payload = {
        patientId: resolvedPatientId || currentUser.uid,
        source: "self",
        name: formData.name.trim(),
        medicationName: formData.name.trim(),
        dosage: formData.doseAmount + " " + formData.doseUnit,
        frequency: {
          type: formData.frequency,
          label: freqObj.label,
          hours: formData.frequency === "hours" ? Number(formData.frequencyHours) : null
        },
        startDate: formData.startDate,
        endDate: formData.noEndDate ? null : formData.endDate,
        reminderTimes: formData.reminderTimes,
        reminderTime: formData.reminderTimes,
        foodInstruction: formData.foodInstruction,
        notes: formData.notes.trim(),
        createdAt: new Date().toISOString()
      };

      await set(newMedRef, payload);
      showToast("Medication added successfully!");
      setTimeout(() => navigate("/patient/medications"), 1500);
    } catch (err) {
      console.error("Error saving medication:", err);
      showToast("Failed to save medication", "error");
      setSaving(false);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="page-transition-enter" style={{ maxWidth: "700px" }}>
      <header className="dash-header">
        <div>
          <h1>Add Medication</h1>
          <p className="dash-sub">Set up a new medication schedule</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        
        {/* Medication Name */}
        <div ref={refs.name}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#0f172a" }}>
            Medication Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={e => {
              setFormData(p => ({ ...p, name: e.target.value }));
              if (errors.name) setErrors(p => ({ ...p, name: null }));
            }}
            placeholder="e.g. Amoxicillin"
            className={errors.name ? "input-error shake" : ""}
            style={{
              width: "100%", padding: "0.75rem", borderRadius: "10px",
              border: errors.name ? "2px solid #ef4444" : "1.5px solid #e2e8f0",
              outline: "none", fontSize: "0.95rem"
            }}
          />
          {errors.name && (
            <div style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.3rem", display: "flex", alignItems: "center", gap: "4px" }}>
              <AlertCircle size={14} /> {errors.name}
            </div>
          )}
        </div>

        {/* Dosage */}
        <div ref={refs.dosage}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#0f172a" }}>
            Dosage *
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="number"
              min="0.5"
              step="0.5"
              placeholder="e.g. 500"
              value={formData.doseAmount}
              onChange={e => {
                setFormData(p => ({ ...p, doseAmount: e.target.value }));
                if (errors.dosage) setErrors(p => ({ ...p, dosage: null }));
              }}
              className={errors.dosage && !formData.doseAmount ? "input-error shake" : ""}
              style={{
                width: "35%", padding: "0.75rem", borderRadius: "10px",
                border: errors.dosage && !formData.doseAmount ? "2px solid #ef4444" : "1.5px solid #e2e8f0",
                outline: "none", fontSize: "0.95rem"
              }}
            />
            <select
              value={formData.doseUnit}
              onChange={e => {
                setFormData(p => ({ ...p, doseUnit: e.target.value }));
                if (errors.dosage) setErrors(p => ({ ...p, dosage: null }));
              }}
              className={errors.dosage && !formData.doseUnit ? "input-error shake" : ""}
              style={{
                width: "65%", padding: "0.75rem", borderRadius: "10px",
                border: errors.dosage && !formData.doseUnit ? "2px solid #ef4444" : "1.5px solid #e2e8f0",
                outline: "none", fontSize: "0.95rem", background: "white"
              }}
            >
              <option value="" disabled>Select unit</option>
              <optgroup label="Weight">
                <option value="mg">mg (milligrams)</option>
                <option value="g">g (grams)</option>
                <option value="mcg">mcg (micrograms)</option>
              </optgroup>
              <optgroup label="Volume">
                <option value="ml">ml (milliliters)</option>
                <option value="tsp">tsp (teaspoon)</option>
                <option value="tbsp">tbsp (tablespoon)</option>
              </optgroup>
              <optgroup label="Units">
                <option value="tablet">tablet(s)</option>
                <option value="capsule">capsule(s)</option>
                <option value="IU">IU (International Units)</option>
                <option value="drop">drop(s)</option>
                <option value="patch">patch(es)</option>
                <option value="puff">puff(s)</option>
                <option value="sachet">sachet(s)</option>
              </optgroup>
            </select>
          </div>
          {errors.dosage && (
            <div style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.3rem", display: "flex", alignItems: "center", gap: "4px" }}>
              <AlertCircle size={14} /> {errors.dosage}
            </div>
          )}
          {formData.doseAmount && formData.doseUnit && (
            <div style={{
              display: "inline-block", marginTop: "0.5rem", background: "#f1f5f9",
              padding: "0.3rem 0.75rem", borderRadius: "12px", fontSize: "0.85rem",
              fontWeight: 600, color: "#334155"
            }}>
              Preview: {formData.doseAmount} {formData.doseUnit}
            </div>
          )}
        </div>

        {/* Frequency */}
        <div ref={refs.frequency}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#0f172a" }}>
            Frequency *
          </label>
          <div className={errors.frequency ? "shake" : ""} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
            {FREQUENCIES.map(freq => {
              const isSelected = formData.frequency === freq.id;
              return (
                <div
                  key={freq.id}
                  onClick={() => handleFrequencyChange(freq.id)}
                  style={{
                    border: isSelected ? "2px solid #2563eb" : (errors.frequency ? "2px solid #ef4444" : "1.5px solid #e2e8f0"),
                    background: isSelected ? "#eff6ff" : "white",
                    padding: "1rem", borderRadius: "12px", cursor: "pointer",
                    textAlign: "center", transition: "all 0.2s",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
                  }}
                >
                  <span style={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? "#1d4ed8" : "#475569", fontSize: "0.9rem" }}>
                    {freq.label}
                  </span>
                </div>
              );
            })}
          </div>
          {errors.frequency && (
            <div style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.3rem", display: "flex", alignItems: "center", gap: "4px" }}>
              <AlertCircle size={14} /> {errors.frequency}
            </div>
          )}
          
          {formData.frequency === "hours" && (
            <div ref={refs.frequencyHours} style={{ marginTop: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#0f172a", fontSize: "0.9rem" }}>
                Every how many hours? *
              </label>
              <input
                type="number"
                min="1"
                max="72"
                placeholder="e.g. 8"
                value={formData.frequencyHours}
                onChange={e => {
                  setFormData(p => ({ ...p, frequencyHours: e.target.value }));
                  if (errors.frequencyHours) setErrors(p => ({ ...p, frequencyHours: null }));
                }}
                className={errors.frequencyHours ? "input-error shake" : ""}
                style={{
                  width: "150px", padding: "0.6rem 0.75rem", borderRadius: "8px",
                  border: errors.frequencyHours ? "2px solid #ef4444" : "1.5px solid #e2e8f0",
                  outline: "none", fontSize: "0.95rem"
                }}
              />
              {errors.frequencyHours && (
                <div style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.3rem" }}>{errors.frequencyHours}</div>
              )}
            </div>
          )}
        </div>

        {/* Reminder Times */}
        {formData.reminderTimes.length > 0 && (
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#0f172a" }}>
              Reminder Times *
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
              {formData.reminderTimes.map((time, idx) => (
                <div key={idx} ref={el => refs.reminderTimes.current[idx] = el} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <label style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 500 }}>Dose {idx + 1} time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={e => {
                      const newTimes = [...formData.reminderTimes];
                      newTimes[idx] = e.target.value;
                      setFormData(p => ({ ...p, reminderTimes: newTimes }));
                      if (errors.reminderTimes?.[idx]) {
                        const newErrs = { ...errors.reminderTimes };
                        delete newErrs[idx];
                        setErrors(p => ({ ...p, reminderTimes: Object.keys(newErrs).length ? newErrs : null }));
                      }
                    }}
                    className={errors.reminderTimes?.[idx] ? "shake" : ""}
                    style={{
                      padding: "0.6rem", borderRadius: "8px",
                      border: errors.reminderTimes?.[idx] ? "2px solid #ef4444" : "1.5px solid #e2e8f0",
                      outline: "none", fontFamily: "inherit"
                    }}
                  />
                  {errors.reminderTimes?.[idx] && (
                    <div style={{ color: "#ef4444", fontSize: "0.75rem" }}>Required</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dates */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div ref={refs.startDate}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#0f172a" }}>
              Start Date *
            </label>
            <input
              type="date"
              min={todayStr}
              value={formData.startDate}
              onChange={e => {
                setFormData(p => ({ ...p, startDate: e.target.value }));
                if (errors.startDate) setErrors(p => ({ ...p, startDate: null }));
              }}
              className={errors.startDate ? "input-error shake" : ""}
              style={{
                width: "100%", padding: "0.75rem", borderRadius: "10px",
                border: errors.startDate ? "2px solid #ef4444" : "1.5px solid #e2e8f0",
                outline: "none", fontFamily: "inherit"
              }}
            />
            {errors.startDate && <div style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.3rem" }}>{errors.startDate}</div>}
          </div>
          
          <div ref={refs.endDate}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <label style={{ fontWeight: 600, color: "#0f172a" }}>End Date</label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", color: "#64748b", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={formData.noEndDate}
                  onChange={e => {
                    setFormData(p => ({ ...p, noEndDate: e.target.checked, endDate: e.target.checked ? "" : p.endDate }));
                    if (errors.endDate) setErrors(p => ({ ...p, endDate: null }));
                  }}
                />
                No end date
              </label>
            </div>
            <input
              type="date"
              min={formData.startDate || todayStr}
              value={formData.endDate}
              disabled={formData.noEndDate}
              onChange={e => {
                setFormData(p => ({ ...p, endDate: e.target.value }));
                if (errors.endDate) setErrors(p => ({ ...p, endDate: null }));
              }}
              className={errors.endDate ? "input-error shake" : ""}
              style={{
                width: "100%", padding: "0.75rem", borderRadius: "10px",
                border: errors.endDate ? "2px solid #ef4444" : "1.5px solid #e2e8f0",
                background: formData.noEndDate ? "#f8fafc" : "white",
                opacity: formData.noEndDate ? 0.6 : 1,
                outline: "none", fontFamily: "inherit"
              }}
            />
            {errors.endDate && <div style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.3rem" }}>{errors.endDate}</div>}
          </div>
        </div>

        {/* Food Instructions */}
        <div ref={refs.foodInstruction}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#0f172a" }}>
            Food Instructions *
          </label>
          <div className={errors.foodInstruction ? "shake" : ""} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {FOOD_INSTRUCTIONS.map(food => {
              const isSelected = formData.foodInstruction === food.id;
              return (
                <div
                  key={food.id}
                  onClick={() => {
                    setFormData(p => ({ ...p, foodInstruction: food.id }));
                    if (errors.foodInstruction) setErrors(p => ({ ...p, foodInstruction: null }));
                  }}
                  style={{
                    border: isSelected ? "2px solid #10b981" : (errors.foodInstruction ? "2px solid #ef4444" : "1.5px solid #e2e8f0"),
                    background: isSelected ? "#ecfdf5" : "white",
                    padding: "0.875rem", borderRadius: "12px", cursor: "pointer",
                    textAlign: "center", transition: "all 0.2s"
                  }}
                >
                  <span style={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? "#047857" : "#475569", fontSize: "0.9rem" }}>
                    {food.label}
                  </span>
                </div>
              );
            })}
          </div>
          {errors.foodInstruction && (
            <div style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.3rem", display: "flex", alignItems: "center", gap: "4px" }}>
              <AlertCircle size={14} /> {errors.foodInstruction}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#0f172a" }}>
            Notes (Optional)
          </label>
          <textarea
            maxLength={200}
            rows={3}
            placeholder="Any special instructions..."
            value={formData.notes}
            onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
            style={{
              width: "100%", padding: "0.75rem", borderRadius: "10px",
              border: "1.5px solid #e2e8f0", outline: "none",
              fontFamily: "inherit", resize: "vertical", fontSize: "0.95rem"
            }}
          />
          <div style={{ textAlign: "right", fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
            {formData.notes.length} / 200
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #f1f5f9" }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              padding: "0.75rem 1.5rem", borderRadius: "10px", border: "1px solid #e2e8f0",
              background: "white", color: "#475569", fontWeight: 600, cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "0.75rem 2rem", borderRadius: "10px", border: "none",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "white", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: "0.5rem",
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.2)"
            }}
          >
            {saving ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={18} />}
            {saving ? "Saving..." : "Save Medication"}
          </button>
        </div>
      </form>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "1.5rem", right: "1.5rem",
          background: toast.type === "success" ? "#10b981" : "#ef4444",
          color: "white", borderRadius: "12px", padding: "0.75rem 1.25rem",
          fontWeight: 600, fontSize: "0.875rem", zIndex: 9999,
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          animation: "slideInRight 0.3s ease"
        }}>
          {toast.message}
        </div>
      )}
      
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .shake {
          animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}
