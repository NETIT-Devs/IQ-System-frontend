// Quotations List Page Component
// Connected with backend Quotation API, Customer API, QuotationForm, and QuotationDetails.

import { useEffect, useMemo, useState, useRef } from "react";
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
  Check,
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
  { label: "All Statuses", value: "All Statuses", color: "#64748b" },
  { label: "Draft", value: "Draft", color: "#d97706" },
  { label: "Pending Approval", value: "Pending Approval", color: "#0284c7" },
  { label: "Approved", value: "Approved", color: "#16a34a" },
  { label: "Rejected", value: "Rejected", color: "#dc2626" },
];

const dateOptions = [
  { label: "All time", value: "all", desc: "Show complete history" },
  { label: "Last 1 week", value: "week", desc: "Past 7 days" },
  { label: "Last 1 month", value: "month", desc: "Past 30 days" },
  { label: "Last 1 year", value: "year", desc: "Past 365 days" },
  { label: "Last 2 years", value: "twoYears", desc: "Past 24 months" },
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

// Resolve creator role display (Admin vs Super Admin)
function getCreatorRole(quotation) {
  if (!quotation) return "—";
  const role = quotation.created_by_role || quotation.creator_role || quotation.creatorRole;
  if (role) {
    const lower = String(role).trim().toLowerCase();
    if (lower.includes("super")) return "Super Admin";
    if (lower.includes("admin")) return "Admin";
    return role;
  }
  if (quotation.created_by === 2) return "Super Admin";
  if (quotation.created_by === 1) return "Admin";
  if (quotation.created_by_name) {
    const lower = String(quotation.created_by_name).trim().toLowerCase();
    if (lower.includes("super")) return "Super Admin";
    if (lower.includes("admin")) return "Admin";
    return quotation.created_by_name;
  }
  return quotation.created_by ? `User #${quotation.created_by}` : "—";
}

export default function Quotations() {
  const { openSidebar } = useOutletContext() || {};

  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [statusFilter, setStatusFilter] = useState("All Statuses");

  // Modern Dropdown Popups state & refs
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const dateDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(event.target)) {
        setDateDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setStatusDropdownOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === "Escape") {
        setDateDropdownOpen(false);
        setStatusDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

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
        const approval = String(q.approval_status || "").trim().toLowerCase();
        const rawStatus = String(q.status || "").trim().toLowerCase();
        const role = String(q.created_by_role || "").trim().toLowerCase();
        const isSuperCreator = role.includes("super") || q.created_by === 2;

        let displayStatus = "Draft";
        // Super Admin finalized quotations are always Approved!
        if (isSuperCreator) {
          displayStatus = rawStatus === "draft" ? "Draft" : "Approved";
        } else if (approval === "pending" || rawStatus.includes("pending")) {
          displayStatus = "Pending Approval";
        } else if (approval === "approved" || ["approved", "accepted"].includes(rawStatus)) {
          displayStatus = "Approved";
        } else if (approval === "rejected" || ["rejected", "declined"].includes(rawStatus)) {
          displayStatus = "Rejected";
        } else if (rawStatus === "draft") {
          displayStatus = "Draft";
        } else if (rawStatus === "sent") {
          displayStatus = "Pending Approval";
        } else if (q.status) {
          displayStatus = q.status.charAt(0).toUpperCase() + q.status.slice(1);
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

  // Count items per status for modern dropdown badges
  const statusCounts = useMemo(() => {
    const counts = { "All Statuses": quotations.length };
    statusOptions.forEach((opt) => {
      if (opt.value !== "All Statuses") counts[opt.value] = 0;
    });
    quotations.forEach((q) => {
      const s = q.status;
      if (counts[s] !== undefined) {
        counts[s] += 1;
      }
    });
    return counts;
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
          getCreatorRole(quotation),
          quotation.created_by_name,
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
  const isSuperAdmin =
    String(authUser?.role || "").trim().toLowerCase() === "super admin" ||
    authUser?.role === "super_admin";
  const userInitials = isSuperAdmin ? "SA" : "A";
  const userRoleTitle = isSuperAdmin ? "Super Admin" : "Admin";

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
        {/* Top bar header matching Overview styling */}
        <header className="quotation-topbar">
          <div className="quotation-topbar-left">
            {openSidebar && (
              <button
                type="button"
                className="quotation-menu-button"
                aria-label="Open navigation menu"
                onClick={openSidebar}
              >
                <Menu size={20} />
              </button>
            )}

            <div className="quotation-breadcrumb-wrap">
              <span className="quotation-breadcrumb">Dashboard / Quotations</span>
            </div>
          </div>

          <div className="quotation-header-actions">
            <NotificationBell />

            <span className="quotation-date-badge" title="Today's Date">
              {new Intl.DateTimeFormat("en-US", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date())}
            </span>

            <div className="quotation-header-profile" title={userRoleTitle}>
              <span className="quotation-profile-avatar" aria-label={`${userRoleTitle} profile`}>
                {userInitials}
              </span>
            </div>
          </div>
        </header>

        <div className="quotation-content">
          {/* Welcome / Title Row right below topbar */}
          <div className="quotation-welcome-bar">
            <div className="quotation-welcome-text">
              <h1>Quotations</h1>
              <p className="quotation-subtitle">
                Create, organize, and track your business quotations.
              </p>
            </div>

            <button
              type="button"
              className="quotation-create-button"
              onClick={openCreateModal}
              title="Create new quotation"
            >
              <Plus size={16} />
              <span>Create Quotation</span>
            </button>
          </div>

          {/* Summary Cards matching Overview Card Size */}
          <section className="quotation-stats-grid" aria-label="Quotation statistics">
            {statCards.map(({ label, value, icon: Icon, color, note }) => (
              <article key={label} className="quotation-stat-card">
                <div className={`quotation-stat-icon ${color}`}>
                  <Icon size={22} strokeWidth={2} />
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

              {/* Modern Date Filter Dropdown */}
              <div className="quotation-dropdown-wrap" ref={dateDropdownRef}>
                <button
                  type="button"
                  className={`quotation-filter-btn ${dateDropdownOpen ? "active" : ""}`}
                  onClick={() => {
                    setDateDropdownOpen((prev) => !prev);
                    setStatusDropdownOpen(false);
                  }}
                  aria-expanded={dateDropdownOpen}
                  aria-haspopup="listbox"
                  title="Filter by date range"
                >
                  <CalendarDays size={16} className="quotation-filter-icon" />
                  <span className="quotation-filter-label">
                    {dateOptions.find((o) => o.value === dateRange)?.label || "Date Filter"}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`quotation-filter-chevron ${dateDropdownOpen ? "open" : ""}`}
                  />
                </button>

                {dateDropdownOpen && (
                  <div className="quotation-dropdown-menu date-menu" role="listbox">
                    <div className="quotation-dropdown-header">
                      <span>Filter by Date</span>
                    </div>
                    <div className="quotation-dropdown-list">
                      {dateOptions.map((opt) => {
                        const isSelected = dateRange === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className={`quotation-dropdown-item ${isSelected ? "selected" : ""}`}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setDateRange(opt.value);
                              setDateDropdownOpen(false);
                            }}
                          >
                            <div className="quotation-dropdown-item-info">
                              <span className="quotation-item-title">{opt.label}</span>
                              {opt.desc && (
                                <span className="quotation-item-desc">{opt.desc}</span>
                              )}
                            </div>
                            {isSelected && <Check size={15} className="quotation-item-check" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modern Status Filter Dropdown */}
              <div className="quotation-dropdown-wrap" ref={statusDropdownRef}>
                <button
                  type="button"
                  className={`quotation-filter-btn ${statusDropdownOpen ? "active" : ""}`}
                  onClick={() => {
                    setStatusDropdownOpen((prev) => !prev);
                    setDateDropdownOpen(false);
                  }}
                  aria-expanded={statusDropdownOpen}
                  aria-haspopup="listbox"
                  title="Filter by status"
                >
                  <SlidersHorizontal size={16} className="quotation-filter-icon" />
                  <span className="quotation-filter-label">{statusFilter}</span>
                  <ChevronDown
                    size={14}
                    className={`quotation-filter-chevron ${statusDropdownOpen ? "open" : ""}`}
                  />
                </button>

                {statusDropdownOpen && (
                  <div className="quotation-dropdown-menu status-menu" role="listbox">
                    <div className="quotation-dropdown-header">
                      <span>Filter by Status</span>
                    </div>
                    <div className="quotation-dropdown-list">
                      {statusOptions.map((opt) => {
                        const isSelected = statusFilter === opt.value;
                        const count = statusCounts[opt.value] ?? 0;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className={`quotation-dropdown-item ${isSelected ? "selected" : ""}`}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setStatusFilter(opt.value);
                              setStatusDropdownOpen(false);
                            }}
                          >
                            <div className="quotation-dropdown-item-left">
                              <span
                                className="quotation-status-dot"
                                style={{ backgroundColor: opt.color }}
                              />
                              <span className="quotation-item-title">{opt.label}</span>
                            </div>
                            <div className="quotation-dropdown-item-right">
                              <span className="quotation-item-badge">{count}</span>
                              {isSelected && <Check size={15} className="quotation-item-check" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
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
                          {(() => {
                            const creatorRole = getCreatorRole(quotation);
                            const isSuper = String(creatorRole).toLowerCase().includes("super");

                            return (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 8px",
                                  fontSize: "11px",
                                  fontWeight: "600",
                                  borderRadius: "4px",
                                  background: isSuper ? "#f5f3ff" : "#eff6ff",
                                  color: isSuper ? "#6d28d9" : "#1d4ed8",
                                  border: isSuper ? "1px solid #ddd6fe" : "1px solid #bfdbfe",
                                }}
                                title={
                                  quotation.created_by_name
                                    ? `${creatorRole} (${quotation.created_by_name})`
                                    : creatorRole
                                }
                              >
                                {creatorRole}
                              </span>
                            );
                          })()}
                        </td>

                        <td>{formatDate(quotation.validUntil)}</td>

                        <td className="amount-column quotation-amount">
                          {formatCurrency(quotation.total, quotation.currency)}
                        </td>

                        <td>
                          <span className={`quotation-status status-${(quotation.status || "").toLowerCase().replace(/\s+/g, "-")}`}>
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
