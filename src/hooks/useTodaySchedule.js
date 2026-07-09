// src/hooks/useTodaySchedule.js
//
// Shared hook: resolves patient ID, fetches today's medications + logs,
// and builds the exact same todayDoses list used by both Schedule and Dashboard.
// This guarantees 100% consistent numbers across pages.

import { useState, useEffect, useMemo } from "react";
import { ref, get, onValue, query, orderByChild, equalTo } from "firebase/database";
import { db } from "../firebase/config";

// ── Helpers (identical to TodaySchedule.jsx) ──────────────────────────────

function getTodayDateString() {
  const d = new Date();
  return (
    d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

/**
 * Given a medication object, returns the full list of today's scheduled times.
 * Expands "every X hours" frequencies into individual HH:MM slots.
 */
export function getExpandedMedicationTimes(med) {
  const raw =
    Array.isArray(med.reminderTimes) ? med.reminderTimes :
    Array.isArray(med.reminderTime)  ? med.reminderTime  :
    med.reminderTime                 ? [med.reminderTime] : [];

  const baseTimes = raw.filter(Boolean);
  const freq = med.frequency;

  // Expand "every X hours" across the rest of the day
  if (
    freq && typeof freq === "object" &&
    freq.type === "hours" && freq.hours &&
    Number(freq.hours) > 0
  ) {
    const start = baseTimes[0];
    if (!start) return [];
    const [sh, sm] = start.split(":").map(Number);
    const startMins    = (sh || 0) * 60 + (sm || 0);
    const intervalMins = Number(freq.hours) * 60;
    const slots = [];
    for (let mins = startMins; mins < 24 * 60; mins += intervalMins) {
      slots.push(
        String(Math.floor(mins / 60)).padStart(2, "0") + ":" +
        String(mins % 60).padStart(2, "0")
      );
    }
    return slots;
  }

  return baseTimes;
}

// ── The hook ───────────────────────────────────────────────────────────────

/**
 * useTodaySchedule
 *
 * Returns:
 *   resolvedPatientId  – Firebase patients key (or Auth UID as fallback)
 *   todayDoses         – sorted array of { medicationId, medicationName, dosage,
 *                        scheduledTime, foodInstruction, source }
 *   todayLogs          – map keyed by "medicationId_scheduledTime" → log object
 *   loading            – boolean
 */
export function useTodaySchedule(currentUser) {
  const todayStr = getTodayDateString();

  const [resolvedPatientId, setResolvedPatientId] = useState(null);
  const [medications,        setMedications]       = useState([]);
  const [todayLogs,          setTodayLogs]         = useState({});
  const [loading,            setLoading]           = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    let unsubMeds = null;
    let unsubLogs = null;
    let cancelled = false;

    // 1. Resolve patient ID (client-side, no index required)
    get(ref(db, "patients")).then(pSnap => {
      let patientId = currentUser.uid; // fallback
      if (pSnap.exists()) {
        pSnap.forEach(child => {
          if (child.val().linkedUid === currentUser.uid) {
            patientId = child.key;
          }
        });
      }
      if (cancelled) return;

      setResolvedPatientId(patientId);
      console.log("📅 useTodaySchedule: patientId =", patientId);

      // 2. Subscribe to patient medications, indexed by patientId
      const medQuery = query(ref(db, "medications"), orderByChild("patientId"), equalTo(patientId));
      unsubMeds = onValue(medQuery, snap => {
        const list = [];
        snap.forEach(child => {
          const val = child.val();
          list.push({ id: child.key, ...val });
        });
        setMedications(list);
        console.log("📅 useTodaySchedule: medications =", list.length);
      });

      // 3. Subscribe to patient logs, indexed by patientId, filter client-side to today only
      const logQuery = query(ref(db, "adherenceLogs"), orderByChild("patientId"), equalTo(patientId));
      unsubLogs = onValue(logQuery, snap => {
        const map = {};
        snap.forEach(child => {
          const log = child.val();
          if (log.scheduledDate === todayStr) {
            map[log.medicationId + "_" + log.scheduledTime] = { id: child.key, ...log };
          }
        });
        setTodayLogs(map);
        setLoading(false);
        console.log("📅 useTodaySchedule: today logs =", Object.keys(map).length);
      });

    }).catch(err => {
      console.error("useTodaySchedule error:", err);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      if (unsubMeds) unsubMeds();
      if (unsubLogs) unsubLogs();
    };
  }, [currentUser, todayStr]);

  // 4. Build todayDoses using the same expanded-time logic
  const todayDoses = useMemo(() => {
    const list = [];
    medications.forEach(med => {
      // Respect start/end date and status
      if (med.status === "discontinued") return;
      if (med.startDate && med.startDate > todayStr) return;
      if (med.endDate   && med.endDate   < todayStr) return;

      getExpandedMedicationTimes(med).forEach(time => {
        list.push({
          medicationId:   med.id,
          medicationName: med.medicationName || med.name || "Medication",
          dosage:         med.dosage  || "Dose not specified",
          scheduledTime:  time,
          foodInstruction:med.foodInstruction || med.notes || "Follow label instructions",
          source:         med.source  || "self"
        });
      });
    });
    return list.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  }, [medications, todayStr]);

  return { resolvedPatientId, todayDoses, todayLogs, loading };
}
