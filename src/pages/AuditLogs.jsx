import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Search,
  RefreshCw,
  AlertCircle,
  Clock,
  ShieldCheck,
  User,
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
  if (a.includes("approv")) return "audit-action-approved";
  if (a.includes("reject")) return "audit-action-rejected";
  if (a.includes("submit") || a.includes("pending")) return "audit-action-pending";
  return "audit-action-created";
}

export default function AuditLogs() {
  const user = getAuthenticatedUser();
  const isSuperAdmin = String(user?.role || "").trim().toLowerCase() === "super admin";

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("All");

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

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesAction =
        actionFilter === "All" ||
        String(log.action || "").toLowerCase().includes(actionFilter.toLowerCase());

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

      return matchesAction && matchesSearch;
    });
  }, [logs, search, actionFilter]);

  if (!isSuperAdmin) {
    return (
      <main className="audit-page">
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <AlertCircle size={36} color="#b91c1c" />
          <h2 style={{ marginTop: "12px", color: "#0f172a" }}>Access Restricted</h2>
          <p style={{ color: "#64748b", fontSize: "13px" }}>
            Audit Logs are restricted to Super Administrator accounts only.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="audit-page">
      <div className="audit-header">
        <div>
          <p className="audit-eyebrow">SYSTEM GOVERNANCE &amp; SECURITY</p>
          <h1>System Audit Logs</h1>
          <p className="audit-subtitle">
            Chronological audit trail of quotation and workflow actions taken across the system.
          </p>
        </div>

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

      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "#b91c1c", padding: "10px 14px", marginBottom: "16px", fontSize: "12.5px" }}>
          {error}
        </div>
      )}

      <section className="audit-panel">
        <div className="audit-toolbar">
          <label className="audit-search">
            <Search size={15} color="#64748b" />
            <input
              type="search"
              placeholder="Search by user, quotation number, or action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <select
              style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 0, fontSize: "12px", background: "#fff", outline: "none" }}
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="All">All Actions</option>
              <option value="Approved">Approvals</option>
              <option value="Rejected">Rejections</option>
              <option value="Submitted">Submissions</option>
              <option value="Draft">Drafts</option>
            </select>

            <span className="audit-count">
              {filteredLogs.length} Records
            </span>
          </div>
        </div>

        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User / Initiator</th>
                <th>Action</th>
                <th>Quotation / Record ID</th>
                <th>Details &amp; Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "35px" }}>
                    Loading audit trail records...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "35px", color: "#64748b" }}>
                    No audit log records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.log_id || `${log.created_at}-${log.record_id}`}>
                    <td style={{ whiteSpace: "nowrap", color: "#64748b" }}>
                      {formatTimestamp(log.created_at)}
                    </td>
                    <td>
                      <strong>{log.user_name || "System"}</strong>
                      <span className="audit-role-badge">
                        {log.user_role || "User"}
                      </span>
                    </td>
                    <td>
                      <span className={`audit-action-badge ${getActionBadgeClass(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: "#1d4ed8" }}>
                      {log.record_id || "—"}
                    </td>
                    <td style={{ maxWidth: "340px", wordBreak: "break-word" }}>
                      {log.details || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
