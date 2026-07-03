const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'src/pages/patient/AddMedication.jsx',
  'src/pages/patient/MedicationDetail.jsx',
  'src/pages/caregiver/CaregiverDashboard.jsx',
  'src/pages/clinician/ClinicianDashboard.jsx',
  'src/pages/clinician/PatientList.jsx',
  'src/pages/clinician/PatientDetail.jsx',
  'src/pages/clinician/AddPatient.jsx',
  'src/pages/clinician/AddMedication.jsx'
];

filesToUpdate.forEach(file => {
  const fullPath = path.resolve(__dirname, file);
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping missing file: ${fullPath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');

  // Strip out the wrapper divs
  // Remove <div className="dashboard-page ...">
  content = content.replace(/<div className="dashboard-page[^>]*>/, '<>');
  
  // Remove the <aside className="sidebar">...</aside>
  content = content.replace(/<aside className="sidebar">[\s\S]*?<\/aside>/, '');
  
  // Remove <main className="dashboard-main">
  content = content.replace(/<main className="dashboard-main">/, '');

  // The ending tags are `</main>` and `</div>`. Replace them with `</>`.
  // Since they usually appear at the very end of the return statement, we can do:
  content = content.replace(/<\/main>\s*<\/div>/, '</>');

  // Also remove unused imports that might have been part of the sidebar
  content = content.replace(/import WorkspaceSwitcher from "[^"]+";\n?/, '');
  
  // The handleSignOut function is now useless if it was only used by the sidebar
  content = content.replace(/async function handleSignOut\(\) \{[\s\S]*?navigate\("\/login"\);\n\s*\}/, '');

  fs.writeFileSync(fullPath, content);
  console.log(`Successfully refactored ${file}`);
});
