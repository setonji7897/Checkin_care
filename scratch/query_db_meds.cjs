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

async function main() {
  const authRes = await postJSON(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { email: `temp_${Date.now()}@example.com`, password: "tempPassword123", returnSecureToken: true }
  );
  const idToken = authRes.idToken;

  console.log("=== Querying database for medications ===");
  const meds = await getJSON(`${DB_URL}/medications.json?auth=${idToken}`);
  for (const id in meds) {
    const m = meds[id];
    const name = (m.medicationName || m.name || "").toLowerCase();
    if (name.includes("paracetamol") || name.includes("vitamin d")) {
      console.log(`Medication ID: ${id} -> Name: "${m.medicationName || m.name}", Patient ID: "${m.patientId}"`);
    }
  }

  console.log("\n=== Querying database for logs ===");
  const logs = await getJSON(`${DB_URL}/adherenceLogs.json?auth=${idToken}`);
  for (const id in logs) {
    const l = logs[id];
    const name = (l.medicationName || "").toLowerCase();
    if (name.includes("paracetamol") || name.includes("vitamin d")) {
      console.log(`Log ID: ${id} -> Name: "${l.medicationName}", Patient ID: "${l.patientId}", Scheduled Date: ${l.scheduledDate}`);
    }
  }

  console.log("\nQuery complete!");
}

main().catch(console.error);
