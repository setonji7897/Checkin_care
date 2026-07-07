import { ref, get, query, orderByChild, equalTo, push, set } from "firebase/database";
import { db } from "../firebase/config";

export async function resolvePatientIdForUser(uid) {
  if (!uid) return null;
  const patientQuery = query(ref(db, "patients"), orderByChild("linkedUid"), equalTo(uid));
  const snap = await get(patientQuery);
  return snap.exists() ? Object.keys(snap.val())[0] : uid;
}

export function getPatientName(patient) {
  return patient?.fullName ||
    [patient?.firstName, patient?.lastName].filter(Boolean).join(" ") ||
    patient?.name ||
    "Patient";
}

export function getPatientUid(patient, fallbackId) {
  return patient?.linkedUid || patient?.uid || patient?.userId || fallbackId;
}

export function getMedicationName(medication) {
  return medication?.medicationName || medication?.name || "Medication";
}

export function getMedicationTimes(medication) {
  const value = medication?.reminderTimes || medication?.reminderTime || medication?.times || [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

export function normalizeDateValue(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function calculateAdherence(logs = []) {
  const eligible = logs.filter(log => log.status !== "upcoming");
  const taken = eligible.filter(log => log.status === "taken").length;
  return {
    taken,
    total: eligible.length,
    rate: eligible.length ? Math.round((taken / eligible.length) * 100) : 0
  };
}

export function calculateCurrentStreak(logs = []) {
  let streak = 0;
  const checkDate = new Date();
  while (true) {
    const dateStr = checkDate.toISOString().split("T")[0];
    const dayLogs = logs.filter(log => log.scheduledDate === dateStr);
    if (dayLogs.length === 0) break;
    if (dayLogs.filter(log => log.status === "taken").length === 0) break;
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return streak;
}

export function calculateBestStreak(logs = []) {
  const dates = [...new Set(logs.map(log => log.scheduledDate).filter(Boolean))].sort();
  let best = 0;
  let current = 0;
  dates.forEach(dateStr => {
    const dayLogs = logs.filter(log => log.scheduledDate === dateStr);
    const dayTaken = dayLogs.filter(log => log.status === "taken").length;
    if (dayTaken > 0) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });
  return best;
}

export function calculatePatientRisk(patientId, logs = []) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  cutoff.setHours(0, 0, 0, 0);
  const recentLogs = logs.filter(log =>
    log.patientId === patientId &&
    log.status !== "upcoming" &&
    new Date(log.scheduledDate + "T00:00:00") >= cutoff
  );
  const { rate } = calculateAdherence(recentLogs);
  if (rate < 60) return { label: "High Risk", color: "#ef4444", rate };
  if (rate < 80) return { label: "Watch", color: "#f59e0b", rate };
  return { label: "Stable", color: "#10b981", rate };
}

export async function writeUserNotification(userId, payload) {
  if (!userId) return null;
  const notifRef = push(ref(db, "notifications/" + userId));
  await set(notifRef, {
    timestamp: Date.now(),
    read: false,
    ...payload
  });
  return notifRef.key;
}

export function evaluatePatientAlerts(patientId, logs = [], medications = []) {
  const alerts = [];
  const patientLogs = logs.filter(l => l.patientId === patientId);
  
  // 1. Weekly adherence < 50%
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  cutoff.setHours(0, 0, 0, 0);
  const weeklyLogs = patientLogs.filter(log => log.status !== "upcoming" && new Date(log.scheduledDate + "T00:00:00") >= cutoff);
  if (weeklyLogs.length > 0) {
    const taken = weeklyLogs.filter(log => log.status === "taken").length;
    const rate = Math.round((taken / weeklyLogs.length) * 100);
    if (rate < 50) {
      alerts.push({ type: "adherence", message: `Weekly adherence dropped to ${rate}%` });
    }
  }

  // 2. 2 or more consecutive missed doses
  const pastLogs = patientLogs.filter(l => l.status !== "upcoming")
    .sort((a, b) => {
      const dtA = new Date(`${a.scheduledDate}T${a.scheduledTime || "00:00"}`).getTime();
      const dtB = new Date(`${b.scheduledDate}T${b.scheduledTime || "00:00"}`).getTime();
      return dtB - dtA;
    });

  if (pastLogs.length >= 2) {
    if (pastLogs[0].status === "missed" && pastLogs[1].status === "missed") {
      alerts.push({ type: "consecutive_missed", message: "2+ consecutive missed doses" });
    }
  }

  // 3. No logs in the last 24+ hours despite an active schedule
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const todayDateStr = new Date().toISOString().split("T")[0];
  const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split("T")[0];

  const hasRecentLog = pastLogs.some(l => {
    // Prefer createdAt (epoch ms) — most reliable
    if (l.createdAt && typeof l.createdAt === "number") {
      return l.createdAt >= oneDayAgo;
    }
    // Fall back: any log scheduled today or yesterday counts as recent
    return l.scheduledDate === todayDateStr || l.scheduledDate === yesterdayStr;
  });
  const hasActiveSchedule = medications.some(m => m.patientId === patientId);

  if (!hasRecentLog && hasActiveSchedule) {
    alerts.push({ type: "no_activity", message: "No activity in 24+ hours" });
  }

  return alerts;
}
