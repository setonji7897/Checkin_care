// src/App.jsx
//
// PURPOSE: The root of the React component tree.
// This file defines ALL the routes for the application using React Router v6.

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";

import LoginRegister       from "./pages/auth/LoginRegister";
import ForgotPassword      from "./pages/auth/ForgotPassword";
import WorkspaceSelector   from "./pages/auth/WorkspaceSelector";
import ProtectedRoute      from "./routes/ProtectedRoute";
import Unauthorized        from "./pages/Unauthorized";
import DashboardLayout     from "./components/DashboardLayout";

// Patient Imports
import PatientDashboard    from "./pages/patient/PatientDashboard";
import TodaySchedule       from "./pages/patient/TodaySchedule";
import PatientAddMedication from "./pages/patient/AddMedication";
import PatientMedications from "./pages/patient/Medications";
import PatientMedicationDetail from "./pages/patient/MedicationDetail";
import PatientAdherenceHistory from "./pages/patient/AdherenceHistory"; // used as History
import PatientAdherence    from "./pages/patient/PatientAdherence";
import PatientProfile      from "./pages/patient/PatientProfile";
import PatientSettings     from "./pages/patient/PatientSettings";
import PatientNotifications from "./pages/patient/PatientNotifications";
import PatientHelp         from "./pages/patient/PatientHelp";
import HelpSupport         from "./pages/patient/HelpSupport";
import MessagesPage        from "./pages/shared/MessagesPage";

import CareTriangle       from "./pages/patient/CareTriangle";

// Caregiver Imports
import CaregiverDashboard  from "./pages/caregiver/CaregiverDashboard";
import CaregiverPatients   from "./pages/caregiver/CaregiverPatients";
import CaregiverAlerts     from "./pages/caregiver/CaregiverAlerts";
import CaregiverReports    from "./pages/caregiver/CaregiverReports";
import CaregiverMessages   from "./pages/caregiver/CaregiverMessages";
import CaregiverProfile    from "./pages/caregiver/CaregiverProfile";
import CaregiverSettings   from "./pages/caregiver/CaregiverSettings";
import CaregiverNotifications from "./pages/caregiver/CaregiverNotifications";
import CaregiverHelp       from "./pages/caregiver/CaregiverHelp";

// Clinician Imports
import ClinicianDashboard  from "./pages/clinician/ClinicianDashboard";
import PatientList from "./pages/clinician/PatientList";
import AddPatient from "./pages/clinician/AddPatient";
import PatientDetail from "./pages/clinician/PatientDetail";
import ClinicianAddMedication from "./pages/clinician/AddMedication";
import ClinicianMedicationManagement from "./pages/clinician/ClinicianMedicationManagement";
import ClinicianReports    from "./pages/clinician/ClinicianReports";
import ClinicianAnalytics  from "./pages/clinician/ClinicianAnalytics";
import ClinicianProfile    from "./pages/clinician/ClinicianProfile";
import ClinicianSettings   from "./pages/clinician/ClinicianSettings";
import ClinicianNotifications from "./pages/clinician/ClinicianNotifications";
import ClinicianHelp       from "./pages/clinician/ClinicianHelp";

import logoIcon from "./assets/logo.png";

import MedicationReminder from "./components/MedicationReminder";

// HomeRedirect: users who visit "/" get sent to their role's dashboard
function HomeRedirect() {
  const { currentUser, activeRole, loading } = useAuth();
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ textAlign: "center" }}>
        <img src={logoIcon} alt="CheckIn Care" style={{ width: 60, marginBottom: "1rem", animation: "pulse 1.5s ease infinite" }} />
        <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Loading your workspace...</p>
      </div>
    </div>
  );
  if (!currentUser) return <Navigate to="/login" replace />;
  if (activeRole === "patient")   return <Navigate to="/patient"   replace />;
  if (activeRole === "caregiver") return <Navigate to="/caregiver" replace />;
  if (activeRole === "clinician") return <Navigate to="/clinician" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  const { currentUser } = useAuth();
  return (
    <>
      {currentUser && <MedicationReminder currentUser={currentUser} />}
      <Routes>
      {/* Public routes — anyone can access */}
      <Route path="/login" element={<LoginRegister />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/select-workspace" element={<WorkspaceSelector />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/unauthorised" element={<Unauthorized />} />

      <Route path="/care-triangle" element={
        <ProtectedRoute allowedRoles={["patient", "caregiver", "clinician"]}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<CareTriangle />} />
      </Route>

      {/* PATIENT MODULE */}
      <Route path="/patient" element={
        <ProtectedRoute allowedRoles={["patient"]}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<PatientDashboard />} />
        <Route path="schedule" element={<TodaySchedule />} />
        <Route path="medications" element={<PatientMedications />} />
        <Route path="medications/:medicationId" element={<PatientMedicationDetail />} />
        <Route path="add-medication" element={<PatientAddMedication />} />
        <Route path="history" element={<PatientAdherenceHistory />} />
        <Route path="adherence" element={<PatientAdherence />} />
        <Route path="notifications" element={<PatientNotifications />} />
        <Route path="profile" element={<PatientProfile />} />
        <Route path="settings" element={<PatientSettings />} />
        <Route path="help" element={<HelpSupport />} />
        <Route path="messages" element={<MessagesPage activeRole="patient" />} />
        <Route path="care-triangle" element={<CareTriangle />} />
      </Route>

      {/* CAREGIVER MODULE */}
      <Route path="/caregiver" element={
        <ProtectedRoute allowedRoles={["caregiver"]}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<CaregiverDashboard />} />
        <Route path="patients" element={<CaregiverPatients />} />
        <Route path="alerts" element={<CaregiverAlerts />} />
        <Route path="reports" element={<CaregiverReports />} />
        <Route path="messages" element={<MessagesPage activeRole="caregiver" />} />
        <Route path="notifications" element={<CaregiverNotifications />} />
        <Route path="profile" element={<CaregiverProfile />} />
        <Route path="settings" element={<CaregiverSettings />} />
        <Route path="help" element={<CaregiverHelp />} />
      </Route>

      {/* CLINICIAN MODULE */}
      <Route path="/clinician" element={
        <ProtectedRoute allowedRoles={["clinician"]}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<ClinicianDashboard />} />
        <Route path="patients" element={<PatientList />} />
        <Route path="patients/add" element={<AddPatient />} />
        <Route path="patients/:patientId" element={<PatientDetail />} />
        <Route path="patients/:patientId/add-medication" element={<ClinicianAddMedication />} />
        <Route path="medications" element={<ClinicianMedicationManagement />} />
        <Route path="reports" element={<ClinicianReports />} />
        <Route path="messages" element={<MessagesPage activeRole="clinician" />} />
        <Route path="analytics" element={<ClinicianAnalytics />} />
        <Route path="notifications" element={<ClinicianNotifications />} />
        <Route path="profile" element={<ClinicianProfile />} />
        <Route path="settings" element={<ClinicianSettings />} />
        <Route path="help" element={<ClinicianHelp />} />
      </Route>

      {/* Catch-all: any unknown URL → redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
