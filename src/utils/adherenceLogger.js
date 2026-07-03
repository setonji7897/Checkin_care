// src/utils/adherenceLogger.js
//
// Common utility helper to safely log taken, missed, or skipped medications.

import { ref, push, set, get, serverTimestamp } from "firebase/database";
import { db } from "../firebase/config";
import {
  attachContextCardFromMissedDose,
  getOrCreateRoom,
  sendMessage
} from "../services/careRoomService";

async function writeNotification(userId, payload) {
  if (!userId) return;
  await set(push(ref(db, "notifications/" + userId)), {
    read: false,
    timestamp: Date.now(),
    ...payload
  });
}

async function writeMissedDoseAlerts({ patientId, patient, medicationName, medicationId, scheduledTime, scheduledDate }) {
  const patientUid = patient.linkedUid || patient.uid || patient.userId || patientId;
  const patientName = [patient.firstName, patient.lastName].filter(Boolean).join(" ") || patient.name || "Patient";
  const title = "Missed dose";
  const body = patientName + " missed " + medicationName + " scheduled for " + scheduledTime + ".";

  await writeNotification(patientUid, {
    type: "missed_dose",
    title,
    body: "You missed " + medicationName + " scheduled for " + scheduledTime + ".",
    actionRoute: "/patient/schedule"
  });

  if (patient.caregiverId) {
    const alertRef = push(ref(db, "alerts"));
    await set(alertRef, {
      caregiverId: patient.caregiverId,
      clinicianId: patient.clinicianId || patient.clinicianUid || null,
      patientId,
      patientName,
      medicationId,
      medicationName,
      scheduledTime,
      scheduledDate,
      reason: "Missed dose",
      resolved: false,
      createdAt: serverTimestamp()
    });

    await writeNotification(patient.caregiverId, {
      type: "caregiver_alert",
      title,
      body,
      actionRoute: "/caregiver/alerts"
    });
  }

  const clinicianUid = patient.clinicianUid || patient.clinicianId;
  if (clinicianUid) {
    await writeNotification(clinicianUid, {
      type: "missed_dose_alert",
      title,
      body,
      actionRoute: "/clinician/patients/" + patientId
    });
  }
}

function getCaregiverIds(patient) {
  if (patient.caregiverIds) {
    return Array.isArray(patient.caregiverIds)
      ? patient.caregiverIds.filter(Boolean)
      : Object.keys(patient.caregiverIds).filter(id => patient.caregiverIds[id]);
  }
  return patient.caregiverId ? [patient.caregiverId] : [];
}

async function postMissedDoseToCareTriangle({ patientId, patient, medicationName, medicationId, scheduledTime, scheduledDate }) {
  try {
    const caregiverIds = getCaregiverIds(patient);
    const clinicianId = patient.clinicianUid || patient.clinicianId || null;
    const patientUid = patient.linkedUid || patient.uid || patient.userId || patientId;
    const patientName = [patient.firstName, patient.lastName].filter(Boolean).join(" ") || patient.name || "Patient";

    await getOrCreateRoom(patientId, caregiverIds, clinicianId, {
      patientUid,
      patientName
    });

    await sendMessage(
      patientId,
      "system",
      "system",
      "CheckIn Care",
      "Missed dose recorded for " + medicationName + ".",
      {
        urgent: true,
        contextCard: attachContextCardFromMissedDose(medicationId, scheduledTime, {
          medicationName,
          scheduledDate
        })
      }
    );
  } catch (err) {
    console.error("Care Triangle missed-dose context failed:", err);
  }
}

/**
 * Checks for duplicate slots and records an adherence entry.
 * @returns {Promise<Object>} { success: boolean, logId?: string, error?: string }
 */
export async function logAdherence({ patientId, medicationId, medicationName, scheduledTime, scheduledDate, status }) {
  try {
    const logsRef = ref(db, "adherenceLogs");
    const snapshot = await get(logsRef);
    let duplicateFound = null;

    if (snapshot.exists()) {
      const allLogs = snapshot.val();
      for (const key in allLogs) {
        const log = allLogs[key];
        if (
          log.patientId === patientId &&
          log.medicationId === medicationId &&
          log.scheduledDate === scheduledDate &&
          log.scheduledTime === scheduledTime
        ) {
          duplicateFound = { id: key, ...log };
          break;
        }
      }
    }

    if (duplicateFound) {
      console.warn("Duplicate log ignored for:", { medicationId, scheduledDate, scheduledTime });
      return { success: true, logId: duplicateFound.id, alreadyExists: true };
    }

    const newLogRef = push(ref(db, "adherenceLogs"));
    const logPayload = {
      patientId,
      medicationId,
      medicationName,
      scheduledTime,
      scheduledDate,
      status,
      takenAt: status === "taken" ? serverTimestamp() : null,
      createdAt: serverTimestamp()
    };

    await set(newLogRef, logPayload);

    if (status === "missed") {
      const patientSnap = await get(ref(db, "patients/" + patientId));
      if (patientSnap.exists()) {
        await writeMissedDoseAlerts({
          patientId,
          patient: patientSnap.val(),
          medicationName,
          medicationId,
          scheduledTime,
          scheduledDate
        });
        await postMissedDoseToCareTriangle({
          patientId,
          patient: patientSnap.val(),
          medicationName,
          medicationId,
          scheduledTime,
          scheduledDate
        });
      }
    }

    return { success: true, logId: newLogRef.key };
  } catch (err) {
    console.error("adherenceLogger write failed:", err);
    return { success: false, error: err.message };
  }
}
