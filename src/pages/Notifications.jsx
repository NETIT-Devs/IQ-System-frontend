import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Clock, XCircle, Info, RefreshCw } from "lucide-react";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/quotationService";
import { useNavigate } from "react-router-dom";
import { getAuthenticatedUser } from "../utils/authStorage";

export default function Notifications() {
  const navigate = useNavigate();
  const user = getAuthenticatedUser();
  const isSuperAdmin = String(user?.role || "").trim().toLowerCase() === "super admin";

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleItemClick = async (notif) => {
    if (!notif.is_read) {
      await markNotificationRead(notif.notification_id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.notification_id === notif.notification_id ? { ...n, is_read: 1 } : n
        )
      );
    }

    if (isSuperAdmin) {
      if (notif.reference_type === "quotation") {
        navigate("/super-admin/approvals");
      }
    } else {
      if (notif.reference_type === "quotation") {
        navigate("/quotations");
      }
    }
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  };

  return (
    <main style={{ padding: "24px", maxWidth: "800px", margin: "0 auto", color: "#0f172a" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", margin: 0, fontWeight: 800 }}>All Notifications</h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>
            Track approvals, system alerts, and quotation updates.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={fetchNotifs}
            style={{ padding: "8px 14px", border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleMarkAll}
            style={{ padding: "8px 14px", background: "#1d4ed8", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "12px" }}
          >
            Mark all read
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
        {notifications.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
            No notifications available.
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.notification_id}
              onClick={() => handleItemClick(notif)}
              style={{
                display: "flex",
                gap: "14px",
                padding: "16px",
                borderBottom: "1px solid #f1f5f9",
                background: !notif.is_read ? "#f0f7ff" : "#fff",
                cursor: "pointer",
              }}
            >
              <div style={{ marginTop: "3px" }}>
                {notif.type === "success" && <CheckCircle2 size={18} color="#15803d" />}
                {notif.type === "warning" && <Clock size={18} color="#b45309" />}
                {notif.type === "error" && <XCircle size={18} color="#b91c1c" />}
                {(!notif.type || notif.type === "info") && <Info size={18} color="#1d4ed8" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "13px" }}>{notif.title}</strong>
                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                    {new Date(notif.created_at).toLocaleString("en-GB")}
                  </span>
                </div>
                <p style={{ margin: "4px 0 0", color: "#475569", fontSize: "12px" }}>
                  {notif.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
