// src/pages/auth/LoginRegister.jsx
import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set } from "firebase/database";
import { auth, db } from "../../firebase/config";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, User, Phone, CheckCircle, CheckCircle2, HeartHandshake, Stethoscope } from "lucide-react";
import AuroraBackground from "../../components/AuroraBackground";
import "../../styles/auth.css";

import logoIcon from "../../assets/logo.png";

export default function LoginRegister() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: "", password: "", firstName: "", lastName: "", phone: "", role: "patient"
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [shaking, setShaking] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    setError("");
    setSuccess(false);
  }, [isLogin]);

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        triggerSuccess();
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;
        
        await set(ref(db, "users/" + user.uid), {
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          roles: { [formData.role]: true },
          createdAt: new Date().toISOString()
        });

        if (formData.role === "patient") await set(ref(db, "patients/" + user.uid), { linkedUid: user.uid });
        else if (formData.role === "caregiver") await set(ref(db, "caregivers/" + user.uid), { linkedUid: user.uid });
        else if (formData.role === "clinician") await set(ref(db, "clinicians/" + user.uid), { linkedUid: user.uid });

        triggerSuccess();
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Authentication failed");
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      setLoading(false);
    }
  };

  const triggerSuccess = () => {
    setSuccess(true);
    setTimeout(() => { navigate("/"); }, 1000);
  };

  return (
    <div className="auth-layout">
      <div className="auth-left">
        <AuroraBackground />
        <div className="auth-brand-content" style={{ textAlign: "center" }}>
          <img src={logoIcon} alt="CheckIn Care" style={{ width: "80px", height: "80px", marginBottom: "1rem" }} />
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "white", margin: "0 0 0.5rem 0" }}>CheckIn Care</h1>
          <p>Smart Medication Reminder &amp; Adherence System</p>
          <div className="auth-features" style={{ marginTop: "2rem", textAlign: "left" }}>
            <div className="feature-item" style={{ animationDelay: "150ms", fontSize: "1rem", color: "white", display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <CheckCircle2 size={20} color="#10b981" /> <span>Never miss a dose — reminders at exactly the right time</span>
            </div>
            <div className="feature-item" style={{ animationDelay: "300ms", fontSize: "1rem", color: "white", display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <CheckCircle2 size={20} color="#10b981" /> <span>Loop in family — share your schedule with anyone who cares</span>
            </div>
            <div className="feature-item" style={{ animationDelay: "450ms", fontSize: "1rem", color: "white", display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <CheckCircle2 size={20} color="#10b981" /> <span>Know your numbers — track streaks, adherence, and trends</span>
            </div>
            <div className="feature-item" style={{ animationDelay: "600ms", fontSize: "1rem", color: "white", display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <CheckCircle2 size={20} color="#10b981" /> <span>Your care team, connected — patients, family, and doctors in one place</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem" }}>
            <img src={logoIcon} alt="Logo" style={{ width: "52px", height: "52px", marginRight: "1rem" }} />
            <div className="auth-tabs" style={{ marginBottom: 0, flex: 1 }}>
              <button className={"auth-tab" + (isLogin ? " active" : "")} onClick={() => setIsLogin(true)}>Sign In</button>
              <button className={"auth-tab" + (!isLogin ? " active" : "")} onClick={() => setIsLogin(false)}>Create Account</button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className={shaking ? "shake-error" : ""} style={{ transition: "all 300ms ease" }}>
            {!isLogin && (
              <>
                <div className="role-grid">
                  <div
                    className={"role-card" + (formData.role === "patient" ? " selected" : "")}
                    onClick={() => setFormData(p => ({ ...p, role: "patient" }))}
                  >
                    <User size={24} />
                    <span>Patient</span>
                  </div>
                  <div
                    className={"role-card" + (formData.role === "caregiver" ? " selected" : "")}
                    onClick={() => setFormData(p => ({ ...p, role: "caregiver" }))}
                  >
                    <HeartHandshake size={24} />
                    <span>Caregiver</span>
                  </div>
                  <div
                    className={"role-card" + (formData.role === "clinician" ? " selected" : "")}
                    onClick={() => setFormData(p => ({ ...p, role: "clinician" }))}
                  >
                    <Stethoscope size={24} />
                    <span>Clinician</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "1rem" }}>
                  <div className="input-floating" style={{ flex: 1 }}>
                    <input type="text" name="firstName" placeholder="First Name" required value={formData.firstName} onChange={handleChange} />
                    <User size={18} className="input-icon" />
                  </div>
                  <div className="input-floating" style={{ flex: 1 }}>
                    <input type="text" name="lastName" placeholder="Last Name" required value={formData.lastName} onChange={handleChange} />
                    <User size={18} className="input-icon" />
                  </div>
                </div>
                <div className="input-floating">
                  <input type="tel" name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} />
                  <Phone size={18} className="input-icon" />
                </div>
              </>
            )}

            <div className="input-floating">
              <input type="email" name="email" placeholder="Email Address" required value={formData.email} onChange={handleChange} />
              <Mail size={18} className="input-icon" />
            </div>

            <div className="input-floating">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                required
                value={formData.password}
                onChange={handleChange}
                minLength={6}
              />
              <Lock size={18} className="input-icon" />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <div style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: "1rem" }}>{error}</div>
            )}

            <button
              type="submit"
              className="btn-primary"
              style={{ width: "100%", marginBottom: "1rem" }}
              disabled={loading || success}
            >
              {success ? (
                <CheckCircle size={20} />
              ) : loading ? (
                <div className="loading-dots"><span /><span /><span /></div>
              ) : (
                isLogin ? "Sign In" : "Create Account"
              )}
            </button>

            {isLogin && (
              <div style={{ textAlign: "center" }}>
                <Link to="/forgot-password" style={{ color: "#10b981", textDecoration: "none", fontSize: "0.9rem" }}>
                  Forgot your password?
                </Link>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
