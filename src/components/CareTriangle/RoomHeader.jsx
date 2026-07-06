import { Users, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function RoomHeader({ patientName, caregiverNames, clinicianName }) {
  const navigate = useNavigate();
  const caregiverList = Object.values(caregiverNames || {}).filter(Boolean);
  const caregiverLabel = caregiverList.length > 0 ? caregiverList.join(", ") : "Caregiver";

  return (
    <div className="care-triangle-header">
      <button
        onClick={() => navigate(-1)}
        className="care-triangle-back"
        aria-label="Go back"
      >
        <ChevronLeft size={24} />
      </button>

      <div className="care-triangle-icon">
        <Users size={20} color="#0d9488" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h2>Care Triangle</h2>
        <div className="care-triangle-members">
          <span>{patientName || "Patient"}</span>
          <span aria-hidden="true">-</span>
          <span>{caregiverLabel}</span>
          <span aria-hidden="true">-</span>
          <span>Dr. {clinicianName || "Clinician"}</span>
        </div>
      </div>
    </div>
  );
}
