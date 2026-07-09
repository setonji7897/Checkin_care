const fs = require('fs');
const path = require('path');

function scanFile(filePath) {
  const content = fs.readFileSync(filePath);
  let hasNonAscii = false;
  for (let i = 0; i < content.length; i++) {
    if (content[i] > 127) {
      hasNonAscii = true;
      break;
    }
  }
  if (!hasNonAscii) return;

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  lines.forEach((line, index) => {
    let lineHasNonAscii = false;
    for (let i = 0; i < line.length; i++) {
      if (line.charCodeAt(i) > 127) {
        lineHasNonAscii = true;
        break;
      }
    }
    if (lineHasNonAscii) {
      // Find non-ascii substrings
      const buf = Buffer.from(line, 'utf8');
      console.log(`${path.basename(filePath)}:${index + 1}: ${line.trim()}`);
      console.log(`   Hex: ${buf.toString('hex')}`);
    }
  });
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        walkDir(fullPath);
      }
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      scanFile(fullPath);
    }
  }
}

console.log("=== Non-ASCII Character Scan ===");
walkDir('c:/Users/Seth/Desktop/FYP/new MVP/medication-reminder/Checkin_care/src');
