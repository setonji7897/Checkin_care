// src/utils/voiceReminder.js
//
// PURPOSE: Stage 5 — Voice Reminder Engine
//
// HOW IT WORKS:
//   The browser ships with a built-in SpeechSynthesis API (Web Speech API).
//   We use window.speechSynthesis.speak() to read aloud a reminder message.
//
//   We schedule reminders using setTimeout, calculated from the difference
//   between "now" and the medication's scheduled time minus a configurable
//   advance warning (default 5 minutes before).
//
// USAGE:
//   import { scheduleVoiceReminder, cancelAllVoiceReminders } from "./voiceReminder";
//
//   scheduleVoiceReminder({
//     medicationName: "Metformin",
//     dosage: "500mg",
//     scheduledTime: "08:30",
//     foodInstruction: "Take with food",
//     advanceMinutes: 5          // optional, default 5
//   });
//
//   cancelAllVoiceReminders(); // clears all scheduled reminders

// Track all active setTimeout IDs so they can be cancelled
const activeTimers = [];

/**
 * Returns true if the browser supports SpeechSynthesis.
 */
export function isVoiceSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Speaks a message immediately using the Web Speech API.
 * @param {string} message — the text to speak
 * @param {number} [rate=0.95]  — speaking rate (0.1–10, 1 = normal)
 * @param {number} [pitch=1.05] — voice pitch (0–2)
 */
export function speakMessage(message, rate = 0.95, pitch = 1.05) {
  if (!isVoiceSupported()) {
    console.warn("[VoiceReminder] Web Speech API not supported in this browser.");
    return;
  }

  // Cancel any currently speaking message before starting a new one
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.lang = "en-GB"; // British English for a clinical tone

  // Prefer a female voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      (v.name.toLowerCase().includes("female") ||
        v.name.toLowerCase().includes("samantha") ||
        v.name.toLowerCase().includes("karen") ||
        v.name.toLowerCase().includes("google uk"))
  );
  if (preferredVoice) utterance.voice = preferredVoice;

  utterance.onerror = (e) => {
    console.warn("[VoiceReminder] SpeechSynthesis error:", e.error);
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Schedules a voice reminder to fire before a dose's scheduled time.
 *
 * @param {Object} options
 * @param {string} options.medicationName
 * @param {string} options.dosage
 * @param {string} options.scheduledTime  — "HH:MM" in 24-hour format
 * @param {string} [options.foodInstruction]
 * @param {number} [options.advanceMinutes=5] — how many minutes early to remind
 *
 * @returns {number|null} setTimeout timer ID, or null if reminder is in the past
 */
export function scheduleVoiceReminder({
  medicationName,
  dosage,
  scheduledTime,
  foodInstruction = "",
  advanceMinutes = 5,
}) {
  if (!isVoiceSupported()) return null;

  const now = new Date();
  const [hours, minutes] = scheduledTime.split(":").map(Number);

  // Build the target Date object for today's scheduled time
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0
  );

  // Subtract the advance notice window
  const fireAt = new Date(target.getTime() - advanceMinutes * 60 * 1000);
  const msUntilFire = fireAt.getTime() - now.getTime();

  // Skip if the reminder window has already passed
  if (msUntilFire <= 0) return null;

  // Build the spoken message
  const foodNote = foodInstruction ? ` ${foodInstruction}.` : "";
  const message =
    `Medication reminder. In ${advanceMinutes} minutes, please take your ${dosage} dose of ${medicationName}.${foodNote} ` +
    `Scheduled time is ${target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`;

  const timerId = setTimeout(() => {
    speakMessage(message);
  }, msUntilFire);

  activeTimers.push(timerId);
  console.log(
    `[VoiceReminder] Scheduled "${medicationName}" reminder in ${Math.round(msUntilFire / 1000)}s`
  );

  return timerId;
}

/**
 * Cancels ALL pending voice reminder timers and stops any active speech.
 */
export function cancelAllVoiceReminders() {
  activeTimers.forEach((id) => clearTimeout(id));
  activeTimers.length = 0; // clear in place

  if (isVoiceSupported()) {
    window.speechSynthesis.cancel();
  }

  console.log("[VoiceReminder] All voice reminders cancelled.");
}
