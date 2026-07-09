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

  const patientId = "-Ovz__fG4tmCsdUJvWKu";
  const linkedUid = "veHFUsMK2Rgm85Kfzo6XZjsHeSq2";

  console.log("=== Testing medsKeyQuery ===");
  // equivalent to: query(ref(db, "medications"), orderByChild("patientId"), equalTo(patientId))
  const medsKeyUrl = `${DB_URL}/medications.json?auth=${idToken}&orderBy="patientId"&equalTo="${patientId}"`;
  const medsKey = await getJSON(medsKeyUrl);
  console.log(`Fetched ${Object.keys(medsKey || {}).length} meds:`, Object.keys(medsKey || {}));

  console.log("\n=== Testing medsUidQuery ===");
  // equivalent to: query(ref(db, "medications"), orderByChild("patientId"), equalTo(linkedUid))
  const medsUidUrl = `${DB_URL}/medications.json?auth=${idToken}&orderBy="patientId"&equalTo="${linkedUid}"`;
  const medsUid = await getJSON(medsUidUrl);
  console.log(`Fetched ${Object.keys(medsUid || {}).length} meds:`, Object.keys(medsUid || {}));

  console.log("\n=== Testing logsKeyQuery ===");
  // equivalent to: query(ref(db, "adherenceLogs"), orderByChild("patientId"), equalTo(patientId))
  const logsKeyUrl = `${DB_URL}/adherenceLogs.json?auth=${idToken}&orderBy="patientId"&equalTo="${patientId}"`;
  const logsKey = await getJSON(logsKeyUrl);
  console.log(`Fetched ${Object.keys(logsKey || {}).length} logs:`, Object.keys(logsKey || {}));

  console.log("\n=== Testing logsUidQuery ===");
  // equivalent to: query(ref(db, "adherenceLogs"), orderByChild("patientId"), equalTo(linkedUid))
  const logsUidUrl = `${DB_URL}/adherenceLogs.json?auth=${idToken}&orderBy="patientId"&equalTo="${linkedUid}"`;
  const logsUid = await getJSON(logsUidUrl);
  console.log(`Fetched ${Object.keys(logsUid || {}).length} logs:`, Object.keys(logsUid || {}));
}

main().catch(console.error);
