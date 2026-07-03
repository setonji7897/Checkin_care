import { ref, get, query, orderByChild, equalTo } from "firebase/database";
import { db } from "../firebase/config";

// --- Helpers ---
function dateStr(d) { return d.toISOString().split("T")[0]; }

function getWeekRange(weeksAgo) {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() - weeksAgo * 7);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { start: dateStr(start), end: dateStr(end) };
}

function dayLabel(ds) {
  return new Date(ds + "T12:00:00").toLocaleDateString([], { weekday: "short" });
}

function weekCounts(actionable, start, end) {
  const wLogs = actionable.filter(l => l.scheduledDate >= start && l.scheduledDate <= end);
  const taken = wLogs.filter(l => l.status === "taken").length;
  const missed = wLogs.filter(l => l.status === "missed").length;
  const skipped = wLogs.filter(l => l.status === "skipped").length;
  const total = taken + missed + skipped;
  return { taken, missed, skipped, total, pct: total > 0 ? Math.round((taken / total) * 100) : 0 };
}

// Extract insights calculation (adapted from PatientDashboard)
function calculatePatientInsights(logs) {
  const actionable = logs.filter(l => l.status === "taken" || l.status === "missed" || l.status === "skipped");

  // Overall adherence
  const totalActionable = actionable.length;
  const totalTaken = actionable.filter(l => l.status === "taken").length;
  const adherencePercent = totalActionable > 0 ? Math.round((totalTaken / totalActionable) * 100) : 0;

  // 4-week trend
  const trendData = Array.from({ length: 4 }, (_, i) => {
    const w = getWeekRange(3 - i);
    return weekCounts(actionable, w.start, w.end).pct;
  });

  let trendDirection = "stable";
  if (trendData.length >= 2) {
    const recent = trendData.slice(-2).reduce((s, d) => s + d, 0) / 2;
    const older  = trendData.slice(0, 2).reduce((s, d) => s + d, 0) / 2;
    if (recent > older + 5) trendDirection = "improving";
    else if (recent < older - 5) trendDirection = "declining";
  }

  // Week summaries for Reports
  const thisWeek = getWeekRange(0);
  const lastWeek = getWeekRange(1);
  const tw = weekCounts(actionable, thisWeek.start, thisWeek.end);
  const lw = weekCounts(actionable, lastWeek.start, lastWeek.end);
  const weekSummary = {
    thisWeekPct: tw.pct,
    lastWeekPct: lw.pct,
    taken: tw.taken,
    missed: tw.missed,
    skipped: tw.skipped
  };

  // Best/Worst day this week
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return dateStr(d);
  });
  const dailyBars = last7.map(ds => {
    const dayLogs = actionable.filter(l => l.scheduledDate === ds);
    return {
      day: dayLabel(ds),
      taken: dayLogs.filter(l => l.status === "taken").length,
      missed: dayLogs.filter(l => l.status === "missed").length,
      skipped: dayLogs.filter(l => l.status === "skipped").length,
      total: dayLogs.length
    };
  });
  
  let bestDay = null;
  let worstDay = null;
  const daysWithLogs = dailyBars.filter(d => d.total > 0);
  if (daysWithLogs.length > 0) {
    const best  = daysWithLogs.reduce((a, b) => ((a.taken / a.total) >= (b.taken / b.total) ? a : b));
    const worst = daysWithLogs.reduce((a, b) => ((a.taken / a.total) <= (b.taken / b.total) ? a : b));
    bestDay = best.day;
    worstDay = worst.day;
  }

  // Day-of-week pattern
  const dowStats = {};
  actionable.forEach(l => {
    const dow = dayLabel(l.scheduledDate);
    if (!dowStats[dow]) dowStats[dow] = { taken: 0, total: 0 };
    dowStats[dow].total++;
    if (l.status === "taken") dowStats[dow].taken++;
  });
  const weakDays = Object.entries(dowStats)
    .filter(([, s]) => s.total >= 3 && (s.taken / s.total) < 0.5)
    .map(([day]) => day);

  // Time-of-day pattern
  const morningMissed = actionable.filter(l => {
    if (l.status !== "missed" || !l.scheduledTime) return false;
    const h = parseInt(l.scheduledTime.split(":")[0], 10);
    return h < 10;
  }).length;
  const totalMissed = actionable.filter(l => l.status === "missed").length;
  const morningPattern = (totalMissed > 3 && morningMissed / totalMissed > 0.5);
  const eveningMissed = totalMissed - morningMissed;
  const eveningPattern = (totalMissed > 3 && eveningMissed / totalMissed > 0.5);

  // Generate summary string
  let summary = "";
  if (totalActionable === 0) {
    summary = "No adherence data available.";
  } else if (trendDirection === "declining") {
    summary = `Adherence declined to ${adherencePercent}% recently.`;
    if (morningPattern) summary += " Missed doses are concentrated in the morning.";
    else if (eveningPattern) summary += " Missed doses are concentrated in the evening/afternoon.";
    else if (weakDays.length > 0) summary += ` Lower adherence observed on ${weakDays.join(" & ")}.`;
  } else if (trendDirection === "improving") {
    summary = `Adherence is improving, currently at ${adherencePercent}%.`;
  } else {
    if (adherencePercent >= 80) summary = "Adherence is stable and high.";
    else summary = `Adherence is stable but low (${adherencePercent}%).`;
    if (weakDays.length > 0) summary += ` Watch for missed doses on ${weakDays.join(" & ")}.`;
  }

  // Risk Level
  let level = "low";
  if (adherencePercent < 50 || (adherencePercent < 70 && trendDirection === "declining")) level = "high";
  else if (adherencePercent < 80 || trendDirection === "declining") level = "medium";

  return {
    level,
    adherencePercent,
    trendDirection,
    summary,
    weekSummary,
    bestDay,
    worstDay,
    trendData, // array of 4 weekly pcts
    dailyBars  // array of 7 daily stats
  };
}

