import { useEffect, useRef, useState } from "react";
import { Bell, CheckCircle2, Clock, AlertTriangle, XCircle, Info, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/quotationService";
import { getAuthenticatedUser } from "../utils/authStorage";
import "./NotificationBell.css";

function formatRelativeTime(dateString) {
  if (!dateString) return "";
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  const minutes = Math.floor(diffInSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getIconForType(type) {
  switch (type) {
    case "success":
      return <CheckCircle2 size={16} />;
    case "warning":
      return <Clock size={16} />;
    case "error":
      return <XCircle size={16} />;
    default:
      return <Info size={16} />;
  }
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const user = getAuthenticatedUser();
  const isSuperAdmin = String(user?.role || "").trim().toLowerCase() === "super admin";

  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      // keep quiet on transient errors
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // Poll every 10s for live alerts

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      clearInterval(interval);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.is_read) {
        await markNotificationRead(notif.notification_id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.notification_id === notif.notification_id
              ? { ...n, is_read: 1 }
              : n
          )
        );
      }
    } catch (err) {
      console.warn("Failed to mark notification read:", err);
    }

    setIsOpen(false);

    // Route based on role and notification reference
    if (isSuperAdmin) {
      if (notif.reference_type === "quotation" || notif.title?.toLowerCase().includes("pending")) {
        navigate("/super-admin/approvals");
      } else {
        navigate("/super-admin-dashboard");
      }
    } else {
      if (notif.reference_type === "quotation" || notif.title?.toLowerCase().includes("quotation")) {
        navigate("/quotations");
      } else {
        navigate("/admin-dashboard");
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.warn("Failed to mark all notifications read:", err);
    }
  };

  return (
    <div className="notif-bell-container" ref={containerRef}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="View notifications"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notif-badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <h4>
              Notifications {unreadCount > 0 ? `(${unreadCount} Unread)` : ""}
            </h4>
            {unreadCount > 0 && (
              <button
                type="button"
                className="notif-mark-all-btn"
                onClick={handleMarkAllRead}
              >
                Mark all as read
              </button>
            )}
          </div>

          <ul className="notif-list">
            {notifications.length === 0 ? (
              <li className="notif-empty">
                <span>No notifications yet.</span>
              </li>
            ) : (
              notifications.map((notif) => {
                const isPendingForSuperAdmin =
                  isSuperAdmin &&
                  (notif.title?.toLowerCase().includes("pending") ||
                    notif.type === "warning");
                const isDecisionForAdmin =
                  !isSuperAdmin &&
                  (notif.title?.toLowerCase().includes("approved") ||
                    notif.title?.toLowerCase().includes("rejected"));

                return (
                  <li
                    key={notif.notification_id}
                    className={`notif-item ${!notif.is_read ? "unread" : ""}`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className={`notif-icon ${notif.type || "info"}`}>
                      {getIconForType(notif.type)}
                    </div>
                    <div className="notif-content">
                      <div className="notif-top-row">
                        <p className="notif-title">{notif.title}</p>
                        <span className="notif-time">
                          {formatRelativeTime(notif.created_at)}
                        </span>
                      </div>
                      <p className="notif-message">{notif.message}</p>
                      {isPendingForSuperAdmin && (
                        <span className="notif-action-hint">
                          Review in Approvals <ExternalLink size={11} />
                        </span>
                      )}
                      {isDecisionForAdmin && (
                        <span className="notif-action-hint">
                          View in Quotations <ExternalLink size={11} />
                        </span>
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
