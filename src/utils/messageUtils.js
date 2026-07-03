// src/utils/messageUtils.js
//
// PURPOSE: Shared utilities for the 3-way messaging system.
// Handles conversation ID generation, message sending, and real-time listeners.

import {
  ref, push, set, onValue, off, get,
  query, orderByChild, serverTimestamp, update
} from "firebase/database";
import { db } from "../firebase/config";

/**
 * Generate a deterministic conversation ID from two user IDs.
 * Sorting ensures uid_A--uid_B === uid_B--uid_A regardless of who initiates.
 */
export function getConversationId(uid1, uid2) {
  return [uid1, uid2].sort().join("--");
}

/**
 * Create or fetch a conversation between two users.
 * Writes metadata only if the conversation doesn't exist yet.
 */
export async function getOrCreateConversation(uid1, role1, uid2, role2, name1, name2) {
  const convId = getConversationId(uid1, uid2);
  const convRef = ref(db, "conversations/" + convId);
  const snap = await get(convRef);

  if (!snap.exists()) {
    await set(convRef, {
      participants: {
        [uid1]: { role: role1, name: name1, uid: uid1 },
        [uid2]: { role: role2, name: name2, uid: uid2 }
      },
      createdAt: Date.now(),
      lastMessage: null,
      lastMessageAt: null,
      unread: { [uid1]: 0, [uid2]: 0 }
    });
  }

  return convId;
}

/**
 * Send a message to a conversation.
 * Updates the conversation's lastMessage and increments unread for recipient.
 */
export async function sendMessage(conversationId, senderId, recipientId, text) {
  const msgRef = push(ref(db, "conversations/" + conversationId + "/messages"));
  const messageData = {
    senderId,
    text: text.trim(),
    timestamp: Date.now(),
    read: false
  };

  await set(msgRef, messageData);

  // Update conversation metadata
  await update(ref(db, "conversations/" + conversationId), {
    lastMessage: text.trim(),
    lastMessageAt: Date.now()
  });

  // Increment unread count for recipient
  const unreadRef = ref(db, "conversations/" + conversationId + "/unread/" + recipientId);
  const unreadSnap = await get(unreadRef);
  const currentUnread = unreadSnap.exists() ? unreadSnap.val() : 0;
  await set(unreadRef, currentUnread + 1);
}

/**
 * Mark all messages in a conversation as read for a given user.
 * Resets their unread count to 0.
 */
export async function markConversationRead(conversationId, userId) {
  await set(
    ref(db, "conversations/" + conversationId + "/unread/" + userId),
    0
  );
}

/**
 * Subscribe to real-time messages in a conversation.
 * Returns an unsubscribe function.
 */
export function subscribeToMessages(conversationId, callback) {
  const msgsRef = ref(db, "conversations/" + conversationId + "/messages");
  const handler = (snap) => {
    const messages = [];
    if (snap.exists()) {
      const vals = snap.val();
      for (const key in vals) {
        messages.push({ id: key, ...vals[key] });
      }
      messages.sort((a, b) => a.timestamp - b.timestamp);
    }
    callback(messages);
  };
  onValue(msgsRef, handler);
  return () => off(msgsRef, "value", handler);
}

/**
 * Subscribe to all conversations a user is part of.
 * Returns an unsubscribe function.
 */
export function subscribeToUserConversations(userId, callback) {
  const convsRef = ref(db, "conversations");
  const handler = (snap) => {
    const convs = [];
    if (snap.exists()) {
      const vals = snap.val();
      for (const key in vals) {
        const conv = vals[key];
        if (conv.participants && conv.participants[userId]) {
          convs.push({ id: key, ...conv });
        }
      }
      convs.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
    }
    callback(convs);
  };
  onValue(convsRef, handler);
  return () => off(convsRef, "value", handler);
}

/**
 * Get the other participant's info from a conversation object.
 */
export function getOtherParticipant(conversation, currentUserId) {
  const participants = conversation.participants || {};
  const otherUid = Object.keys(participants).find(uid => uid !== currentUserId);
  return otherUid ? participants[otherUid] : null;
}

/**
 * Format a timestamp for display in conversations.
 */
export function formatMessageTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/**
 * Role display helpers
 */
export const ROLE_LABELS = {
  patient: "Patient",
  caregiver: "Caregiver",
  clinician: "Clinician"
};

export const ROLE_COLORS = {
  patient: { bg: "#ede9ff", color: "#6c63ff" },
  caregiver: { bg: "#ecfdf5", color: "#059669" },
  clinician: { bg: "#eff6ff", color: "#2563eb" }
};

export function getRoleInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}