export async function getPatientRiskLevel(patientId) {
  if (!patientId) return null;
  // Fetch adherence logs for patient
  const logsSnap = await get(query(ref(db, "adherenceLogs"), orderByChild("patientId"), equalTo(patientId)));
  const logs = [];
  if (logsSnap.exists()) {
    logsSnap.forEach(child => {
      logs.push(child.val());
    });
  }
  return calculatePatientInsights(logs);
}

export async function getAllPatientsRiskRanked(clinicianId) {
  if (!clinicianId) return [];

  // Fetch all patients for this clinician
  const patientsSnap = await get(ref(db, "patients"));
  const patients = [];
  if (patientsSnap.exists()) {
    patientsSnap.forEach(child => {
      const p = child.val();
      if (p.clinicianId === clinicianId || p.clinicianUid === clinicianId) {
        patients.push({ id: child.key, ...p });
      }
    });
  }

  // Fetch all adherenceLogs to avoid n+1 queries
  const logsSnap = await get(ref(db, "adherenceLogs"));
  const allLogs = [];
  if (logsSnap.exists()) {
    logsSnap.forEach(child => {
      allLogs.push(child.val());
    });
  }

  const results = patients.map(p => {
    const pLogs = allLogs.filter(l => l.patientId === p.id);
    const insights = calculatePatientInsights(pLogs);
    return { ...p, insights };
  });

  // Sort highest-risk first (high > medium > low), then by lowest adherence
  const riskWeight = { high: 3, medium: 2, low: 1 };
  results.sort((a, b) => {
    const wA = riskWeight[a.insights.level] || 1;
    const wB = riskWeight[b.insights.level] || 1;
    if (wA !== wB) return wB - wA; // descending
    // If same risk level, lowest adherence comes first
    return a.insights.adherencePercent - b.insights.adherencePercent;
  });

  return results;
}
