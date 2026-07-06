import { useEffect, useRef, useState } from "react";
import { Send, AlertTriangle, X } from "lucide-react";

export default function MessageInput({ onSendMessage, onTypingChange, replyTo, onCancelReply }) {
  const [text, setText] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [sending, setSending] = useState(false);
  const typingRef = useRef(false);
  const idleTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      if (typingRef.current) onTypingChange?.(false);
    };
  }, [onTypingChange]);

  function markTyping() {
    if (!typingRef.current) {
      typingRef.current = true;
      onTypingChange?.(true);
    }

    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      typingRef.current = false;
      onTypingChange?.(false);
    }, 3000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || sending) return;

    setSending(true);
    try {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      typingRef.current = false;
      onTypingChange?.(false);
      await onSendMessage(text, { urgent: isUrgent });
      setText("");
      setIsUrgent(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="care-triangle-input-wrap">
      {replyTo && (
        <div className="care-reply-preview">
          <div>
            <strong>Replying to {replyTo.senderName}</strong>
            <span>{replyTo.textPreview}</span>
          </div>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply">
            <X size={16} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="care-triangle-input-form">
        <button
          type="button"
          onClick={() => setIsUrgent(!isUrgent)}
          title="Mark as urgent"
          className={"care-triangle-urgent " + (isUrgent ? "active" : "")}
        >
          <AlertTriangle size={20} />
        </button>

        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) markTyping();
          }}
          placeholder="Type a message to your care team..."
          className="care-triangle-input"
        />

        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="care-triangle-send"
          aria-label="Send message"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
