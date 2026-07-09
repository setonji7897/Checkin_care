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

  const targetId = "-Ovz__fG4tmCsdUJvWKu";

  console.log("Checking for leftover medications...");
  const medications = await getJSON(`${DB_URL}/medications.json?auth=${idToken}`);
  for (const medId in medications) {
    if (medications[medId].patientId === targetId) {
      await deleteURL(`${DB_URL}/medications/${medId}.json?auth=${idToken}`);
      console.log(`Deleted leftover medication: ${medId}`);
    }
  }

  console.log("Checking for leftover logs...");
  const logs = await getJSON(`${DB_URL}/adherenceLogs.json?auth=${idToken}`);
  for (const logId in logs) {
    if (logs[logId].patientId === targetId) {
      await deleteURL(`${DB_URL}/adherenceLogs/${logId}.json?auth=${idToken}`);
      console.log(`Deleted leftover log: ${logId}`);
    }
  }

  console.log("Leftover cleanup complete!");
}

main().catch(console.error);
