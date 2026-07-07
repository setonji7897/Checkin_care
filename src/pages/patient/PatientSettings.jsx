// src/pages/patient/PatientSettings.jsx
import { useState, useEffect } from "react";
import { updatePassword } from "firebase/auth";
import { ref, get, set, update, onValue, query, orderByChild, equalTo } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { Type, Bell, Lock, Volume2, Mic, Play, Users, Clipboard, RefreshCw, XCircle } from "lucide-react";
import { generateInviteCode, getActiveInvitesForPatient, revokeInvite, unlinkCaregiver } from "../../services/careInviteService";
import "../../styles/dashboard.css";

const SOUNDS = [
  { name: "Default Chime", emoji: "🔔" },
  { name: "Gentle Bell", emoji: "🔔" },
  { name: "Double Beep", emoji: "📱" },
  { name: "Rising Sweep", emoji: "🪄" },
  { name: "Marimba", emoji: "🎹" }
];

const playChime = (index = 0) => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  
  const playTone = (freq, type, duration, startTime) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
    
    gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime + startTime);
    osc.stop(ctx.currentTime + startTime + duration);
  };

  if (index === 0) {
    playTone(440, "sine", 0.4, 0);
    playTone(523, "sine", 0.6, 0.2);
  } else if (index === 1) {
    playTone(880, "sine", 0.8, 0);
  } else if (index === 2) {
    playTone(600, "square", 0.1, 0);
    playTone(600, "square", 0.1, 0.2);
  } else if (index === 3) {
    playTone(300, "triangle", 0.2, 0);
    playTone(400, "triangle", 0.2, 0.1);
    playTone(500, "triangle", 0.3, 0.2);
  } else if (index === 4) {
    playTone(349, "sine", 0.5, 0);
    playTone(523, "sine", 0.5, 0.15);
  }
};

