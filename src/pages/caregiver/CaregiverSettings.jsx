// src/pages/caregiver/CaregiverSettings.jsx
import { useState, useEffect } from "react";
import { updatePassword } from "firebase/auth";
import { ref, get, update, onValue, query, orderByChild, equalTo } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { Type, Bell, Lock, Users, KeyRound, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { redeemInviteCode, unlinkCaregiver } from "../../services/careInviteService";
import { getPatientName } from "../../utils/backendData";
import "../../styles/dashboard.css";

export default function CaregiverSettings() {
  const { currentUser, userData } = useAuth();
  const { darkMode, largeText, toggleDarkMode, toggleLargeText } = useTheme();
  
  const [preferences, setPreferences] = useState({
    pushNotifications: localStorage.getItem("pushNotifications") !== "false",
    emailAlerts: localStorage.getItem("emailAlerts") !== "false"
  });

  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [passwordStatus, setPasswordStatus] = useState({ loading: false, message: "", error: false });

  // Linked patients and invite redemption states
  const [patients, setPatients] = useState([]);
  const [inviteCode, setInviteCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [successPatient, setSuccessPatient] = useState("");

  useEffect(() => {
    localStorage.setItem("pushNotifications", preferences.pushNotifications);
    localStorage.setItem("emailAlerts", preferences.emailAlerts);
  }, [preferences]);

  // Load connected patients
  useEffect(() => {
    if (!currentUser) return;
    const assignQuery = query(
      ref(db, "caregiverAssignments"),
      orderByChild("caregiverId"),
      equalTo(currentUser.uid)
    );
    const unsub = onValue(assignQuery, async (snapshot) => {
      const patientIds = [];
      snapshot.forEach(child => {
        patientIds.push(child.key);
      });
      const list = [];
      for (const pid of patientIds) {
        const pSnap = await get(ref(db, "patients/" + pid));
        if (pSnap.exists()) {
          const patientData = { id: pid, ...pSnap.val() };
          const linkedUid = patientData.linkedUid || pid;
          const uSnap = await get(ref(db, "users/" + linkedUid));
          if (uSnap.exists()) {
            const u = uSnap.val();
            patientData.firstName = u.firstName || "";
            patientData.lastName = u.lastName || "";
          }
          list.push(patientData);
        }
      }
      setPatients(list);
    });
    return () => unsub();
  }, [currentUser]);

  const handleToggle = (key) => setPreferences(prev => ({ ...prev, [key]: !prev[key] }));

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordStatus({ loading: true, message: "", error: false });
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus({ loading: false, message: "Passwords do not match", error: true });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordStatus({ loading: false, message: "Password must be at least 6 characters", error: true });
      return;
    }
    try {
      await updatePassword(currentUser, passwordForm.newPassword);
      setPasswordStatus({ loading: false, message: "Password updated successfully!", error: false });
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPasswordStatus({ loading: false, message: "Failed to update password. Please sign in again.", error: true });
    }
  };

  const handleRedeemCode = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setRedeemLoading(true);
    setRedeemError("");
    try {
      const caregiverName = [userData?.firstName, userData?.lastName].filter(Boolean).join(" ") || "Caregiver";
      const invite = await redeemInviteCode(inviteCode, currentUser.uid, caregiverName);
      setSuccessPatient(invite.patientName || "your patient");
      setInviteCode("");
      setTimeout(() => setSuccessPatient(""), 3000);
    } catch (err) {
      if (err.message === "not_found") {
        setRedeemError("Invalid code. Please check spelling.");
      } else if (err.message === "already_used") {
        setRedeemError("This invite code has already been redeemed.");
      } else if (err.message === "expired") {
        setRedeemError("This invite code has expired.");
      } else {
        setRedeemError("An error occurred. Please try again.");
      }
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleDisconnect = async (patient) => {
    if (window.confirm(`Are you sure you want to disconnect from ${getPatientName(patient)}?`)) {
      await unlinkCaregiver(patient.id, currentUser.uid);
    }
  };

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Settings</h1>
          <p className="dash-sub">Customise your caregiver dashboard</p>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: "800px", paddingBottom: "2rem" }}>
        
        {/* Connected Patients Section */}
        <div className="dash-card">
          <h3 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={20} color="#10b981" /> Linked Patients & Invites
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {patients.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {patients.map(patient => (
                  <div key={patient.id} style={{ background: "var(--bg-page)", padding: "1rem", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ display: "block", color: "var(--text-primary)" }}>{getPatientName(patient)}</strong>
                      <span style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)" }}>Patient ID: {patient.id}</span>
                    </div>
                    <button
                      onClick={() => handleDisconnect(patient)}
                      className="outline-btn"
                      style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "#ef4444", borderColor: "#ef4444", padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
                    >
                      <XCircle size={14} /> Disconnect
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>No patients linked yet.</p>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />

            <form onSubmit={handleRedeemCode} style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "400px" }}>
              <h4 style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <KeyRound size={16} /> Link New Patient
              </h4>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Enter the 6-character code generated on the patient's settings page to connect.
              </p>
              
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  placeholder="Invite Code (e.g. ABC123)"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  style={{
                    flex: 1, padding: "0.55rem 0.75rem", borderRadius: "10px",
                    border: "1.5px solid var(--border)", background: "var(--bg-card)",
                    color: "var(--text-primary)", fontFamily: "monospace", fontWeight: 700,
                    letterSpacing: "1px", textTransform: "uppercase"
                  }}
                />
                <button
                  type="submit"
                  disabled={redeemLoading || !inviteCode.trim()}
                  className="primary-btn"
                  style={{ padding: "0.55rem 1rem", fontSize: "0.85rem" }}
                >
                  {redeemLoading ? "Linking..." : "Link"}
                </button>
              </div>

              {successPatient && (
                <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", color: "#10b981", fontSize: "0.85rem" }}>
                  <CheckCircle2 size={16} />
                  <span>Successfully connected to {successPatient}!</span>
                </div>
              )}

              {redeemError && (
                <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", color: "#ef4444", fontSize: "0.85rem" }}>
                  <AlertCircle size={16} />
                  <span>{redeemError}</span>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Appearance & Accessibility */}
        <div className="dash-card">
          <h3 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Type size={20} color="#6c63ff" /> Appearance & Accessibility
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Dark Mode</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Switch to a darker colour palette</span>
              </div>
              <button onClick={toggleDarkMode} style={{ width: '50px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer', background: darkMode ? '#10b981' : 'var(--border)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '2px', left: darkMode ? '24px' : '2px', width: '24px', height: '24px', borderRadius: '50%', background: 'white', transition: 'left 0.3s' }} />
              </button>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Large Text</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Increase text size for easier reading</span>
              </div>
              <button onClick={toggleLargeText} style={{ width: '50px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer', background: largeText ? '#10b981' : 'var(--border)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '2px', left: largeText ? '24px' : '2px', width: '24px', height: '24px', borderRadius: '50%', background: 'white', transition: 'left 0.3s' }} />
              </button>
            </div>
          </div>
        </div>

        {/* Alerts & Notifications */}
        <div className="dash-card">
          <h3 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={20} color="#f59e0b" /> Alerts & Notifications
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Push Notifications</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Receive alerts on your device screen</span>
              </div>
              <button onClick={() => handleToggle("pushNotifications")} style={{ width: '50px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer', background: preferences.pushNotifications ? '#10b981' : 'var(--border)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '2px', left: preferences.pushNotifications ? '24px' : '2px', width: '24px', height: '24px', borderRadius: '50%', background: 'white', transition: 'left 0.3s' }} />
              </button>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Email Alerts</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Get daily digests via email</span>
              </div>
              <button onClick={() => handleToggle("emailAlerts")} style={{ width: '50px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer', background: preferences.emailAlerts ? '#10b981' : 'var(--border)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '2px', left: preferences.emailAlerts ? '24px' : '2px', width: '24px', height: '24px', borderRadius: '50%', background: 'white', transition: 'left 0.3s' }} />
              </button>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="dash-card">
          <h3 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Lock size={20} color="#ef4444" /> Security</h3>
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>New Password</label>
              <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: "var(--bg-card)", color: "var(--text-primary)" }} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Confirm New Password</label>
              <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: "var(--bg-card)", color: "var(--text-primary)" }} required />
            </div>
            {passwordStatus.message && (
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: passwordStatus.error ? '#fef2f2' : '#ecfdf5', color: passwordStatus.error ? '#ef4444' : '#10b981', fontSize: '0.85rem' }}>{passwordStatus.message}</div>
            )}
            <button type="submit" disabled={passwordStatus.loading} style={{ background: 'var(--text-primary)', color: 'white', padding: '0.75rem', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer', opacity: passwordStatus.loading ? 0.7 : 1, alignSelf: 'flex-start' }}>
              {passwordStatus.loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
