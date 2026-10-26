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
  Clock3,
  Send,
  CheckCircle2,
  XCircle,
  FileEdit,
  SlidersHorizontal,
  Eye,
} from "lucide-react";
import QuotationForm from "./QuotationForm";
import QuotationDetails from "./QuotationDetails";
import {
  getQuotations,
  deleteQuotation,
} from "../services/quotationService";
import "./Quotations.css";

const statusOptions = [
  "All Statuses",
  "Draft",
  "Sent",
  "Approved",
  "Rejected",
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
  switch (status) {
    case "Sent":
      return Send;
    case "Approved":
      return CheckCircle2;
    case "Rejected":
      return XCircle;
    case "Expired":
      return Clock3;
    default:
      return FileEdit;
  }
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
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [statusFilter, setStatusFilter] = useState("All Statuses");

  // Modal controls
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);

  // Fetch quotations from backend
  async function loadQuotations() {
    try {
      setLoading(true);
      const data = await getQuotations();

      // Normalize backend records for table display
      const normalized = (data || []).map((q) => ({
        ...q,
        id: q.quotation_number,
        clientName: q.customer_name || "Customer",
        project: q.items?.[0]?.item_name || "Software Solution",
        issuedDate: String(q.quotation_date || "").slice(0, 10),
        validUntil: String(q.valid_until || "").slice(0, 10),
        total: Number(q.total_amount) || 0,
        status: q.status || "Draft",
      }));

      setQuotations(normalized);
    } catch (err) {
      console.error("Failed to load quotations:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuotations();
  }, []);

  // Calculate the quotation summary card values
  const stats = useMemo(
    () => ({
      total: quotations.length,
      draft: quotations.filter((item) => item.status === "Draft").length,
      sent: quotations.filter((item) => item.status === "Sent").length,
      approved: quotations.filter((item) => item.status === "Approved").length,
    }),
    [quotations]
  );

  // Filter quotations using the search term, date range, and status
  const filteredQuotations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const cutoff = getDateCutoff(dateRange);
    const today = new Date();

    today.setHours(23, 59, 59, 999);

    return quotations.filter((quotation) => {
      const matchesSearch =
        !term ||
        [quotation.id, quotation.clientName, quotation.project].some(
          (value) => value?.toLowerCase().includes(term)
        );

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

  // Open creation modal
  function openCreateModal() {
    setSelectedQuotation(null);
    setShowFormModal(true);
  }

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

  // Duplicate quotation
  function handleDuplicate(quotation) {
    const duplicated = {
      ...quotation,
      quotation_id: undefined,
      quotation_number: `QUO-${Date.now().toString().slice(-6)}`,
      status: "Draft",
      quotation_date: new Date().toISOString().slice(0, 10),
    };

    setSelectedQuotation(duplicated);
    setShowFormModal(true);
  }

  // Delete a quotation with confirmation and backend integration
  async function handleDelete(quotation) {
    const targetId = quotation.quotation_id || quotation.id;
    const confirmed = window.confirm(
      `Delete quotation ${quotation.id}? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deleteQuotation(targetId);
      await loadQuotations();
    } catch (err) {
      alert(err?.message || "Failed to delete quotation from backend.");
    }
  }

  // Quotation summary cards
  const statCards = [
    {
      label: "Total Quotations",
      value: stats.total,
      icon: FileText,
      color: "blue",
      note: "All quotations",
    },
    {
      label: "Draft",
      value: stats.draft,
      icon: FileEdit,
      color: "purple",
      note: "Work in progress",
    },
    {
      label: "Sent",
      value: stats.sent,
      icon: Send,
      color: "cyan",
      note: "Awaiting response",
    },
    {
      label: "Approved",
      value: stats.approved,
      icon: CheckCircle2,
      color: "orange",
      note: "Approved quotations",
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

            <button
              type="button"
              className="quotation-notification-button"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={19} />
              <span className="quotation-notification-dot" />
            </button>

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
                    <th>VALID UNTIL</th>
                    <th className="amount-column">TOTAL</th>
                    <th>STATUS</th>
                    <th className="actions-column">ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredQuotations.map((quotation) => {
                    const StatusIcon = getStatusIcon(quotation.status);

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

                        <td>{formatDate(quotation.validUntil)}</td>

                        <td className="amount-column quotation-amount">
                          {formatCurrency(quotation.total, quotation.currency)}
                        </td>

                        <td>
                          <span
                            className={`quotation-status status-${quotation.status.toLowerCase()}`}
                          >
                            <StatusIcon size={14} />
                            {quotation.status}
                          </span>
                        </td>

                        <td className="actions-column">
                          <div className="quotation-row-actions">
                            {/* View details & download PDF */}
                            <button
                              type="button"
                              className="row-action-button"
                              style={{ color: "#2563eb" }}
                              title="View details & Download PDF"
                              aria-label={`View ${quotation.id}`}
                              onClick={() => openDetailsModal(quotation)}
                            >
                              <Eye size={16} />
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
                      <td colSpan={8} className="quotation-empty-cell">
                        <div className="quotation-empty-state">
                          <div className="empty-state-icon">
                            <FileText size={29} />
                          </div>

                          <h3>
                            {loading
                              ? "Loading quotations..."
                              : quotations.length === 0
                              ? "No quotations yet"
                              : "No matching quotations"}
                          </h3>

                          <p>
                            {loading
                              ? "Retrieving records from backend database..."
                              : quotations.length === 0
                              ? "Create your first quotation to get started."
                              : "Try another search term or change your filters."}
                          </p>

                          {!loading && quotations.length === 0 && (
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
