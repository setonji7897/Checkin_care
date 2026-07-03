// src/pages/auth/ForgotPassword.jsx
//
// PURPOSE: Handles sending password reset email verification links to users.

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../firebase/config";
import { useNavigate } from "react-router-dom";
import { getFriendlyErrorMessage } from "../../utils/firebaseErrors";
import "../../styles/auth.css";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("If an account exists for this email, a password reset link has been sent.");
      setEmail("");
    } catch (err) {
      console.error("Password reset failure details:", err);
      setError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-blob blob-1" />
      <div className="auth-blob blob-2" />

      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">💊</span>
          <h1 className="auth-brand">MedRemind</h1>
        </div>

        <p className="auth-subtitle">Reset your account password</p>

        <form onSubmit={handleSubmit} className="auth-form" id="forgot-password-form">
          <div className="field-group">
            <label htmlFor="reset-email">Email Address</label>
            <input
              id="reset-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p style={{ color: "#059669", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "8px", padding: "0.6rem 0.9rem", fontSize: "0.875rem", margin: 0 }} role="alert">{message}</p>}

          <button
            id="btn-submit-reset"
            type="submit"
            className="submit-btn"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <p className="auth-footer">
          Remember your password?{" "}
          <button className="link-btn" onClick={() => navigate("/login")}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
