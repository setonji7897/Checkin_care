// src/pages/clinician/ClinicianHelp.jsx
//
// PURPOSE: Full Help & Support page for clinicians — mirrors the patient
// HelpSupport experience: Care Triangle card (with unread badge), AI chatbot,
// call support, FAQ accordion, and floating chat button.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import {
  ChevronDown, Phone, MessageCircle, HelpCircle, Users
} from "lucide-react";
import SupportChat from "../../components/SupportChat";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebase/config";
import { subscribeToRoom } from "../../services/careRoomService";
import "../../styles/dashboard.css";

const FAQS = [
  {
    q: "How do I update a patient's prescription?",
    a: "Navigate to the Patient Detail view by clicking on a patient in your Patient List. Under the Medication tab, you can edit dosages, schedules, and food instructions which will instantly sync to the patient's device."
  },
  {
    q: "Can I generate PDF adherence reports?",
    a: "Yes — go to Clinical Reports in the sidebar. Select a patient or choose 'All Patients' for a population-level report. Click 'Export as PDF' to print or save the report."
  },
  {
    q: "How do I assign a caregiver to a patient?",
    a: "In the Patient Detail view, scroll to the Caregiver section and enter the caregiver's account ID. The caregiver will then automatically see this patient in their dashboard and receive missed-dose alerts."
  },
  {
    q: "What does the Care Triangle room do?",
    a: "The Care Triangle is a shared group chat between the patient, their caregiver(s), and you (the clinician). It lets the whole care team discuss adherence issues in one place instead of through disconnected messages. You can send messages, reply to specific messages, add reactions, and share context cards about missed doses."
  },
  {
    q: "How do I discontinue a medication?",
    a: "Go to Medication Management in the sidebar. Find the patient whose medication you want to discontinue, expand their section, and click the red X icon on the medication row. Confirm the action — the medication will be flagged as discontinued and will no longer appear on the patient's schedule, but it will remain in their history."
  },
  {
    q: "What does the Analytics page show?",
    a: "The Analytics page shows population-level adherence trends: a 4-week trend line, a day-of-week adherence bar chart, and a risk-stratified patient table sorted from highest to lowest risk. Each patient row shows their adherence %, risk level badge, a 4-week sparkline, and a one-line clinical summary."
  },
  {
    q: "How are risk levels calculated?",
    a: "Risk is calculated from the patient's adherence logs over 4 weeks. A patient is 'High Risk' if their overall adherence is below 50%, or below 70% with a declining trend. 'Medium Risk' applies to patients below 80% or with a declining trend. Everyone else is 'Low Risk'."
  },
  {
    q: "How do I contact technical support?",
    a: "For platform emergencies, call the IT Support Desk on 1-800-555-0199. For feature requests and feedback, use the 'Submit Feedback' button. For urgent clinical issues, please follow your institution's standard escalation procedure."
  }
];

function FAQItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: "12px",
      overflow: "hidden", transition: "box-shadow 0.2s",
      boxShadow: open ? "0 4px 16px rgba(37,99,235,0.08)" : "none"
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", background: open ? "var(--sidebar-active-bg)" : "var(--bg-card)",
          border: "none", padding: "1rem 1.25rem",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "pointer", textAlign: "left", transition: "background 0.2s"
        }}
      >
        <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.9rem", flex: 1, marginRight: "1rem" }}>
          {item.q}
        </span>
        <ChevronDown
          size={18}
          color="#2563eb"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s", flexShrink: 0 }}
        />
      </button>
      <div style={{
        maxHeight: open ? "300px" : "0",
        overflow: "hidden",
        transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1)"
      }}>
        <p style={{
          padding: "0 1.25rem 1rem",
          color: "var(--text-muted)", fontSize: "0.875rem", lineHeight: "1.65", margin: 0
        }}>
          {item.a}
        </p>
      </div>
    </div>
  );
}

