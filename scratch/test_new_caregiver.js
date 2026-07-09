// scratch/test_new_caregiver.js
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getDatabase, ref, query, orderByChild, equalTo, get, set } from "firebase/database";

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

const PATIENT_PUSH_ID = "-Ovz__fG4tmCsdUJvWKu";

async function run() {
  console.log("Connecting...");
  const email = "temp_cg_agent_" + Date.now() + "@example.com";
  const password = "TempPassword123!";
  let caregiverUid = null;
  
  try {
    // 1. Create caregiver user in Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    caregiverUid = userCredential.user.uid;
    console.log("Caregiver auth user created:", caregiverUid);

    // 2. Write caregiver record in users/
    await set(ref(db, "users/" + caregiverUid), {
      email,
      firstName: "Temp",
      lastName: "Caregiver",
      role: "caregiver"
    });
    console.log("Caregiver profile written to users/");

    // 3. Assign caregiver to patient
    // Note: the clinician dashboard sets caregiverAssignments/{patientId} = { caregiverId, patientId, patientName }
    await set(ref(db, `caregiverAssignments/${PATIENT_PUSH_ID}`), {
      caregiverId: caregiverUid,
      patientId: PATIENT_PUSH_ID,
      patientName: "fadipe setonji ibrahim"
    });
    console.log("Caregiver assigned to patient in caregiverAssignments/");

    // 4. Log out and log back in to simulate fresh session
    await auth.signOut();
    await signInWithEmailAndPassword(auth, email, password);
    console.log("Logged back in as caregiver. Running queries...");

    // Query assignments
    const assignQuery = query(
      ref(db, "caregiverAssignments"),
      orderByChild("caregiverId"),
      equalTo(caregiverUid)
    );
    const assignSnap = await get(assignQuery);
    console.log("Query caregiverAssignments exists:", assignSnap.exists());
    if (assignSnap.exists()) {
      console.log("Assignments:", assignSnap.val());
    }

    // Query patients
    const patientSnap = await get(ref(db, "patients/" + PATIENT_PUSH_ID));
    console.log("Query patient exists:", patientSnap.exists());

    // Query medications
    const medsSnap = await get(ref(db, "medications"));
    console.log("Query medications total count:", Object.keys(medsSnap.val() || {}).length);

    // Query adherenceLogs
    const logsSnap = await get(ref(db, "adherenceLogs"));
    console.log("Query adherenceLogs total count:", Object.keys(logsSnap.val() || {}).length);

  } catch (err) {
    console.error("🔥 Error during test:", err);
  } finally {
    // Cleanup
    console.log("Cleaning up...");
    try {
      // Log in again if needed to delete user (auth user delete requires recent login)
      if (auth.currentUser) {
        // Delete caregiverAssignment
        await set(ref(db, `caregiverAssignments/${PATIENT_PUSH_ID}`), {
          caregiverId: "yJtiEUlefqWpb8Xt1WEiFU9QBFy2", // Restore original caregiver
          patientId: PATIENT_PUSH_ID,
          patientName: "fadipe setonji ibrahim"
        });
        console.log("Restored original caregiver assignment.");
        
        await set(ref(db, "users/" + caregiverUid), null);
        console.log("Deleted caregiver profile from users/");

        await auth.currentUser.delete();
        console.log("Deleted caregiver auth user.");
      }
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
    }
    process.exit(0);
  }
}

run();
