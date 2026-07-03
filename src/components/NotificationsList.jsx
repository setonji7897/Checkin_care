import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, onValue, update } from "firebase/database";
import { Bell, AlertCircle, MessageSquare, Pill, FilePenLine } from "lucide-react";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import "../styles/dashboard.css";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "medication", label: "Medication" },
  { id: "messages", label: "Messages" }
];

function iconFor(type) {
  if (type === "message") return <MessageSquare size={20} color="#2563eb" />;
  if (type === "prescription_update") return <FilePenLine size={20} color="#10b981" />;
  if (type === "reminder" || type === "missed_dose") return <Pill size={20} color="#f59e0b" />;
  if (type === "caregiver_alert" || type === "missed_dose_alert") return <AlertCircle size={20} color="#ef4444" />;
  return <Bell size={20} color="#64748b" />;
}

function matchesFilter(notification, filter) {
  if (filter === "all") return true;
  if (filter === "unread") return !notification.read;
  if (filter === "messages") return notification.type === "message";
  if (filter === "medication") {
    return ["missed_dose", "reminder", "prescription_update", "caregiver_alert", "missed_dose_alert"].includes(notification.type);
  }
  return true;
}

export default function NotificationsList({ subtitle }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!currentUser) return;
    const notifRef = ref(db, "notifications/" + currentUser.uid);
    const unsub = onValue(notifRef, (snapshot) => {
      const items = [];
      snapshot.forEach(child => items.push({ id: child.key, ...child.val() }));
      items.sort((a, b) => {
        if ((a.read || false) === (b.read || false)) return Number(b.timestamp || 0) - Number(a.timestamp || 0);
        return a.read ? 1 : -1;
      });
      setNotifications(items);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [currentUser]);

  const visibleNotifications = useMemo(
    () => notifications.filter(notification => matchesFilter(notification, filter)),
    [notifications, filter]
  );

  const openNotification = async (notification) => {
    if (!currentUser) return;
    if (!notification.read) {
      await update(ref(db, "notifications/" + currentUser.uid + "/" + notification.id), { read: true });
    }
    if (notification.actionRoute) navigate(notification.actionRoute);
  };

  if (loading) return <div className="loading-state">Loading notifications...</div>;

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Notifications</h1>
          <p className="dash-sub">{subtitle || "Stay up to date with your alerts and messages"}</p>
        </div>
      </header>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {FILTERS.map(item => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id)}
            style={{
              border: "1px solid var(--border)",
              background: filter === item.id ? "#2563eb" : "var(--bg-card)",
              color: filter === item.id ? "white" : "var(--text-primary)",
              borderRadius: "10px",
              padding: "0.55rem 0.9rem",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
        {visibleNotifications.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center" }}>
            <Bell size={48} color="#cbd5e1" style={{ marginBottom: "1rem" }} />
            <h3 style={{ margin: 0, color: "var(--text-primary)" }}>You're all caught up</h3>
            <p style={{ color: "var(--text-muted)" }}>No notifications match this view.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {visibleNotifications.map(notification => (
              <button
                key={notification.id}
                onClick={() => openNotification(notification)}
                style={{
                  display: "flex",
                  gap: "1rem",
                  padding: "1.25rem",
                  border: "none",
                  borderBottom: "1px solid var(--border)",
                  borderLeft: notification.read ? "4px solid transparent" : "4px solid #2563eb",
                  background: notification.read ? "var(--bg-card)" : "rgba(37,99,235,0.06)",
                  alignItems: "flex-start",
                  textAlign: "left",
                  cursor: "pointer",
                  opacity: notification.read ? 0.72 : 1
                }}
              >
                <div style={{ marginTop: "0.25rem" }}>{iconFor(notification.type)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "0.25rem" }}>
                    <h4 style={{ margin: 0, fontSize: "1rem", color: "var(--text-primary)", fontWeight: notification.read ? 600 : 800 }}>
                      {notification.title || "Notification"}
                    </h4>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {notification.timestamp ? new Date(notification.timestamp).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {notification.body || notification.message || ""}
                  </p>
                </div>
                {!notification.read && (
                  <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#2563eb", marginTop: "0.45rem", flexShrink: 0 }} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
