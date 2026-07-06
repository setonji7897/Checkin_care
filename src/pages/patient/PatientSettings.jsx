// src/pages/patient/PatientSettings.jsx
import { useState, useEffect } from "react";
import { updatePassword } from "firebase/auth";
import { ref, get, set, update } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { Type, Bell, Lock, Volume2, Mic, Play } from "lucide-react";
import "../../styles/dashboard.css";

const SOUNDS = [
  { name: "Default Chime", emoji: "🔔" },
  { name: "Gentle Bell", emoji: "ðŸ›Žï¸" },
  { name: "Double Beep", emoji: "ðŸ“±" },
  { name: "Rising Sweep", emoji: "ðŸª„" },
  { name: "Marimba", emoji: "ðŸŽ¹" }
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
  const { currentUser } = useAuth();
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
      window.speechSynthesis.cancel(); // roughly cancels all
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

  return (
    <div className="page-transition-enter" style={{ maxWidth: "800px", paddingBottom: "2rem" }}>
      <header className="dash-header">
        <div>
          <h1>Settings</h1>
          <p className="dash-sub">Customise your app experience</p>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
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
            
            <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: 0 }} />
            
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
            
            <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: 0 }} />

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
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--border)", outline: "none" }}
                  >
                    {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
                  </select>
                </div>
              </div>
            )}
            
            <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: 0 }} />

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
                          background: isSelected ? "#eff6ff" : "white",
                          textAlign: "center", transition: "all 0.2s"
                        }}
                      >
                        <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{sound.emoji}</div>
                        <div style={{ fontSize: "0.8rem", fontWeight: isSelected ? 700 : 500, color: isSelected ? "#1d4ed8" : "#475569" }}>
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
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>New Password</label>
              <input 
                type="password" 
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db' }} 
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>Confirm New Password</label>
              <input 
                type="password" 
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db' }} 
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
