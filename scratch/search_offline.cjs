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
      if (content.includes('enableIndexedDbPersistence') || content.includes('persistent') || content.includes('offline') || content.includes('enableLogging')) {
        console.log(`Found reference in: ${fullPath}`);
      }
    }
  }
}

searchDir('c:/Users/Seth/Desktop/FYP/new MVP/medication-reminder/Checkin_care/src');
