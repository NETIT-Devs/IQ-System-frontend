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
import ThemeToggle from "../components/ThemeToggle";
import {
  getQuotations,
  getQuotationById,
  deleteQuotation,
  getCompanyDetails,
  updateQuotationCustomerStatus,
} from "../services/quotationService";
import { downloadQuotationPdf } from "../utils/pdfGenerator";
import { getAuthenticatedUser } from "../utils/authStorage";
import { getNextQuotationNumber } from "../utils/formatters";
import "./Quotations.css";

const statusOptions = [
  { label: "All Status", value: "All Statuses", color: "#64748b" },
  { label: "Draft", value: "Draft", color: "#d97706" },
  { label: "Pending Approval", value: "Pending Approval", color: "#0284c7" },
  { label: "Approved", value: "Approved", color: "#16a34a" },
  { label: "Rejected", value: "Rejected", color: "#dc2626" },
  { label: "Customer Accepted", value: "Customer Accepted", color: "#15803d" },
  { label: "Sent to Customer", value: "Sent to Customer", color: "#0369a1" },
  { label: "Customer Rejected", value: "Customer Rejected", color: "#b91c1c" },
];

const CUSTOMER_STATUS_FILTER_VALUES = new Set([
  "Customer Accepted",
  "Sent to Customer",
  "Customer Rejected",
]);

function getNormalizedCustomerStatus(quotation) {
  const cs = String(quotation?.customer_status || "").trim().toLowerCase();
  if (cs === "customer accepted" || cs === "accepted") return "Customer Accepted";
  if (cs === "customer rejected" || cs === "rejected") return "Customer Rejected";
  if (cs === "sent to customer" || cs === "sent") return "Sent to Customer";
  return "";
}

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

