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

  const meds = await getJSON(`${DB_URL}/medications.json?auth=${idToken}`);
  console.log("Total medications in database:", Object.keys(meds || {}).length);

  const keyMeds = [];
  const uidMeds = [];

  for (const key in meds) {
    const med = meds[key];
    if (med.patientId === "-Ovz__fG4tmCsdUJvWKu") {
      keyMeds.push({ id: key, ...med });
    }
    if (med.patientId === "veHFUsMK2Rgm85Kfzo6XZjsHeSq2") {
      uidMeds.push({ id: key, ...med });
    }
  }

  console.log(`Medications for key (-Ovz__fG4tmCsdUJvWKu): ${keyMeds.length}`);
  keyMeds.forEach(m => console.log(`  - [${m.id}] ${m.medicationName || m.name} (Source: ${m.source})`));

  console.log(`Medications for uid (veHFUsMK2Rgm85Kfzo6XZjsHeSq2): ${uidMeds.length}`);
  uidMeds.forEach(m => console.log(`  - [${m.id}] ${m.medicationName || m.name} (Source: ${m.source})`));
}

main().catch(console.error);
