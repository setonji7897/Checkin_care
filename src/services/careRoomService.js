import { ref, push, set, get, onValue, serverTimestamp, update, child, remove, onDisconnect } from "firebase/database";
import { auth, db } from "../firebase/config";

function toMemberMap(ids) {
  if (!ids) return {};
  if (Array.isArray(ids)) {
    return ids.filter(Boolean).reduce((acc, id) => {
      acc[id] = true;
      return acc;
    }, {});
  }
  if (typeof ids === "object") {
    return Object.keys(ids).filter(id => ids[id]).reduce((acc, id) => {
      acc[id] = true;
      return acc;
    }, {});
  }
  return { [ids]: true };
}

function cleanUndefined(value) {
  return Object.keys(value).reduce((acc, key) => {
    if (value[key] !== undefined) acc[key] = value[key];
    return acc;
  }, {});
}

export async function getOrCreateRoom(patientId, caregiverIds = [], clinicianId = null, options = {}) {
  if (!patientId) throw new Error("patientId is required to create a care room");

  const roomRef = ref(db, "careRooms/" + patientId);
  const snapshot = await get(roomRef);
  const caregiverMap = toMemberMap(caregiverIds);
  const patientUid = options.patientUid || patientId;

  const basePayload = cleanUndefined({
    patientId,
    patientUid,
    patientName: options.patientName || null,
    caregiverIds: caregiverMap,
    clinicianId: clinicianId || null,
    clinicianName: options.clinicianName || null,
    caregiverNames: options.caregiverNames || {},
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp()
  });

  if (!snapshot.exists()) {
    await set(roomRef, basePayload);
    return basePayload;
  }

  const room = snapshot.val();
  const updates = {};

  if (!room.patientUid && patientUid) updates.patientUid = patientUid;
  if (options.patientName && room.patientName !== options.patientName) updates.patientName = options.patientName;
  if (clinicianId && room.clinicianId !== clinicianId) updates.clinicianId = clinicianId;
  if (options.clinicianName && room.clinicianName !== options.clinicianName) updates.clinicianName = options.clinicianName;

  Object.keys(caregiverMap).forEach(uid => {
    if (!room.caregiverIds || !room.caregiverIds[uid]) {
      updates["caregiverIds/" + uid] = true;
    }
  });

  Object.keys(options.caregiverNames || {}).forEach(uid => {
    if (!room.caregiverNames || room.caregiverNames[uid] !== options.caregiverNames[uid]) {
      updates["caregiverNames/" + uid] = options.caregiverNames[uid];
    }
  });

  if (Object.keys(updates).length > 0) {
    await update(roomRef, updates);
  }

  return { ...room, ...updates };
}

export function subscribeToRoom(patientId, callback) {
  if (!patientId) return () => {};
  const roomRef = ref(db, "careRooms/" + patientId);
  return onValue(roomRef, (snapshot) => {
    const room = snapshot.val();
    if (!room) {
      callback(null);
      return;
    }

    const messages = Object.entries(room.messages || {})
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));

    callback({ ...room, messages });
  });
}

export async function sendMessage(patientId, senderId, senderRole, senderName, text, options = {}) {
  if (!patientId || !senderId) throw new Error("patientId and senderId are required to send a message");

  const roomRef = ref(db, "careRooms/" + patientId);
  const messagesRef = child(roomRef, "messages");
  const newMessageRef = push(messagesRef);
  const trimmedText = typeof text === "string" ? text.trim() : "";

  const messageData = cleanUndefined({
    senderId,
    senderRole,
    senderName: senderName || "Care team member",
    text: trimmedText || null,
    urgent: !!options.urgent,
    contextCard: options.contextCard || null,
    deleted: false,
    editedAt: null,
    replyTo: options.replyTo || null,
    reactions: {},
    readBy: { [senderId]: true },
    createdAt: serverTimestamp()
  });

  await set(newMessageRef, messageData);
  await update(roomRef, {
    lastMessageAt: serverTimestamp(),
    lastMessagePreview: trimmedText || (options.contextCard ? "Shared an adherence update" : "")
  });

  return newMessageRef.key;
}

export async function editMessage(patientId, messageId, newText) {
  const currentUid = auth.currentUser?.uid;
  if (!patientId || !messageId || !currentUid) throw new Error("Cannot edit this message");

  const messageRef = ref(db, "careRooms/" + patientId + "/messages/" + messageId);
  const snapshot = await get(messageRef);
  if (!snapshot.exists() || snapshot.val().senderId !== currentUid) {
    throw new Error("Only the original sender can edit this message");
  }

  await update(messageRef, {
    text: String(newText || "").trim(),
    editedAt: serverTimestamp()
  });
}

export async function deleteMessage(patientId, messageId) {
  const currentUid = auth.currentUser?.uid;
  if (!patientId || !messageId || !currentUid) throw new Error("Cannot delete this message");

  const messageRef = ref(db, "careRooms/" + patientId + "/messages/" + messageId);
  const snapshot = await get(messageRef);
  if (!snapshot.exists() || snapshot.val().senderId !== currentUid) {
    throw new Error("Only the original sender can delete this message");
  }

  await update(messageRef, {
    deleted: true,
    editedAt: serverTimestamp()
  });
}

export async function replyToMessage(patientId, senderId, senderRole, senderName, text, replyTo) {
  const replySnapshot = replyTo ? {
    messageId: replyTo.messageId || replyTo.id,
    senderName: replyTo.senderName || "Care team member",
    textPreview: String(replyTo.textPreview || replyTo.text || "Message").slice(0, 60)
  } : null;

  return sendMessage(patientId, senderId, senderRole, senderName, text, { replyTo: replySnapshot });
}

export async function setReaction(patientId, messageId, uid, emoji) {
  if (!patientId || !messageId || !uid || !emoji) return;

  const reactionRef = ref(db, "careRooms/" + patientId + "/messages/" + messageId + "/reactions/" + uid);
  const snapshot = await get(reactionRef);

  if (snapshot.exists() && snapshot.val() === emoji) {
    await remove(reactionRef);
    return;
  }

  await set(reactionRef, emoji);
}

export async function setTypingStatus(patientId, uid, isTyping) {
  if (!patientId || !uid) return;

  const typingRef = ref(db, "careRooms/" + patientId + "/typing/" + uid);
  if (isTyping) {
    await set(typingRef, true);
    await onDisconnect(typingRef).remove();
    return;
  }

  await remove(typingRef);
}

export async function markMessagesRead(patientId, uid) {
  if (!patientId || !uid) return;

  const roomRef = ref(db, "careRooms/" + patientId);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return;

  const room = snapshot.val();
  const updates = {};

  Object.keys(room.messages || {}).forEach(messageId => {
    const message = room.messages[messageId];
    if (!message.readBy || !message.readBy[uid]) {
      updates["messages/" + messageId + "/readBy/" + uid] = true;
    }
  });

  if (Object.keys(updates).length > 0) {
    await update(roomRef, updates);
  }
}

export function attachContextCardFromMissedDose(medicationId, scheduledTime, details = {}) {
  return {
    type: "missedDose",
    medicationId,
    medicationName: details.medicationName || "Medication",
    scheduledTime,
    scheduledDate: details.scheduledDate || "",
    status: "missed"
  };
}
