import { useEffect, useMemo, useState, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Receipt,
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Copy,
  Download,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CalendarDays,
  SlidersHorizontal,
  Menu,
  ChevronDown,
  Check,
  X,
  FileText,
  DollarSign,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import NotificationBell from "../components/NotificationBell";
import InvoiceForm from "./InvoiceForm";
import InvoiceDetails from "./InvoiceDetails";
import InvoicePaymentModal from "../components/InvoicePaymentModal";
import {
  getInvoices,
  getInvoiceById,
  deleteInvoice,
  duplicateInvoice,
  submitInvoiceForApproval,
  approveInvoice,
  rejectInvoice,
  updateInvoiceStatus,
  getCustomers,
  getQuotations,
} from "../services/invoiceService";
import {
  addNotification,
  getCompanyDetails,
} from "../services/quotationService";
import { downloadInvoicePdf } from "../utils/pdfGenerator";
import { getAuthenticatedUser } from "../utils/authStorage";
import "./Invoices.css";

const statusFilterOptions = [
  { label: "All Statuses", value: "All", color: "#64748b" },
  { label: "Paid", value: "Paid", color: "#16a34a" },
  { label: "Unpaid", value: "Unpaid", color: "#2563eb" },
  { label: "Partial", value: "Partial", color: "#d97706" },
  { label: "Overdue", value: "Overdue", color: "#ef4444" },
  { label: "Pending Approval", value: "Pending Approval", color: "#f59e0b" },
  { label: "Draft", value: "Draft", color: "#64748b" },
  { label: "Approved", value: "Approved", color: "#16a34a" },
  { label: "Rejected", value: "Rejected", color: "#dc2626" },
];

const dateRangeOptions = [
  { label: "All time", value: "all", desc: "Show all records" },
  { label: "Last 7 days", value: "week", desc: "Past 7 days" },
  { label: "Last 30 days", value: "month", desc: "Past 30 days" },
  { label: "Last 1 year", value: "year", desc: "Past 365 days" },
];

function formatCurrency(amount, currency = "LKR") {
  return `${currency} ${(Number(amount) || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(str) {
  if (!str) return "—";
  try {
    const d = new Date(str.includes("T") ? str : `${str}T00:00:00`);
    if (Number.isNaN(d.getTime())) return str;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return str;
  }
}

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

function getCreatorRole(inv) {
  const role = String(inv?.created_by_role || "").trim();
  if (role.toLowerCase().includes("super") || inv?.created_by === 2) {
    return "Super Admin";
  }
  return role || "Admin";
}

function getInvoiceApprovalStatus(inv) {
  const s = String(inv?.status || "").trim().toLowerCase();
  if (s === "pending approval" || inv?.approval_status === "Pending") {
    return "Pending Approval";
  }
  if (s === "rejected" || inv?.approval_status === "Rejected") {
    return "Rejected";
  }
  if (s === "draft" || inv?.approval_status === "Draft") {
    return "Draft";
  }
  return "Approved";
}

function getInvoicePaymentStatus(inv) {
  const s = String(inv?.status || "").trim().toLowerCase();
  if (s === "draft") return "Draft";
  if (s === "pending approval") return "Pending Approval";
  if (s === "rejected") return "Rejected";
  if (s === "cancelled") return "Cancelled";
  if (s === "paid") return "Paid";

  const total = Number(inv?.total_amount) || 0;
  const paid = Number(inv?.amount_paid) || 0;
  const bal = Number(inv?.balance_due ?? (total - paid));

  if (bal <= 0 && total > 0) return "Paid";
  if (inv?.due_date && new Date(inv.due_date) < new Date() && bal > 0) return "Overdue";
  if (s === "partially paid" || s === "partial" || (paid > 0 && bal > 0)) return "Partially Paid";
  return "Unpaid";
}

export default function Invoices() {
  const { openSidebar } = useOutletContext() || {};

  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("all");
  const [customRange, setCustomRange] = useState({ startDate: "", endDate: "" });

  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [customDropdownOpen, setCustomDropdownOpen] = useState(false);
  const [draftCustomStart, setDraftCustomStart] = useState("");
  const [draftCustomEnd, setDraftCustomEnd] = useState("");
  const [customRangeError, setCustomRangeError] = useState("");
  const statusDropdownRef = useRef(null);
  const dateDropdownRef = useRef(null);
  const customDropdownRef = useRef(null);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);

  // Delete modal
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Invoice & Payment Settlement Modal
  const [paymentInvoice, setPaymentInvoice] = useState(null);

  // Rejection Modal (Super Admin)
  const [invoiceToReject, setInvoiceToReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  const authUser = getAuthenticatedUser();
  const isSuperAdmin =
    String(authUser?.role || "").trim().toLowerCase() === "super admin" ||
    authUser?.role === "super_admin";
  const userInitials = isSuperAdmin ? "SA" : "A";
  const userRoleTitle = isSuperAdmin ? "Super Admin" : "Admin";

  // Load invoices and supporting data
  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [invList, custList, quoList] = await Promise.all([
        getInvoices(),
        getCustomers().catch(() => []),
        getQuotations().catch(() => []),
      ]);
      setInvoices(Array.isArray(invList) ? invList : []);
      setCustomers(Array.isArray(custList) ? custList : []);
      setQuotations(Array.isArray(quoList) ? quoList : []);
    } catch (err) {
      console.error("Failed to load invoices:", err);
      setError(err?.message || "Could not load invoices.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Dropdown click outside listeners
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(e.target)
      ) {
        setStatusDropdownOpen(false);
      }
      if (
        dateDropdownRef.current &&
        !dateDropdownRef.current.contains(e.target)
      ) {
        setDateDropdownOpen(false);
      }
      if (
        customDropdownRef.current &&
        !customDropdownRef.current.contains(e.target)
      ) {
        setCustomDropdownOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setStatusDropdownOpen(false);
        setDateDropdownOpen(false);
        setCustomDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Search
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        [
          inv.invoice_number,
          inv.customer_name,
          inv.company_name,
          inv.quotation_id,
          inv.status,
          inv.created_by_name,
          inv.notes,
        ].some((val) => String(val || "").toLowerCase().includes(term));

      // Status
      let matchesStatus = true;
      if (statusFilter !== "All") {
        const payStatus = getInvoicePaymentStatus(inv);
        const appStatus = getInvoiceApprovalStatus(inv);

        if (statusFilter === "Overdue") {
          matchesStatus = payStatus === "Overdue";
        } else if (statusFilter === "Paid") {
          matchesStatus = payStatus === "Paid";
        } else if (statusFilter === "Unpaid") {
          matchesStatus = payStatus === "Unpaid";
        } else if (statusFilter === "Partial") {
          matchesStatus = payStatus === "Partial" || payStatus === "Partially Paid";
        } else if (statusFilter === "Pending Approval") {
          matchesStatus = appStatus === "Pending Approval";
        } else if (statusFilter === "Draft") {
          matchesStatus = appStatus === "Draft";
        } else if (statusFilter === "Approved") {
          matchesStatus = appStatus === "Approved";
        } else if (statusFilter === "Rejected") {
          matchesStatus = appStatus === "Rejected";
        }
      }

      // Date cutoff & custom range
      const hasCustomRange = Boolean(customRange.startDate || customRange.endDate);
      const rawDate = inv.invoice_date || inv.created_at;
      const invD = rawDate
        ? new Date(rawDate.includes("T") ? rawDate : `${rawDate}T00:00:00`)
        : null;

      let matchesDate = true;
      if (dateFilter !== "all") {
        if (!invD || Number.isNaN(invD.getTime())) {
          matchesDate = false;
        } else {
          const cutoff = new Date();
          cutoff.setHours(0, 0, 0, 0);
          if (dateFilter === "week") cutoff.setDate(cutoff.getDate() - 7);
          if (dateFilter === "month") cutoff.setMonth(cutoff.getMonth() - 1);
          if (dateFilter === "year") cutoff.setFullYear(cutoff.getFullYear() - 1);
          matchesDate = invD >= cutoff;
        }
      }

      let matchesCustomRange = true;
      if (hasCustomRange) {
        if (!invD || Number.isNaN(invD.getTime())) {
          matchesCustomRange = false;
        } else {
          const startBound = customRange.startDate
            ? new Date(`${customRange.startDate}T00:00:00`)
            : null;
          const endBound = customRange.endDate
            ? new Date(`${customRange.endDate}T23:59:59.999`)
            : null;
          if (startBound && invD < startBound) matchesCustomRange = false;
          if (endBound && invD > endBound) matchesCustomRange = false;
        }
      }

      return matchesSearch && matchesStatus && matchesDate && matchesCustomRange;
    });
  }, [invoices, searchTerm, statusFilter, dateFilter, customRange]);

  // Count items per status for dropdown badges
  const statusCounts = useMemo(() => {
    const counts = {
      All: invoices.length,
      Paid: 0,
      Unpaid: 0,
      Partial: 0,
      Overdue: 0,
      "Pending Approval": 0,
      Draft: 0,
      Approved: 0,
      Rejected: 0,
    };
    invoices.forEach((inv) => {
      const payStatus = getInvoicePaymentStatus(inv);
      const appStatus = getInvoiceApprovalStatus(inv);
      if (payStatus === "Overdue") counts.Overdue += 1;
      if (payStatus === "Paid") counts.Paid += 1;
      if (payStatus === "Unpaid") counts.Unpaid += 1;
      if (payStatus === "Partial" || payStatus === "Partially Paid") counts.Partial += 1;
      if (appStatus === "Pending Approval") counts["Pending Approval"] += 1;
      if (appStatus === "Draft") counts.Draft += 1;
      if (appStatus === "Approved") counts.Approved += 1;
      if (appStatus === "Rejected") counts.Rejected += 1;
    });
    return counts;
  }, [invoices]);

  // Action handlers
  function handleOpenCreate() {
    setEditingInvoice(null);
    setIsFormOpen(true);
  }

  function handleOpenEdit(inv) {
    setEditingInvoice(inv);
    setIsFormOpen(true);
  }

  function handleOpenView(inv) {
    setViewingInvoice(inv);
    setIsDetailsOpen(true);
  }

  async function handleDownloadRowPdf(inv) {
    if (!inv?.invoice_id) return;
    try {
      const [freshInv, company] = await Promise.all([
        getInvoiceById(inv.invoice_id).catch(() => null),
        getCompanyDetails().catch(() => ({})),
      ]);
      const rawInvoice = freshInv || inv;
      const linkedQ = (Array.isArray(quotations) ? quotations : []).find(
        (q) =>
          (rawInvoice.quotation_id &&
            String(q.quotation_id) === String(rawInvoice.quotation_id)) ||
          (rawInvoice.quotation_number &&
            String(q.quotation_number) === String(rawInvoice.quotation_number))
      );
      const qDiscAmt = Number(linkedQ?.discount_amount ?? 0);
      const qDiscPct = Number(linkedQ?.discount_percentage ?? 0);
      const fallbackDiscount =
        qDiscAmt > 0
          ? qDiscAmt
          : qDiscPct > 0
            ? ((Number(rawInvoice.subtotal) || 0) * qDiscPct) / 100
            : 0;
      const targetInvoice =
        Number(rawInvoice.discount_amount || 0) === 0 && fallbackDiscount > 0
          ? { ...rawInvoice, discount_amount: fallbackDiscount }
          : rawInvoice;
      const fileNum =
        targetInvoice.invoice_number || `INV-${targetInvoice.invoice_id}`;
      await downloadInvoicePdf(targetInvoice, company || {}, `${fileNum}.pdf`);
    } catch (err) {
      alert("Failed to download invoice PDF: " + (err?.message || err));
    }
  }

  async function handleDuplicate(inv) {
    try {
      const duplicated = await duplicateInvoice(inv.invoice_id);
      await loadData();
      setEditingInvoice(duplicated);
      setIsFormOpen(true);
    } catch (err) {
      alert("Failed to duplicate invoice: " + (err.message || err));
    }
  }

  function handlePromptDelete(inv) {
    setInvoiceToDelete(inv);
  }

  async function handleConfirmDelete() {
    if (!invoiceToDelete) return;
    try {
      setIsDeleting(true);
      await deleteInvoice(invoiceToDelete.invoice_id);
      setInvoiceToDelete(null);
      await loadData();
    } catch (err) {
      alert("Failed to delete invoice: " + (err.message || err));
    } finally {
      setIsDeleting(false);
    }
  }

  // Quick Approval handlers (Super Admin)
  async function handleQuickApprove(inv) {
    try {
      await approveInvoice(inv.invoice_id);
      const invNum = inv.invoice_number || `ID #${inv.invoice_id}`;
      const clientName = inv.customer_name || inv.client_name || "client";
      const authUser = getAuthenticatedUser();
      try {
        await addNotification({
          title: `Invoice Approved: ${invNum}`,
          message: `Your invoice ${invNum} for ${clientName} has been approved and issued by Super Admin.`,
          type: "success",
          reference_type: "invoice",
          reference_id: inv.invoice_id,
          target_role: "admin",
          target_user_id: inv.created_by,
          created_by: authUser?.user_id || authUser?.id,
          created_by_name: authUser?.name || "Super Admin",
        });
      } catch (err) {
        console.warn("Could not dispatch invoice approval notification:", err);
      }
      await loadData();
    } catch (err) {
      alert("Failed to approve invoice: " + (err.message || err));
    }
  }

  function handlePromptReject(inv) {
    setInvoiceToReject(inv);
    setRejectionReason("");
  }

  async function handleConfirmReject(e) {
    e.preventDefault();
    if (!invoiceToReject) return;
    const inv = invoiceToReject;
    const cleanReason = rejectionReason.trim();
    try {
      setIsRejecting(true);
      await rejectInvoice(inv.invoice_id, cleanReason);
      const invNum = inv.invoice_number || `ID #${inv.invoice_id}`;
      const clientName = inv.customer_name || inv.client_name || "client";
      const authUser = getAuthenticatedUser();
      try {
        await addNotification({
          title: `Invoice Rejected: ${invNum}`,
          message: `Your invoice ${invNum} for ${clientName} was rejected. Reason: "${cleanReason}".`,
          type: "error",
          reference_type: "invoice",
          reference_id: inv.invoice_id,
          target_role: "admin",
          target_user_id: inv.created_by,
          created_by: authUser?.user_id || authUser?.id,
          created_by_name: authUser?.name || "Super Admin",
        });
      } catch (err) {
        console.warn("Could not dispatch invoice rejection notification:", err);
      }
      setInvoiceToReject(null);
      setRejectionReason("");
      await loadData();
    } catch (err) {
      alert("Failed to reject invoice: " + (err.message || err));
    } finally {
      setIsRejecting(false);
    }
  }

  // Open Invoice & Payment Settlement Modal
  function handleOpenPaymentModal(inv) {
    setPaymentInvoice(inv);
  }

  function handleApplyCustomRange(e) {
    e.preventDefault();
    if (!draftCustomStart && !draftCustomEnd) {
      setCustomRangeError("Please select at least a From or To date.");
      return;
    }
    if (draftCustomStart && draftCustomEnd && draftCustomStart > draftCustomEnd) {
      setCustomRangeError("From date cannot be after To date.");
      return;
    }
    setCustomRangeError("");
    setCustomRange({ startDate: draftCustomStart, endDate: draftCustomEnd });
    setDateFilter("all");
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

  const hasActiveFilters =
    Boolean(searchTerm) ||
    statusFilter !== "All" ||
    dateFilter !== "all" ||
    hasActiveCustomRange;

  const isCreateScreen = isFormOpen && !editingInvoice;

  return (
    <div className="invoices-page">
      {/* Top bar header matching Quotations styling */}
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
              {isCreateScreen
                ? "Dashboard / Invoices / Create Invoice"
                : "Dashboard / Invoices"}
            </span>
          </div>
        </div>

        <div className="quotation-header-actions">
          <ThemeToggle />
          <NotificationBell filter="invoice" />

          <span className="quotation-date-badge" title="Today's Date">
            {new Intl.DateTimeFormat("en-US", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date())}
          </span>

          <div className="quotation-header-profile" title={userRoleTitle}>
            <span
              className="quotation-profile-avatar"
              aria-label={`${userRoleTitle} profile`}
            >
              {userInitials}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="inv-content">
        {isCreateScreen ? (
          <InvoiceForm
            asPage
            isOpen
            onClose={() => setIsFormOpen(false)}
            onSuccess={() => {
              setIsFormOpen(false);
              loadData();
            }}
          />
        ) : (
          <>
            {/* Welcome / Title Row matching Quotations styling */}
            <div className="quotation-welcome-bar">
          <div className="quotation-welcome-text">
            <h1>Invoices</h1>
            <p className="quotation-subtitle">
              Create, organize, and track your business invoices and client payments.
            </p>
          </div>

          <button
            type="button"
            className="quotation-create-button"
            onClick={handleOpenCreate}
            title="Create new invoice"
          >
            <Plus size={16} />
            <span>Create Invoice</span>
          </button>
        </div>

        {/* Separated Search & Filter Bar */}
        <section className="inv-toolbar-panel" aria-label="Search and filter invoices">
          <div className="inv-filters-bar">
          <div className="inv-search-wrap">
            <Search size={16} className="inv-search-icon" />
            <input
              type="text"
              placeholder="Search by Invoice #, Customer, Quotation Ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="inv-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                className="inv-search-clear"
                onClick={() => setSearchTerm("")}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="inv-filters-right">
            {/* Status Dropdown */}
            <div className="inv-dropdown-wrap" ref={statusDropdownRef}>
              <button
                type="button"
                className={`inv-filter-btn ${statusDropdownOpen ? "active" : ""}`}
                onClick={() => {
                  setStatusDropdownOpen((prev) => !prev);
                  setDateDropdownOpen(false);
                }}
                aria-expanded={statusDropdownOpen}
                aria-haspopup="listbox"
                title="Filter by status"
              >
                <SlidersHorizontal size={16} className="inv-filter-icon" />
                <span className="inv-filter-label">
                  {statusFilter === "All" ? "All Status" : statusFilter}
                </span>
                <ChevronDown
                  size={14}
                  className={`inv-filter-chevron ${statusDropdownOpen ? "open" : ""}`}
                />
              </button>
              {statusDropdownOpen && (
                <div className="inv-dropdown-menu status-menu" role="listbox">
                  <div className="inv-dropdown-header">
                    <span>Filter by Status</span>
                  </div>
                  <div className="inv-dropdown-list">
                    {statusFilterOptions.map((opt) => {
                      const isSelected = statusFilter === opt.value;
                      const count = statusCounts[opt.value] ?? 0;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className={`inv-dropdown-item ${isSelected ? "active" : ""}`}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setStatusFilter(opt.value);
                            setStatusDropdownOpen(false);
                          }}
                        >
                          <div className="inv-dropdown-item-left">
                            <span
                              className="inv-status-dot"
                              style={{ backgroundColor: opt.color }}
                            />
                            <span className="inv-item-title">{opt.label}</span>
                          </div>
                          <div className="inv-dropdown-item-right">
                            <span className="inv-item-badge">{count}</span>
                            {isSelected && <Check size={15} className="inv-item-check" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Date Range Dropdown */}
            <div className="inv-dropdown-wrap" ref={dateDropdownRef}>
              <button
                type="button"
                className={`inv-filter-btn ${dateDropdownOpen ? "active" : ""}`}
                onClick={() => {
                  setDateDropdownOpen((prev) => !prev);
                  setStatusDropdownOpen(false);
                }}
                aria-expanded={dateDropdownOpen}
                aria-haspopup="listbox"
                title="Filter by date range"
              >
                <CalendarDays size={16} className="inv-filter-icon" />
                <span className="inv-filter-label">
                  {dateRangeOptions.find((d) => d.value === dateFilter)?.label}
                </span>
                <ChevronDown
                  size={14}
                  className={`inv-filter-chevron ${dateDropdownOpen ? "open" : ""}`}
                />
              </button>
              {dateDropdownOpen && (
                <div className="inv-dropdown-menu date-menu" role="listbox">
                  <div className="inv-dropdown-header">
                    <span>Filter by Date</span>
                  </div>
                  <div className="inv-dropdown-list">
                    {dateRangeOptions.map((opt) => {
                      const isSelected = dateFilter === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className={`inv-dropdown-item ${isSelected ? "active" : ""}`}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setDateFilter(opt.value);
                            setCustomRange({ startDate: "", endDate: "" });
                            setDateDropdownOpen(false);
                          }}
                        >
                          <div className="inv-dropdown-item-info">
                            <span className="inv-item-title">{opt.label}</span>
                            {opt.desc && (
                              <span className="inv-item-desc">{opt.desc}</span>
                            )}
                          </div>
                          {isSelected && <Check size={15} className="inv-item-check" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Custom Date Range Dropdown */}
            <div className="inv-dropdown-wrap" ref={customDropdownRef}>
              <button
                type="button"
                className={`inv-filter-btn ${
                  customDropdownOpen || hasActiveCustomRange ? "active" : ""
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
                <CalendarDays size={16} className="inv-filter-icon" />
                <span className="inv-filter-label">{customRangeLabel}</span>
                <ChevronDown
                  size={14}
                  className={`inv-filter-chevron ${customDropdownOpen ? "open" : ""}`}
                />
              </button>

              {customDropdownOpen && (
                <form
                  className="inv-dropdown-menu custom-range-menu"
                  onSubmit={handleApplyCustomRange}
                  aria-label="Custom date range filter"
                >
                  <div className="inv-dropdown-header">
                    <span>Custom Date Range</span>
                  </div>

                  <div className="inv-custom-fields">
                    <label className="inv-custom-field">
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

                    <label className="inv-custom-field">
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
                    <p className="inv-custom-error" role="alert">
                      {customRangeError}
                    </p>
                  )}

                  <div className="inv-custom-actions">
                    {hasActiveCustomRange && (
                      <button
                        type="button"
                        className="inv-custom-reset"
                        onClick={handleResetCustomRange}
                      >
                        Reset
                      </button>
                    )}
                    <div className="inv-custom-btn-group">
                      <button
                        type="button"
                        className="inv-custom-cancel"
                        onClick={() => setCustomDropdownOpen(false)}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="inv-custom-apply">
                        Apply
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="inv-clear-all-btn"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("All");
                  setDateFilter("all");
                  setCustomRange({ startDate: "", endDate: "" });
                  setDraftCustomStart("");
                  setDraftCustomEnd("");
                  setCustomRangeError("");
                }}
                title="Reset all filters"
              >
                <RefreshCw size={13} />
                <span>Reset</span>
              </button>
            )}
          </div>
          </div>
        </section>

        {/* Invoice List Table */}
        <section className="inv-table-section">
          {loading ? (
            <div className="inv-loading-state">
              <div className="inv-spinner" />
              <p>Loading invoices...</p>
            </div>
          ) : error ? (
            <div className="inv-error-state">
              <AlertCircle size={24} color="#dc2626" />
              <p>{error}</p>
              <button type="button" onClick={loadData}>
                Retry
              </button>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="inv-empty-state">
              <div className="inv-empty-icon">
                <Receipt size={32} />
              </div>
              <h3>No invoices found</h3>
              <p>
                {searchTerm || statusFilter !== "All"
                  ? "Try adjusting your search criteria or filters."
                  : "Start creating your first invoice to bill customers."}
              </p>
              <button
                type="button"
                className="inv-create-btn"
                onClick={handleOpenCreate}
              >
                <Plus size={16} />
                <span>Create First Invoice</span>
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Responsive Table */}
              <div className="inv-table-responsive">
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th>INVOICE ID</th>
                      <th>CLIENT</th>
                      <th>QUOTATION</th>
                      <th>DUE DATE</th>
                      <th>CREATED BY</th>
                      <th>FINANCIAL</th>
                      <th style={{ textAlign: "center" }}>PAYMENT STATUS</th>
                      <th style={{ textAlign: "center" }}>APPROVAL STATUS</th>
                      <th style={{ textAlign: "center" }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv) => {
                      const invNum =
                        inv.invoice_number || `INV-${inv.invoice_id}`;
                      const total = Number(inv.total_amount) || 0;
                      const paid = Number(inv.amount_paid) || 0;
                      const bal = Number(inv.balance_due ?? (total - paid));
                      const payStatus = getInvoicePaymentStatus(inv);
                      const appStatus = getInvoiceApprovalStatus(inv);
                      const creatorRole = getCreatorRole(inv);
                      const isSuperCreator =
                        String(creatorRole).toLowerCase().includes("super");
                      const isOverdue = payStatus === "Overdue";

                      return (
                        <tr key={inv.invoice_id}>
                          <td>
                            <div className="inv-id-cell">
                              <button
                                type="button"
                                className="inv-id-btn"
                                onClick={() => handleOpenView(inv)}
                                title="Click to view details"
                              >
                                {invNum}
                              </button>
                              <span className="inv-id-date">
                                {formatDate(inv.invoice_date)}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="inv-cell-customer">
                              <div className="inv-cust-avatar">
                                {(inv.customer_name || "C")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                              <div className="inv-cust-info">
                                <span className="inv-cust-name">
                                  {inv.customer_name || "—"}
                                </span>
                                {inv.company_name && (
                                  <span className="inv-cust-company">
                                    {inv.company_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            {inv.quotation_number || inv.quotation_id ? (
                              <span className="inv-quo-ref">
                                {inv.quotation_number || inv.quotation_id}
                              </span>
                            ) : (
                              <span className="inv-cell-muted">Direct</span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`inv-cell-due ${
                                isOverdue ? "overdue" : ""
                              }`}
                            >
                              {formatDate(inv.due_date)}
                              {isOverdue && (
                                <span className="inv-overdue-pill">Overdue</span>
                              )}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`inv-creator-pill ${
                                isSuperCreator ? "super" : "admin"
                              }`}
                              title={
                                inv.created_by_name
                                  ? `${creatorRole} (${inv.created_by_name})`
                                  : creatorRole
                              }
                            >
                              <span
                                className="inv-creator-dot"
                                aria-hidden="true"
                              />
                              <span>{creatorRole}</span>
                            </span>
                          </td>
                          <td className="inv-financial-td">
                            <div className="inv-financial-cell">
                              <span className="inv-financial-total">
                                {formatCurrency(total, inv.currency)}
                              </span>
                              <span className="inv-financial-paid">
                                Paid: {formatCurrency(paid, inv.currency)}
                              </span>
                              <span
                                className={`inv-financial-balance ${
                                  bal > 0 ? "due" : "settled"
                                }`}
                              >
                                Balance: {formatCurrency(bal, inv.currency)}
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span
                              className={`inv-badge ${payStatus
                                .toLowerCase()
                                .replace(/\s+/g, "-")}`}
                            >
                              <span
                                className="inv-pill-dot"
                                aria-hidden="true"
                              />
                              <span>{payStatus}</span>
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span
                              className={`inv-app-badge ${appStatus
                                .toLowerCase()
                                .replace(/\s+/g, "-")}`}
                            >
                              <span
                                className="inv-pill-dot"
                                aria-hidden="true"
                              />
                              <span>{appStatus}</span>
                            </span>
                          </td>
                          <td>
                            <div className="inv-row-actions">
                              {/* View */}
                              <button
                                type="button"
                                className="inv-action-btn"
                                onClick={() => handleOpenView(inv)}
                                title="View & Print Invoice"
                              >
                                <Eye size={15} />
                              </button>

                              {/* Payment */}
                              <button
                                type="button"
                                className="inv-action-btn pay"
                                onClick={() => handleOpenPaymentModal(inv)}
                                disabled={
                                  appStatus !== "Approved" ||
                                  payStatus === "Cancelled"
                                }
                                title={
                                  appStatus !== "Approved" ||
                                  payStatus === "Cancelled"
                                    ? "Payment available for approved active invoices"
                                    : payStatus === "Paid"
                                    ? "View payment settlement & history"
                                    : "Record payment & settlement"
                                }
                              >
                                <CreditCard size={15} />
                              </button>

                              {/* Edit */}
                              <button
                                type="button"
                                className="inv-action-btn"
                                onClick={() => handleOpenEdit(inv)}
                                title="Edit Invoice"
                              >
                                <Pencil size={15} />
                              </button>

                              {/* Download */}
                              <button
                                type="button"
                                className="inv-action-btn"
                                onClick={() => handleDownloadRowPdf(inv)}
                                title="Download Invoice PDF"
                              >
                                <Download size={15} />
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                className="inv-action-btn delete"
                                onClick={() => handlePromptDelete(inv)}
                                title="Delete Invoice"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="inv-mobile-cards">
                {filteredInvoices.map((inv) => {
                  const invNum =
                    inv.invoice_number || `INV-${inv.invoice_id}`;
                  const total = Number(inv.total_amount) || 0;
                  const paid = Number(inv.amount_paid) || 0;
                  const bal = Number(inv.balance_due ?? (total - paid));
                  const payStatus = getInvoicePaymentStatus(inv);
                  const appStatus = getInvoiceApprovalStatus(inv);
                  const creatorRole = getCreatorRole(inv);
                  const isSuperCreator =
                    String(creatorRole).toLowerCase().includes("super");
                  const isOverdue = payStatus === "Overdue";

                  return (
                    <article key={inv.invoice_id} className="inv-mobile-card">
                      <div className="inv-mcard-top">
                        <div>
                          <strong
                            className="inv-mcard-num"
                            onClick={() => handleOpenView(inv)}
                            style={{ cursor: "pointer" }}
                          >
                            {invNum}
                          </strong>
                          <span className="inv-mcard-date">
                            {formatDate(inv.invoice_date)}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <span
                            className={`inv-app-badge ${appStatus
                              .toLowerCase()
                              .replace(/\s+/g, "-")}`}
                          >
                            {appStatus}
                          </span>
                          <span
                            className={`inv-badge ${payStatus
                              .toLowerCase()
                              .replace(/\s+/g, "-")}`}
                          >
                            {payStatus}
                          </span>
                        </div>
                      </div>

                      <div className="inv-mcard-body">
                        <div className="inv-mcard-row">
                          <span className="inv-mcard-lbl">Customer:</span>
                          <span className="inv-mcard-val bold">
                            {inv.customer_name || "—"}
                          </span>
                        </div>

                        {(inv.quotation_number || inv.quotation_id) && (
                          <div className="inv-mcard-row">
                            <span className="inv-mcard-lbl">Quotation:</span>
                            <span className="inv-mcard-val">
                              {inv.quotation_number || inv.quotation_id}
                            </span>
                          </div>
                        )}

                        <div className="inv-mcard-row">
                          <span className="inv-mcard-lbl">Created By:</span>
                          <span
                            className={`inv-creator-pill ${
                              isSuperCreator ? "super" : "admin"
                            }`}
                          >
                            {creatorRole}
                          </span>
                        </div>

                        <div className="inv-mcard-row">
                          <span className="inv-mcard-lbl">Due Date:</span>
                          <span
                            className={`inv-mcard-val ${
                              isOverdue ? "overdue" : ""
                            }`}
                          >
                            {formatDate(inv.due_date)}
                            {isOverdue && (
                              <span className="inv-overdue-pill">Overdue</span>
                            )}
                          </span>
                        </div>

                        <div className="inv-mcard-row total">
                          <span className="inv-mcard-lbl">Total:</span>
                          <span className="inv-mcard-val bold">
                            {formatCurrency(total, inv.currency)}
                          </span>
                        </div>

                        <div className="inv-mcard-row">
                          <span className="inv-mcard-lbl">Paid Amount:</span>
                          <span
                            className="inv-mcard-val bold"
                            style={{ color: "#16a34a" }}
                          >
                            {formatCurrency(paid, inv.currency)}
                          </span>
                        </div>

                        <div className="inv-mcard-row">
                          <span className="inv-mcard-lbl">Balance Due:</span>
                          <span
                            className="inv-mcard-val bold"
                            style={{
                              color: bal > 0 ? "#dc2626" : "#16a34a",
                            }}
                          >
                            {formatCurrency(bal, inv.currency)}
                          </span>
                        </div>
                      </div>

                      <div className="inv-mcard-actions">
                        <button
                          type="button"
                          className="inv-mcard-btn"
                          onClick={() => handleOpenView(inv)}
                        >
                          <Eye size={14} /> View
                        </button>

                        {appStatus === "Approved" &&
                          payStatus !== "Cancelled" && (
                            <button
                              type="button"
                              className="inv-mcard-btn pay"
                              onClick={() => handleOpenPaymentModal(inv)}
                            >
                              <CreditCard size={14} />{" "}
                              {payStatus === "Paid" ? "Payments" : "Pay"}
                            </button>
                          )}

                        {isSuperAdmin && appStatus === "Pending Approval" && (
                          <>
                            <button
                              type="button"
                              className="inv-mcard-btn approve"
                              onClick={() => handleQuickApprove(inv)}
                            >
                              <CheckCircle2 size={14} /> Approve
                            </button>
                            <button
                              type="button"
                              className="inv-mcard-btn reject"
                              onClick={() => handlePromptReject(inv)}
                            >
                              <XCircle size={14} /> Reject
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          className="inv-mcard-btn"
                          onClick={() => handleOpenEdit(inv)}
                        >
                          <Pencil size={14} /> Edit
                        </button>

                        <button
                          type="button"
                          className="inv-mcard-btn delete"
                          onClick={() => handlePromptDelete(inv)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {!loading && !error && (
            <div className="inv-table-footer">
              <span>
                Showing {filteredInvoices.length} of {invoices.length} invoices
              </span>

              <span className="inv-table-footer-note">
                <span className="inv-footer-dot" aria-hidden="true" />
                Invoice Management System
              </span>
            </div>
          )}
        </section>
          </>
        )}
      </main>

      {/* Invoice Edit Modal */}
      {isFormOpen && editingInvoice && (
        <InvoiceForm
          isOpen
          onClose={() => setIsFormOpen(false)}
          invoiceToEdit={editingInvoice}
          onSuccess={() => {
            setIsFormOpen(false);
            loadData();
          }}
        />
      )}

      {/* Invoice Details / Print Preview Modal */}
      <InvoiceDetails
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        invoice={viewingInvoice}
        onEdit={(inv) => {
          setIsDetailsOpen(false);
          handleOpenEdit(inv);
        }}
        onRecordPayment={(inv) => {
          setIsDetailsOpen(false);
          handleOpenPaymentModal(inv);
        }}
      />

      {/* Invoice & Payment Settlement Modal */}
      {paymentInvoice && (
        <InvoicePaymentModal
          key={paymentInvoice.invoice_id}
          isOpen
          invoice={paymentInvoice}
          quotations={quotations}
          onClose={() => setPaymentInvoice(null)}
          onPaymentUpdated={loadData}
        />
      )}

      {/* Reject Modal (Super Admin) */}
      {invoiceToReject && (
        <div
          className="inv-modal-overlay"
          onClick={() => !isRejecting && setInvoiceToReject(null)}
        >
          <div
            className="inv-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="inv-modal-header">
              <div className="inv-modal-header-info">
                <h3>Reject Invoice</h3>
                <p>
                  Invoice:{" "}
                  <strong>
                    {invoiceToReject.invoice_number ||
                      `INV-${invoiceToReject.invoice_id}`}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                className="inv-modal-close"
                onClick={() => setInvoiceToReject(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="inv-modal-form">
              <div className="inv-form-field">
                <label>Rejection Reason (Optional)</label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this invoice is being rejected so the Admin can make corrections..."
                />
              </div>

              <div className="inv-modal-actions">
                <button
                  type="button"
                  className="inv-btn-secondary"
                  onClick={() => setInvoiceToReject(null)}
                  disabled={isRejecting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inv-btn-danger"
                  disabled={isRejecting}
                >
                  {isRejecting ? "Rejecting..." : "Reject Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div
          className="inv-modal-overlay"
          onClick={() => !isDeleting && setInvoiceToDelete(null)}
        >
          <div
            className="inv-modal-card confirm-delete"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="inv-delete-icon-box">
              <Trash2 size={26} color="#dc2626" />
            </div>
            <h3>Delete Invoice</h3>
            <p>
              Are you sure you want to delete invoice{" "}
              <strong>
                {invoiceToDelete.invoice_number ||
                  `INV-${invoiceToDelete.invoice_id}`}
              </strong>
              ? This action cannot be undone.
            </p>

            <div className="inv-modal-actions centered">
              <button
                type="button"
                className="inv-btn-secondary"
                onClick={() => setInvoiceToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inv-btn-danger"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
