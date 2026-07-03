// src/utils/adherenceStats.js
//
// PURPOSE: Common math calculations for patient dose adherence percentages and filtering.

/**
 * Calculates adherence rate metrics from an array of log objects.
 * Excludes "snoozed" state logs from calculations.
 * @param {Array} logs - Adherence log objects
 * @returns {Object} { taken, missed, skipped, snoozed, total, rate }
 */
export function calculateAdherenceRate(logs = []) {
  let taken = 0;
  let missed = 0;
  let skipped = 0;
  let snoozed = 0;

  logs.forEach(log => {
    if (log.status === "taken") taken++;
    else if (log.status === "missed") missed++;
    else if (log.status === "skipped") skipped++;
    else if (log.status === "snoozed") snoozed++;
  });

  const total = taken + missed + skipped; // Exclude snoozed from rate calculations

  if (total === 0) {
    return { taken, missed, skipped, snoozed, total: 0, rate: null };
  }

  const rate = Number(((taken / total) * 100).toFixed(1));
  return { taken, missed, skipped, snoozed, total, rate };
}

/**
 * Filters adherence logs by inclusive start and end date strings.
 * @param {Array} logs - Adherence log objects
 * @param {string} startDate - "YYYY-MM-DD"
 * @param {string} endDate - "YYYY-MM-DD"
 * @returns {Array}
 */
export function filterLogsByDateRange(logs = [], startDate, endDate) {
  return logs.filter(log => {
    const d = log.scheduledDate;
    return d >= startDate && d <= endDate;
  });
}
