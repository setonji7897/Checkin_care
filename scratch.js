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

async function checkData() {
  console.log("Checking DB...");
  const medsSnap = await get(ref(db, "medications"));
  if (medsSnap.exists()) {
    console.log("Medications:", JSON.stringify(medsSnap.val(), null, 2));
  } else {
    console.log("No medications node.");
  }
  
  const patientsSnap = await get(ref(db, "patients"));
  if (patientsSnap.exists()) {
    console.log("Patients:", JSON.stringify(patientsSnap.val(), null, 2));
  } else {
    console.log("No patients node.");
  }
  process.exit(0);
}

checkData().catch(console.error);
