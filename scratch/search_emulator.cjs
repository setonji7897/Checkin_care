const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        searchDir(fullPath);
      }
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('connectDatabaseEmulator') || content.includes('connectAuthEmulator') || content.includes('localhost:9000') || content.includes('localhost:8080')) {
        console.log(`Found emulator connection in: ${fullPath}`);
      }
    }
  }
}

searchDir('c:/Users/Seth/Desktop/FYP/new MVP/medication-reminder/Checkin_care/src');
