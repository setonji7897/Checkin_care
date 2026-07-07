import { useEffect, useMemo, useRef, useState } from "react";
import { Users, Bell, MessageSquare, ChevronRight } from "lucide-react";
import { ref, query, orderByChild, equalTo, onValue, get } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { calculatePatientRisk, getPatientName, getPatientUid, writeUserNotification } from "../../utils/backendData";
import { getOrCreateConversation } from "../../utils/messageUtils";

export default function CaregiverPatients() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [logs, setLogs] = useState([]);

  const unsubLogsRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;

    const assignQuery = query(
      ref(db, "caregiverAssignments"),
      orderByChild("caregiverId"),
      equalTo(currentUser.uid)
    );

    const unsubAssign = onValue(assignQuery, async (snapshot) => {
      const patientIds = [];
      snapshot.forEach(child => {
        patientIds.push(child.key); // child.key is the patientId
      });

      const patientList = [];
      for (const pid of patientIds) {
        const pSnap = await get(ref(db, "patients/" + pid));
        if (!pSnap.exists()) continue;
        const patientData = { id: pid, ...pSnap.val() };
        const linkedUid = patientData.linkedUid || pid;
        const uSnap = await get(ref(db, "users/" + linkedUid));
        if (uSnap.exists()) {
          const u = uSnap.val();
          patientData.firstName = u.firstName || "";
          patientData.lastName  = u.lastName  || "";
        }
        patientList.push(patientData);
      }
      setPatients(patientList);

      // Tear down previous logs listener, start a fresh one filtered client-side
      if (unsubLogsRef.current) unsubLogsRef.current();

      if (patientIds.length === 0) {
        setLogs([]);
        return;
      }

      unsubLogsRef.current = onValue(ref(db, "adherenceLogs"), (snapshot) => {
        const list = [];
        snapshot.forEach(child => {
          const log = { id: child.key, ...child.val() };
          if (patientIds.includes(log.patientId)) list.push(log);
        });
        setLogs(list);
      });
    });

    return () => {
      unsubAssign();
      if (unsubLogsRef.current) unsubLogsRef.current();
    };
  }, [currentUser]);

  const rows = useMemo(() => patients.map(patient => {
    const risk = calculatePatientRisk(patient.id, logs);
    const todayStr = new Date().toISOString().split("T")[0];
    const todayLogs = logs.filter(log => log.patientId === patient.id && log.scheduledDate === todayStr);
    const eligible = todayLogs.filter(l => l.status !== "upcoming");
    const taken = eligible.filter(log => log.status === "taken").length;
    const todayText = eligible.length
      ? taken + "/" + eligible.length + " doses taken today"
      : "No doses logged today";
    return { patient, risk, todayText };
  }), [patients, logs]);

  const sendReminder = async (patient) => {
    const uid = getPatientUid(patient, patient.id);
    await writeUserNotification(uid, {
      type: "reminder",
      title: "Caregiver reminder",
      body: "Please check your medication schedule.",
      actionRoute: "/patient/schedule"
    });
  };

  const startMessage = async (patient) => {
    const patientUid = getPatientUid(patient, patient.id);
    await getOrCreateConversation(
      currentUser.uid,
      "caregiver",
      patientUid,
      "patient",
      userData?.firstName || "Caregiver",
      getPatientName(patient)
    );
    navigate("/caregiver/messages");
  };

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>My Patients</h1>
          <p className="dash-sub">Manage and monitor assigned patients</p>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="dash-card">
          <p style={{ color: "var(--text-muted)", margin: 0 }}>No patients are assigned to you yet.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {rows.map(({ patient, risk, todayText }) => (
            <div
              key={patient.id}
              className="dash-card"
              style={{ cursor: "pointer" }}
              onClick={() => navigate("/caregiver/patients/" + patient.id)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ padding: "1rem", background: "#ecfdf5", borderRadius: "50%", color: "#059669" }}>
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, color: "var(--text-primary)" }}>{getPatientName(patient)}</h3>
                    <p style={{ margin: 0, color: "var(--text-muted)" }}>{todayText}</p>
                    <p style={{ margin: "0.25rem 0 0", color: risk.color, fontWeight: 700 }}>
                      {risk.rate}% adherence · {risk.label}
                    </p>
                  </div>
                </div>

                <div
                  style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end", flex: "0 0 auto" }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => sendReminder(patient)}
                    className="primary-btn"
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1rem", whiteSpace: "nowrap", fontSize: "0.875rem" }}
                  >
                    <Bell size={16} /> Send Reminder
                  </button>
                  <button
                    onClick={() => startMessage(patient)}
                    className="outline-btn"
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1rem", whiteSpace: "nowrap" }}
                  >
                    <MessageSquare size={16} /> Message
                  </button>
                  <button
                    onClick={() => navigate("/caregiver/patients/" + patient.id)}
                    className="outline-btn"
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1rem", whiteSpace: "nowrap" }}
                  >
                    <ChevronRight size={16} /> View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
