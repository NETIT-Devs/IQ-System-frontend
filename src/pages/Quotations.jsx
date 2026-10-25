
import { useMemo, useState } from "react";
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
  FilePlus2,
  Clock3,
  Send,
  CheckCircle2,
  XCircle,
  FileEdit,
  SlidersHorizontal,
} from "lucide-react";
import "./Quotations.css";

const initialForm = {
  clientName: "",
  project: "",
  issuedDate: new Date().toISOString().slice(0, 10),
  validUntil: "",
  total: "",
  status: "Draft",
};

const statusOptions = [
  "All Statuses",
  "Draft",
  "Sent",
  "Accepted",
  "Rejected",
  "Expired",
];

const dateOptions = [
  { label: "All time", value: "all" },
  { label: "Last 1 week", value: "week" },
  { label: "Last 1 month", value: "month" },
  { label: "Last 1 year", value: "year" },
  { label: "Last 2 years", value: "twoYears" },
];

function createQuotationId() {
  // Generate a client-side ID until the backend assigns permanent IDs.
  return `QUO-${Date.now().toString().slice(-8)}`;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusIcon(status) {
  switch (status) {
    case "Sent":
      return Send;
    case "Accepted":
      return CheckCircle2;
    case "Rejected":
      return XCircle;
    case "Expired":
      return Clock3;
    default:
      return FileEdit;
  }
}

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
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [statusFilter, setStatusFilter] = useState("All Statuses");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState("");

  const stats = useMemo(() => {
    return {
      total: quotations.length,
      draft: quotations.filter((item) => item.status === "Draft").length,
      sent: quotations.filter((item) => item.status === "Sent").length,
      accepted: quotations.filter((item) => item.status === "Accepted").length,
    };
  }, [quotations]);

  const filteredQuotations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const cutoff = getDateCutoff(dateRange);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return quotations.filter((quotation) => {
      const matchesSearch =
        !term ||
        [
          quotation.id,
          quotation.clientName,
          quotation.project,
        ].some((value) => value?.toLowerCase().includes(term));

      const quotationDate = new Date(
        `${quotation.issuedDate}T00:00:00`
      );

      const matchesDate =
        !cutoff ||
        (!Number.isNaN(quotationDate.getTime()) &&
          quotationDate >= cutoff &&
          quotationDate <= today);

      const matchesStatus =
        statusFilter === "All Statuses" ||
        quotation.status === statusFilter;

      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [quotations, searchTerm, dateRange, statusFilter]);

  function openCreateModal() {
    setEditingId(null);
    setForm({
      ...initialForm,
      issuedDate: new Date().toISOString().slice(0, 10),
    });
    setFormError("");
    setShowModal(true);
  }

  function openEditModal(quotation) {
    setEditingId(quotation.id);
    setForm({
      clientName: quotation.clientName,
      project: quotation.project,
      issuedDate: quotation.issuedDate,
      validUntil: quotation.validUntil,
      total: String(quotation.total),
      status: quotation.status,
    });
    setFormError("");
    setShowModal(true);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function handleSaveQuotation(event) {
    event.preventDefault();
    setFormError("");

    if (
      !form.clientName.trim() ||
      !form.project.trim() ||
      !form.issuedDate ||
      !form.validUntil ||
      form.total === ""
    ) {
      setFormError("Please complete all required fields.");
      return;
    }

    if (form.validUntil < form.issuedDate) {
      setFormError("Valid until date must be on or after the issue date.");
      return;
    }

    if (!Number.isFinite(Number(form.total)) || Number(form.total) < 0) {
      setFormError("Please enter a valid quotation amount.");
      return;
    }

    const quotationData = {
      clientName: form.clientName.trim(),
      project: form.project.trim(),
      issuedDate: form.issuedDate,
      validUntil: form.validUntil,
      total: Number(form.total),
      status: form.status,
    };

    if (editingId) {
      // Editing updates the existing quotation without creating a new row.
      setQuotations((previous) =>
        previous.map((item) =>
          item.id === editingId ? { ...item, ...quotationData } : item
        )
      );
    } else {
      // New quotations receive a separate ID.
      setQuotations((previous) => [
        { id: createQuotationId(), ...quotationData },
        ...previous,
      ]);
    }

    setShowModal(false);
    setEditingId(null);
    setForm(initialForm);
  }

  function handleDuplicate(quotation) {
    // Copy the details into a new quotation with a new ID and Draft status.
    const duplicated = {
      ...quotation,
      id: createQuotationId(),
      status: "Draft",
      issuedDate: new Date().toISOString().slice(0, 10),
    };

    setQuotations((previous) => [duplicated, ...previous]);
  }

  function handleDelete(quotation) {
    const confirmed = window.confirm(
      `Delete quotation ${quotation.id}? This cannot be undone.`
    );

    if (!confirmed) return;

    setQuotations((previous) =>
      previous.filter((item) => item.id !== quotation.id)
    );
  }

  const statCards = [
    {
      label: "Total Quotations",
      value: stats.total,
      icon: FileText,
      className: "stat-total",
      note: "All quotations",
    },
    {
      label: "Draft",
      value: stats.draft,
      icon: FileEdit,
      className: "stat-draft",
      note: "Work in progress",
    },
    {
      label: "Sent",
      value: stats.sent,
      icon: Send,
      className: "stat-sent",
      note: "Awaiting response",
    },
    {
      label: "Accepted",
      value: stats.accepted,
      icon: CheckCircle2,
      className: "stat-accepted",
      note: "Approved quotations",
    },
  ];

  return (
    <div className="quotation-app">
      {/* Main content */}
      <div className="quotation-main">
        <header className="quotation-topbar">
          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Open navigation"
            onClick={openSidebar}
          >
            <Menu size={23} />
          </button>

          <div className="topbar-breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>Quotations</strong>
          </div>

          <div className="topbar-right">
            <span className="topbar-date">
              {new Date().toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
            <button
              type="button"
              className="topbar-notification"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={19} />
              <span />
            </button>
          </div>
        </header>

        <div className="quotation-content">
          {/* Page heading and primary action */}
          <section className="quotation-page-heading">
            <div className="quotation-heading-text">
              <div className="quotation-eyebrow">
                <span className="eyebrow-line" />
                DOCUMENT MANAGEMENT
              </div>
              <h1>Quotations</h1>
              <p>
                Create, organize, and track your business quotations.
              </p>
            </div>

            <button
              type="button"
              className="create-quotation-button"
              onClick={openCreateModal}
            >
              <Plus size={19} />
              <span>Create Quotation</span>
            </button>
          </section>

          {/* Summary cards */}
          <section className="quotation-stats-grid">
            {statCards.map(({ label, value, icon: Icon, className, note }) => (
              <article
                key={label}
                className={`quotation-stat-card ${className}`}
              >
                <div className="quotation-stat-top">
                  <div className="quotation-stat-icon">
                    <Icon size={21} />
                  </div>
                  <span className="stat-indicator" />
                </div>
                <p className="quotation-stat-label">{label}</p>
                <div className="quotation-stat-bottom">
                  <h2>{value}</h2>
                  <span>{note}</span>
                </div>
              </article>
            ))}
          </section>

          {/* Search and filters */}
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

              <label className="quotation-filter-select">
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

              <label className="quotation-filter-select">
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

            {/* Quotations table */}
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
                      <tr key={quotation.id}>
                        <td>
                          <span className="quotation-id">{quotation.id}</span>
                        </td>
                        <td>
                          <div className="quotation-client">
                            <div className="client-avatar">
                              {quotation.clientName.charAt(0).toUpperCase()}
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
                          {formatCurrency(quotation.total)}
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
                            <button
                              type="button"
                              className="row-action-button edit-action"
                              title="Edit quotation"
                              aria-label={`Edit ${quotation.id}`}
                              onClick={() => openEditModal(quotation)}
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              type="button"
                              className="row-action-button duplicate-action"
                              title="Duplicate quotation"
                              aria-label={`Duplicate ${quotation.id}`}
                              onClick={() => handleDuplicate(quotation)}
                            >
                              <Copy size={16} />
                            </button>

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

                  {filteredQuotations.length === 0 && (
                    <tr>
                      <td colSpan={8} className="quotation-empty-cell">
                        <div className="quotation-empty-state">
                          <div className="empty-state-icon">
                            <FileText size={29} />
                          </div>
                          <h3>
                            {quotations.length === 0
                              ? "No quotations yet"
                              : "No matching quotations"}
                          </h3>
                          <p>
                            {quotations.length === 0
                              ? "Create your first quotation to get started."
                              : "Try another search term or change your filters."}
                          </p>
                          {quotations.length === 0 && (
                            <button
                              type="button"
                              className="empty-create-button"
                              onClick={openCreateModal}
                            >
                              <Plus size={17} />
                              Create your first quotation
                            </button>
                          )}
                          {quotations.length > 0 && (
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

            <div className="quotation-table-footer">
              <span>
                Showing {filteredQuotations.length} of {quotations.length}{" "}
                quotations
              </span>
              <span className="table-footer-note">
                <span className="footer-dot" />
                Quotation Management
              </span>
            </div>
          </section>
        </div>
      </div>

      {/* Create and edit modal */}
      {showModal && (
        <div
          className="quotation-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowModal(false);
            }
          }}
        >
          <section
            className="quotation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quotation-modal-title"
          >
            <div className="quotation-modal-header">
              <div className="modal-heading-icon">
                {editingId ? <Pencil size={21} /> : <FilePlus2 size={22} />}
              </div>
              <div>
                <h2 id="quotation-modal-title">
                  {editingId ? "Edit Quotation" : "Create Quotation"}
                </h2>
                <p>
                  {editingId
                    ? `Update details for ${editingId}.`
                    : "Enter the basic details for your quotation."}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-button"
                onClick={() => setShowModal(false)}
                aria-label="Close dialog"
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={handleSaveQuotation}>
              <div className="quotation-modal-body">
                {formError && (
                  <div className="quotation-form-error" role="alert">
                    {formError}
                  </div>
                )}

                {editingId && (
                  <div className="quotation-edit-notice">
                    Editing <strong>{editingId}</strong> will update the
                    existing quotation. To create a separate quotation, use
                    Duplicate from the table.
                  </div>
                )}

                <div className="quotation-form-grid">
                  <label className="quotation-form-field">
                    <span>Client Name <b>*</b></span>
                    <input
                      name="clientName"
                      value={form.clientName}
                      onChange={handleFormChange}
                      placeholder="Enter client or company name"
                      required
                    />
                  </label>

                  <label className="quotation-form-field">
                    <span>Project Name <b>*</b></span>
                    <input
                      name="project"
                      value={form.project}
                      onChange={handleFormChange}
                      placeholder="Enter project name"
                      required
                    />
                  </label>

                  <label className="quotation-form-field">
                    <span>Issued Date <b>*</b></span>
                    <input
                      type="date"
                      name="issuedDate"
                      value={form.issuedDate}
                      onChange={handleFormChange}
                      required
                    />
                  </label>

                  <label className="quotation-form-field">
                    <span>Valid Until <b>*</b></span>
                    <input
                      type="date"
                      name="validUntil"
                      value={form.validUntil}
                      min={form.issuedDate}
                      onChange={handleFormChange}
                      required
                    />
                  </label>

                  <label className="quotation-form-field">
                    <span>Total Amount (LKR) <b>*</b></span>
                    <input
                      type="number"
                      name="total"
                      value={form.total}
                      onChange={handleFormChange}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      required
                    />
                  </label>

                  <label className="quotation-form-field">
                    <span>Status</span>
                    <select
                      name="status"
                      value={form.status}
                      onChange={handleFormChange}
                    >
                      {statusOptions
                        .filter((status) => status !== "All Statuses")
                        .map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="quotation-modal-footer">
                <button
                  type="button"
                  className="modal-cancel-button"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="modal-save-button">
                  {editingId ? "Save Changes" : "Create Quotation"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
