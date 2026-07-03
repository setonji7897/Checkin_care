// src/pages/patient/HelpSupport.jsx
//
// PURPOSE: Help & Support page with working FAQ accordion, support chat trigger,
// and a tel: call button. Replace the old non-functional version with this.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import {
  ChevronDown, Phone, MessageCircle, FileText, Bug,
  HelpCircle, AlertCircle, Users
} from "lucide-react";
import SupportChat from "../../components/SupportChat";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebase/config";
import { subscribeToRoom } from "../../services/careRoomService";

const FAQS = [
  {
    q: "How do I add a medication?",
    a: "Go to My Medications in the sidebar, then tap the '+ Add Medication' button. Fill in the medication name, dosage amount and unit, frequency, start date, and preferred reminder times. All fields marked with * are required before you can save."
  },
  {
    q: "How do I mark a dose as taken?",
    a: "Open Today's Schedule from the sidebar. Each upcoming dose has a 'Take' button. Tap it and your adherence log updates instantly. You can also tap 'Skip' if you intentionally skipped a dose."
  },
  {
    q: "What happens if I miss a dose?",
    a: "If a dose time passes without you marking it taken or skipped, CheckIn Care automatically records it as missed after 15 minutes. Your caregiver (if assigned) will receive a missed dose alert, and your adherence score will reflect it."
  },
  {
    q: "How does my caregiver see my information?",
    a: "Your clinician links your account to a caregiver when they set up your profile. The caregiver can see your today's schedule, adherence score, and missed dose alerts — but they cannot change your prescriptions. Only your clinician can do that."
  },
  {
    q: "How do I change my reminder time?",
    a: "Go to My Medications, find the medication you want to update, and tap on it to open the details. From there you can edit the reminder time(s). Changes take effect immediately and your next reminder will fire at the new time."
  },
  {
    q: "Why aren't my notifications showing up?",
    a: "First check Settings → Notifications & Audio and make sure Push Notifications is turned on. Then check your device/browser notification permissions — the browser must have permission to show notifications from this site. On Chrome, click the lock icon in the address bar to check."
  },
  {
    q: "What is my adherence score?",
    a: "Your adherence score is the percentage of scheduled doses you have taken on time over a given period. A score of 80% or above is generally considered good. You can see your detailed breakdown in the Adherence page including streaks and weekly trends."
  },
  {
    q: "How do I contact my clinician?",
    a: "Go to Messages in the sidebar to send a direct message to your clinician. For urgent medical concerns, please call your clinic directly or go to your nearest emergency room."
  }
];

function FAQItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      border: "1px solid #e2e8f0", borderRadius: "12px",
      overflow: "hidden", transition: "box-shadow 0.2s",
      boxShadow: open ? "0 4px 16px rgba(37,99,235,0.08)" : "none"
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", background: open ? "#f0f7ff" : "white",
          border: "none", padding: "1rem 1.25rem",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "pointer", textAlign: "left", transition: "background 0.2s"
        }}
      >
        <span style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.9rem", flex: 1, marginRight: "1rem" }}>
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
          color: "#475569", fontSize: "0.875rem", lineHeight: "1.65", margin: 0
        }}>
          {item.a}
        </p>
      </div>
    </div>
  );
}

export default function HelpSupport() {
  const [chatOpen, setChatOpen] = useState(false);
  const [hasCareUnread, setHasCareUnread] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;
    let unsubRoom = null;
    let cancelled = false;

    async function subscribeUnread() {
      const patientsSnap = await get(ref(db, "patients"));
      let patientId = currentUser.uid;

      if (patientsSnap.exists()) {
        patientsSnap.forEach(child => {
          const patient = child.val();
          if (patient.linkedUid === currentUser.uid || patient.uid === currentUser.uid || patient.userId === currentUser.uid) {
            patientId = child.key;
          }
        });
      }

      if (cancelled) return;
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
          <h1>Help & Support</h1>
          <p className="dash-sub">Find answers or get in touch with support</p>
        </div>
      </header>

      {/* Contact cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>

        {/* Care Triangle card */}
        <div style={{
          background: "white", border: "1px solid #e2e8f0",
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
                position: "absolute",
                top: "1rem",
                right: "1rem",
                width: "10px",
                height: "10px",
                borderRadius: "999px",
                background: "#ef4444",
                boxShadow: "0 0 0 4px rgba(239,68,68,0.14)"
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
            <div style={{ color: "#0f172a", fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem" }}>
              Care Triangle
            </div>
            <div style={{ color: "#64748b", fontSize: "0.8rem" }}>
              Group chat — you, your caregiver, and clinician
            </div>
          </div>
          <button
            onClick={() => navigate("/care-triangle")}
            style={{
              background: "#f1f5f9",
              border: "1px solid #e2e8f0", color: "#0f172a", borderRadius: "10px",
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
              Call Support
            </div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.8rem" }}>
              Available Mon–Fri, 8am–6pm
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
          background: "white", border: "1px solid #e2e8f0",
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
            <div style={{ color: "#0f172a", fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem" }}>
              Live Chat
            </div>
            <div style={{ color: "#64748b", fontSize: "0.8rem" }}>
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
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
            Frequently Asked Questions
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {FAQS.map((item, i) => <FAQItem key={i} item={item} />)}
        </div>
      </div>

      {/* App info */}
      <div style={{
        background: "#f8fafc", border: "1px solid #e2e8f0",
        borderRadius: "12px", padding: "1rem 1.25rem",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: "0.5rem"
      }}>
        <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
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
            position: "fixed",
            bottom: "30px",
            right: "30px",
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #2563eb, #0d9488)",
            color: "white",
            border: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
            zIndex: 9998,
            transition: "transform 0.2s"
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
