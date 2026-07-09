import { useEffect, useState } from "react";
import { ref, query, orderByChild, equalTo, onValue, get } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { getPatientName } from "../../utils/backendData";
import { MessageSquare, Users, ArrowRight } from "lucide-react";
import "../../styles/dashboard.css";

export default function CaregiverMessages() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    // 1. Get assigned patients from caregiverAssignments
    const assignQuery = query(
      ref(db, "caregiverAssignments"),
      orderByChild("caregiverId"),
      equalTo(currentUser.uid)
    );

    const unsub = onValue(assignQuery, async (snapshot) => {
      const patientIds = [];
      snapshot.forEach(child => patientIds.push(child.key));

      const roomList = [];
      for (const pid of patientIds) {
        // Fetch patient details
        const pSnap = await get(ref(db, "patients/" + pid));
        let patient = { id: pid, fullName: "Patient" };
        if (pSnap.exists()) {
          const patientData = { id: pid, ...pSnap.val() };
          const linkedUid = patientData.linkedUid || pid;
          const uSnap = await get(ref(db, "users/" + linkedUid));
          if (uSnap.exists()) {
            const u = uSnap.val();
            patientData.firstName = u.firstName || "";
            patientData.lastName = u.lastName || "";
          }
          patient = patientData;
        }

        // Fetch care room (if it exists)
        const roomSnap = await get(ref(db, "careRooms/" + pid));
        const room = roomSnap.exists() ? roomSnap.val() : null;

        roomList.push({ patient, room });
      }

      setRooms(roomList);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser]);

  const openCareRoom = (patientId) => {
    navigate(`/care-triangle?patientId=${patientId}`);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px", color: "var(--text-muted)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 1rem" }} />
          <p style={{ margin: 0, fontSize: "0.9rem" }}>Loading your care rooms...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Messages</h1>
          <p className="dash-sub">Communicate with patients and clinicians via Care Triangle</p>
        </div>
      </header>

      {rooms.length === 0 ? (
        <div className="dash-card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
          <MessageSquare size={48} style={{ color: "var(--text-muted)", opacity: 0.4, marginBottom: "1rem" }} />
          <h3 style={{ margin: "0 0 0.5rem", color: "var(--text-primary)" }}>No care rooms yet</h3>
          <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "0.9rem" }}>
            You'll be able to message once a clinician assigns you to a patient.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {rooms.map(({ patient, room }) => {
            const lastMsg = room?.lastMessagePreview || null;
            const lastTime = room?.lastMessageAt
              ? new Date(room.lastMessageAt).toLocaleDateString([], { month: "short", day: "numeric" })
              : null;

            return (
              <div
                key={patient.id}
                className="dash-card"
                onClick={() => openCareRoom(patient.id)}
                style={{ cursor: "pointer", transition: "box-shadow 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.15)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = ""}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: "50%",
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0
                    }}>
                      <Users size={22} color="white" />
                    </div>
                    <div>
                      <h3 style={{ margin: "0 0 0.2rem", color: "var(--text-primary)", fontSize: "1rem" }}>
                        {getPatientName(patient)}'s Care Triangle
                      </h3>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                        {lastMsg || "No messages yet — start the conversation"}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                    {lastTime && (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{lastTime}</span>
                    )}
                    <ArrowRight size={18} color="var(--text-muted)" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </>
  );
}
