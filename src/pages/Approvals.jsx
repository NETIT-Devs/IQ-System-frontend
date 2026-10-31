import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Eye,
  Check,
  X,
  Clock3,
  FileText,
  AlertCircle,
  XCircle,
  CheckCircle2,
  Receipt,
  Layers,
  User,
  Filter,
} from "lucide-react";
import {
  getQuotations,
  approveQuotation,
  rejectQuotation,
} from "../services/quotationService";
import { getAuthenticatedUser } from "../utils/authStorage";
import QuotationDetails from "./QuotationDetails";
import "./Approvals.css";

function formatCurrency(amount, currency = "LKR") {
  if (amount === null || amount === undefined || amount === "") {
    return "—";
  }

  const number = Number(amount);
  if (!Number.isFinite(number)) return "—";

  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "LKR",
    maximumFractionDigits: 2,
  }).format(number);
}

function formatDate(date) {
  if (!date) return "—";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return String(date);

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getQuotationStatusCategory(quotation) {
  const approval = String(quotation?.approval_status || "").trim().toLowerCase();
  const status = String(quotation?.status || "").trim().toLowerCase();
  const role = String(quotation?.created_by_role || "").trim().toLowerCase();
  const isSuperCreator = role.includes("super") || quotation?.created_by === 2;

  // Super Admin finalized quotations are always Approved and never need pending approval!
  if (isSuperCreator) {
    if (status === "draft") return "draft";
    return "approved";
  }

  // Admin submitted quotations
  if (approval === "approved" || status.includes("approv") || status.includes("accept")) {
    return "approved";
  }
  if (approval === "rejected" || status.includes("reject") || status.includes("declin")) {
    return "rejected";
  }
  if (status === "draft" && approval !== "pending") {
    return "draft";
  }
  if (approval === "pending" || status.includes("pending") || status === "sent") {
    return "pending";
  }

  return "draft";
}

function SummaryCard({ label, value, icon, note, tone = "blue", active = false, onClick }) {
  return (
    <article
      className={`approval-summary-card clickable ${active ? "active" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      title={`Click to view ${label}`}
    >
      <div className={`approval-summary-icon ${tone}`}>{icon}</div>
      <div className="approval-summary-info">
        <p>{label}</p>
        <strong>{value}</strong>
        {note && <span className="approval-card-note">{note}</span>}
      </div>
      {active && <span className="approval-card-indicator" />}
    </article>
  );
}

export default function Approvals() {
  const user = getAuthenticatedUser();
  const role = String(user?.role || "").trim().toLowerCase();
  const isSuperAdmin = role === "super admin";

  const [activeTab, setActiveTab] = useState("quotations"); // "quotations" | "invoices"
  const [statusFilter, setStatusFilter] = useState("pending"); // "pending" | "approved" | "rejected" | "draft" | "all"
  const [allQuotations, setAllQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Modal states
  const [viewingId, setViewingId] = useState(null);
  const [rejectingQuotation, setRejectingQuotation] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const records = await getQuotations();
      setAllQuotations(Array.isArray(records) ? records : []);
    } catch (err) {
      console.error("Failed to load approvals data:", err);
      setError(
        err?.message || "Could not load approvals data from the backend."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Overall counts for summary cards
  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let drafts = 0;

    allQuotations.forEach((q) => {
      const cat = getQuotationStatusCategory(q);
      if (cat === "pending") pending += 1;
      else if (cat === "approved") approved += 1;
      else if (cat === "rejected") rejected += 1;
      else drafts += 1;
    });

    return {
      total: allQuotations.length,
      pending,
      approved,
      rejected,
      drafts,
    };
  }, [allQuotations]);

  // Filter quotations by status filter & search query
  const filteredQuotations = useMemo(() => {
    const q = search.trim().toLowerCase();

    return allQuotations.filter((item) => {
      const cat = getQuotationStatusCategory(item);
      if (statusFilter !== "all" && cat !== statusFilter) {
        return false;
      }

      if (!q) return true;

      const num = item.quotation_number || "";
      const client = item.customer_name || item.client_name || "";
      const proj =
        item.items?.[0]?.website_type ||
        item.items?.[0]?.item_name ||
        item.project_name ||
        "";
      const createdBy = item.created_by_name || String(item.created_by || "");
      const reason = item.rejection_reason || "";

      return (
        num.toLowerCase().includes(q) ||
        client.toLowerCase().includes(q) ||
        proj.toLowerCase().includes(q) ||
        createdBy.toLowerCase().includes(q) ||
        reason.toLowerCase().includes(q)
      );
    });
  }, [allQuotations, statusFilter, search]);

  const headingInfo = useMemo(() => {
    switch (statusFilter) {
      case "approved":
        return {
          title: "Approved Quotations History",
          subtitle: "Quotations reviewed and approved by the Super Admin.",
          badge: `${filteredQuotations.length} Approved`,
        };
      case "rejected":
        return {
          title: "Rejected Quotations History",
          subtitle: "Quotations rejected by the Super Admin with specific feedback and revision notes.",
          badge: `${filteredQuotations.length} Rejected`,
        };
      case "draft":
        return {
          title: "Draft Quotations",
          subtitle: "Quotations currently saved as drafts and not yet submitted for approval.",
          badge: `${filteredQuotations.length} Drafts`,
        };
      case "all":
        return {
          title: "All Quotations Approvals History",
          subtitle: "Comprehensive review trail of all quotations across all review statuses.",
          badge: `${filteredQuotations.length} Total`,
        };
      case "pending":
      default:
        return {
          title: "Pending Quotations Awaiting Approval",
          subtitle: "Quotations submitted by administrators that require your review and decision.",
          badge: `${filteredQuotations.length} Pending`,
        };
    }
  }, [statusFilter, filteredQuotations.length]);

  // Approve action
  const handleApprove = async (quotation) => {
    if (!isSuperAdmin) {
      setFeedback("Only Super Admin can authorize quotation approvals.");
      return;
    }

    const qNum = quotation.quotation_number || `ID #${quotation.quotation_id}`;
    if (!window.confirm(`Are you sure you want to approve quotation ${qNum}?`)) {
      return;
    }

    try {
      setActionLoading(true);
      setFeedback("");
      const res = await approveQuotation(quotation.quotation_id);
      setFeedback(
        res?.message || `Quotation ${qNum} has been approved successfully!`
      );
      await loadData();
    } catch (err) {
      setFeedback(err.message || "Failed to approve quotation.");
    } finally {
      setActionLoading(false);
    }
  };

  // Open reject modal
  const openRejectModal = (quotation) => {
    setRejectingQuotation(quotation);
    setRejectionReason("");
    setRejectionError("");
  };

  // Submit reject action
  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      setRejectionError("Please provide a rejection reason / feedback for the admin.");
      return;
    }

    const quotation = rejectingQuotation;
    const qNum = quotation.quotation_number || `ID #${quotation.quotation_id}`;

    try {
      setActionLoading(true);
      setRejectionError("");
      const res = await rejectQuotation(
        quotation.quotation_id,
        rejectionReason.trim()
      );
      setRejectingQuotation(null);
      setFeedback(
        res?.message || `Quotation ${qNum} has been rejected.`
      );
      await loadData();
    } catch (err) {
      setRejectionError(err.message || "Failed to reject quotation.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main className="approvals-page">
      {/* Header bar */}
      <div className="approvals-header">
        <div>
          <p className="approvals-eyebrow">Administration / Approvals</p>
          <h1>Review &amp; Approvals</h1>
          <p className="approvals-subtitle">
            Authorize or reject admin submissions, verify project scope and pricing before clients receive documents.
          </p>
        </div>

        <button
          type="button"
          className="approval-btn-action approval-btn-refresh"
          onClick={loadData}
          disabled={loading}
          title="Refresh approvals queue"
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className="approval-feedback">
          <CheckCircle2 size={16} />
          <span>{feedback}</span>
          <button
            type="button"
            className="approval-btn-action"
            style={{ marginLeft: "auto", border: "none", background: "none" }}
            onClick={() => setFeedback("")}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="approval-error">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button
            type="button"
            onClick={loadData}
            style={{ marginLeft: "auto" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Modern Approvals Switcher Tabs */}
      <div className="approval-tabs-wrapper">
        <div className="approval-tabs-container" role="tablist" aria-label="Approval categories">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "quotations"}
            className={`approval-tab-card ${activeTab === "quotations" ? "active" : ""}`}
            onClick={() => setActiveTab("quotations")}
          >
            <div className="approval-tab-icon-box">
              <FileText size={16} />
            </div>
            <div className="approval-tab-info">
              <div className="approval-tab-label-group">
                <span className="approval-tab-label">Quotation Approvals</span>
                {stats.pending > 0 && (
                  <span className="approval-tab-count highlight">
                    <span className="approval-tab-dot" />
                    {stats.pending} Pending
                  </span>
                )}
              </div>
            </div>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "invoices"}
            className={`approval-tab-card ${activeTab === "invoices" ? "active" : ""}`}
            onClick={() => setActiveTab("invoices")}
          >
            <div className="approval-tab-icon-box">
              <Receipt size={16} />
            </div>
            <div className="approval-tab-info">
              <div className="approval-tab-label-group">
                <span className="approval-tab-label">Invoice Approvals</span>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Tab 1: Quotation Approvals */}
      {activeTab === "quotations" && (
        <>
          {/* Summary metrics - Clickable to switch views */}
          <section className="approval-summary">
            <SummaryCard
              label="Pending Approvals"
              value={stats.pending}
              icon={<Clock3 size={22} />}
              note="Awaiting decision"
              tone="amber"
              active={statusFilter === "pending"}
              onClick={() => setStatusFilter("pending")}
            />
            <SummaryCard
              label="Approved Quotations"
              value={stats.approved}
              icon={<Check size={22} />}
              note="Verified &amp; ready"
              tone="green"
              active={statusFilter === "approved"}
              onClick={() => setStatusFilter("approved")}
            />
            <SummaryCard
              label="Rejected Quotations"
              value={stats.rejected}
              icon={<XCircle size={22} />}
              note="Returned with notes"
              tone="red"
              active={statusFilter === "rejected"}
              onClick={() => setStatusFilter("rejected")}
            />
            <SummaryCard
              label="Draft Quotations"
              value={stats.drafts}
              icon={<FileText size={22} />}
              note="Unsubmitted drafts"
              tone="blue"
              active={statusFilter === "draft"}
              onClick={() => setStatusFilter("draft")}
            />
          </section>

          {/* Quotations Table Panel */}
          <section className="approval-panel">
            <div className="approval-panel-heading">
              <div>
                <h2>{headingInfo.title}</h2>
                <p>{headingInfo.subtitle}</p>
              </div>

              <span className="approval-count">
                {headingInfo.badge}
              </span>
            </div>

            <div className="approval-toolbar">
              <label className="approval-search">
                <Search size={16} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by quotation #, client, project, or reason..."
                />
              </label>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11.5px", fontWeight: "650", color: "#64748b" }}>Status Filter:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter quotations by approval status"
                >
                  <option value="pending">⏳ Pending Approvals ({stats.pending})</option>
                  <option value="approved">✅ Approved Quotations ({stats.approved})</option>
                  <option value="rejected">❌ Rejected Quotations ({stats.rejected})</option>
                  <option value="draft">📝 Draft Quotations ({stats.drafts})</option>
                  <option value="all">📋 All Quotations ({stats.total})</option>
                </select>
              </div>
            </div>

            <div className="approval-table-wrap">
              <table className="approval-table">
                <thead>
                  <tr>
                    <th>Quotation Number</th>
                    <th>Client Name</th>
                    <th>Project / Service</th>
                    <th>Amount</th>
                    <th>Created By</th>
                    <th>Date</th>
                    <th>Approval Status</th>
                    {(statusFilter === "rejected" || statusFilter === "all") && (
                      <th>Rejection Reason / Feedback</th>
                    )}
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={statusFilter === "rejected" || statusFilter === "all" ? 9 : 8} style={{ textAlign: "center", padding: "35px" }}>
                        Loading quotation records...
                      </td>
                    </tr>
                  ) : filteredQuotations.length === 0 ? (
                    <tr>
                      <td colSpan={statusFilter === "rejected" || statusFilter === "all" ? 9 : 8} style={{ textAlign: "center", padding: "40px" }}>
                        <div style={{ color: "#64748b", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                          {statusFilter === "approved" ? (
                            <>
                              <CheckCircle2 size={32} color="#15803d" />
                              <strong style={{ color: "#0f172a" }}>No Approved Quotations Found</strong>
                              <span>{search ? "No approved quotations match your search." : "No quotations have been approved yet."}</span>
                            </>
                          ) : statusFilter === "rejected" ? (
                            <>
                              <XCircle size={32} color="#dc2626" />
                              <strong style={{ color: "#0f172a" }}>No Rejected Quotations Found</strong>
                              <span>{search ? "No rejected quotations match your search." : "No quotations have been rejected yet."}</span>
                            </>
                          ) : statusFilter === "pending" ? (
                            <>
                              <CheckCircle2 size={32} color="#15803d" />
                              <strong style={{ color: "#0f172a" }}>No Pending Approvals</strong>
                              <span>{search ? "No pending quotations match your search." : "All quotation submissions have been reviewed."}</span>
                            </>
                          ) : (
                            <>
                              <FileText size={32} color="#64748b" />
                              <strong style={{ color: "#0f172a" }}>No Quotations Found</strong>
                              <span>No quotations match your selected filter or search term.</span>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredQuotations.map((q) => {
                      const amount = q.total_amount ?? q.grand_total ?? 0;
                      const websiteType =
                        q.items?.[0]?.website_type ||
                        q.items?.[0]?.item_name ||
                        "Software Project";
                      const client =
                        q.customer_name || q.client_name || "Client";
                      const createdBy =
                        q.created_by_role ||
                        (q.created_by === 2
                          ? "Super Admin"
                          : q.created_by === 1
                          ? "Admin"
                          : q.created_by_name || `User #${q.created_by || "—"}`);
                      const recordDate = formatDate(
                        q.updated_at || q.created_at || q.quotation_date
                      );
                      const cat = getQuotationStatusCategory(q);

                      return (
                        <tr key={q.quotation_id}>
                          <td style={{ fontWeight: 700, color: "#0f172a" }}>
                            {q.quotation_number}
                          </td>
                          <td>{client}</td>
                          <td>{websiteType}</td>
                          <td style={{ fontWeight: 700, color: "#1d4ed8" }}>
                            {formatCurrency(amount, q.currency)}
                          </td>
                          <td>{createdBy}</td>
                          <td>{recordDate}</td>
                          <td>
                            {cat === "pending" && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "#fef3c7",
                                  color: "#b45309",
                                  padding: "3px 8px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                }}
                              >
                                <Clock3 size={12} /> Pending Approval
                              </span>
                            )}
                            {cat === "approved" && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "#dcfce7",
                                  color: "#15803d",
                                  padding: "3px 8px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                }}
                              >
                                <Check size={12} /> Approved
                              </span>
                            )}
                            {cat === "rejected" && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                  padding: "3px 8px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                }}
                              >
                                <XCircle size={12} /> Rejected
                              </span>
                            )}
                            {cat === "draft" && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "#f1f5f9",
                                  color: "#475569",
                                  padding: "3px 8px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                }}
                              >
                                <FileText size={12} /> Draft
                              </span>
                            )}
                          </td>

                          {(statusFilter === "rejected" || statusFilter === "all") && (
                            <td style={{ maxWidth: "230px", fontSize: "11.5px", color: q.rejection_reason ? "#991b1b" : "#94a3b8" }}>
                              {q.rejection_reason ? (
                                <span title={q.rejection_reason} style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                  {q.rejection_reason}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          )}

                          <td style={{ textAlign: "right" }}>
                            <div className="approval-table-actions" style={{ justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                className="approval-btn-action approval-btn-view"
                                onClick={() => setViewingId(q.quotation_id)}
                                title="View Quotation Details & Items"
                              >
                                <Eye size={13} />
                                <span>View</span>
                              </button>

                              {cat === "pending" && (
                                <>
                                  <button
                                    type="button"
                                    className="approval-btn-action approval-btn-approve"
                                    onClick={() => handleApprove(q)}
                                    disabled={actionLoading}
                                    title="Approve quotation"
                                  >
                                    <Check size={13} />
                                    <span>Approve</span>
                                  </button>

                                  <button
                                    type="button"
                                    className="approval-btn-action approval-btn-reject"
                                    onClick={() => openRejectModal(q)}
                                    disabled={actionLoading}
                                    title="Reject quotation with reason"
                                  >
                                    <X size={13} />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Tab 2: Invoice Approvals */}
      {activeTab === "invoices" && (
        <section className="approval-panel" style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{ maxWidth: "480px", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "48px", height: "48px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
              <Receipt size={24} />
            </div>
            <h2 style={{ fontSize: "16px", color: "#0f172a", margin: 0 }}>
              Invoice Approval Queue
            </h2>
            <p style={{ fontSize: "12.5px", color: "#64748b", margin: 0, lineHeight: 1.6 }}>
              Invoices created by administrators that require Super Admin authorization will appear here. No invoices are currently pending review.
            </p>
          </div>
        </section>
      )}

      {/* View Details Modal */}
      {viewingId && (
        <QuotationDetails
          activeId={viewingId}
          onClose={() => setViewingId(null)}
        />
      )}

      {/* Rejection Modal */}
      {rejectingQuotation && (
        <div className="approval-rejection-overlay">
          <div className="approval-rejection-card">
            <div className="approval-rejection-header">
              <h3>
                Reject Quotation: {rejectingQuotation.quotation_number}
              </h3>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}
                onClick={() => setRejectingQuotation(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="approval-rejection-body">
              <p>
                Please state the specific reason or feedback for rejecting this quotation. The administrator will see this message and be able to revise and resubmit.
              </p>

              {rejectionError && (
                <div style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "#b91c1c", padding: "8px 12px", fontSize: "12px", marginBottom: "10px" }}>
                  {rejectionError}
                </div>
              )}

              <textarea
                rows={4}
                className="approval-rejection-textarea"
                placeholder="e.g. Scope item 2 requires clarification on hosting. Please update price..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                autoFocus
              />
            </div>

            <div className="approval-rejection-footer">
              <button
                type="button"
                className="approval-btn-action approval-btn-view"
                onClick={() => setRejectingQuotation(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="approval-btn-action approval-btn-reject"
                onClick={handleConfirmReject}
                disabled={actionLoading}
              >
                {actionLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
