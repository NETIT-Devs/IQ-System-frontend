import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ChevronDown,
  Check,
} from "lucide-react";
import { getAuditLogs } from "../services/quotationService";
import { getAuthenticatedUser } from "../utils/authStorage";
import ThemeToggle from "../components/ThemeToggle";
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

function getLocalDateString(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return "";
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
  const [dateFilter, setDateFilter] = useState("");
  const [openAuditDropdown, setOpenAuditDropdown] = useState(null); // null | "category" | "role"
  const auditDropdownRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (
        auditDropdownRef.current &&
        !auditDropdownRef.current.contains(e.target)
      ) {
        setOpenAuditDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

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

      // Date filter
      const localDate = getLocalDateString(log.created_at);
      const formattedTs = formatTimestamp(log.created_at);
      const matchesDate = !dateFilter || localDate === dateFilter;

      // Search term filter (includes date/timestamp search)
      const matchesSearch =
        !q ||
        [
          log.user_name,
          log.user_role,
          log.action,
          log.record_id,
          log.details,
          log.created_at,
          localDate,
          formattedTs,
        ]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(q));

      return matchesCategory && matchesRole && matchesDate && matchesSearch;
    });
  }, [logs, search, categoryFilter, roleFilter, dateFilter]);

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
          <ThemeToggle />
          <button
            type="button"
            className="audit-refresh-btn"
            onClick={loadLogs}
            disabled={loading}
            aria-label="Refresh logs"
            title="Refresh logs"
          >
            <RefreshCw size={17} className={loading ? "spin" : ""} />
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

      {/* Separated Search & Filter Toolbar */}
      <div className="audit-toolbar">
          <div className="audit-toolbar-left">
            <label className="audit-search">
              <Search size={15} color="#64748b" />
              <input
                type="search"
                placeholder="Search by initiator, action, record ID, date, or details..."
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

            <div className="audit-date-filter">
              <input
                type="date"
                className="audit-date-input"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                aria-label="Filter by date"
                title="Filter by date"
              />
              {dateFilter && (
                <button
                  type="button"
                  className="audit-date-clear"
                  onClick={() => setDateFilter("")}
                  aria-label="Clear date filter"
                  title="Clear date"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="audit-dropdowns-group" ref={auditDropdownRef}>
              {/* 1. All Categories Dropdown */}
              <div className="audit-dropdown-wrap">
                <button
                  type="button"
                  className={`audit-dropdown-btn ${openAuditDropdown === "category" ? "active" : ""}`}
                  onClick={() =>
                    setOpenAuditDropdown((prev) =>
                      prev === "category" ? null : "category"
                    )
                  }
                  aria-expanded={openAuditDropdown === "category"}
                >
                  <span className="audit-dropdown-label">
                    {categoryFilter === "quotations"
                      ? "Quotation Workflows"
                      : categoryFilter === "approvals"
                        ? "Submissions & Approvals"
                        : categoryFilter === "users"
                          ? "Admin & User Management"
                          : categoryFilter === "auth"
                            ? "Sign-ins & Authentication"
                            : categoryFilter === "customers"
                              ? "Customer Records"
                              : "All Categories"}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`audit-dropdown-chevron ${openAuditDropdown === "category" ? "open" : ""}`}
                  />
                </button>

                {openAuditDropdown === "category" && (
                  <div className="audit-dropdown-menu" role="listbox">
                    <div className="audit-dropdown-header">
                      <span>Filter by Category</span>
                    </div>
                    <div className="audit-dropdown-list">
                      {[
                        { value: "All", label: "All Categories", color: "#64748b" },
                        { value: "quotations", label: "Quotation Workflows", color: "#7c3aed" },
                        { value: "approvals", label: "Submissions & Approvals", color: "#16a34a" },
                        { value: "users", label: "Admin & User Management", color: "#2563eb" },
                        { value: "auth", label: "Sign-ins & Authentication", color: "#ea580c" },
                        { value: "customers", label: "Customer Records", color: "#0d9488" },
                      ].map((opt) => {
                        const isSelected = categoryFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className={`audit-dropdown-item ${isSelected ? "selected" : ""}`}
                            onClick={() => {
                              setCategoryFilter(opt.value);
                              setOpenAuditDropdown(null);
                            }}
                          >
                            <div className="audit-dropdown-item-left">
                              <span
                                className="audit-dropdown-dot"
                                style={{ backgroundColor: opt.color }}
                              />
                              <span className="audit-dropdown-item-text">{opt.label}</span>
                            </div>
                            {isSelected && <Check size={14} className="audit-dropdown-check" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. All Initiator Roles Dropdown */}
              <div className="audit-dropdown-wrap">
                <button
                  type="button"
                  className={`audit-dropdown-btn ${openAuditDropdown === "role" ? "active" : ""}`}
                  onClick={() =>
                    setOpenAuditDropdown((prev) =>
                      prev === "role" ? null : "role"
                    )
                  }
                  aria-expanded={openAuditDropdown === "role"}
                >
                  <span className="audit-dropdown-label">
                    {roleFilter === "Super Admin"
                      ? "Super Admin"
                      : roleFilter === "Admin"
                        ? "Admin"
                        : "All Initiator Roles"}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`audit-dropdown-chevron ${openAuditDropdown === "role" ? "open" : ""}`}
                  />
                </button>

                {openAuditDropdown === "role" && (
                  <div className="audit-dropdown-menu" role="listbox">
                    <div className="audit-dropdown-header">
                      <span>Filter by Initiator Role</span>
                    </div>
                    <div className="audit-dropdown-list">
                      {[
                        { value: "All", label: "All Initiator Roles", color: "#64748b" },
                        { value: "Super Admin", label: "Super Admin", color: "#4338ca" },
                        { value: "Admin", label: "Admin", color: "#2563eb" },
                      ].map((opt) => {
                        const isSelected = roleFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className={`audit-dropdown-item ${isSelected ? "selected" : ""}`}
                            onClick={() => {
                              setRoleFilter(opt.value);
                              setOpenAuditDropdown(null);
                            }}
                          >
                            <div className="audit-dropdown-item-left">
                              <span
                                className="audit-dropdown-dot"
                                style={{ backgroundColor: opt.color }}
                              />
                              <span className="audit-dropdown-item-text">{opt.label}</span>
                            </div>
                            {isSelected && <Check size={14} className="audit-dropdown-check" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <span className="audit-count">
            {filteredLogs.length} Records
          </span>
        </div>

      {/* Main Panel (Audit Logs Table) */}
      <section className="audit-panel">
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
