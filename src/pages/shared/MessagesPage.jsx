// src/pages/shared/MessagesPage.jsx
//
// PURPOSE: Unified 3-way messaging page used by all three roles.
// Pass the currentUser's role as a prop from each role's router.
// Works for Patient ↔ Clinician ↔ Caregiver conversations.

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebase/config";
import { ref, get, query, orderByChild, equalTo } from "firebase/database";
import {
  subscribeToUserConversations,
  subscribeToMessages,
  sendMessage,
  markConversationRead,
  getOrCreateConversation,
  getOtherParticipant,
  formatMessageTime,
  ROLE_LABELS,
  ROLE_COLORS,
  getRoleInitials
} from "../../utils/messageUtils";
import {
  Send, Search, MessageSquarePlus, ArrowLeft,
  Loader2, CheckCheck, User
} from "lucide-react";

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ name, role, size = 40 }) {
  const colors = ROLE_COLORS[role] || { bg: "#f1f5f9", color: "var(--text-muted)" };
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: colors.bg, color: colors.color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: size * 0.35, flexShrink: 0,
      border: "2px solid " + colors.color + "33"
    }}>
      {getRoleInitials(name)}
    </div>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const colors = ROLE_COLORS[role] || { bg: "#f1f5f9", color: "var(--text-muted)" };
  return (
    <span style={{
      background: colors.bg, color: colors.color,
      fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px",
      borderRadius: "20px", textTransform: "capitalize"
    }}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

// ─── New Conversation Modal ───────────────────────────────────────────────────
function NewConversationModal({ currentUser, userData, activeRole, onStart, onClose }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadContacts() {
      setLoading(true);
      const found = [];

      try {
        // Load linked clinician if patient or caregiver
        if (activeRole === "patient" || activeRole === "caregiver") {
          // Get patient record to find linked clinician
          const patientSnap = await get(
            query(ref(db, "patients"), orderByChild("linkedUid"), equalTo(currentUser.uid))
          );
          if (patientSnap.exists()) {
            const patientData = Object.values(patientSnap.val())[0];
            if (patientData.clinicianId) {
              const clinSnap = await get(ref(db, "users/" + patientData.clinicianId));
              if (clinSnap.exists()) {
                found.push({
                  uid: patientData.clinicianId,
                  role: "clinician",
                  ...clinSnap.val()
                });
              }
            }
            if (patientData.caregiverId) {
              const cgSnap = await get(ref(db, "users/" + patientData.caregiverId));
              if (cgSnap.exists()) {
                found.push({
                  uid: patientData.caregiverId,
                  role: "caregiver",
                  ...cgSnap.val()
                });
              }
            }
          }
        }

        // If clinician, load all their patients
        if (activeRole === "clinician") {
          const patientsSnap = await get(
            query(ref(db, "patients"), orderByChild("clinicianId"), equalTo(currentUser.uid))
          );
          if (patientsSnap.exists()) {
            const patients = patientsSnap.val();
            for (const pid in patients) {
              const p = patients[pid];
              if (p.linkedUid) {
                const userSnap = await get(ref(db, "users/" + p.linkedUid));
                if (userSnap.exists()) {
                  found.push({ uid: p.linkedUid, role: "patient", ...userSnap.val() });
                }
              }
              if (p.caregiverId) {
                const cgSnap = await get(ref(db, "users/" + p.caregiverId));
                if (cgSnap.exists()) {
                  found.push({ uid: p.caregiverId, role: "caregiver", ...cgSnap.val() });
                }
              }
            }
          }
        }

        // If caregiver, load assigned patients and their clinicians
        if (activeRole === "caregiver") {
          const patientsSnap = await get(
            query(ref(db, "patients"), orderByChild("caregiverId"), equalTo(currentUser.uid))
          );
          if (patientsSnap.exists()) {
            const patients = patientsSnap.val();
            for (const pid in patients) {
              const p = patients[pid];
              if (p.linkedUid) {
                const userSnap = await get(ref(db, "users/" + p.linkedUid));
                if (userSnap.exists()) {
                  found.push({ uid: p.linkedUid, role: "patient", ...userSnap.val() });
                }
              }
              if (p.clinicianId) {
                const clinSnap = await get(ref(db, "users/" + p.clinicianId));
                if (clinSnap.exists()) {
                  found.push({ uid: p.clinicianId, role: "clinician", ...clinSnap.val() });
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Error loading contacts:", err);
      }

      // Deduplicate by uid
      const unique = Object.values(
        found.reduce((acc, c) => { acc[c.uid] = c; return acc; }, {})
      );
      setContacts(unique);
      setLoading(false);
    }

    loadContacts();
  }, [currentUser, activeRole]);

  const filtered = contacts.filter(c =>
    (c.displayName || c.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)",
      backdropFilter: "blur(4px)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeIn 0.2s ease"
    }} onClick={onClose}>
      <div className={"messages-shell" + (activeConv ? " has-active-conversation" : "")} style={{
        background: "white", borderRadius: "20px", width: "420px",
        maxHeight: "520px", display: "flex", flexDirection: "column",
        boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
        animation: "slideUp 0.3s cubic-bezier(0.0,0,0.2,1)"
      }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "1.25rem 1.25rem 0" }}>
          <h3 style={{ margin: "0 0 1rem", color: "var(--text-primary)", fontSize: "1rem", fontWeight: 700 }}>
            New Conversation
          </h3>
          <div style={{ position: "relative", marginBottom: "1rem" }}>
            <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts..."
              style={{
                width: "100%", padding: "0.6rem 0.75rem 0.6rem 2.25rem",
                border: "1.5px solid var(--border)", borderRadius: "10px",
                fontSize: "0.875rem", outline: "none", fontFamily: "inherit"
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 1.25rem 1.25rem" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontSize: "0.875rem" }}>
              No contacts found
            </div>
          ) : filtered.map(contact => (
            <div
              key={contact.uid}
              onClick={() => onStart(contact)}
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.75rem", borderRadius: "12px", cursor: "pointer",
                transition: "background 0.15s", marginBottom: "0.25rem"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg-card)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <Avatar name={contact.displayName || contact.email} role={contact.role} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.9rem" }}>
                  {contact.displayName || contact.email}
                </div>
                <RoleBadge role={contact.role} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Chat Window ──────────────────────────────────────────────────────────────
function ChatWindow({ conversation, currentUser, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const other = getOtherParticipant(conversation, currentUser.uid);
  const unreadCount = conversation.unread?.[currentUser.uid] || 0;

  useEffect(() => {
    const unsub = subscribeToMessages(conversation.id, setMessages);
    markConversationRead(conversation.id, currentUser.uid);
    return unsub;
  }, [conversation.id, currentUser.uid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversation.id]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !other) return;
    setInput("");
    setSending(true);
    try {
      await sendMessage(conversation.id, currentUser.uid, other.uid, text);
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.timestamp).toDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Chat header */}
      <div style={{
        padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9",
        display: "flex", alignItems: "center", gap: "0.75rem",
        background: "white", flexShrink: 0
      }}>
        <button
          onClick={onBack}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", display: "flex", alignItems: "center",
            padding: "4px"
          }}
        >
          <ArrowLeft size={20} />
        </button>
        {other && <Avatar name={other.name} role={other.role} size={38} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.95rem" }}>
            {other?.name || "Unknown"}
          </div>
          {other && <RoleBadge role={other.role} />}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "1rem",
        display: "flex", flexDirection: "column", gap: "0.75rem",
        background: "var(--bg-card)"
      }}>
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            {/* Date divider */}
            <div style={{
              textAlign: "center", margin: "0.5rem 0",
              fontSize: "0.75rem", color: "#94a3b8", fontWeight: 500
            }}>
              {new Date(date).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
            </div>

            {msgs.map((msg, i) => {
              const isMine = msg.senderId === currentUser.uid;
              const showAvatar = !isMine && (i === 0 || msgs[i - 1]?.senderId !== msg.senderId);

              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    flexDirection: isMine ? "row-reverse" : "row",
                    alignItems: "flex-end",
                    gap: "0.5rem",
                    marginBottom: "2px",
                    animation: "fadeUp 0.25s ease"
                  }}
                >
                  {!isMine && (
                    <div style={{ width: 28, flexShrink: 0 }}>
                      {showAvatar && <Avatar name={other?.name} role={other?.role} size={28} />}
                    </div>
                  )}

                  <div style={{ maxWidth: "68%" }}>
                    <div style={{
                      background: isMine
                        ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
                        : "white",
                      color: isMine ? "white" : "var(--text-primary)",
                      borderRadius: isMine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      padding: "0.6rem 0.9rem",
                      fontSize: "0.875rem", lineHeight: "1.5",
                      boxShadow: isMine ? "none" : "0 2px 8px rgba(0,0,0,0.06)",
                      border: isMine ? "none" : "1px solid var(--border)",
                      wordBreak: "break-word"
                    }}>
                      {msg.text}
                    </div>
                    <div style={{
                      fontSize: "0.7rem", color: "#94a3b8",
                      marginTop: "3px",
                      textAlign: isMine ? "right" : "left",
                      padding: isMine ? "0 4px 0 0" : "0 0 0 4px",
                      display: "flex",
                      justifyContent: isMine ? "flex-end" : "flex-start",
                      alignItems: "center", gap: "3px"
                    }}>
                      {formatMessageTime(msg.timestamp)}
                      {isMine && <CheckCheck size={12} color="#94a3b8" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#94a3b8" }}>
            <MessageSquarePlus size={36} style={{ marginBottom: "0.75rem", opacity: 0.5 }} />
            <p style={{ fontSize: "0.875rem", margin: 0 }}>
              No messages yet. Say hello to {other?.name}!
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "0.875rem 1rem", borderTop: "1px solid #f1f5f9",
        display: "flex", gap: "0.5rem", alignItems: "flex-end",
        background: "white", flexShrink: 0
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={"Message " + (other?.name || "...")}
          rows={1}
          style={{
            flex: 1, border: "1.5px solid var(--border)", borderRadius: "12px",
            padding: "0.6rem 0.875rem", fontSize: "0.875rem",
            fontFamily: "inherit", resize: "none", outline: "none",
            maxHeight: "120px", overflowY: "auto",
            background: "var(--bg-card)", lineHeight: "1.5",
            transition: "border-color 0.15s"
          }}
          onFocus={e => e.target.style.borderColor = "#2563eb"}
          onBlur={e => e.target.style.borderColor = "var(--border)"}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          style={{
            width: "42px", height: "42px", borderRadius: "12px", flexShrink: 0,
            background: input.trim() && !sending
              ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
              : "var(--border)",
            border: "none",
            cursor: input.trim() && !sending ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s"
          }}
        >
          {sending
            ? <Loader2 size={18} color="#94a3b8" style={{ animation: "spin 1s linear infinite" }} />
            : <Send size={18} color={input.trim() ? "white" : "#94a3b8"} />
          }
        </button>
      </div>
    </div>
  );
}

// ─── Conversation List ────────────────────────────────────────────────────────
function ConversationList({ conversations, currentUser, activeConvId, onSelect, onNew }) {
  const [search, setSearch] = useState("");

  const filtered = conversations.filter(conv => {
    const other = getOtherParticipant(conv, currentUser.uid);
    return (other?.name || "").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* List header */}
      <div style={{
        padding: "1.25rem 1rem 0.75rem",
        borderBottom: "1px solid #f1f5f9", flexShrink: 0
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>Messages</h2>
          <button
            onClick={onNew}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              border: "none", color: "white", borderRadius: "10px",
              padding: "0.45rem 0.875rem", fontSize: "0.8rem",
              fontWeight: 600, cursor: "pointer"
            }}
          >
            <MessageSquarePlus size={15} /> New
          </button>
        </div>
        <div style={{ position: "relative" }}>
          <Search size={15} color="#94a3b8" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search messages..."
            style={{
              width: "100%", padding: "0.55rem 0.75rem 0.55rem 2rem",
              border: "1.5px solid var(--border)", borderRadius: "10px",
              fontSize: "0.8rem", outline: "none", fontFamily: "inherit",
              background: "var(--bg-card)"
            }}
          />
        </div>
      </div>

      {/* Conversations */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#94a3b8" }}>
            <MessageSquarePlus size={32} style={{ marginBottom: "0.75rem", opacity: 0.4 }} />
            <p style={{ fontSize: "0.875rem", margin: "0 0 0.5rem" }}>No conversations yet</p>
            <button
              onClick={onNew}
              style={{
                background: "none", border: "none", color: "#2563eb",
                fontSize: "0.8rem", fontWeight: 600, cursor: "pointer"
              }}
            >
              Start one →
            </button>
          </div>
        ) : filtered.map(conv => {
          const other = getOtherParticipant(conv, currentUser.uid);
          const unread = conv.unread?.[currentUser.uid] || 0;
          const isActive = conv.id === activeConvId;

          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv)}
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.875rem 1rem",
                background: isActive ? "#eff6ff" : "transparent",
                borderLeft: isActive ? "3px solid #2563eb" : "3px solid transparent",
                cursor: "pointer", transition: "all 0.15s"
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--bg-card)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <Avatar name={other?.name} role={other?.role} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: unread > 0 ? 700 : 600, color: "var(--text-primary)", fontSize: "0.875rem" }}>
                    {other?.name || "Unknown"}
                  </span>
                  <span style={{ fontSize: "0.7rem", color: "#94a3b8", flexShrink: 0 }}>
                    {formatMessageTime(conv.lastMessageAt)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                  <span style={{
                    fontSize: "0.8rem", color: unread > 0 ? "var(--text-primary)" : "#94a3b8",
                    fontWeight: unread > 0 ? 500 : 400,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    maxWidth: "160px"
                  }}>
                    {conv.lastMessage || "No messages yet"}
                  </span>
                  {unread > 0 && (
                    <span style={{
                      background: "#2563eb", color: "white",
                      borderRadius: "20px", fontSize: "0.7rem", fontWeight: 700,
                      padding: "2px 7px", flexShrink: 0
                    }}>
                      {unread}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: "3px" }}>
                  <RoleBadge role={other?.role} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main MessagesPage ────────────────────────────────────────────────────────
export default function MessagesPage({ activeRole }) {
  const { currentUser, userData } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToUserConversations(currentUser.uid, (convs) => {
      setConversations(convs);
      setLoading(false);
    });
    return unsub;
  }, [currentUser]);

  const handleStartConversation = async (contact) => {
    setShowNewModal(false);
    try {
      const convId = await getOrCreateConversation(
        currentUser.uid,
        activeRole,
        contact.uid,
        contact.role,
        userData?.displayName || currentUser.email,
        contact.displayName || contact.email
      );
      // Find or create conv object for immediate UI update
      const existingConv = conversations.find(c => c.id === convId);
      if (existingConv) {
        setActiveConv(existingConv);
      } else {
        setActiveConv({
          id: convId,
          participants: {
            [currentUser.uid]: {
              uid: currentUser.uid,
              role: activeRole,
              name: userData?.displayName || currentUser.email
            },
            [contact.uid]: {
              uid: contact.uid,
              role: contact.role,
              name: contact.displayName || contact.email
            }
          },
          lastMessage: null,
          lastMessageAt: null,
          unread: {}
        });
      }
    } catch (err) {
      console.error("Error starting conversation:", err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "400px", color: "#94a3b8" }}>
        <Loader2 size={28} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <>
      <div style={{
        display: "flex", height: "calc(100vh - 4rem)",
        border: "1px solid var(--border)", borderRadius: "16px",
        overflow: "hidden", background: "white",
        boxShadow: "0 4px 20px rgba(0,0,0,0.05)"
      }}>
        {/* Conversation list — always visible on desktop, hidden when chat open on mobile */}
        <div className="messages-list-pane" style={{
          width: "320px", flexShrink: 0, borderRight: "1px solid #f1f5f9",
          display: activeConv ? "none" : "block"
        }}>
          <ConversationList
            conversations={conversations}
            currentUser={currentUser}
            activeConvId={activeConv?.id}
            onSelect={setActiveConv}
            onNew={() => setShowNewModal(true)}
          />
        </div>

        {/* Chat window or empty state */}
        <div className="messages-chat-pane" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {activeConv ? (
            <ChatWindow
              conversation={activeConv}
              currentUser={currentUser}
              onBack={() => setActiveConv(null)}
            />
          ) : (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              color: "#94a3b8", textAlign: "center", padding: "2rem"
            }}>
              <MessageSquarePlus size={52} style={{ marginBottom: "1rem", opacity: 0.35 }} />
              <h3 style={{ color: "var(--text-primary)", margin: "0 0 0.5rem", fontWeight: 700 }}>
                Your messages
              </h3>
              <p style={{ fontSize: "0.875rem", margin: "0 0 1.5rem", maxWidth: "300px" }}>
                Stay connected with your {activeRole === "patient" ? "clinician and caregiver" : activeRole === "caregiver" ? "patients and clinicians" : "patients and caregivers"} in one place.
              </p>
              <button
                onClick={() => setShowNewModal(true)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  border: "none", color: "white", borderRadius: "12px",
                  padding: "0.7rem 1.25rem", fontSize: "0.875rem",
                  fontWeight: 600, cursor: "pointer"
                }}
              >
                <MessageSquarePlus size={17} /> Start a conversation
              </button>
            </div>
          )}
        </div>
      </div>

      {showNewModal && (
        <NewConversationModal
          currentUser={currentUser}
          userData={userData}
          activeRole={activeRole}
          onStart={handleStartConversation}
          onClose={() => setShowNewModal(false)}
        />
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </>
  );
}
