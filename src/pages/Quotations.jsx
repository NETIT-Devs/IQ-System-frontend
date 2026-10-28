// Quotations List Page Component
// Connected with backend Quotation API, Customer API, QuotationForm, and QuotationDetails.

import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  FileText,
  Search,
  Bell,
  Menu,
  X,
  Plus,
  CalendarDays,
  ChevronDown,
  Pencil,
  Copy,
  Trash2,
  SlidersHorizontal,
  Eye,
  Download,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import QuotationForm from "./QuotationForm";
import QuotationDetails from "./QuotationDetails";
import NotificationBell from "../components/NotificationBell";
import {
  getQuotations,
  getQuotationById,
  deleteQuotation,
  getCompanyDetails,
  updateQuotationCustomerStatus,
} from "../services/quotationService";
import { downloadQuotationPdf } from "../utils/pdfGenerator";
import { getAuthenticatedUser } from "../utils/authStorage";
import "./Quotations.css";

const statusOptions = [
  "All Statuses",
  "Draft",
  "Pending Approval",
  "Approved",
  "Rejected",
  "Sent",
];

const dateOptions = [
  { label: "All time", value: "all" },
  { label: "Last 1 week", value: "week" },
  { label: "Last 1 month", value: "month" },
  { label: "Last 1 year", value: "year" },
  { label: "Last 2 years", value: "twoYears" },
];

