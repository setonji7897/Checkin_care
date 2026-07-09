const https = require('https');

const API_KEY = "AIzaSyCCxT6jmVbyszfiMHsyXiBtXtqjOE5kGPk";
const DB_URL = "https://smart-medication-reminde-d7f30-default-rtdb.firebaseio.com";

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function deleteURL(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'DELETE'
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const authRes = await postJSON(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { email: `temp_${Date.now()}@example.com`, password: "tempPassword123", returnSecureToken: true }
  );
  const idToken = authRes.idToken;

  // 1. Get all patients
  const patients = await getJSON(`${DB_URL}/patients.json?auth=${idToken}`);
  const targetIds = [];

  for (const id in patients) {
    const p = patients[id];
    const name = (p.fullName || p.name || "").toLowerCase();
    if (name.includes("fadipe") || name.includes("setonji")) {
      targetIds.push(id);
      console.log(`Found matching patient: ${p.fullName} (ID: ${id})`);
    }
  }

  if (targetIds.length === 0) {
    console.log("No matching patients found.");
    return;
  }

  // 2. Perform deletions
  for (const patientId of targetIds) {
    console.log(`\n--- Cleaning up data for Patient ID: ${patientId} ---`);

    // Delete patient record
    await deleteURL(`${DB_URL}/patients/${patientId}.json?auth=${idToken}`);
    console.log(`Deleted patients/${patientId}`);

    // Delete caregiver assignments
    await deleteURL(`${DB_URL}/caregiverAssignments/${patientId}.json?auth=${idToken}`);
    console.log(`Deleted caregiverAssignments/${patientId}`);

    // Delete careRoom
    await deleteURL(`${DB_URL}/careRooms/${patientId}.json?auth=${idToken}`);
    console.log(`Deleted careRooms/${patientId}`);

    // Delete medications
    const medications = await getJSON(`${DB_URL}/medications.json?auth=${idToken}`);
    for (const medId in medications) {
      if (medications[medId].patientId === patientId) {
        await deleteURL(`${DB_URL}/medications/${medId}.json?auth=${idToken}`);
        console.log(`Deleted medications/${medId} (linked to patient)`);
      }
    }

    // Delete adherence logs
    const logs = await getJSON(`${DB_URL}/adherenceLogs.json?auth=${idToken}`);
    for (const logId in logs) {
      if (logs[logId].patientId === patientId) {
        await deleteURL(`${DB_URL}/adherenceLogs/${logId}.json?auth=${idToken}`);
        console.log(`Deleted adherenceLogs/${logId} (linked to patient)`);
      }
    }
  }

  console.log("\nCleanup successfully completed!");
}

main().catch(console.error);
