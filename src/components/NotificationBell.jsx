import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Info,
  ExternalLink,
  Check,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
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

export default function NotificationBell({ filter = "all" }) {
  const navigate = useNavigate();
  const user = getAuthenticatedUser();
  const role = String(user?.role || "").trim().toLowerCase();
  const isSuperAdmin = role === "super admin" || role === "super_admin";
  const currentUserId = user?.user_id || user?.id;

  const [rawNotifications, setRawNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const data = await getNotifications();
      setRawNotifications(Array.isArray(data) ? data : []);
    } catch {
      // keep quiet on transient errors
    }
  };

  useEffect(() => {
    fetchNotifications();

    const handleCustomEvent = () => fetchNotifications();
    const handleStorageEvent = (e) => {
      if (e.key === "iq_system_notifications_v2" || !e.key) {
        fetchNotifications();
      }
    };

    window.addEventListener("iq-notifications-updated", handleCustomEvent);
    window.addEventListener("storage", handleStorageEvent);
    const interval = setInterval(fetchNotifications, 5000); // Live poll every 5s

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });

    return () => {
      clearInterval(interval);
      window.removeEventListener("iq-notifications-updated", handleCustomEvent);
      window.removeEventListener("storage", handleStorageEvent);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Filter notifications based on role, recipient admin ID, and page filter (quotation / invoice / all)
  const notifications = useMemo(() => {
    return rawNotifications.filter((notif) => {
      // 1. Role & user targeting filter
      const targetRole = String(
        notif.target_role || notif.targetRole || "all"
      ).trim().toLowerCase();
      const targetUserId = notif.target_user_id ?? notif.targetUserId;

      if (isSuperAdmin) {
        // Super admin sees all notifications targeted to super_admin or all
        const isForSuper =
          targetRole === "super_admin" ||
          targetRole === "super admin" ||
          targetRole === "all" ||
          (!targetRole && !targetUserId);
        if (!isForSuper) return false;
      } else {
        // Admin sees notifications targeted to admin or all
        const isForAdmin =
          targetRole === "admin" ||
          targetRole === "all" ||
          (!targetRole && targetUserId);
        if (!isForAdmin) return false;

        // If a specific admin is targeted, only that admin receives it
        if (
          targetUserId !== null &&
          targetUserId !== undefined &&
          currentUserId !== null &&
          currentUserId !== undefined &&
          String(targetUserId) !== String(currentUserId)
        ) {
          return false;
        }
      }

      // 2. Page type filter: "all" | "quotation" | "invoice"
      const refType = String(
        notif.reference_type || notif.referenceType || ""
      ).toLowerCase();
      const titleLower = String(notif.title || "").toLowerCase();
      const isQuotation =
        refType === "quotation" || titleLower.includes("quotation");
      const isInvoice =
        refType === "invoice" || titleLower.includes("invoice");

      if (filter === "quotation") {
        return isQuotation;
      }
      if (filter === "invoice") {
        return isInvoice;
      }
      return true; // "all"
    });
  }, [rawNotifications, isSuperAdmin, currentUserId, filter]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkSingleRead = async (e, notifId) => {
    e.stopPropagation();
    try {
      await markNotificationRead(notifId);
      setRawNotifications((prev) =>
        prev.map((n) =>
          n.notification_id === notifId ? { ...n, is_read: 1 } : n
        )
      );
    } catch (err) {
      console.warn("Failed to mark notification read:", err);
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.is_read) {
        await markNotificationRead(notif.notification_id);
        setRawNotifications((prev) =>
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

    const refType = String(
      notif.reference_type || notif.referenceType || ""
    ).toLowerCase();
    const titleLower = String(notif.title || "").toLowerCase();
    const isPayment = refType === "payment" || titleLower.includes("payment");
    const isInvoice = refType === "invoice" || titleLower.includes("invoice");

    // Route based on role and notification reference
    if (isSuperAdmin) {
      if (isPayment) {
        navigate("/super-admin/invoices");
      } else if (isInvoice) {
        navigate("/super-admin/approvals", {
          state: { tab: "invoices", status: "pending" },
        });
      } else {
        navigate("/super-admin/approvals", {
          state: { tab: "quotations", status: "pending" },
        });
      }
    } else {
      if (isPayment || isInvoice) {
        navigate("/admin/invoices");
      } else {
        navigate("/quotations");
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(filter, currentUserId);
      setRawNotifications((prev) =>
        prev.map((n) => {
          const refType = String(
            n.reference_type || n.referenceType || ""
          ).toLowerCase();
          const titleLower = String(n.title || "").toLowerCase();
          const isQuotation =
            refType === "quotation" || titleLower.includes("quotation");
          const isInvoice =
            refType === "invoice" || titleLower.includes("invoice");
          const matches =
            filter === "all" ||
            (filter === "quotation" && isQuotation) ||
            (filter === "invoice" && isInvoice);
          return matches ? { ...n, is_read: 1 } : n;
        })
      );
    } catch (err) {
      console.warn("Failed to mark all notifications read:", err);
    }
  };

  const handleDeleteSingle = async (e, notifId) => {
    e.stopPropagation();
    try {
      await deleteNotification(notifId);
      setRawNotifications((prev) =>
        prev.filter((n) => n.notification_id !== notifId)
      );
    } catch (err) {
      console.warn("Failed to delete notification:", err);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllNotifications(filter, currentUserId);
      setRawNotifications((prev) =>
        prev.filter((n) => {
          const refType = String(
            n.reference_type || n.referenceType || ""
          ).toLowerCase();
          const titleLower = String(n.title || "").toLowerCase();
          const isQuotation =
            refType === "quotation" || titleLower.includes("quotation");
          const isInvoice =
            refType === "invoice" || titleLower.includes("invoice");
          const matches =
            filter === "all" ||
            (filter === "quotation" && isQuotation) ||
            (filter === "invoice" && isInvoice);
          return !matches;
        })
      );
    } catch (err) {
      console.warn("Failed to clear all notifications:", err);
    }
  };

  const headerTitle =
    filter === "quotation"
      ? "Quotation Notifications"
      : filter === "invoice"
      ? "Invoice Notifications"
      : "Notifications";

  const emptyText =
    filter === "quotation"
      ? "No quotation notifications."
      : filter === "invoice"
      ? "No invoice notifications."
      : "No notifications yet.";

  return (
    <div className="notif-bell-container" ref={containerRef}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="View notifications"
        title={headerTitle}
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
              {headerTitle} {unreadCount > 0 ? `(${unreadCount} Unread)` : ""}
            </h4>
            <div className="notif-header-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notif-mark-all-btn"
                  onClick={handleMarkAllRead}
                >
                  Mark all as read
                </button>
              )}
              <button
                type="button"
                className="notif-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
                title="Close"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <ul className="notif-list">
            {notifications.length === 0 ? (
              <li className="notif-empty">
                <span>{emptyText}</span>
              </li>
            ) : (
              notifications.map((notif) => {
                const refType = String(
                  notif.reference_type || notif.referenceType || ""
                ).toLowerCase();
                const titleLower = String(notif.title || "").toLowerCase();
                const isInvoice =
                  refType === "invoice" || titleLower.includes("invoice");
                const isPendingForSuperAdmin =
                  isSuperAdmin &&
                  (titleLower.includes("pending") || notif.type === "warning");
                const isDecisionForAdmin =
                  !isSuperAdmin &&
                  (titleLower.includes("approved") ||
                    titleLower.includes("rejected"));

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
                        <div className="notif-top-actions">
                          <span className="notif-time">
                            {formatRelativeTime(notif.created_at)}
                          </span>
                          {!notif.is_read && (
                            <button
                              type="button"
                              className="notif-mark-single-btn"
                              title="Mark as read"
                              onClick={(e) =>
                                handleMarkSingleRead(e, notif.notification_id)
                              }
                            >
                              <Check size={12} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="notif-delete-single-btn"
                            title="Delete notification"
                            onClick={(e) =>
                              handleDeleteSingle(e, notif.notification_id)
                            }
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <p className="notif-message">{notif.message}</p>
                      {isPendingForSuperAdmin && (
                        <span className="notif-action-hint">
                          Review in Approvals <ExternalLink size={11} />
                        </span>
                      )}
                      {isDecisionForAdmin && (
                        <span className="notif-action-hint">
                          {isInvoice ? (
                            <>
                              View in Invoices <ExternalLink size={11} />
                            </>
                          ) : (
                            <>
                              View in Quotations <ExternalLink size={11} />
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {notifications.length > 0 && (
            <div className="notif-footer">
              <button
                type="button"
                className="notif-clear-all-btn"
                onClick={handleClearAll}
                title="Clear all notifications"
              >
                <Trash2 size={13} />
                <span>Clear all</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
