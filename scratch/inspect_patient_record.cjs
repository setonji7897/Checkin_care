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

  const patient = await getJSON(`${DB_URL}/patients/-Ovz__fG4tmCsdUJvWKu.json?auth=${idToken}`);
  console.log("Patient record (-Ovz__fG4tmCsdUJvWKu):");
  console.log(JSON.stringify(patient, null, 2));

  // Let's also check if there are any OTHER patients with name "fadipe setonji"
  const allPatients = await getJSON(`${DB_URL}/patients.json?auth=${idToken}`);
  console.log("\nAll patients in database containing 'fadipe':");
  for (const key in allPatients) {
    const p = allPatients[key];
    if (p.fullName && p.fullName.toLowerCase().includes("fadipe")) {
      console.log(`[${key}] Name: ${p.fullName}, ClinicianId: ${p.clinicianId}, LinkedUid: ${p.linkedUid}`);
    }
  }
}

main().catch(console.error);
