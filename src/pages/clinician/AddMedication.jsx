// src/pages/clinician/AddMedication.jsx
//
// PURPOSE: Adds medications to patients (Prescribed by Clinician).

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, get, push, set, serverTimestamp } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/config";
import { getFriendlyErrorMessage } from "../../utils/firebaseErrors";
import "../../styles/dashboard.css";

const FREQUENCIES = ["Daily", "Twice Daily", "Three Times Daily", "Weekly", "As Needed"];
const FOOD_INSTRUCTIONS = ["Take after food", "Take before food", "Take with water", "No restriction"];

export default function AddMedication() {
  const { currentUser } = useAuth();
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [loadingPatient, setLoadingPatient] = useState(true);

  // Form Fields
  const [medicationName, setMedicationName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("Daily");
  const [reminderTimes, setReminderTimes] = useState(["08:00"]);
  const [foodInstruction, setFoodInstruction] = useState("No restriction");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  

  // Load Patient Profile
  useEffect(() => {
    const pRef = ref(db, `patients/${patientId}`);
    get(pRef).then(snapshot => {
      if (snapshot.exists()) {
        setPatient(snapshot.val());
      }
      setLoadingPatient(false);
    }).catch(err => {
      console.error(err);
      setLoadingPatient(false);
    });
  }, [patientId]);

  // Adjust reminder times arrays dynamically depending on chosen frequency
  useEffect(() => {
    if (frequency === "Twice Daily") {
      setReminderTimes(prev => {
        const slots = [...prev];
        while (slots.length < 2) slots.push("20:00");
        return slots.slice(0, 2);
      });
    } else if (frequency === "Three Times Daily") {
      setReminderTimes(prev => {
        const slots = [...prev];
        while (slots.length < 3) slots.push(slots.length === 1 ? "14:00" : "20:00");
        return slots.slice(0, 3);
      });
    } else {
      setReminderTimes(prev => [prev[0] || "08:00"]);
    }
  }, [frequency]);

  const handleTimeChange = (index, value) => {
    setReminderTimes(prev => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  function validate() {
    const errs = {};
    if (!medicationName.trim()) errs.medicationName = "Medication name is required.";
    if (!dosage.trim()) errs.dosage = "Dosage amount is required.";
    
    if (!startDate) {
      errs.startDate = "Start date is required.";
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(startDate);
      if (start < today) {
        errs.startDate = "Start date cannot be in the past.";
      }
    }

    if (endDate && startDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end <= start) {
        errs.endDate = "End date must be after the start date.";
      }
    }

    reminderTimes.forEach((t, i) => {
      if (!t) {
        errs[`reminderTime_${i}`] = "Reminder time slot is required.";
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;
    setLoading(true);

    try {
      const medsRef = ref(db, "medications");
      const newMedRef = push(medsRef);

      const payload = {
        patientId,
        medicationName,
        dosage,
        frequency,
        reminderTime: frequency === "Daily" || frequency === "Weekly" || frequency === "As Needed"
          ? reminderTimes[0]
          : reminderTimes,
        foodInstruction,
        startDate,
        endDate: endDate || null,
        source: "clinician",
        prescribedBy: currentUser.uid,
        createdAt: serverTimestamp()
      };

      await set(newMedRef, payload);
      navigate(`/clinician/patients/${patientId}`);
    } catch (err) {
      console.error(err);
      setFormError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  }

  if (loadingPatient) {
    return <div style={{ padding: "3rem", textAlign: "center" }}>Loading details...</div>;
  }

  return (
    <>
      

      
        <header className="dash-header">
          <div>
            <h1>Prescribe Medication</h1>
            <p className="dash-sub">Patient: {patient?.fullName}</p>
          </div>
        </header>

        <div className="auth-card" style={{ background: "#fff", width: "100%", maxWidth: "600px", margin: "0 auto", padding: "2rem" }}>
          <form onSubmit={handleSubmit} className="auth-form" style={{ width: "100%" }}>
            <div className="field-group">
              <label htmlFor="med-name">Medication Name</label>
              <input
                id="med-name"
                type="text"
                placeholder="Aspirin"
                value={medicationName}
                onChange={e => setMedicationName(e.target.value)}
              />
              {errors.medicationName && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.2rem" }}>{errors.medicationName}</p>}
            </div>

            <div className="field-group">
              <label htmlFor="med-dose">Dosage</label>
              <input
                id="med-dose"
                type="text"
                placeholder="75mg"
                value={dosage}
                onChange={e => setDosage(e.target.value)}
              />
              {errors.dosage && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.2rem" }}>{errors.dosage}</p>}
            </div>

            <div className="field-group">
              <label htmlFor="med-freq">Frequency</label>
              <select
                id="med-freq"
                value={frequency}
                onChange={e => setFrequency(e.target.value)}
                style={{ padding: "0.7rem", border: "1.5px solid var(--border)", borderRadius: "14px", background: "#fff" }}
              >
                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {/* Dynamic reminder time fields */}
            <div className="field-group">
              <label>Reminder Time(s)</label>
              {reminderTimes.map((time, idx) => (
                <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "0.2rem", marginBottom: "0.5rem" }}>
                  <input
                    type="time"
                    value={time}
                    onChange={e => handleTimeChange(idx, e.target.value)}
                  />
                  {errors[`reminderTime_${idx}`] && <p style={{ color: "#ef4444", fontSize: "0.8rem" }}>{errors[`reminderTime_${idx}`]}</p>}
                </div>
              ))}
            </div>

            <div className="field-group">
              <label htmlFor="med-food">Instructions</label>
              <select
                id="med-food"
                value={foodInstruction}
                onChange={e => setFoodInstruction(e.target.value)}
                style={{ padding: "0.7rem", border: "1.5px solid var(--border)", borderRadius: "14px", background: "#fff" }}
              >
                {FOOD_INSTRUCTIONS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            <div className="field-group">
              <label htmlFor="med-start">Start Date</label>
              <input
                id="med-start"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              {errors.startDate && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.2rem" }}>{errors.startDate}</p>}
            </div>

            <div className="field-group">
              <label htmlFor="med-end">End Date (Optional)</label>
              <input
                id="med-end"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
              {errors.endDate && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.2rem" }}>{errors.endDate}</p>}
            </div>

            {formError && <p className="auth-error">{formError}</p>}

            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
              <button
                type="button"
                className="signout-btn"
                style={{ flex: 1, padding: "0.8rem", border: "1px solid #d1d5db", color: "#4b5563" }}
                onClick={() => navigate(`/clinician/patients/${patientId}`)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="submit-btn"
                style={{ flex: 2, padding: "0.8rem" }}
                disabled={loading}
              >
                {loading ? "Prescribing..." : "Prescribe Medication"}
              </button>
            </div>
          </form>
        </div>
      </>
  );
}
