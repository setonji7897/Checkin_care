// src/utils/formatTime.js

/**
 * Converts a 24-hour time string "HH:MM" to a 12-hour format "h:MM AM/PM".
 * @param {string} timeStr - "HH:MM"
 * @returns {string} - "h:MM AM/PM"
 */
export function formatTime12Hour(timeStr) {
  if (!timeStr) return "";
  if (typeof timeStr !== "string") return String(timeStr);
  const [hoursStr, minutesStr] = timeStr.split(":");
  if (!hoursStr || !minutesStr) return timeStr;
  
  let h = parseInt(hoursStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  h = h ? h : 12; // the hour '0' should be '12'
  
  return `${h}:${minutesStr} ${ampm}`;
}
