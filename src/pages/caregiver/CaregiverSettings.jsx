// src/pages/caregiver/CaregiverSettings.jsx
import { useState, useEffect } from "react";
import { updatePassword } from "firebase/auth";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { Type, Bell, Lock } from "lucide-react";
import "../../styles/dashboard.css";

export default function CaregiverSettings() {
  const { currentUser } = useAuth();
  const { darkMode, largeText, toggleDarkMode, toggleLargeText } = useTheme();
  
  const [preferences, setPreferences] = useState({
    pushNotifications: localStorage.getItem("pushNotifications") !== "false",
    emailAlerts: localStorage.getItem("emailAlerts") !== "false"
  });

  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [passwordStatus, setPasswordStatus] = useState({ loading: false, message: "", error: false });

  useEffect(() => {
    localStorage.setItem("pushNotifications", preferences.pushNotifications);
    localStorage.setItem("emailAlerts", preferences.emailAlerts);
  }, [preferences]);

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

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Settings</h1>
          <p className="dash-sub">Customise your caregiver dashboard</p>
        </div>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
            <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: 0 }} />
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
            <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: 0 }} />
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

        <div className="dash-card">
          <h3 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Lock size={20} color="#ef4444" /> Security</h3>
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>New Password</label>
              <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db' }} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>Confirm New Password</label>
              <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db' }} required />
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
