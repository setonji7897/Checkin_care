// scratch/test_rest_api.js
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getDatabase } from "firebase/database";

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

async function run() {
  console.log("Connecting...");
  const email = "temp_rest_agent_" + Date.now() + "@example.com";
  const password = "TempPassword123!";
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    console.log("Auth session created. ID Token retrieved.");

    // Query REST API
    const url = `https://smart-medication-reminde-d7f30-default-rtdb.firebaseio.com/adherenceLogs.json?auth=${idToken}`;
    console.log("Fetching logs via REST API...");
    const res = await fetch(url);
    const data = await res.json();
    
    if (data && typeof data === "object") {
      console.log("REST API adherenceLogs count:", Object.keys(data).length);
    } else {
      console.log("REST API adherenceLogs returned:", data);
    }

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
