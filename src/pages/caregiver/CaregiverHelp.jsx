// src/pages/caregiver/CaregiverHelp.jsx
//
// PURPOSE: Full Help & Support page for caregivers — mirrors the patient
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
    q: "How do I see a patient's medication schedule?",
    a: "Go to Patients in the sidebar and select any assigned patient. Their profile shows today's doses, adherence rates, and any missed medications highlighted in red. You can also view their full weekly adherence history."
  },
  {
    q: "What triggers a missed dose alert?",
    a: "When a patient's dose passes its scheduled time by 15 minutes without being marked taken or skipped, CheckIn Care automatically records it as missed and sends you an alert. You can review all alerts on the Alerts page."
  },
  {
    q: "How can I contact the patient's clinician?",
    a: "The best way is through the Care Triangle — the shared group room with the patient and their clinician. You can also use the Messages page for direct messages. For urgent medical concerns, please call the clinic directly."
  },
  {
    q: "What is the Care Triangle?",
    a: "The Care Triangle is a shared group chat between the patient, you (the caregiver), and the patient's clinician. It's designed so the whole care team can discuss adherence issues in one place. You can send messages, reply to specific messages, add emoji reactions, and see context cards about missed doses."
  },
  {
    q: "How do I know if my messages have been read?",
    a: "Inside the Care Triangle room, messages show a read indicator. Unread messages from others are flagged — you will also see a red dot on the Care Triangle card on this page when you have unread messages."
  },
  {
    q: "Can I see if a patient took their medication on time?",
    a: "Yes. The patient's adherence history page (accessible from their profile) shows each dose logged as Taken, Missed, or Skipped, along with the exact time it was logged. You can view daily and weekly breakdowns."
  },
  {
    q: "Why is a patient showing as high risk?",
    a: "A patient is flagged as high risk when their adherence falls below 50%, or below 70% with a declining trend over the past 4 weeks. The risk level is calculated automatically and updates daily as new adherence logs come in."
  },
  {
    q: "How do I get technical support?",
    a: "Call the support line on 1-800-555-0199 for technical issues. For feature feedback, use the AI Chat to describe your issue and it will guide you, or contact the development team directly."
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
          width: "100%", background: open ? "#f0f7ff" : "var(--bg-card)",
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
          color: "#475569", fontSize: "0.875rem", lineHeight: "1.65", margin: 0
        }}>
          {item.a}
        </p>
      </div>
    </div>
  );
}

export default function CaregiverHelp() {
  const [chatOpen, setChatOpen] = useState(false);
  const [hasCareUnread, setHasCareUnread] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Subscribe to the first patient room this caregiver is part of, for unread indicator
  useEffect(() => {
    if (!currentUser) return;
    let unsubRoom = null;
    let cancelled = false;

    async function subscribeUnread() {
      const patientsSnap = await get(ref(db, "patients"));
      let patientId = null;

      if (patientsSnap.exists()) {
        patientsSnap.forEach(child => {
          if (patientId) return;
          const p = child.val();
          // Check caregiverIds (object map) or caregiverId (single string)
          const cgIds = p.caregiverIds
            ? (Array.isArray(p.caregiverIds) ? p.caregiverIds : Object.keys(p.caregiverIds))
            : p.caregiverId ? [p.caregiverId] : [];
          if (cgIds.includes(currentUser.uid)) {
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
          <p className="dash-sub">Resources for managing your caregiving duties</p>
        </div>
      </header>

      {/* Contact cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>

        {/* Care Triangle card */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid #e2e8f0",
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
            <div style={{ color: "#64748b", fontSize: "0.8rem" }}>
              Group chat — patient, clinician &amp; you
            </div>
          </div>
          <button
            onClick={() => navigate("/care-triangle")}
            style={{
              background: "#f1f5f9",
              border: "1px solid #e2e8f0", color: "var(--text-primary)", borderRadius: "10px",
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
          background: "var(--bg-card)", border: "1px solid #e2e8f0",
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