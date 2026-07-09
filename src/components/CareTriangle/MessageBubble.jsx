import { useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import ContextCard from "./ContextCard";
import { deleteMessage, editMessage, setReaction } from "../../services/careRoomService";

const REACTION_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function formatMessageTime(value) {
  if (!value) return "";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function reactionGroups(reactions) {
  const grouped = {};
  Object.entries(reactions || {}).forEach(([uid, emoji]) => {
    if (!grouped[emoji]) grouped[emoji] = [];
    grouped[emoji].push(uid);
  });
  return grouped;
}

function previewFor(message) {
  if (message.deleted) return "This message was deleted";
  if (message.text) return message.text.slice(0, 60);
  if (message.contextCard) return "Shared an adherence update";
  return "Message";
}

export default function MessageBubble({ message, isOwnMessage, currentUserUid, patientId, onReply }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text || "");
  const pressTimer = useRef(null);
  const roleClass = "care-triangle-role " + (message.senderRole || "patient");
  const bubbleClass = "care-triangle-bubble " + (isOwnMessage ? "own" : "other") + (message.urgent ? " urgent" : "");
  const groupedReactions = reactionGroups(message.reactions);

  function startPress() {
    pressTimer.current = window.setTimeout(() => setMenuOpen(true), 450);
  }

  function clearPress() {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
  }

  async function saveEdit() {
    const nextText = draft.trim();
    if (!nextText || nextText === message.text) {
      setEditing(false);
      setDraft(message.text || "");
      return;
    }
    await editMessage(patientId, message.id, nextText);
    setEditing(false);
  }

  function handleReply() {
    onReply({
      messageId: message.id,
      senderName: message.senderName || "Care team member",
      textPreview: previewFor(message)
    });
    setMenuOpen(false);
  }

  async function handleReaction(emoji) {
    await setReaction(patientId, message.id, currentUserUid, emoji);
    setMenuOpen(false);
  }

  return (
    <div
      className={"care-triangle-message " + (isOwnMessage ? "own" : "other")}
      onMouseLeave={() => setMenuOpen(false)}
      onTouchStart={startPress}
      onTouchEnd={clearPress}
      onTouchCancel={clearPress}
    >
      <div className="care-triangle-message-meta">
        <span className="care-triangle-name">{message.senderName || "Care team member"}</span>
        <span className={roleClass}>{message.senderRole || "member"}</span>
        <span className="care-triangle-time">{formatMessageTime(message.createdAt)}</span>
        {message.editedAt && !message.deleted && <span className="care-triangle-edited">edited</span>}
      </div>

      <div className="care-triangle-bubble-wrap">
        <button
          type="button"
          className="care-message-menu-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Message actions"
        >
          <MoreHorizontal size={16} />
        </button>

        {menuOpen && (
          <div className={"care-message-menu " + (isOwnMessage ? "own" : "other")}>
            <button type="button" onClick={handleReply}>Reply</button>
            {isOwnMessage && !message.deleted && message.text && (
              <button type="button" onClick={() => { setEditing(true); setMenuOpen(false); }}>Edit</button>
            )}
            {isOwnMessage && !message.deleted && (
              <button type="button" onClick={() => { deleteMessage(patientId, message.id); setMenuOpen(false); }}>Delete</button>
            )}
            <div className="care-reaction-picker">
              {REACTION_OPTIONS.map(emoji => (
                <button key={emoji} type="button" onClick={() => handleReaction(emoji)}>{emoji}</button>
              ))}
            </div>
          </div>
        )}

        {message.contextCard && !message.deleted && <ContextCard card={message.contextCard} />}

        {(message.text || message.deleted) && (
          <div className={bubbleClass}>
            {message.replyTo && !message.deleted && (
              <div className="care-reply-quote">
                <strong>{message.replyTo.senderName}</strong>
                <span>{message.replyTo.textPreview}</span>
              </div>
            )}

            {message.deleted ? (
              <span className="care-deleted-message">This message was deleted</span>
            ) : editing ? (
              <input
                value={draft}
                autoFocus
                className="care-edit-input"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") {
                    setDraft(message.text || "");
                    setEditing(false);
                  }
                }}
              />
            ) : (
              message.text
            )}
          </div>
        )}
      </div>

      {Object.keys(groupedReactions).length > 0 && (
        <div className={"care-reaction-row " + (isOwnMessage ? "own" : "other")}>
          {Object.entries(groupedReactions).map(([emoji, uids]) => (
            <button
              key={emoji}
              type="button"
              className={"care-reaction-pill " + (uids.includes(currentUserUid) ? "active" : "")}
              onClick={() => handleReaction(emoji)}
            >
              {emoji} {uids.length}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