// Format amounts using Sri Lankan Rupees or quotation currency
function formatCurrency(amount, currency = "LKR") {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: currency || "LKR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

// Format dates for display in the quotation table
function formatDate(value) {
  if (!value) return "—";

  try {
    const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

// Return an icon based on the quotation status
function getStatusIcon(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("approv") || s.includes("accept")) return CheckCircle;
  if (s.includes("reject") || s.includes("declin")) return XCircle;
  if (s.includes("pending")) return Clock;
  return FileText;
}

// Calculate the starting date for the selected date filter
function getDateCutoff(range) {
  if (range === "all") return null;

  const date = new Date();
  date.setHours(0, 0, 0, 0);

  if (range === "week") date.setDate(date.getDate() - 7);
  if (range === "month") date.setMonth(date.getMonth() - 1);
  if (range === "year") date.setFullYear(date.getFullYear() - 1);
  if (range === "twoYears") date.setFullYear(date.getFullYear() - 2);

  return date;
}

export default function Quotations() {
  const { openSidebar } = useOutletContext();

  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [statusFilter, setStatusFilter] = useState("All Statuses");

  // Modal controls
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [newQuotationNumber, setNewQuotationNumber] = useState("");

  // Fetch quotations from backend
  async function loadQuotations() {
    try {
      setLoading(true);
      setLoadError("");
      const data = await getQuotations();
      const list = Array.isArray(data) ? data : [];

      // Normalize backend records for table display
      const normalized = list.map((q) => {
        const raw = q.status || q.approval_status;
        let displayStatus = "Draft";
        if (raw) {
          const lower = String(raw).trim().toLowerCase();
          if (["approved", "accepted"].includes(lower)) displayStatus = "Approved";
          else if (["rejected", "declined"].includes(lower)) displayStatus = "Rejected";
          else if (lower.includes("pending")) displayStatus = "Pending Approval";
          else if (lower.includes("sent")) displayStatus = "Sent";
          else displayStatus = raw.charAt(0).toUpperCase() + raw.slice(1);
        }

        return {
          ...q,
          id: q.quotation_number || "—",
          clientName: q.customer_name || "—",
          project: q.items?.[0]?.item_name || "—",
          issuedDate: String(q.quotation_date || "").slice(0, 10),
          validUntil: String(q.valid_until || "").slice(0, 10),
          total: Number(q.total_amount ?? 0),
          status: displayStatus,
          rejection_reason: q.rejection_reason || null,
        };
      });

      setQuotations(normalized);
    } catch (err) {
      console.error("Failed to load quotations:", err);
      setLoadError(err?.message || "Could not load quotations. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(loadQuotations);
  }, []);

  // Calculate the quotation summary card values
  const stats = useMemo(() => {
    let total = quotations.length;
    let approved = 0;
    let rejected = 0;
    let pending = 0;
    let draft = 0;

    quotations.forEach((q) => {
      const s = String(q.status || q.approval_status || "").trim().toLowerCase();
      if (["approved", "accepted"].includes(s)) {
        approved += 1;
      } else if (["rejected", "declined"].includes(s)) {
        rejected += 1;
      } else if (s.includes("pending")) {
        pending += 1;
      } else {
        draft += 1;
      }
    });

    return { total, approved, rejected, pending, draft };
  }, [quotations]);

  // Filter quotations using the search term, date range, and status
  const filteredQuotations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const cutoff = getDateCutoff(dateRange);

    return quotations.filter((quotation) => {
      const matchesSearch =
        !term ||
        [
          quotation.id,
          quotation.clientName,
          quotation.project,
          quotation.status,
        ].some((value) => String(value || "").toLowerCase().includes(term));

      const quotationDate = new Date(
        `${quotation.issuedDate}T00:00:00`
      );

      const matchesDate =
        !cutoff ||
        (!Number.isNaN(quotationDate.getTime()) &&
          quotationDate >= cutoff);

      const matchesStatus =
        statusFilter === "All Statuses" ||
        quotation.status === statusFilter;

      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [quotations, searchTerm, dateRange, statusFilter]);
  const quotationSchemaError =
    loadError.toLowerCase().includes("unknown column") &&
    loadError.toLowerCase().includes("status");

  // Open creation modal
  function openCreateModal() {
    setSelectedQuotation(null);
    setNewQuotationNumber(`QUO-${Date.now().toString(36).toUpperCase()}`);
    setShowFormModal(true);
  }

  const authUser = getAuthenticatedUser();
  const currentUserId = authUser?.user_id;
  const isSuperAdmin = String(authUser?.role || "").trim().toLowerCase() === "super admin";

  const [showFormSettingsModal, setShowFormSettingsModal] = useState(false);
  const [showTemplateSettingsModal, setShowTemplateSettingsModal] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  // Open edit modal
  function openEditModal(quotation) {
    setSelectedQuotation(quotation);
    setShowFormModal(true);
  }

  // Open view details modal
  function openDetailsModal(quotation) {
    setSelectedQuotation(quotation);
    setShowDetailsModal(true);
  }

  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // Manually update customer quotation status (Sent, Approved, Rejected, etc.)
  async function handleCustomerStatusUpdate(quotation, newStatus) {
    const rawId = quotation.quotation_id || quotation.id;
    try {
      setUpdatingStatusId(rawId);
      await updateQuotationCustomerStatus(rawId, newStatus);
      await loadQuotations();
    } catch (err) {
      alert(err?.message || "Failed to update quotation customer status.");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  // Direct PDF download from table row
  async function handleDirectDownload(quotation) {
    const rawId = quotation.quotation_id || quotation.id;
    try {
      setDownloadingId(rawId);
      let targetQuotation = quotation;
      try {
        const full = await getQuotationById(rawId);
        if (full) targetQuotation = full;
      } catch (e) {
        console.warn("Could not fetch full quotation details, using row data:", e);
      }

      let company = null;
      try {
        company = await getCompanyDetails();
      } catch {
        // ignore
      }

      const filename = `${targetQuotation.quotation_number || quotation.id || "Quotation"}.pdf`;
      await downloadQuotationPdf(
        targetQuotation,
        company,
        {
          customer_name: targetQuotation.customer_name || targetQuotation.clientName || quotation.clientName || "",
          company_name: targetQuotation.customer_company || targetQuotation.company_name || "",
          email: targetQuotation.customer_email || targetQuotation.email || "",
          phone: targetQuotation.customer_phone || targetQuotation.phone || "",
          address: targetQuotation.customer_address || targetQuotation.address || "",
        },
        filename
      );
    } catch (err) {
      console.error("Direct PDF download failed:", err);
      alert("Could not generate quotation PDF. Please open details to try again.");
    } finally {
      setDownloadingId(null);
    }
  }

  // Duplicate quotation
  function handleDuplicate(quotation) {
    const duplicated = {
      ...quotation,
      quotation_id: undefined,
      quotation_number: `QUO-${Date.now().toString(36).toUpperCase()}`,
      status: "Draft",
      quotation_date: new Date().toISOString().slice(0, 10),
    };

    setSelectedQuotation(duplicated);
    setShowFormModal(true);
  }

  // Delete a quotation with confirmation and backend integration
  async function handleDelete(quotation) {
    const targetId = quotation.quotation_id || quotation.id;
    if (!targetId) {
      alert("This quotation is missing its backend ID and cannot be deleted.");
      return;
    }

    const confirmed = window.confirm(
      `Delete quotation ${quotation.id || quotation.quotation_number}? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deleteQuotation(targetId);
      await loadQuotations();
    } catch (err) {
      alert(err?.message || "Failed to delete quotation from backend.");
    }
  }

  // Quotation summary cards - 4 cards: Total Quotations, Approved Quotations, Reject Quotations, Draft
  const statCards = [
    {
      label: "Total Quotations",
      value: stats.total,
      icon: FileText,
      color: "blue",
      note: "All quotations",
    },
    {
      label: "Approved Quotations",
      value: stats.approved,
      icon: CheckCircle,
      color: "green",
      note: "Approved quotations",
    },
    {
      label: "Reject Quotations",
      value: stats.rejected,
      icon: XCircle,
      color: "red",
      note: "Rejected quotations",
    },
    {
      label: "Draft",
      value: stats.draft,
      icon: Clock,
      color: "orange",
      note: "Draft quotations",
    },
  ];

  return (
    <div className="quotation-app">
      <div className="quotation-main">
        {/* Top bar header */}
        <header className="quotation-topbar">
          <div className="quotation-topbar-left">
            <button
              type="button"
              className="quotation-menu-button"
              aria-label="Open navigation menu"
              onClick={openSidebar}
            >
              <Menu size={21} />
            </button>

            <div>
              <p className="quotation-breadcrumb">Dashboard / Quotations</p>
              <h1>Quotations</h1>
              <p className="quotation-subtitle">
                Create, organize, and track your business quotations.
              </p>
            </div>
          </div>

          <div className="quotation-header-actions">
            <div className="quotation-date-badge">
              <CalendarDays size={15} />
              <span>
                {new Date().toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>

            <NotificationBell />

            <button
              type="button"
              className="quotation-create-button"
              onClick={openCreateModal}
            >
              <Plus size={16} />
              <span>Create Quotation</span>
            </button>
          </div>
        </header>

        <div className="quotation-content">
          {/* Summary Cards */}
          <section className="quotation-stats-grid">
            {statCards.map(({ label, value, icon: Icon, color, note }) => (
              <article key={label} className="quotation-stat-card">
                <div className={`quotation-stat-icon ${color}`}>
                  <Icon size={21} strokeWidth={1.8} />
                </div>

                <div className="quotation-stat-content">
                  <p>{label}</p>
                  <h3>{value}</h3>
                  <span className="quotation-stat-note">{note}</span>
                </div>
              </article>
            ))}
          </section>

          {/* Table, Search, and Filters */}
          <section className="quotation-list-section">
            <div className="quotation-list-heading">
              <div>
                <h2>All Quotations</h2>
                <p>View and manage your quotation records.</p>
              </div>
              <span className="quotation-record-count">
                {filteredQuotations.length} records
              </span>
            </div>

            {loadError && (
              <div
                className="quotation-load-error"
                role="alert"
                aria-live="assertive"
              >
                <strong>
                  {quotationSchemaError
                    ? "Quotation data is unavailable"
                    : "Could not load quotations"}
                </strong>
                <span>
                  {quotationSchemaError
                    ? "The connected database does not store quotation status. Restart the backend with the schema-compatible quotation update so saved records can be displayed without status fields."
                    : loadError}
                </span>
              </div>
            )}

            <div className="quotation-filters">
              {/* Search */}
              <label className="quotation-search">
                <Search size={19} />

                <input
                  type="search"
                  placeholder="Search ID, client or project..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />

                {searchTerm && (
                  <button
                    type="button"
                    className="clear-search"
                    onClick={() => setSearchTerm("")}
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                )}
              </label>

              {/* Date Filter */}
              <label
                className="quotation-filter-select"
                onClick={(e) => {
                  const select = e.currentTarget.querySelector("select");
                  if (
                    select &&
                    typeof select.showPicker === "function" &&
                    e.target !== select
                  ) {
                    try {
                      select.showPicker();
                    } catch {
                      select.focus();
                    }
                  }
                }}
              >
                <CalendarDays size={17} />

                <select
                  value={dateRange}
                  onChange={(event) => setDateRange(event.target.value)}
                  aria-label="Filter by date"
                >
                  {dateOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <ChevronDown size={15} />
              </label>

              {/* Status Filter */}
              <label
                className="quotation-filter-select"
                onClick={(e) => {
                  const select = e.currentTarget.querySelector("select");
                  if (
                    select &&
                    typeof select.showPicker === "function" &&
                    e.target !== select
                  ) {
                    try {
                      select.showPicker();
                    } catch {
                      select.focus();
                    }
                  }
                }}
              >
                <SlidersHorizontal size={17} />

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter by status"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                <ChevronDown size={15} />
              </label>
            </div>

            {/* Table */}
            <div className="quotation-table-wrapper">
              <table className="quotation-table">
                <thead>
                  <tr>
                    <th>QUOTATION ID</th>
                    <th>CLIENT</th>
                    <th>PROJECT</th>
                    <th>ISSUED DATE</th>
                    <th>CREATED BY</th>
                    <th>VALID UNTIL</th>
                    <th className="amount-column">TOTAL</th>
                    <th>STATUS</th>
                    <th>CUSTOMER STATUS</th>
                    <th className="actions-column">ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredQuotations.map((quotation) => {
                    const StatusIcon = getStatusIcon(quotation.status);
                    const canModify = quotation.created_by === currentUserId;
                    const isMine = quotation.created_by === currentUserId;

                    return (
                      <tr key={quotation.id || quotation.quotation_id}>
                        <td>
                          <button
                            type="button"
                            className="quotation-id"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              textAlign: "left",
                              padding: 0,
                            }}
                            title="Click to view quotation details and download PDF"
                            onClick={() => openDetailsModal(quotation)}
                          >
                            {quotation.id}
                          </button>
                        </td>

                        <td>
                          <div
                            className="quotation-client"
                            style={{ cursor: "pointer" }}
                            onClick={() => openDetailsModal(quotation)}
                          >
                            <div className="client-avatar">
                              {quotation.clientName
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <span>{quotation.clientName}</span>
                          </div>
                        </td>

                        <td>
                          <span className="quotation-project">
                            {quotation.project}
                          </span>
                        </td>

                        <td>{formatDate(quotation.issuedDate)}</td>

                        <td>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              fontSize: "11px",
                              fontWeight: "600",
                              borderRadius: "4px",
                              background: isMine ? "#eff6ff" : "#f1f5f9",
                              color: isMine ? "#1d4ed8" : "#475569",
                              border: isMine ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                            }}
                          >
                            {isMine
                              ? "You"
                              : quotation.created_by_name || `User #${quotation.created_by || "—"}`}
                          </span>
                        </td>

                        <td>{formatDate(quotation.validUntil)}</td>

                        <td className="amount-column quotation-amount">
                          {formatCurrency(quotation.total, quotation.currency)}
                        </td>

                        <td>
                          <span className={`quotation-status status-${(quotation.status || "").toLowerCase() === "approved" ? "accepted" : (quotation.status || "").toLowerCase()}`}>
                            <StatusIcon size={14} />
                            {quotation.status}
                          </span>
                        </td>

                        <td>
                          <div className="quotation-status-control" title="Manually update customer response">
                            <select
                              value={quotation.customer_status || "Not Sent"}
                              disabled={updatingStatusId === (quotation.quotation_id || quotation.id)}
                              onChange={(e) => handleCustomerStatusUpdate(quotation, e.target.value)}
                              className={`quotation-status-select cust-status-badge status-${(quotation.customer_status || "notsent").toLowerCase().replace(/\s+/g, "")}`}
                            >
                              <option value="Not Sent">Not Sent</option>
                              <option value="Sent to Customer">📤 Sent to Customer</option>
                              <option value="Customer Accepted">✅ Customer Accepted</option>
                              <option value="Customer Rejected">❌ Customer Rejected</option>
                            </select>
                          </div>
                        </td>

                        <td className="actions-column">
                          <div className="quotation-row-actions">
                            {/* View details */}
                            <button
                              type="button"
                              className="row-action-button"
                              style={{ color: "#2563eb" }}
                              title="View details"
                              aria-label={`View ${quotation.id}`}
                              onClick={() => openDetailsModal(quotation)}
                            >
                              <Eye size={16} />
                            </button>

                            {/* Download PDF directly */}
                            <button
                              type="button"
                              className="row-action-button download-action"
                              style={{ color: "#0284c7" }}
                              title="Download PDF"
                              aria-label={`Download ${quotation.id} PDF`}
                              disabled={downloadingId === (quotation.quotation_id || quotation.id)}
                              onClick={() => handleDirectDownload(quotation)}
                            >
                              <Download size={16} />
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              className="row-action-button edit-action"
                              title="Edit quotation"
                              aria-label={`Edit ${quotation.id}`}
                              onClick={() => openEditModal(quotation)}
                            >
                              <Pencil size={16} />
                            </button>

                            {/* Duplicate */}
                            <button
                              type="button"
                              className="row-action-button duplicate-action"
                              title="Duplicate quotation"
                              aria-label={`Duplicate ${quotation.id}`}
                              onClick={() => handleDuplicate(quotation)}
                            >
                              <Copy size={16} />
                            </button>

                            {/* Delete */}
                            <div className="quotation-more-wrapper">
                              <button
                                type="button"
                                className="row-action-button delete-action"
                                title="Delete quotation"
                                aria-label={`Delete ${quotation.id}`}
                                onClick={() => handleDelete(quotation)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Empty state */}
                  {filteredQuotations.length === 0 && (
                    <tr>
                      <td colSpan={9} className="quotation-empty-cell">
                        <div className="quotation-empty-state">
                          <div className="empty-state-icon">
                            <FileText size={29} />
                          </div>

                          <h3>
                            {loadError
                              ? "Unable to load quotations"
                              : loading
                              ? "Loading quotations..."
                              : quotations.length === 0
                              ? "No quotations yet"
                              : "No matching quotations"}
                          </h3>

                          <p>
                            {loadError
                              ? "Check your connection or sign in again, then retry."
                              : loading
                              ? "Retrieving records from backend database..."
                              : quotations.length === 0
                              ? "Create your first quotation to get started."
                              : "Try another search term or change your filters."}
                          </p>

                          {!loading && !loadError && quotations.length === 0 && (
                            <button
                              type="button"
                              className="empty-create-button"
                              onClick={openCreateModal}
                            >
                              <Plus size={17} />
                              Create your first quotation
                            </button>
                          )}

                          {!loading && quotations.length > 0 && (
                            <button
                              type="button"
                              className="empty-create-button"
                              onClick={() => {
                                setSearchTerm("");
                                setDateRange("all");
                                setStatusFilter("All Statuses");
                              }}
                            >
                              Clear filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="quotation-table-footer">
              <span>
                Showing {filteredQuotations.length} of {quotations.length}{" "}
                quotations
              </span>

              <span className="table-footer-note">
                <span className="footer-dot" />
                Quotation Management System
              </span>
            </div>
          </section>
        </div>
      </div>

      {/* Quotation Creation & Editing Modal */}
      {showFormModal && (
        <QuotationForm
          initialData={selectedQuotation}
          quotationNumber={newQuotationNumber}
          onSave={async () => {
            setShowFormModal(false);
            setSelectedQuotation(null);
            await loadQuotations();
          }}
          onClose={() => {
            setShowFormModal(false);
            setSelectedQuotation(null);
          }}
        />
      )}

      {/* Quotation Details Modal */}
      {showDetailsModal && selectedQuotation && (
        <QuotationDetails
          quotation={selectedQuotation}
          quotationId={selectedQuotation.quotation_id}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedQuotation(null);
          }}
          onEdit={(q) => {
            setShowDetailsModal(false);
            setSelectedQuotation(q);
            setShowFormModal(true);
          }}
        />
      )}
    </div>
  );
}
