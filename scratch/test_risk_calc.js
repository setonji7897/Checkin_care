import { initializeApp } from "firebase/app";
import { getDatabase, ref, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCCxT6jmVbyszfiMHsyXiBtXtqjOE5kGPk",
  authDomain: "smart-medication-reminde-d7f30.firebaseapp.com",
  databaseURL: "https://smart-medication-reminde-d7f30-default-rtdb.firebaseio.com",
  projectId: "smart-medication-reminde-d7f30",
  storageBucket: "smart-medication-reminde-d7f30.firebasestorage.app",
  messagingSenderId: "1018909313942",
  appId: "1:1018909313942:web:cb3c8e0baa08aa63002bb7"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function calculateAdherence(logs = []) {
  const eligible = logs.filter(log => log.status !== "upcoming");
  const taken = eligible.filter(log => log.status === "taken").length;
  return {
    taken,
    total: eligible.length,
    rate: eligible.length ? Math.round((taken / eligible.length) * 100) : 0
  };
}

function calculatePatientRisk(patientId, logs = [], linkedUid = null) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  cutoff.setHours(0, 0, 0, 0);
  const recentLogs = logs.filter(log =>
    (log.patientId === patientId || (linkedUid && log.patientId === linkedUid)) &&
    log.status !== "upcoming" &&
    new Date(log.scheduledDate + "T00:00:00") >= cutoff
  );
  const { rate } = calculateAdherence(recentLogs);
  if (rate < 60) return { label: "High Risk", color: "#ef4444", rate };
  if (rate < 80) return { label: "Watch", color: "#f59e0b", rate };
  return { label: "Stable", color: "#10b981", rate };
}

async function run() {
  const patientId = "-Ovz__fG4tmCsdUJvWKu";
  const pSnap = await get(ref(db, "patients/" + patientId));
  const patient = pSnap.val();
  console.log("Patient linkedUid:", patient.linkedUid);

  const logsSnap = await get(ref(db, "adherenceLogs"));
  const logs = [];
  if (logsSnap.exists()) {
    Object.entries(logsSnap.val()).forEach(([key, val]) => {
      logs.push({ id: key, ...val });
    });
  }
  console.log("Total logs in database:", logs.length);

  const risk = calculatePatientRisk(patientId, logs, patient.linkedUid);
  console.log("Calculated Risk:", risk);

  // Let's see which logs match the filter
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  cutoff.setHours(0, 0, 0, 0);
  console.log("Cutoff date:", cutoff.toISOString());

  const recentLogs = logs.filter(log => {
    const isMatch = (log.patientId === patientId || (patient.linkedUid && log.patientId === patient.linkedUid));
    const isNotUpcoming = log.status !== "upcoming";
    const logDate = new Date(log.scheduledDate + "T00:00:00");
    const isAfterCutoff = logDate >= cutoff;
    return isMatch && isNotUpcoming && isAfterCutoff;
  });

  console.log(`Matching recent logs count: ${recentLogs.length}`);
  recentLogs.forEach(l => {
    console.log(`- Date: ${l.scheduledDate}, Med: ${l.medicationName || l.name}, Status: ${l.status}`);
  });

  process.exit(0);
}

run().catch(console.error);
