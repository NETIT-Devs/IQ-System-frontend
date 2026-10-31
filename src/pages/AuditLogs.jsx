import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  ClipboardList,
  Search,
  RefreshCw,
  AlertCircle,
  Clock,
  ShieldCheck,
  User,
  Users,
  FileText,
  LogIn,
  Menu,
  X,
  Filter,
} from "lucide-react";
import { getAuditLogs } from "../services/quotationService";
import { getAuthenticatedUser } from "../utils/authStorage";
import "./AuditLogs.css";

function formatTimestamp(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

function getActionBadgeClass(action) {
  const a = String(action || "").toLowerCase();
  if (a.includes("delet")) return "audit-action-deleted";
  if (a.includes("reject")) return "audit-action-rejected";
  if (a.includes("approv") || a.includes("finaliz")) return "audit-action-approved";
  if (a.includes("submit") || a.includes("pending") || a.includes("resubmit")) return "audit-action-pending";
  if (a.includes("login") || a.includes("sign in")) return "audit-action-login";
  if (a.includes("admin") || a.includes("user") || a.includes("password")) return "audit-action-user";
  if (a.includes("customer")) return "audit-action-customer";
  return "audit-action-created";
}

export default function AuditLogs() {
  const { openSidebar } = useOutletContext();
  const user = getAuthenticatedUser();
  const isSuperAdmin = String(user?.role || "").trim().toLowerCase() === "super admin";

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const records = await getAuditLogs();
      setLogs(Array.isArray(records) ? records : []);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
      setError(err?.message || "Could not retrieve audit logs from backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();

    return logs.filter((log) => {
      const action = String(log.action || "").toLowerCase();
      const role = String(log.user_role || "").toLowerCase();

      // Category filter
      let matchesCategory = true;
      if (categoryFilter === "quotations") {
        matchesCategory = action.includes("quotation");
      } else if (categoryFilter === "approvals") {
        matchesCategory =
          action.includes("approv") ||
          action.includes("reject") ||
          action.includes("submit");
      } else if (categoryFilter === "users") {
        matchesCategory =
          action.includes("admin") ||
          action.includes("user") ||
          action.includes("password");
      } else if (categoryFilter === "auth") {
        matchesCategory = action.includes("login") || action.includes("password");
      } else if (categoryFilter === "customers") {
        matchesCategory = action.includes("customer");
      }

      // Role filter
      let matchesRole = true;
      if (roleFilter !== "All") {
        const filterVal = roleFilter.trim().toLowerCase();
        const normalizedRole = role.replace(/[\-_]/g, " ").trim();
        if (filterVal === "admin") {
          matchesRole = normalizedRole === "admin";
        } else if (filterVal === "super admin") {
          matchesRole = normalizedRole === "super admin" || normalizedRole === "superadmin";
        } else {
          matchesRole = normalizedRole === filterVal;
        }
      }

      // Search term filter
      const matchesSearch =
        !q ||
        [
          log.user_name,
          log.user_role,
          log.action,
          log.record_id,
          log.details,
        ]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(q));

      return matchesCategory && matchesRole && matchesSearch;
    });
  }, [logs, search, categoryFilter, roleFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const quotations = logs.filter((l) =>
      String(l.action || "").toLowerCase().includes("quotation")
    ).length;
    const userEvents = logs.filter((l) => {
      const a = String(l.action || "").toLowerCase();
      return a.includes("admin") || a.includes("user");
    }).length;
    const logins = logs.filter((l) =>
      String(l.action || "").toLowerCase().includes("login")
    ).length;

    return { total, quotations, userEvents, logins };
  }, [logs]);

  if (!isSuperAdmin) {
    return (
      <main className="audit-page">
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <AlertCircle size={40} color="#b91c1c" />
          <h2 style={{ marginTop: "14px", color: "#0f172a" }}>Access Restricted</h2>
          <p style={{ color: "#64748b", fontSize: "13px" }}>
            Audit Logs are restricted to Super Administrator accounts only.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="audit-page">
      {/* Top Header */}
      <header className="audit-header">
        <div className="audit-header-left">
          <button
            type="button"
            className="audit-menu-button"
            aria-label="Open menu"
            onClick={openSidebar}
          >
            <Menu size={20} />
          </button>
          <div>
            <p className="audit-eyebrow">Administration / Audit Logs</p>
            <h1>System Audit Logs</h1>
            <p className="audit-subtitle">
              Comprehensive chronological audit trail of all quotation workflows, admin actions, and system logins.
            </p>
          </div>
        </div>

        <div className="audit-header-actions">
          <button
            type="button"
            className="audit-refresh-btn"
            onClick={loadLogs}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            <span>Refresh Logs</span>
          </button>
        </div>
      </header>

      {/* Error alert */}
      {error && (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            padding: "10px 14px",
            marginBottom: "16px",
            fontSize: "12.5px",
          }}
        >
          {error}
        </div>
      )}

      {/* Overview Statistics Cards */}
      <section className="audit-stats-grid">
        <div className="audit-stat-card">
          <div className="audit-stat-icon blue">
            <ClipboardList size={22} />
          </div>
          <div className="audit-stat-info">
            <p>Total Events</p>
            <h3>{stats.total}</h3>
            <span className="audit-stat-note">All recorded system actions</span>
          </div>
        </div>

        <div className="audit-stat-card">
          <div className="audit-stat-icon purple">
            <FileText size={22} />
          </div>
          <div className="audit-stat-info">
            <p>Quotation Activities</p>
            <h3>{stats.quotations}</h3>
            <span className="audit-stat-note">Workflow &amp; proposals</span>
          </div>
        </div>

        <div className="audit-stat-card">
          <div className="audit-stat-icon emerald">
            <Users size={22} />
          </div>
          <div className="audit-stat-info">
            <p>Admin / User Events</p>
            <h3>{stats.userEvents}</h3>
            <span className="audit-stat-note">Account &amp; security logs</span>
          </div>
        </div>

        <div className="audit-stat-card">
          <div className="audit-stat-icon amber">
            <LogIn size={22} />
          </div>
          <div className="audit-stat-info">
            <p>User Sign-ins</p>
            <h3>{stats.logins}</h3>
            <span className="audit-stat-note">Authenticated sessions</span>
          </div>
        </div>
      </section>

      {/* Main Panel */}
      <section className="audit-panel">
        {/* Toolbar */}
        <div className="audit-toolbar">
          <div className="audit-toolbar-left">
            <label className="audit-search">
              <Search size={15} color="#64748b" />
              <input
                type="search"
                placeholder="Search by initiator, action, record ID, or details..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                >
                  <X size={14} />
                </button>
              )}
            </label>

            <select
              className="audit-filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All Categories</option>
              <option value="quotations">Quotation Workflows</option>
              <option value="approvals">Submissions &amp; Approvals</option>
              <option value="users">Admin &amp; User Management</option>
              <option value="auth">Sign-ins &amp; Authentication</option>
              <option value="customers">Customer Records</option>
            </select>

            <select
              className="audit-filter-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="All">All Initiator Roles</option>
              <option value="Super Admin">Super Admin</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          <span className="audit-count">
            {filteredLogs.length} Records
          </span>
        </div>

        {/* Table */}
        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User / Initiator</th>
                <th>Action Taken</th>
                <th>Record Reference</th>
                <th>Action Details &amp; Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px" }}>
                    <RefreshCw size={20} className="spin" style={{ marginBottom: "8px", color: "#2563eb" }} />
                    <p style={{ margin: 0, color: "#64748b" }}>Loading audit records...</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                    No audit log records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const initials = (log.user_name || "AD")
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0].toUpperCase())
                    .join("");
                  const isSuper = String(log.user_role || "").toLowerCase().includes("super");

                  return (
                    <tr key={log.log_id || `${log.created_at}-${log.record_id}-${log.action}`}>
                      <td style={{ whiteSpace: "nowrap", color: "#64748b" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Clock size={13} color="#94a3b8" />
                          <span>{formatTimestamp(log.created_at)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="audit-user-cell">
                          <div className={`audit-avatar ${isSuper ? "super-admin" : ""}`}>
                            {initials || "U"}
                          </div>
                          <div className="audit-user-details">
                            <span className="audit-user-name">{log.user_name || "System"}</span>
                            <span className={`audit-role-badge ${isSuper ? "super-admin" : "admin"}`}>
                              {log.user_role || "User"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`audit-action-badge ${getActionBadgeClass(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td>
                        <span className="audit-record-id">
                          {log.record_id || "—"}
                        </span>
                      </td>
                      <td style={{ maxWidth: "380px", wordBreak: "break-word", lineHeight: "1.45" }}>
                        {log.details || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
