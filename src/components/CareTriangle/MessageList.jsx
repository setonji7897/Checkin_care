import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import EmptyRoomState from "./EmptyRoomState";

export default function MessageList({ messages, currentUserUid, patientId, onReply }) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!messages || messages.length === 0) {
    return <EmptyRoomState />;
  }

  return (
    <div className="care-triangle-messages">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          isOwnMessage={message.senderId === currentUserUid}
          currentUserUid={currentUserUid}
          patientId={patientId}
          onReply={onReply}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