export default function PatientSettings() {
  const { currentUser, userData } = useAuth();
  const { darkMode, largeText, toggleDarkMode, toggleLargeText } = useTheme();

  const [notificationSettings, setNotificationSettings] = useState({
    pushEnabled: false,
    voiceEnabled: false,
    alertEnabled: false,
    alertSoundIndex: 0,
    voiceSpeed: 1.0,
    voiceURI: ""
  });

  const [voices, setVoices] = useState([]);
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [passwordStatus, setPasswordStatus] = useState({ loading: false, message: "", error: false });
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Care Team States
  const [resolvedPatientId, setResolvedPatientId] = useState(currentUser?.uid || null);
  const [caregiver, setCaregiver] = useState(null);
  const [activeInvite, setActiveInvite] = useState(null);
  const [countdown, setCountdown] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      let v = window.speechSynthesis.getVoices();
      if (v.length) {
        setVoices(v.filter(voice => voice.lang.startsWith("en")));
      }
    };
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Load from Firebase
  useEffect(() => {
    if (!currentUser) return;
    const fetchSettings = async () => {
      try {
        const snap = await get(ref(db, "users/" + currentUser.uid + "/settings"));
        if (snap.exists()) {
          const s = snap.val();
          setNotificationSettings(prev => ({ ...prev, ...s }));
          if (s.voiceEnabled !== undefined) {
            localStorage.setItem("voiceRemindersEnabled", s.voiceEnabled);
          }
        }
      } catch (err) {
        console.error("Error fetching settings", err);
      } finally {
        setLoadingSettings(false);
      }
    };
    fetchSettings();
  }, [currentUser]);

  // Caregiver and invite synchronization
  useEffect(() => {
    if (!currentUser) return;

    let unsubPatient = null;
    let unsubInvites = null;
    let active = true;

    async function initSync() {
      try {
        const pQuery = query(ref(db, "patients"), orderByChild("linkedUid"), equalTo(currentUser.uid));
        const pSnap = await get(pQuery);
        let patientId = currentUser.uid;
        if (pSnap.exists()) {
          patientId = Object.keys(pSnap.val())[0];
        }

        if (!active) return;
        setResolvedPatientId(patientId);

        // 1. Listen to patient record for caregiverId updates
        const patientRef = ref(db, `patients/${patientId}`);
        unsubPatient = onValue(patientRef, async (snapshot) => {
          if (snapshot.exists()) {
            const patientData = snapshot.val();
            if (patientData.caregiverId) {
              const cgSnap = await get(ref(db, `users/${patientData.caregiverId}`));
              if (cgSnap.exists()) {
                const cgVal = cgSnap.val();
                setCaregiver({
                  uid: patientData.caregiverId,
                  name: [cgVal.firstName, cgVal.lastName].filter(Boolean).join(" ") || cgVal.name || "Caregiver",
                  email: cgVal.email || "",
                  phone: cgVal.phone || ""
                });
              } else {
                setCaregiver({ uid: patientData.caregiverId, name: "Assigned Caregiver" });
              }
            } else {
              setCaregiver(null);
            }
          } else {
            setCaregiver(null);
          }
        });

        // 2. Listen to active invites
        const invitesRef = ref(db, "careInvites");
        unsubInvites = onValue(invitesRef, (snapshot) => {
          if (snapshot.exists()) {
            const now = Date.now();
            let found = null;
            snapshot.forEach((child) => {
              const val = child.val();
              if (val.patientId === patientId && !val.used && !val.revoked && val.expiresAt > now) {
                found = val;
              }
            });
            setActiveInvite(found);
          } else {
            setActiveInvite(null);
          }
        });
      } catch (err) {
        console.error("Error initializing caregiver sync:", err);
      }
    }

    initSync();

    return () => {
      active = false;
      if (unsubPatient) unsubPatient();
      if (unsubInvites) unsubInvites();
    };
  }, [currentUser]);

  // Expiry countdown timer
  useEffect(() => {
    if (!activeInvite) {
      setCountdown("");
      return;
    }
    const updateTimer = () => {
      const remaining = activeInvite.expiresAt - Date.now();
      if (remaining <= 0) {
        setCountdown("Expired");
        setActiveInvite(null);
      } else {
        const hrs = Math.floor(remaining / 3600000);
        const mins = Math.floor((remaining % 3600000) / 60000);
        setCountdown(`${hrs}h ${mins}m remaining`);
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [activeInvite]);

  // Save Notification settings to Firebase
  const updateFirebaseSetting = async (key, value) => {
    if (!currentUser) return;
    setNotificationSettings(prev => ({ ...prev, [key]: value }));
    try {
      await update(ref(db, "users/" + currentUser.uid + "/settings"), { [key]: value });
    } catch (err) {
      console.error("Error saving setting", err);
    }
  };

  const handlePushToggle = async () => {
    const newVal = !notificationSettings.pushEnabled;
    if (newVal) {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        alert("Please enable notifications in your browser settings to use this feature.");
        return;
      }
    }
    updateFirebaseSetting("pushEnabled", newVal);
  };

  const handleVoiceToggle = () => {
    const newVal = !notificationSettings.voiceEnabled;
    updateFirebaseSetting("voiceEnabled", newVal);
    localStorage.setItem("voiceRemindersEnabled", newVal);
    if (newVal) {
      const utterance = new SpeechSynthesisUtterance("Voice reminders enabled");
      utterance.rate = notificationSettings.voiceSpeed;
      if (notificationSettings.voiceURI) {
        const selectedVoice = voices.find(v => v.voiceURI === notificationSettings.voiceURI);
        if (selectedVoice) utterance.voice = selectedVoice;
      }
      window.speechSynthesis.speak(utterance);
    } else {
      window.speechSynthesis.cancel();
    }
  };

  const handleAlertToggle = () => {
    const newVal = !notificationSettings.alertEnabled;
    updateFirebaseSetting("alertEnabled", newVal);
    if (newVal) {
      playChime(notificationSettings.alertSoundIndex);
    }
  };

  const handlePreviewVoice = () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("This is how your reminders will sound.");
    utterance.rate = notificationSettings.voiceSpeed;
    if (notificationSettings.voiceURI) {
      const selectedVoice = voices.find(v => v.voiceURI === notificationSettings.voiceURI);
      if (selectedVoice) utterance.voice = selectedVoice;
    }
    window.speechSynthesis.speak(utterance);
  };

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
      console.error(err);
      setPasswordStatus({ 
        loading: false, 
        message: err.message.includes('requires-recent-login') 
          ? "Please sign out and sign back in to change your password." 
          : "Failed to update password.", 
        error: true 
      });
    }
  };

  const handleGenerateInvite = async () => {
    try {
      const patientName = [userData?.firstName, userData?.lastName].filter(Boolean).join(" ") || "Patient";
      await generateInviteCode(resolvedPatientId || currentUser.uid, patientName);
    } catch (err) {
      console.error("Failed to generate invite code", err);
    }
  };

  const handleRevokeInvite = async () => {
    if (activeInvite) {
      await revokeInvite(activeInvite.code, resolvedPatientId || currentUser.uid);
    }
  };

  const handleUnlinkCaregiver = async () => {
    if (caregiver && window.confirm(`Are you sure you want to remove ${caregiver.name} as your caregiver?`)) {
      await unlinkCaregiver(resolvedPatientId || currentUser.uid, caregiver.uid);
    }
  };

  const handleCopyCode = () => {
    if (!activeInvite) return;
    navigator.clipboard.writeText(activeInvite.code);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  return (
    <div className="page-transition-enter" style={{ maxWidth: "800px", paddingBottom: "2rem" }}>
      <header className="dash-header">
        <div>
          <h1>Settings</h1>
          <p className="dash-sub">Customise your app experience</p>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Care Team Section */}
        <div className="dash-card">
          <h3 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={20} color="#10b981" /> Care Team
          </h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {caregiver ? (
              <div style={{ background: "var(--bg-page)", padding: "1rem", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ display: "block", color: "var(--text-primary)" }}>{caregiver.name}</strong>
                  {caregiver.email && <span style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)" }}>{caregiver.email}</span>}
                  {caregiver.phone && <span style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)" }}>{caregiver.phone}</span>}
                </div>
                <button
                  onClick={handleUnlinkCaregiver}
                  className="outline-btn"
                  style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "#ef4444", borderColor: "#ef4444", padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
                >
                  <XCircle size={14} /> Remove Access
                </button>
              </div>
            ) : (
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
                No caregiver connected. Share an invite code to let a caregiver monitor your adherence.
              </p>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />

            {activeInvite ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", background: "rgba(16, 185, 129, 0.05)", border: "1.5px dashed #10b981", borderRadius: "12px", padding: "1rem", alignItems: "center", textAlign: "center" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#10b981" }}>Active Invite Code</span>
                <span style={{ fontSize: "2rem", fontWeight: 800, fontFamily: "monospace", letterSpacing: "4px", color: "var(--text-primary)" }}>
                  {activeInvite.code}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{countdown}</span>
                
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    onClick={handleCopyCode}
                    className="primary-btn"
                    style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", padding: "0.4rem 0.8rem" }}
                  >
                    <Clipboard size={14} /> {copyFeedback ? "Copied!" : "Copy Code"}
                  </button>
                  <button
                    onClick={handleRevokeInvite}
                    className="outline-btn"
                    style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", padding: "0.4rem 0.8rem" }}
                  >
                    Revoke Code
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleGenerateInvite}
                className="primary-btn"
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", alignSelf: "flex-start", padding: "0.6rem 1.25rem" }}
              >
                <RefreshCw size={16} /> Invite a Caregiver
              </button>
            )}
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
              <button 
                onClick={toggleDarkMode}
                style={{ 
                  width: '50px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                  background: darkMode ? '#10b981' : 'var(--border)', position: 'relative', transition: 'background 0.3s'
                }}
              >
                <div style={{
                  position: 'absolute', top: '2px', left: darkMode ? '24px' : '2px',
                  width: '24px', height: '24px', borderRadius: '50%', background: 'white', transition: 'left 0.3s'
                }} />
              </button>
            </div>
            
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Large Text</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Increase text size for easier reading</span>
              </div>
              <button 
                onClick={toggleLargeText}
                style={{ 
                  width: '50px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                  background: largeText ? '#10b981' : 'var(--border)', position: 'relative', transition: 'background 0.3s'
                }}
              >
                <div style={{
                  position: 'absolute', top: '2px', left: largeText ? '24px' : '2px',
                  width: '24px', height: '24px', borderRadius: '50%', background: 'white', transition: 'left 0.3s'
                }} />
              </button>
            </div>
          </div>
        </div>

        {/* Notifications & Audio */}
        <div className="dash-card" style={{ opacity: loadingSettings ? 0.6 : 1 }}>
          <h3 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={20} color="#f59e0b" /> Notifications & Audio
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Push Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Push Notifications</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Receive alerts on your device screen</span>
              </div>
              <button 
                onClick={handlePushToggle}
                style={{ 
                  width: '50px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                  background: notificationSettings.pushEnabled ? '#10b981' : 'var(--border)', position: 'relative', transition: 'background 0.3s'
                }}
              >
                <div style={{
                  position: 'absolute', top: '2px', left: notificationSettings.pushEnabled ? '24px' : '2px',
                  width: '24px', height: '24px', borderRadius: '50%', background: 'white', transition: 'left 0.3s'
                }} />
              </button>
            </div>
            
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />

            {/* Voice Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <div style={{ background: "#ecfdf5", padding: "0.5rem", borderRadius: "10px", marginTop: "2px" }}>
                  <Mic size={18} color="#10b981" />
                </div>
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Voice Reminders</strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: "block", maxWidth: "250px" }}>
                    Speaks medication name and dosage aloud at reminder time
                  </span>
                </div>
              </div>
              <button 
                onClick={handleVoiceToggle}
                style={{ 
                  width: '50px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                  background: notificationSettings.voiceEnabled ? '#10b981' : 'var(--border)', position: 'relative', transition: 'background 0.3s'
                }}
              >
                <div style={{
                  position: 'absolute', top: '2px', left: notificationSettings.voiceEnabled ? '24px' : '2px',
                  width: '24px', height: '24px', borderRadius: '50%', background: 'white', transition: 'left 0.3s'
                }} />
              </button>
            </div>

            {/* Voice Settings Sub-menu */}
            {notificationSettings.voiceEnabled && (
              <div style={{ background: "var(--bg-card)", padding: "1rem", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "1rem", marginLeft: "2.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "0.5rem", display: "block" }}>Voice Speed ({notificationSettings.voiceSpeed}x)</label>
                    <input 
                      type="range" min="0.5" max="2.0" step="0.25" 
                      value={notificationSettings.voiceSpeed}
                      onChange={e => updateFirebaseSetting("voiceSpeed", parseFloat(e.target.value))}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <button 
                    onClick={handlePreviewVoice}
                    style={{ background: "var(--border)", border: "none", padding: "0.4rem 0.8rem", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem" }}
                  >
                    <Play size={14} /> Preview
                  </button>
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "0.5rem", display: "block" }}>Select Voice</label>
                  <select 
                    value={notificationSettings.voiceURI}
                    onChange={e => updateFirebaseSetting("voiceURI", e.target.value)}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--border)", outline: "none", background: "var(--bg-card)", color: "var(--text-primary)" }}
                  >
                    {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
                  </select>
                </div>
              </div>
            )}
            
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />

            {/* Alert Sounds Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <div style={{ background: "#eff6ff", padding: "0.5rem", borderRadius: "10px", marginTop: "2px" }}>
                  <Volume2 size={18} color="#2563eb" />
                </div>
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Alert Sounds</strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: "block", maxWidth: "250px" }}>
                    Plays a short audio chime at reminder time — no speech
                  </span>
                </div>
              </div>
              <button 
                onClick={handleAlertToggle}
                style={{ 
                  width: '50px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                  background: notificationSettings.alertEnabled ? '#2563eb' : 'var(--border)', position: 'relative', transition: 'background 0.3s'
                }}
              >
                <div style={{
                  position: 'absolute', top: '2px', left: notificationSettings.alertEnabled ? '24px' : '2px',
                  width: '24px', height: '24px', borderRadius: '50%', background: 'white', transition: 'left 0.3s'
                }} />
              </button>
            </div>

            {/* Sound Selector Sub-menu */}
            {notificationSettings.alertEnabled && (
              <div style={{ overflowX: "auto", padding: "0.5rem 0 1rem", marginLeft: "2.5rem" }}>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  {SOUNDS.map((sound, i) => {
                    const isSelected = notificationSettings.alertSoundIndex === i;
                    return (
                      <div 
                        key={i}
                        onClick={() => {
                          updateFirebaseSetting("alertSoundIndex", i);
                          playChime(i);
                        }}
                        style={{
                          minWidth: "120px", padding: "0.75rem", borderRadius: "12px", cursor: "pointer",
                          border: isSelected ? "2px solid #2563eb" : "1.5px solid var(--border)",
                          background: isSelected ? "#eff6ff" : "var(--bg-card)",
                          textAlign: "center", transition: "all 0.2s"
                        }}
                      >
                        <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{sound.emoji}</div>
                        <div style={{ fontSize: "0.8rem", fontWeight: isSelected ? 700 : 500, color: isSelected ? "#1d4ed8" : "var(--text-muted)" }}>
                          {sound.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Security */}
        <div className="dash-card">
          <h3 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={20} color="#ef4444" /> Security
          </h3>
          
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>New Password</label>
              <input 
                type="password" 
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: "var(--bg-card)", color: "var(--text-primary)" }} 
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Confirm New Password</label>
              <input 
                type="password" 
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: "var(--bg-card)", color: "var(--text-primary)" }} 
                required 
              />
            </div>
            
            {passwordStatus.message && (
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: passwordStatus.error ? '#fef2f2' : '#ecfdf5', color: passwordStatus.error ? '#ef4444' : '#10b981', fontSize: '0.85rem' }}>
                {passwordStatus.message}
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={passwordStatus.loading}
              style={{ 
                background: 'var(--text-primary)', color: 'white', padding: '0.75rem', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer',
                opacity: passwordStatus.loading ? 0.7 : 1, alignSelf: 'flex-start'
              }}
            >
              {passwordStatus.loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
