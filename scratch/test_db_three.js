// scratch/test_db_three.js
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
  console.log("Connecting...");
  const email = "temp_three_agent_" + Date.now() + "@example.com";
  const password = "TempPassword123!";
  
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    
    const logsSnap = await get(ref(db, "adherenceLogs"));
    console.log("adherenceLogs keys:", Object.keys(logsSnap.val() || {}));
    console.log("adherenceLogs raw val:", JSON.stringify(logsSnap.val()));

    const medsSnap = await get(ref(db, "medications"));
    console.log("medications keys:", Object.keys(medsSnap.val() || {}));
    console.log("medications raw val:", JSON.stringify(medsSnap.val()));

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
