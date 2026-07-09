// src/pages/clinician/AddPatient.jsx
//
// PURPOSE: Form to add a new clinical patient record and link their email.

import { useState } from "react";
import { ref, push, set, get, query, orderByChild, equalTo, serverTimestamp } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/config";
import { getFriendlyErrorMessage } from "../../utils/firebaseErrors";
import "../../styles/dashboard.css";

export default function AddPatient() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [medicalCondition, setMedicalCondition] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  

  function validate() {
    const errs = {};
    if (!fullName.trim()) errs.fullName = "Full name is required.";
    
    if (!dateOfBirth) {
      errs.dateOfBirth = "Date of birth is required.";
    } else {
      const selectedDate = new Date(dateOfBirth);
      const today = new Date();
      if (selectedDate >= today) {
        errs.dateOfBirth = "Date of birth must be in the past.";
      }
    }

    if (!medicalCondition.trim()) errs.medicalCondition = "Medical condition is required.";

    if (!email.trim()) {
      errs.email = "Email address is required.";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errs.email = "Please enter a valid email address.";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;
    setLoading(true);

    try {
      let linkedUid = null;

      // Try resolving existing user matching this email to link them
      if (email.trim()) {
        // First check if a patient with this email is already on the clinician's roster
        const rosterQuery = query(
          ref(db, "patients"),
          orderByChild("clinicianId"),
          equalTo(currentUser.uid)
        );
        const rosterSnap = await get(rosterQuery);
        if (rosterSnap.exists()) {
          const rosterVal = rosterSnap.val();
          const isDuplicate = Object.values(rosterVal).some(
            p => p.email && p.email.trim().toLowerCase() === email.trim().toLowerCase()
          );
          if (isDuplicate) {
            setErrors(prev => ({ ...prev, email: "A patient with this email is already on your roster." }));
            setLoading(false);
            return;
          }
        }

        const emailQuery = query(
          ref(db, "users"),
          orderByChild("email"),
          equalTo(email.trim().toLowerCase())
        );
        const userSnap = await get(emailQuery);
        if (userSnap.exists()) {
          const userVals = userSnap.val();
          // Extract matching key
          linkedUid = Object.keys(userVals)[0];
        }
      }

      const patientsRef = ref(db, "patients");
      const newPatientRef = push(patientsRef);
      
      const payload = {
        fullName,
        dateOfBirth,
        medicalCondition,
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        clinicianId: currentUser.uid,
        linkedUid: linkedUid || null,
        createdAt: serverTimestamp()
      };

      await set(newPatientRef, payload);

      if (linkedUid) {
        await set(push(ref(db, "notifications/" + linkedUid)), {
          read: false,
          timestamp: Date.now(),
          type: "invite_redemption",
          title: "Clinician Connected",
          body: `Clinician ${currentUser.email} has added you to their patient roster.`,
          actionRoute: "/patient/profile"
        });
      }

      navigate(`/clinician/patients/${newPatientRef.key}`);
    } catch (err) {
      console.error("Failed to add patient:", err);
      setFormError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      

      
        <header className="dash-header">
          <div>
            <h1>Add New Patient</h1>
            <p className="dash-sub">Set up patient profile and connect status updates</p>
          </div>
        </header>

        <div className="auth-card" style={{ background: "#fff", width: "100%", maxWidth: "600px", margin: "0 auto", padding: "2rem" }}>
          <form onSubmit={handleSubmit} className="auth-form" style={{ width: "100%" }}>
            <div className="field-group">
              <label htmlFor="p-name">Patient Full Name</label>
              <input
                id="p-name"
                type="text"
                placeholder="Arthur Pendragon"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
              {errors.fullName && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.2rem" }}>{errors.fullName}</p>}
            </div>

            <div className="field-group">
              <label htmlFor="p-dob">Date of Birth</label>
              <input
                id="p-dob"
                type="date"
                value={dateOfBirth}
                onChange={e => setDateOfBirth(e.target.value)}
              />
              {errors.dateOfBirth && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.2rem" }}>{errors.dateOfBirth}</p>}
            </div>

            <div className="field-group">
              <label htmlFor="p-cond">Medical Condition</label>
              <input
                id="p-cond"
                type="text"
                placeholder="Hypertension, Osteoarthritis"
                value={medicalCondition}
                onChange={e => setMedicalCondition(e.target.value)}
              />
              {errors.medicalCondition && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.2rem" }}>{errors.medicalCondition}</p>}
            </div>

            <div className="field-group">
              <label htmlFor="p-email">Patient Contact Email (Optional)</label>
              <input
                id="p-email"
                type="email"
                placeholder="patient@gmail.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              {errors.email && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.2rem" }}>{errors.email}</p>}
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0.1rem 0 0 0" }}>
                Entering the email matching a registered Patient login will automatically link their logs.
              </p>
            </div>

            <div className="field-group">
              <label htmlFor="p-phone">Phone Number (Optional)</label>
              <input
                id="p-phone"
                type="tel"
                placeholder="+353 87 123 4567"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
              />
            </div>

            {formError && <p className="auth-error" style={{ margin: "1rem 0 0 0" }}>{formError}</p>}

            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
              <button
                type="button"
                className="signout-btn"
                style={{ flex: 1, padding: "0.8rem", border: "1px solid #d1d5db", color: "#4b5563" }}
                onClick={() => navigate("/clinician/patients")}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="submit-btn"
                style={{ flex: 2, padding: "0.8rem" }}
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Patient Profile"}
              </button>
            </div>
          </form>
        </div>
      </>
  );
}
