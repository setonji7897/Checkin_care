// scratch/count_patient_logs.js
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getDatabase, ref, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCCxT6jmVbyszfiMHsyXiBtXtqjOE5kGPk",
  authDomain: "smart-medication-reminde-d7f30.firebaseapp.com",
  databaseURL: "https://smart-medication-reminde-d7f30-default-rtdb.firebaseio.com",
  projectId: "smart-medication-reminde-d7f30",
  storageBucket: "smart-medication-reminde-d7f30.appspot.com",
  messagingSenderId: "331587834571",
  appId: "1:331587834571:web:44c5c2d4c0628fcb0a9db5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

async function run() {
  const email = "temp_count_agent_" + Date.now() + "@example.com";
  const password = "TempPassword123!";
  
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    const snap = await get(ref(db, "adherenceLogs"));
    const val = snap.val() || {};
    
    const counts = {};
    const todayCounts = {};
    const todayStr = new Date().toISOString().split("T")[0];

    Object.entries(val).forEach(([id, log]) => {
      counts[log.patientId] = (counts[log.patientId] || 0) + 1;
      if (log.scheduledDate === todayStr) {
        todayCounts[log.patientId] = (todayCounts[log.patientId] || 0) + 1;
      }
    });

    console.log("🔥 LOG COUNTS BY PATIENT ID:", counts);
    console.log("🔥 TODAY LOG COUNTS BY PATIENT ID:", todayCounts);

  } catch (err) {
    console.error(err);
  } finally {
    if (auth.currentUser) {
      await auth.currentUser.delete();
    }
    process.exit(0);
  }
}

run();
