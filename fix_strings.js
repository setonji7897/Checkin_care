const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src', 'pages');

const filesToFix = [
  path.join(dir, 'caregiver', 'CaregiverHelp.jsx'),
  path.join(dir, 'clinician', 'ClinicianHelp.jsx'),
  path.join(dir, 'patient', 'HelpSupport.jsx')
];

for (const file of filesToFix) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    content = content.replace(/Group chat - patient, clinician &amp; you/g, 'Group chat &mdash; patient, clinician &amp; you');
    content = content.replace(/Group chat - patient, caregiver &amp; you/g, 'Group chat &mdash; patient, caregiver &amp; you');
    content = content.replace(/Available Mon-Fri, 8am-6pm/g, 'Available Mon&ndash;Fri, 8am&ndash;6pm');
    content = content.replace(/AI assistant . instant answers/g, 'AI assistant &middot; instant answers');
    content = content.replace(/CheckIn Care . Version 1\.0\.0 . Updated June 2026/g, 'CheckIn Care &middot; Version 1.0.0 &middot; Updated June 2026');
    
    // Also fix the transparent button background
    content = content.replace(/background: "var\(--bg-page\)",\s*border: "1px solid var\(--border\)", color: "var\(--text-primary\)", borderRadius: "10px",\s*padding: "0\.6rem 1\.25rem"/g, 'background: "transparent",\n              border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: "10px",\n              padding: "0.6rem 1.25rem"');
    
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
  }
}
