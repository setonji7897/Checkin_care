const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, 'src/pages/clinician');

const files = {
  'ClinicianDashboard.jsx': `import { Users, Activity, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
export default function ClinicianDashboard() {
  const navigate = useNavigate();
  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Clinician Dashboard</h1>
          <p className="dash-sub">Practice overview and high-risk alerts</p>
        </div>
      </header>
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Users size={32} color="#2563eb" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', color: '#6b7280', fontSize: '0.9rem' }}>Total Patients</h3>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a2e' }}>42</span>
        </div>
        <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Activity size={32} color="#10b981" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', color: '#6b7280', fontSize: '0.9rem' }}>Avg Adherence</h3>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a2e' }}>78%</span>
        </div>
        <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <AlertTriangle size={32} color="#ef4444" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', color: '#6b7280', fontSize: '0.9rem' }}>High Risk Patients</h3>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a2e' }}>4</span>
        </div>
      </div>
      <div className="dash-card">
        <h3 style={{ margin: '0 0 1rem' }}>Quick Actions</h3>
        <button className="primary-btn" onClick={() => navigate("/clinician/patients/add")}>Add New Patient</button>
      </div>
    </>
  );
}`,

  'ClinicianMedicationManagement.jsx': `import { Pill } from "lucide-react";
export default function ClinicianMedicationManagement() {
  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Medication Management</h1>
          <p className="dash-sub">Centralised prescription control</p>
        </div>
      </header>
      <div className="dash-card"><p>Medication directory and editing tools coming soon.</p></div>
    </>
  );
}`,

  'ClinicianReports.jsx': `import { FileText } from "lucide-react";
export default function ClinicianReports() {
  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Clinical Reports</h1>
          <p className="dash-sub">Export patient adherence and outcome summaries</p>
        </div>
      </header>
      <div className="dash-card"><p>Reporting module coming soon.</p></div>
    </>
  );
}`,

  'ClinicianAnalytics.jsx': `import { BarChart } from "lucide-react";
export default function ClinicianAnalytics() {
  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Analytics</h1>
          <p className="dash-sub">Population health trends and insights</p>
        </div>
      </header>
      <div className="dash-card"><p>Advanced charting coming soon.</p></div>
    </>
  );
}`,

  'ClinicianNotifications.jsx': `import { Bell } from "lucide-react";
export default function ClinicianNotifications() {
  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Notifications</h1>
          <p className="dash-sub">Clinical alerts and system messages</p>
        </div>
      </header>
      <div className="dash-card"><p>No new notifications.</p></div>
    </>
  );
}`,

  'ClinicianProfile.jsx': `import { User } from "lucide-react";
export default function ClinicianProfile() {
  return (
    <>
      <header className="dash-header">
        <div>
          <h1>My Profile</h1>
          <p className="dash-sub">Manage clinical credentials and information</p>
        </div>
      </header>
      <div className="dash-card"><p>Profile editor coming soon.</p></div>
    </>
  );
}`,

  'ClinicianSettings.jsx': `import { Settings } from "lucide-react";
export default function ClinicianSettings() {
  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Settings</h1>
          <p className="dash-sub">App preferences and security</p>
        </div>
      </header>
      <div className="dash-card"><p>Settings panel coming soon.</p></div>
    </>
  );
}`,

  'ClinicianHelp.jsx': `import { HelpCircle } from "lucide-react";
export default function ClinicianHelp() {
  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Help & Support</h1>
          <p className="dash-sub">Resources and contact information</p>
        </div>
      </header>
      <div className="dash-card"><p>Help centre coming soon.</p></div>
    </>
  );
}`
};

Object.entries(files).forEach(([filename, content]) => {
  fs.writeFileSync(path.join(srcDir, filename), content);
  console.log('Generated ' + filename);
});
