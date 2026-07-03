import { Users } from "lucide-react";

export default function EmptyRoomState() {
  return (
    <div className="care-triangle-empty">
      <div className="care-triangle-empty-icon">
        <Users size={32} color="#94a3b8" />
      </div>
      <h3>Welcome to the Care Triangle</h3>
      <p>
        This is your care team's shared space. You, your caregiver, and your clinician can discuss medication adherence here.
      </p>
    </div>
  );
}
