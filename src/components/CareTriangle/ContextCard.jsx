import { AlertCircle, Clock, Pill } from "lucide-react";

export default function ContextCard({ card }) {
  if (!card || card.type !== "missedDose") return null;

  return (
    <div className="care-context-card">
      <div className="care-context-title">
        <AlertCircle size={16} color="#ef4444" />
        <span>Missed Dose Alert</span>
      </div>

      <div className="care-context-body">
        <div className="care-context-row">
          <Pill size={14} color="#ef4444" />
          <span>{card.medicationName || "Medication"}</span>
        </div>
        <div className="care-context-row muted">
          <Clock size={14} />
          <span>{card.scheduledDate || "Today"} at {card.scheduledTime || "scheduled time"}</span>
        </div>
      </div>
    </div>
  );
}