export default function ClinicianHelp() {
  const [chatOpen, setChatOpen] = useState(false);
  const [hasCareUnread, setHasCareUnread] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Subscribe to the first patient room this clinician has, for unread indicator
  useEffect(() => {
    if (!currentUser) return;
    let unsubRoom = null;
    let cancelled = false;

    async function subscribeUnread() {
      const patientsSnap = await get(ref(db, "patients"));
      let patientId = null;

      if (patientsSnap.exists()) {
        patientsSnap.forEach(child => {
          const p = child.val();
          if (!patientId && (p.clinicianId === currentUser.uid || p.clinicianUid === currentUser.uid)) {
            patientId = child.key;
          }
        });
      }

      if (!patientId || cancelled) return;
      unsubRoom = subscribeToRoom(patientId, room => {
        const unread = (room?.messages || []).some(message => (
          message.senderId !== currentUser.uid &&
          (!message.readBy || !message.readBy[currentUser.uid])
        ));
        setHasCareUnread(unread);
      });
    }

    subscribeUnread().catch(err => console.error("Care Triangle unread check failed:", err));

    return () => {
      cancelled = true;
      if (unsubRoom) unsubRoom();
    };
  }, [currentUser]);

  return (
    <div className="page-transition-enter" style={{ maxWidth: "760px" }}>
      <header className="dash-header">
        <div>
          <h1>Help &amp; Support</h1>
          <p className="dash-sub">Resources for managing your clinical platform</p>
        </div>
      </header>

      {/* Contact cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>

        {/* Care Triangle card */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "16px", padding: "1.5rem",
          display: "flex", flexDirection: "column", alignItems: "center",
          textAlign: "center", gap: "0.75rem",
          boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
          position: "relative"
        }}>
          {hasCareUnread && (
            <span
              aria-label="Unread Care Triangle messages"
              style={{
                position: "absolute", top: "1rem", right: "1rem",
                width: "10px", height: "10px", borderRadius: "999px",
                background: "#ef4444", boxShadow: "0 0 0 4px rgba(239,68,68,0.14)"
              }}
            />
          )}
          <div style={{
            width: "52px", height: "52px", borderRadius: "50%",
            background: "#f0fdfa",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <Users size={24} color="#0d9488" />
          </div>
          <div>
            <div style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem" }}>
              Care Triangle
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
              Group chat — patient, caregiver &amp; you
            </div>
          </div>
          <button
            onClick={() => navigate("/care-triangle")}
            style={{
              background: "var(--bg-page)",
              border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: "10px",
              padding: "0.6rem 1.25rem", fontSize: "0.875rem", fontWeight: 700,
              cursor: "pointer", transition: "all 0.2s"
            }}
          >
            Open room
          </button>
        </div>

        {/* Call card */}
        <div style={{
          background: "linear-gradient(135deg, #1e40af, #0d9488)",
          borderRadius: "16px", padding: "1.5rem",
          display: "flex", flexDirection: "column", alignItems: "center",
          textAlign: "center", gap: "0.75rem"
        }}>
          <div style={{
            width: "52px", height: "52px", borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <Phone size={24} color="white" />
          </div>
          <div>
            <div style={{ color: "white", fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem" }}>
              IT Support Desk
            </div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.8rem" }}>
              Available 24/7 for platform emergencies
            </div>
          </div>
          <a
            href="tel:+18005550199"
            style={{
              background: "rgba(255,255,255,0.2)", border: "1.5px solid rgba(255,255,255,0.4)",
              color: "white", borderRadius: "10px", padding: "0.6rem 1.25rem",
              fontSize: "0.875rem", fontWeight: 700, textDecoration: "none",
              transition: "background 0.2s", display: "inline-block"
            }}
          >
            1-800-555-0199
          </a>
        </div>

        {/* AI Chat card */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "16px", padding: "1.5rem",
          display: "flex", flexDirection: "column", alignItems: "center",
          textAlign: "center", gap: "0.75rem",
          boxShadow: "0 4px 20px rgba(0,0,0,0.05)"
        }}>
          <div style={{
            width: "52px", height: "52px", borderRadius: "50%",
            background: "#eff6ff",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <MessageCircle size={24} color="#2563eb" />
          </div>
          <div>
            <div style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem" }}>
              AI Support Chat
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
              AI assistant · instant answers
            </div>
          </div>
          <button
            onClick={() => setChatOpen(true)}
            style={{
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              border: "none", color: "white", borderRadius: "10px",
              padding: "0.6rem 1.25rem", fontSize: "0.875rem", fontWeight: 700,
              cursor: "pointer", transition: "all 0.2s"
            }}
          >
            Start Chat
          </button>
        </div>
      </div>

      {/* FAQ Section */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <HelpCircle size={18} color="#2563eb" />
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Frequently Asked Questions
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {FAQS.map((item, i) => <FAQItem key={i} item={item} />)}
        </div>
      </div>

      {/* App info */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "12px", padding: "1rem 1.25rem",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: "0.5rem"
      }}>
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          CheckIn Care · Version 1.0.0 · Updated June 2026
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button style={{ background: "none", border: "none", color: "#2563eb", fontSize: "0.8rem", fontWeight: 500, cursor: "pointer" }}>
            Privacy Policy
          </button>
          <button style={{ background: "none", border: "none", color: "#2563eb", fontSize: "0.8rem", fontWeight: 500, cursor: "pointer" }}>
            Terms of Service
          </button>
        </div>
      </div>

      {/* Support Chat Modal */}
      <SupportChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />

      {/* Floating Chat Button */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          style={{
            position: "fixed", bottom: "30px", right: "30px",
            width: "60px", height: "60px", borderRadius: "50%",
            background: "linear-gradient(135deg, #2563eb, #0d9488)",
            color: "white", border: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "24px",
            zIndex: 9998, transition: "transform 0.2s"
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.1)"}
          onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
        >
          💬
        </button>
      )}
    </div>
  );
}

