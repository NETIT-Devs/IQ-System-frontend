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

function SummaryCard({ label, value, icon, tone = "blue" }) {
  return (
    <article className="approval-summary-card">
      <div className={`approval-summary-icon ${tone}`}>{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

export default function Approvals() {
  const user = getAuthenticatedUser();
  const role = String(user?.role || "").trim().toLowerCase();
  const isSuperAdmin = role === "super admin";

  const [activeTab, setActiveTab] = useState("quotations"); // "quotations" | "invoices"
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

  // Quotations awaiting review
  const pendingQuotations = useMemo(() => {
    return allQuotations.filter((q) => {
      const s = String(q.status || q.approval_status || "").trim();
      return s === "Pending Approval" || s.toLowerCase() === "pending";
    });
  }, [allQuotations]);

  // Overall counts for summary cards
  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let drafts = 0;

    allQuotations.forEach((q) => {
      const s = String(q.status || q.approval_status || "")
        .trim()
        .toLowerCase();
      if (s.includes("pending")) pending += 1;
      else if (s.includes("approv") || s.includes("accept")) approved += 1;
      else if (s.includes("reject") || s.includes("declin")) rejected += 1;
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

  // Filter pending quotations by search
  const filteredPending = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pendingQuotations;

    return pendingQuotations.filter((item) => {
      const num = item.quotation_number || "";
      const client = item.customer_name || item.client_name || "";
      const proj =
        item.items?.[0]?.website_type ||
        item.items?.[0]?.item_name ||
        item.project_name ||
        "";
      const createdBy = item.created_by_name || String(item.created_by || "");

      return (
        num.toLowerCase().includes(q) ||
        client.toLowerCase().includes(q) ||
        proj.toLowerCase().includes(q) ||
        createdBy.toLowerCase().includes(q)
      );
    });
  }, [pendingQuotations, search]);

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
      {/* Page Header */}
      <div className="approvals-header">
        <div>
          <p className="approvals-eyebrow">INVOICE &amp; QUOTATION MANAGEMENT</p>
          <h1>Review &amp; Approvals</h1>
          <p className="approvals-subtitle">
            {isSuperAdmin
              ? "Review pending submissions from administrators, authorize final quotations, and track approval workflows."
              : "Track quotation approval status."}
          </p>
        </div>

        <button
          className="approval-refresh"
          type="button"
          onClick={loadData}
          disabled={loading || actionLoading}
        >
          <RefreshCw size={15} className={loading ? "spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {feedback && (
        <div className="approval-feedback" role="status">
          <span>{feedback}</span>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setFeedback("")}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <div className="approval-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button type="button" onClick={loadData}>
            Try again
          </button>
        </div>
      )}

      {/* Tabs Switcher: Quotations & Invoices */}
      <div className="approval-tabs">
        <button
          type="button"
          className={`approval-tab-btn ${activeTab === "quotations" ? "active" : ""}`}
          onClick={() => setActiveTab("quotations")}
        >
          <FileText size={16} />
          <span>Quotation Approvals</span>
          <span className="approval-tab-badge">{pendingQuotations.length}</span>
        </button>

        <button
          type="button"
          className={`approval-tab-btn ${activeTab === "invoices" ? "active" : ""}`}
          onClick={() => setActiveTab("invoices")}
        >
          <Receipt size={16} />
          <span>Invoice Approvals</span>
          <span className="approval-tab-badge">0</span>
        </button>
      </div>

      {/* Tab 1: Quotation Approvals */}
      {activeTab === "quotations" && (
        <>
          {/* Summary metrics */}
          <section className="approval-summary">
            <SummaryCard
              label="Pending Approvals"
              value={stats.pending}
              icon={<Clock3 size={19} />}
              tone="amber"
            />
            <SummaryCard
              label="Approved Quotations"
              value={stats.approved}
              icon={<Check size={19} />}
              tone="green"
            />
            <SummaryCard
              label="Rejected Quotations"
              value={stats.rejected}
              icon={<XCircle size={19} />}
              tone="red"
            />
            <SummaryCard
              label="Draft Quotations"
              value={stats.drafts}
              icon={<FileText size={19} />}
              tone="blue"
            />
          </section>

          {/* Pending Quotations Table Panel */}
          <section className="approval-panel">
            <div className="approval-panel-heading">
              <div>
                <h2>Pending Quotations Awaiting Approval</h2>
                <p>
                  Only quotations submitted by administrators that require your decision are shown here.
                </p>
              </div>

              <span className="approval-count">
                {filteredPending.length} Pending
              </span>
            </div>

            <div className="approval-toolbar">
              <label className="approval-search">
                <Search size={16} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by quotation #, client, or project..."
                />
              </label>
            </div>

            <div className="approval-table-wrap">
              <table className="approval-table">
                <thead>
                  <tr>
                    <th>Quotation Number</th>
                    <th>Client Name</th>
                    <th>Project / Website Type</th>
                    <th>Quotation Amount</th>
                    <th>Created By</th>
                    <th>Submitted Date</th>
                    <th>Current Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "35px" }}>
                        Loading pending approval requests...
                      </td>
                    </tr>
                  ) : filteredPending.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "40px" }}>
                        <div style={{ color: "#64748b", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                          <CheckCircle2 size={32} color="#15803d" />
                          <strong style={{ color: "#0f172a" }}>No Pending Approvals</strong>
                          <span>
                            {search
                              ? "No pending quotations match your search."
                              : "All quotation submissions have been reviewed."}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPending.map((q) => {
                      const amount = q.total_amount ?? q.grand_total ?? 0;
                      const websiteType =
                        q.items?.[0]?.website_type ||
                        q.items?.[0]?.item_name ||
                        "Software Project";
                      const client =
                        q.customer_name || q.client_name || "Client";
                      const createdBy =
                        q.created_by_name ||
                        (q.created_by === 1 ? "Admin" : `User #${q.created_by}`);
                      const submittedDate = formatDate(
                        q.updated_at || q.created_at || q.quotation_date
                      );

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
                          <td>{submittedDate}</td>
                          <td>
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
                          </td>
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
