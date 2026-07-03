import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ref, get } from "firebase/database";
import { AlertCircle } from "lucide-react";
import RoomHeader from "../../components/CareTriangle/RoomHeader";
import MessageList from "../../components/CareTriangle/MessageList";
import MessageInput from "../../components/CareTriangle/MessageInput";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebase/config";
import {
  getOrCreateRoom,
  markMessagesRead,
  replyToMessage,
  sendMessage,
  setTypingStatus,
  subscribeToRoom
} from "../../services/careRoomService";

function fullName(record, fallback) {
  if (!record) return fallback;
  return [record.firstName, record.lastName].filter(Boolean).join(" ") || record.name || record.displayName || fallback;
}

function caregiverIdsFromPatient(patient) {
  if (!patient) return [];
  if (patient.caregiverIds) {
    return Array.isArray(patient.caregiverIds)
      ? patient.caregiverIds.filter(Boolean)
      : Object.keys(patient.caregiverIds).filter(id => patient.caregiverIds[id]);
  }
  return patient.caregiverId ? [patient.caregiverId] : [];
}

async function resolveCareRoomPatient(currentUser, activeRole, searchParams) {
  if (!currentUser) return null;

  const requestedPatientId = searchParams.get("patientId");
  const patientsSnap = await get(ref(db, "patients"));
  const patients = [];

  if (patientsSnap.exists()) {
    patientsSnap.forEach(child => {
      patients.push({ id: child.key, ...child.val() });
    });
  }

  if (requestedPatientId) {
    return patients.find(patient => patient.id === requestedPatientId) || null;
  }

  if (activeRole === "patient") {
    return patients.find(patient => patient.linkedUid === currentUser.uid || patient.uid === currentUser.uid || patient.userId === currentUser.uid) || {
      id: currentUser.uid,
      linkedUid: currentUser.uid,
      name: currentUser.displayName || "Patient"
    };
  }

  if (activeRole === "caregiver") {
    return patients.find(patient => caregiverIdsFromPatient(patient).includes(currentUser.uid)) || null;
  }

  if (activeRole === "clinician") {
    return patients.find(patient => (patient.clinicianId || patient.clinicianUid) === currentUser.uid) || null;
  }

  return null;
}

export default function CareTriangle() {
  const { currentUser, userData, activeRole } = useAuth();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [room, setRoom] = useState(null);
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replyTo, setReplyTo] = useState(null);

  const typingNames = useMemo(() => {
    const typing = room?.typing || {};
    return Object.keys(typing)
      .filter(uid => uid !== currentUser?.uid && typing[uid])
      .map(uid => {
        if (uid === room?.patientUid) return room?.patientName || "Patient";
        if (uid === room?.clinicianId) return room?.clinicianName || "Clinician";
        return room?.caregiverNames?.[uid] || "Care team member";
      });
  }, [room, currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    let unsubscribe = null;
    let cancelled = false;

    async function startRoom() {
      setLoading(true);
      setError("");

      try {
        const resolvedPatient = await resolveCareRoomPatient(currentUser, activeRole, searchParams);
        if (!resolvedPatient) {
          if (!cancelled) {
            setPatient(null);
            setRoom(null);
            setError("No linked patient was found for this care room.");
            setLoading(false);
          }
          return;
        }

        const patientId = resolvedPatient.id;
        const caregiverIds = caregiverIdsFromPatient(resolvedPatient);
        const clinicianId = resolvedPatient.clinicianId || resolvedPatient.clinicianUid || null;
        const patientUid = resolvedPatient.linkedUid || resolvedPatient.uid || resolvedPatient.userId || patientId;

        await getOrCreateRoom(patientId, caregiverIds, clinicianId, {
          patientUid,
          patientName: fullName(resolvedPatient, "Patient")
        });

        if (cancelled) return;
        setPatient(resolvedPatient);

        unsubscribe = subscribeToRoom(patientId, nextRoom => {
          if (cancelled) return;
          setRoom(nextRoom);
          setLoading(false);
          if (nextRoom) markMessagesRead(patientId, currentUser.uid);
        });
      } catch (err) {
        console.error("Care Triangle room failed:", err);
        if (!cancelled) {
          setError("The Care Triangle could not be loaded. Please try again.");
          setLoading(false);
        }
      }
    }

    startRoom();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser, activeRole, searchParams]);

  async function handleSendMessage(text, options) {
    if (!patient || !currentUser) return;

    const senderName = fullName(userData, currentUser.displayName || "Care team member");
    if (replyTo) {
      await replyToMessage(
        patient.id,
        currentUser.uid,
        activeRole || "patient",
        senderName,
        text,
        replyTo
      );
      setReplyTo(null);
    } else {
      await sendMessage(
        patient.id,
        currentUser.uid,
        activeRole || "patient",
        senderName,
        text,
        options
      );
    }
    await setTypingStatus(patient.id, currentUser.uid, false);
  }

  const handleTypingChange = useCallback((isTyping) => {
    if (!patient || !currentUser) return;
    setTypingStatus(patient.id, currentUser.uid, isTyping).catch(err => {
      console.error("Typing status update failed:", err);
    });
  }, [patient, currentUser]);

  if (loading) {
    return (
      <div className="care-triangle-shell care-triangle-state">
        <div className="care-triangle-loader" />
        <p>Loading your Care Triangle...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="care-triangle-shell care-triangle-state">
        <AlertCircle size={28} color="#ef4444" />
        <h2>Care Triangle unavailable</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="page-transition-enter care-triangle-shell">
      <RoomHeader
        patientName={room?.patientName || fullName(patient, "Patient")}
        caregiverNames={room?.caregiverNames || {}}
        clinicianName={room?.clinicianName || "Clinician"}
      />
      <MessageList
        messages={room?.messages || []}
        currentUserUid={currentUser.uid}
        patientId={patient.id}
        onReply={setReplyTo}
      />
      {typingNames.length > 0 && (
        <div className="care-typing-indicator">
          {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing...
        </div>
      )}
      <MessageInput
        onSendMessage={handleSendMessage}
        onTypingChange={handleTypingChange}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}
