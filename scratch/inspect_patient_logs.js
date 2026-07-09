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

  const logs = await getJSON(`${DB_URL}/adherenceLogs.json?auth=${idToken}`);
  console.log("Total logs in database:", Object.keys(logs || {}).length);

  const keyLogs = [];
  const uidLogs = [];
  
  for (const key in logs) {
    const log = logs[key];
    if (log.patientId === "-Ovz__fG4tmCsdUJvWKu") {
      keyLogs.push({ id: key, ...log });
    }
    if (log.patientId === "veHFUsMK2Rgm85Kfzo6XZjsHeSq2") {
      uidLogs.push({ id: key, ...log });
    }
  }

  console.log(`Logs for key (-Ovz__fG4tmCsdUJvWKu): ${keyLogs.length}`);
  console.log(`Logs for uid (veHFUsMK2Rgm85Kfzo6XZjsHeSq2): ${uidLogs.length}`);

  console.log("\nUID Logs Sample (first 5):");
  console.log(uidLogs.slice(0, 5));
  console.log("\nUID Logs Sample (last 5):");
  console.log(uidLogs.slice(-5));
}

main().catch(console.error);
