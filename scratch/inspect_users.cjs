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

  const clinician = await getJSON(`${DB_URL}/users/QTXxgN5B3XSqpbzwqMc4HoSPnxE2.json?auth=${idToken}`);
  console.log("Clinician user (QTXxgN5B3XSqpbzwqMc4HoSPnxE2):");
  console.log(JSON.stringify(clinician, null, 2));

  const patientUser = await getJSON(`${DB_URL}/users/veHFUsMK2Rgm85Kfzo6XZjsHeSq2.json?auth=${idToken}`);
  console.log("\nPatient user (veHFUsMK2Rgm85Kfzo6XZjsHeSq2):");
  console.log(JSON.stringify(patientUser, null, 2));
}

main().catch(console.error);
