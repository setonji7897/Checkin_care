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
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.json')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('databaseURL') || content.includes('initializeApp(')) {
        console.log(`Found Firebase config in: ${fullPath}`);
        // print lines containing databaseURL or initializeApp
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('databaseURL') || line.includes('initializeApp(')) {
            console.log(`  L${index + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

searchDir('c:/Users/Seth/Desktop/FYP/new MVP/medication-reminder/Checkin_care/src');
