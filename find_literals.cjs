const fs = require('fs');
const path = require('path');

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      search(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (line.match(/=[ \t]*\{?\s*`/)) {
          console.log(`[JSX Literal] ${fullPath}:${i+1} : ${line.trim()}`);
        }
      });
    }
  }
}

search(path.join(__dirname, 'src'));
