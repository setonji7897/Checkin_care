const fs = require('fs');
const path = require('path');

const fixEscapes = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fixEscapes(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      // Replace literal backslash-backtick with backtick
      content = content.replace(/\\`/g, '`');
      // Replace literal backslash-dollar with dollar
      content = content.replace(/\\\$/g, '$');
      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Fixed:', fullPath);
      }
    }
  }
};

fixEscapes(path.join(__dirname, 'src'));
console.log('Done fixing escapes.');
