const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, 'src/pages/caregiver');

const files = {
  'CaregiverDashboard.jsx': `import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { Users, AlertTriangle, Activity, CalendarClock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../../styles/dashboard.css";

export default function CaregiverDashboard() {
  const navigate = useNavigate();
  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Caregiver Dashboard</h1>
          <p className="dash-sub">Overview of your assigned patients</p>
        </div>
      </header>
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Users size={32} color="#059669" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', color: '#6b7280', fontSize: '0.9rem' }}>Assigned Patients</h3>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a2e' }}>3</span>
        </div>
        <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <AlertTriangle size={32} color="#ef4444" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', color: '#6b7280', fontSize: '0.9rem' }}>Critical Alerts</h3>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a2e' }}>1</span>
        </div>
        <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Activity size={32} color="#6c63ff" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', color: '#6b7280', fontSize: '0.9rem' }}>Avg Adherence</h3>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a2e' }}>84%</span>
        </div>
      </div>
      <div className="dash-card">
        <h3 style={{ margin: '0 0 1rem' }}>Patients Needing Attention</h3>
        <p style={{ color: '#6b7280' }}>John Doe missed 2 doses of Lisinopril today.</p>
        <button className="primary-btn" onClick={() => navigate("/caregiver/patients")}>View Patients</button>
      </div>
    </>
  );
}`,

  'CaregiverPatients.jsx': `import { Users } from "lucide-react";
export default function CaregiverPatients() {
  return (
    <>
      <header className="dash-header">
        <div>
          <h1>My Patients</h1>
          <p className="dash-sub">Manage and monitor assigned patients</p>
        </div>
      </header>
      <div className="dash-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: '#ecfdf5', borderRadius: '50%', color: '#059669' }}><Users size={24} /></div>
          <div>
            <h3 style={{ margin: 0 }}>John Doe</h3>
            <p style={{ margin: 0, color: '#6b7280' }}>Adherence: 75% - High Risk</p>
          </div>
        </div>
      </div>
    </>
  );
}`,

  'CaregiverAlerts.jsx': `import { AlertTriangle } from "lucide-react";
export default function CaregiverAlerts() {
  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Active Alerts</h1>
          <p className="dash-sub">Critical missed medications and warnings</p>
        </div>
      </header>
      <div className="dash-card">
        <p>No critical alerts at this time.</p>
      </div>
    </>
  );
}`,

  'CaregiverReports.jsx': `import { FileText } from "lucide-react";
export default function CaregiverReports() {
  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Reports</h1>
          <p className="dash-sub">Generate compliance summaries</p>
        </div>
      </header>
      <div className="dash-card"><p>Report generation coming soon.</p></div>
    </>
  );
}`,

  'CaregiverMessages.jsx': `import { MessageSquare } from "lucide-react";
export default function CaregiverMessages() {
  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Messages</h1>
          <p className="dash-sub">Communicate with patients and clinicians</p>
        </div>
      </header>
      <div className="dash-card"><p>Messaging system coming soon.</p></div>
    </>
  );
}`,

  'CaregiverNotifications.jsx': `import { Bell } from "lucide-react";
export default function CaregiverNotifications() {
  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Notifications</h1>
          <p className="dash-sub">System updates and alerts</p>
        </div>
      </header>
      <div className="dash-card"><p>No new notifications.</p></div>
    </>
  );
}`,

  'CaregiverProfile.jsx': `import { User } from "lucide-react";
export default function CaregiverProfile() {
  return (
    <>
      <header className="dash-header">
        <div>
          <h1>My Profile</h1>
          <p className="dash-sub">Manage your caregiver information</p>
        </div>
      </header>
      <div className="dash-card"><p>Profile editor coming soon.</p></div>
    </>
  );
}`,

  'CaregiverSettings.jsx': `import { Settings } from "lucide-react";
export default function CaregiverSettings() {
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

  'CaregiverHelp.jsx': `import { HelpCircle } from "lucide-react";
export default function CaregiverHelp() {
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
