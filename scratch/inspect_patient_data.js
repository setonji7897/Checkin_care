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

async function run() {
  const patientId = "-Ovz__fG4tmCsdUJvWKu";
  const pSnap = await get(ref(db, "patients/" + patientId));
  console.log("=== Patients Record ===");
  console.log(pSnap.val());

  if (pSnap.exists()) {
    const linkedUid = pSnap.val().linkedUid || patientId;
    console.log("linkedUid is:", linkedUid);

    const medsSnap = await get(ref(db, "medications"));
    console.log("\n=== Medications ===");
    let medCount = 0;
    if (medsSnap.exists()) {
      Object.entries(medsSnap.val()).forEach(([key, med]) => {
        if (med.patientId === patientId || med.patientId === linkedUid) {
          console.log(`- [${key}] Name: ${med.medicationName || med.name}, patientId: ${med.patientId}`);
          medCount++;
        }
      });
    }
    console.log(`Total medications found: ${medCount}`);

    const logsSnap = await get(ref(db, "adherenceLogs"));
    console.log("\n=== Adherence Logs ===");
    let logCount = 0;
    if (logsSnap.exists()) {
      Object.entries(logsSnap.val()).forEach(([key, log]) => {
        if (log.patientId === patientId || log.patientId === linkedUid) {
          console.log(`- [${key}] Name: ${log.medicationName || log.name}, patientId: ${log.patientId}, date: ${log.scheduledDate}, status: ${log.status}`);
          logCount++;
        }
      });
    }
    console.log(`Total logs found: ${logCount}`);
  }
  process.exit(0);
}

run().catch(console.error);