// Convert any date value or UTC ISO string to local YYYY-MM-DD
function toLocalDateStr(value) {
  if (!value) return "";
  const str = String(value).trim();
  if (!str) return "";
  const date = str.includes("T") ? new Date(str) : new Date(`${str.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return str.slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolveIssuedDate(q) {
  const qDate = toLocalDateStr(q?.quotation_date);
  const cDate = toLocalDateStr(q?.created_at || q?.createdAt);
  if (qDate && cDate && qDate < cDate) {
    return cDate;
  }
  return qDate || cDate || "";
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

// Format short date for Custom Range button label
function formatShortRangeDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return dateStr;
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
    if (lower.includes("admin")) {
      return quotation.created_by_name ? `Admin: ${quotation.created_by_name}` : "Admin";
    }
    return role;
  }
  if (quotation.created_by === 2) return "Super Admin";
  if (quotation.created_by === 1) return quotation.created_by_name ? `Admin: ${quotation.created_by_name}` : "Admin";
  if (quotation.created_by_name) {
    const lower = String(quotation.created_by_name).trim().toLowerCase();
    if (lower.includes("super")) return "Super Admin";
    if (lower.includes("admin")) return `Admin: ${quotation.created_by_name}`;
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
  const [customRange, setCustomRange] = useState({ startDate: "", endDate: "" });
  const [statusFilter, setStatusFilter] = useState("All Statuses");

  // Modern Dropdown Popups state & refs
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [customDropdownOpen, setCustomDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [draftCustomStart, setDraftCustomStart] = useState("");
  const [draftCustomEnd, setDraftCustomEnd] = useState("");
  const [customRangeError, setCustomRangeError] = useState("");
  const dateDropdownRef = useRef(null);
  const customDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(event.target)) {
        setDateDropdownOpen(false);
      }
      if (customDropdownRef.current && !customDropdownRef.current.contains(event.target)) {
        setCustomDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setStatusDropdownOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === "Escape") {
        setDateDropdownOpen(false);
        setCustomDropdownOpen(false);
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
          issuedDate: resolveIssuedDate(q),
          validUntil: toLocalDateStr(q.valid_until),
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
      const cs = getNormalizedCustomerStatus(q);
      if (cs && counts[cs] !== undefined) {
        counts[cs] += 1;
      }
    });
    return counts;
  }, [quotations]);

  // Filter quotations using the search term, date range, custom range, and status
  const filteredQuotations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const cutoff = getDateCutoff(dateRange);
    const hasCustomRange = Boolean(customRange.startDate || customRange.endDate);
    const customStartBound = customRange.startDate
      ? new Date(`${customRange.startDate}T00:00:00`)
      : null;
    const customEndBound = customRange.endDate
      ? new Date(`${customRange.endDate}T23:59:59.999`)
      : null;
    const isCustomerStatusFilter = CUSTOMER_STATUS_FILTER_VALUES.has(statusFilter);

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

      const matchesCustomRange =
        !hasCustomRange ||
        (!Number.isNaN(quotationDate.getTime()) &&
          (!customStartBound || quotationDate >= customStartBound) &&
          (!customEndBound || quotationDate <= customEndBound));

      const matchesStatus =
        statusFilter === "All Statuses" ||
        (isCustomerStatusFilter
          ? getNormalizedCustomerStatus(quotation) === statusFilter
          : quotation.status === statusFilter);

      return matchesSearch && matchesDate && matchesCustomRange && matchesStatus;
    });
  }, [quotations, searchTerm, dateRange, customRange, statusFilter]);

  function handleApplyCustomRange(e) {
    e.preventDefault();
    if (!draftCustomStart && !draftCustomEnd) {
      setCustomRangeError("Select at least a From or To date.");
      return;
    }
    if (draftCustomStart && draftCustomEnd && draftCustomStart > draftCustomEnd) {
      setCustomRangeError("From date cannot be after To date.");
      return;
    }
    setCustomRangeError("");
    setCustomRange({ startDate: draftCustomStart, endDate: draftCustomEnd });
    setDateRange("all");
    setCustomDropdownOpen(false);
  }

  function handleResetCustomRange() {
    setDraftCustomStart("");
    setDraftCustomEnd("");
    setCustomRange({ startDate: "", endDate: "" });
    setCustomRangeError("");
    setCustomDropdownOpen(false);
  }

  const hasActiveCustomRange = Boolean(customRange.startDate || customRange.endDate);
  let customRangeLabel = "Custom Range";
  if (customRange.startDate && customRange.endDate) {
    customRangeLabel = `${formatShortRangeDate(customRange.startDate)} – ${formatShortRangeDate(
      customRange.endDate
    )}`;
  } else if (customRange.startDate) {
    customRangeLabel = `From ${formatShortRangeDate(customRange.startDate)}`;
  } else if (customRange.endDate) {
    customRangeLabel = `Until ${formatShortRangeDate(customRange.endDate)}`;
  }
  const quotationSchemaError =
    loadError.toLowerCase().includes("unknown column") &&
    loadError.toLowerCase().includes("status");

  // Open creation screen
  function openCreateModal() {
    setSelectedQuotation(null);
    setNewQuotationNumber(getNextQuotationNumber(quotations));
    setShowFormModal(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  // Custom in-app Delete Confirmation Modal State
  const [quotationToDelete, setQuotationToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Open edit screen
  function openEditModal(quotation) {
    setSelectedQuotation(quotation);
    setShowFormModal(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    if (!isSuperAdmin && quotation.status !== "Approved") {
      return;
    }
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
      quotation_number: getNextQuotationNumber(quotations),
      status: "Draft",
      quotation_date: new Date().toISOString().slice(0, 10),
    };

    setSelectedQuotation(duplicated);
    setShowFormModal(true);
  }

  // Open in-app delete confirmation modal (no native browser confirm)
  function handleDelete(quotation) {
    setDeleteError("");
    setQuotationToDelete(quotation);
  }

  // Handle confirmed delete
  async function handleConfirmDelete() {
    if (!quotationToDelete) return;
    const targetId = quotationToDelete.quotation_id || quotationToDelete.id;
    if (!targetId) {
      setDeleteError("This quotation is missing its backend ID and cannot be deleted.");
      return;
    }

    try {
      setIsDeleting(true);
      setDeleteError("");
      await deleteQuotation(targetId);
      setQuotationToDelete(null);
      await loadQuotations();
    } catch (err) {
      setDeleteError(err?.message || "Failed to delete quotation from backend.");
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCancelDelete() {
    if (isDeleting) return;
    setQuotationToDelete(null);
    setDeleteError("");
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

  if (showFormModal) {
    return (
      <QuotationForm
        isPage
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
    );
  }

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
              <span className="quotation-breadcrumb">
                <span className="quotation-breadcrumb-full">Dashboard / Quotations</span>
                <span className="quotation-breadcrumb-short">Quotations</span>
              </span>
            </div>
          </div>

          <div className="quotation-header-actions">
            <ThemeToggle />
            <NotificationBell filter="quotation" />

            <span className="quotation-date-badge" title="Today's Date">
              <span className="quotation-date-full">
                {new Intl.DateTimeFormat("en-US", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(new Date())}
              </span>
              <span className="quotation-date-short">
                {new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                }).format(new Date())}
              </span>
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

          {/* Separated Search & Filter Bar */}
          <section
            className="quotation-toolbar-panel"
            aria-label="Search and filter quotations"
          >
            <div className="quotation-filters">
              {/* Search */}
              <label className="quotation-search">
                <Search size={15} />

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

              {/* 1. Modern Status Filter Dropdown */}
              <div className="quotation-dropdown-wrap" ref={statusDropdownRef}>
                <button
                  type="button"
                  className={`quotation-filter-btn ${statusDropdownOpen ? "active" : ""}`}
                  onClick={() => {
                    setStatusDropdownOpen((prev) => !prev);
                    setDateDropdownOpen(false);
                    setCustomDropdownOpen(false);
                  }}
                  aria-expanded={statusDropdownOpen}
                  aria-haspopup="listbox"
                  title="Filter by status"
                >
                  <SlidersHorizontal size={16} className="quotation-filter-icon" />
                  <span className="quotation-filter-label">
                    {statusFilter === "All Statuses" ? "All Status" : statusFilter}
                  </span>
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

              {/* 2. Modern Date Filter Dropdown */}
              <div className="quotation-dropdown-wrap" ref={dateDropdownRef}>
                <button
                  type="button"
                  className={`quotation-filter-btn ${dateDropdownOpen ? "active" : ""}`}
                  onClick={() => {
                    setDateDropdownOpen((prev) => !prev);
                    setStatusDropdownOpen(false);
                    setCustomDropdownOpen(false);
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
                        const isSelected = !hasActiveCustomRange && dateRange === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className={`quotation-dropdown-item ${isSelected ? "selected" : ""}`}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setDateRange(opt.value);
                              setCustomRange({ startDate: "", endDate: "" });
                              setDraftCustomStart("");
                              setDraftCustomEnd("");
                              setCustomRangeError("");
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

              {/* 3. Custom Date Range Dropdown */}
              <div className="quotation-dropdown-wrap" ref={customDropdownRef}>
                <button
                  type="button"
                  className={`quotation-filter-btn ${customDropdownOpen || hasActiveCustomRange ? "active" : ""
                    }`}
                  onClick={() => {
                    if (!customDropdownOpen) {
                      setDraftCustomStart(customRange.startDate);
                      setDraftCustomEnd(customRange.endDate);
                      setCustomRangeError("");
                    }
                    setCustomDropdownOpen((prev) => !prev);
                    setDateDropdownOpen(false);
                    setStatusDropdownOpen(false);
                  }}
                  aria-expanded={customDropdownOpen}
                  aria-haspopup="dialog"
                  title="Filter by custom date range"
                >
                  <CalendarDays size={16} className="quotation-filter-icon" />
                  <span className="quotation-filter-label">{customRangeLabel}</span>
                  <ChevronDown
                    size={14}
                    className={`quotation-filter-chevron ${customDropdownOpen ? "open" : ""}`}
                  />
                </button>

                {customDropdownOpen && (
                  <form
                    className="quotation-dropdown-menu custom-range-menu"
                    onSubmit={handleApplyCustomRange}
                    aria-label="Custom date range filter"
                  >
                    <div className="quotation-dropdown-header">
                      <span>Custom Date Range</span>
                    </div>

                    <div className="quotation-custom-fields">
                      <label className="quotation-custom-field">
                        <span>From</span>
                        <input
                          type="date"
                          value={draftCustomStart}
                          onChange={(e) => {
                            setDraftCustomStart(e.target.value);
                            setCustomRangeError("");
                          }}
                        />
                      </label>

                      <label className="quotation-custom-field">
                        <span>To</span>
                        <input
                          type="date"
                          value={draftCustomEnd}
                          min={draftCustomStart || undefined}
                          onChange={(e) => {
                            setDraftCustomEnd(e.target.value);
                            setCustomRangeError("");
                          }}
                        />
                      </label>
                    </div>

                    {customRangeError && (
                      <p className="quotation-custom-error" role="alert">
                        {customRangeError}
                      </p>
                    )}

                    <div className="quotation-custom-actions">
                      {hasActiveCustomRange && (
                        <button
                          type="button"
                          className="quotation-custom-reset"
                          onClick={handleResetCustomRange}
                        >
                          Reset
                        </button>
                      )}
                      <div className="quotation-custom-btn-group">
                        <button
                          type="button"
                          className="quotation-custom-cancel"
                          onClick={() => setCustomDropdownOpen(false)}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="quotation-custom-apply">
                          Apply
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>

          {/* Quotations Details Table Panel */}
          <section className="quotation-list-section" aria-label="Quotations list">
            {loadError && (
              <div
                className="quotation-load-error"
                role="alert"
                aria-live="assertive"
                style={{ marginTop: "16px" }}
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

            {/* Table */}
            <div className="quotation-table-wrapper">
              <table className="quotation-table">
                <thead>
                  <tr>
                    <th>QUOTATION ID</th>
                    <th>CLIENT</th>
                    <th>PROJECT</th>
                    <th>CREATED BY</th>
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
                          <div className="quotation-id-cell">
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
                            <span className="quotation-id-date">
                              {formatDate(quotation.issuedDate)}
                            </span>
                          </div>
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

                        <td>
                          {(() => {
                            const creatorRole = getCreatorRole(quotation);
                            const isSuper = String(creatorRole).toLowerCase().includes("super");

                            return (
                              <span
                                className={`quotation-creator-badge ${isSuper ? "super" : "admin"
                                  }`}
                                title={
                                  quotation.created_by_name
                                    ? `${creatorRole} (${quotation.created_by_name})`
                                    : creatorRole
                                }
                              >
                                <span className="quotation-creator-dot" aria-hidden="true" />
                                <span className="quotation-creator-text">{creatorRole}</span>
                              </span>
                            );
                          })()}
                        </td>

                        <td className="amount-column quotation-amount">
                          {formatCurrency(quotation.total, quotation.currency)}
                        </td>

                        <td>
                          <span className={`quotation-status status-${(quotation.status || "").toLowerCase().replace(/\s+/g, "-")}`}>
                            <StatusIcon size={11} />
                            {quotation.status}
                          </span>
                        </td>

                        <td>
                          {(() => {
                            const statusSlug = (quotation.customer_status || "notsent")
                              .toLowerCase()
                              .replace(/\s+/g, "");
                            return (
                              <div
                                className={`quotation-status-control status-${statusSlug}`}
                                title="Update customer response"
                              >
                                <select
                                  value={quotation.customer_status || "Not Sent"}
                                  disabled={updatingStatusId === (quotation.quotation_id || quotation.id)}
                                  onChange={(e) => handleCustomerStatusUpdate(quotation, e.target.value)}
                                  className={`quotation-status-select cust-status-badge status-${statusSlug}`}
                                  aria-label={`Customer status for ${quotation.id}`}
                                >
                                  <option value="Not Sent">Not Sent</option>
                                  <option value="Sent to Customer">Sent</option>
                                  <option value="Customer Accepted">Accepted</option>
                                  <option value="Customer Rejected">Rejected</option>
                                </select>
                                <ChevronDown
                                  size={11}
                                  className="quotation-status-select-chevron"
                                  aria-hidden="true"
                                />
                              </div>
                            );
                          })()}
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
                              style={{
                                color:
                                  !isSuperAdmin && quotation.status !== "Approved"
                                    ? "#94a3b8"
                                    : "#0284c7",
                                cursor:
                                  !isSuperAdmin && quotation.status !== "Approved"
                                    ? "not-allowed"
                                    : undefined,
                                opacity:
                                  !isSuperAdmin && quotation.status !== "Approved"
                                    ? 0.45
                                    : undefined,
                              }}
                              title={
                                !isSuperAdmin && quotation.status !== "Approved"
                                  ? "Available after Super Admin approval"
                                  : "Download PDF"
                              }
                              aria-label={`Download ${quotation.id} PDF`}
                              disabled={
                                downloadingId === (quotation.quotation_id || quotation.id) ||
                                (!isSuperAdmin && quotation.status !== "Approved")
                              }
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
                      <td colSpan={8} className="quotation-empty-cell">
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
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}

      {/* Custom in-app Delete Confirmation Modal */}
      {quotationToDelete && (
        <div
          className="quotation-modal-overlay"
          onClick={handleCancelDelete}
        >
          <div
            className="quotation-delete-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
          >
            <div className="quotation-delete-icon-wrap">
              <Trash2 size={24} />
            </div>

            <h3 id="delete-dialog-title" className="quotation-delete-title">
              Delete Quotation
            </h3>

            <p className="quotation-delete-desc">
              Are you sure you want to delete quotation{" "}
              <strong>
                {quotationToDelete.quotation_number ||
                  quotationToDelete.id ||
                  "this quotation"}
              </strong>
              {quotationToDelete.customer_name || quotationToDelete.clientName ? (
                <>
                  {" "}for{" "}
                  <strong>
                    {quotationToDelete.customer_name ||
                      quotationToDelete.clientName}
                  </strong>
                </>
              ) : null}
              ? This action cannot be undone.
            </p>

            {deleteError && (
              <div className="quotation-delete-error" role="alert">
                {deleteError}
              </div>
            )}

            <div className="quotation-delete-actions">
              <button
                type="button"
                className="quotation-delete-btn cancel"
                disabled={isDeleting}
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
              <button
                type="button"
                className="quotation-delete-btn confirm"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}