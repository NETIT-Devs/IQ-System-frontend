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
    AlertCircle,
    Clock,
    Calendar,
    Filter,
    Menu,
    ChevronDown,
    Check,
    X,
    FileText,
    DollarSign,
    ArrowUpRight,
    TrendingUp,
} from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import NotificationBell from "../components/NotificationBell";
import InvoiceForm from "./InvoiceForm";
import InvoiceDetails from "./InvoiceDetails";
import {
    getInvoices,
    deleteInvoice,
    recordPayment,
    duplicateInvoice,
    getCustomers,
    getQuotations,
} from "../services/invoiceService";
import { getAuthenticatedUser } from "../utils/authStorage";
import "./Invoices.css";

const statusFilterOptions = [
    { label: "All Statuses", value: "All" },
    { label: "Paid", value: "Paid", color: "#16a34a" },
    { label: "Unpaid", value: "Unpaid", color: "#dc2626" },
    { label: "Partial", value: "Partial", color: "#d97706" },
    { label: "Overdue", value: "Overdue", color: "#ef4444" },
    { label: "Draft", value: "Draft", color: "#64748b" },
];

const dateRangeOptions = [
    { label: "All time", value: "all" },
    { label: "Last 7 days", value: "week" },
    { label: "Last 30 days", value: "month" },
    { label: "Last 1 year", value: "year" },
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

    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
    const statusDropdownRef = useRef(null);
    const dateDropdownRef = useRef(null);

    // Modals
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);

    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [viewingInvoice, setViewingInvoice] = useState(null);

    // Delete modal
    const [invoiceToDelete, setInvoiceToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Quick Payment Modal
    const [paymentInvoice, setPaymentInvoice] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
    const [paymentDate, setPaymentDate] = useState(
        new Date().toISOString().slice(0, 10)
    );
    const [paymentReference, setPaymentReference] = useState("");
    const [paymentNotes, setPaymentNotes] = useState("");
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const [paymentError, setPaymentError] = useState("");

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
            setInvoices(invList);
            setCustomers(custList);
            setQuotations(quoList);
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
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
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
                    inv.quotation_id,
                    inv.status,
                    inv.notes,
                ].some((val) => String(val || "").toLowerCase().includes(term));

            // Status
            let matchesStatus = true;
            if (statusFilter === "Overdue") {
                const s = String(inv.status || "").toLowerCase();
                matchesStatus =
                    s !== "paid" &&
                    s !== "cancelled" &&
                    Boolean(inv.due_date) &&
                    new Date(inv.due_date) < new Date();
            } else if (statusFilter !== "All") {
                matchesStatus =
                    String(inv.status || "").toLowerCase() === statusFilter.toLowerCase();
            }

            // Date cutoff
            let matchesDate = true;
            if (dateFilter !== "all" && inv.invoice_date) {
                const invD = new Date(
                    inv.invoice_date.includes("T")
                        ? inv.invoice_date
                        : `${inv.invoice_date}T00:00:00`
                );
                const cutoff = new Date();
                cutoff.setHours(0, 0, 0, 0);
                if (dateFilter === "week") cutoff.setDate(cutoff.getDate() - 7);
                if (dateFilter === "month") cutoff.setMonth(cutoff.getMonth() - 1);
                if (dateFilter === "year") cutoff.setFullYear(cutoff.getFullYear() - 1);

                if (!Number.isNaN(invD.getTime())) {
                    matchesDate = invD >= cutoff;
                }
            }

            return matchesSearch && matchesStatus && matchesDate;
        });
    }, [invoices, searchTerm, statusFilter, dateFilter]);

    // Statistics for 4 Cards
    const stats = useMemo(() => {
        const totalCount = invoices.length;
        let paidCount = 0;
        let paidSum = 0;
        let unpaidCount = 0;
        let unpaidSum = 0;
        let partialCount = 0;
        let partialSum = 0;

        invoices.forEach((inv) => {
            const s = String(inv.status || "").toLowerCase();
            const total = Number(inv.total_amount) || 0;
            const paid = Number(inv.amount_paid) || 0;
            const bal = Number(inv.balance_due ?? (total - paid));

            if (s === "paid") {
                paidCount++;
                paidSum += total;
            } else if (s === "partial") {
                partialCount++;
                partialSum += bal;
            } else {
                // unpaid or draft
                unpaidCount++;
                unpaidSum += bal;
            }
        });

        return {
            total: totalCount,
            paid: paidCount,
            paidSum,
            unpaid: unpaidCount,
            unpaidSum,
            partial: partialCount,
            partialSum,
        };
    }, [invoices]);

    const statCards = [
        {
            label: "Total Invoices",
            value: stats.total,
            icon: Receipt,
            color: "blue",
            note: "All active & draft records",
        },
        {
            label: "Paid Invoices",
            value: stats.paid,
            icon: CheckCircle2,
            color: "green",
            note: `${formatCurrency(stats.paidSum)} collected`,
        },
        {
            label: "Unpaid Invoices",
            value: stats.unpaid,
            icon: AlertCircle,
            color: "red",
            note: `${formatCurrency(stats.unpaidSum)} outstanding`,
        },
        {
            label: "Partial Payments",
            value: stats.partial,
            icon: Clock,
            color: "orange",
            note: `${formatCurrency(stats.partialSum)} remaining`,
        },
    ];

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

    async function handleDuplicate(inv) {
        try {
            const duplicated = await duplicateInvoice(inv.invoice_id);
            await loadData();
            // Optionally open editor for the duplicated invoice
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

    // Payment recording
    function handleOpenPaymentModal(inv) {
        setPaymentInvoice(inv);
        const balance = Number(
            inv.balance_due ?? (Number(inv.total_amount || 0) - Number(inv.amount_paid || 0))
        );
        setPaymentAmount(balance > 0 ? String(balance) : "");
        setPaymentMethod("Bank Transfer");
        setPaymentDate(new Date().toISOString().slice(0, 10));
        setPaymentReference("");
        setPaymentNotes("");
        setPaymentError("");
    }

    async function handleSavePayment(e) {
        e.preventDefault();
        if (!paymentInvoice) return;
        const amountNum = parseFloat(paymentAmount);
        if (!amountNum || amountNum <= 0) {
            setPaymentError("Please enter a valid payment amount greater than 0.");
            return;
        }

        try {
            setIsSubmittingPayment(true);
            setPaymentError("");
            await recordPayment(paymentInvoice.invoice_id, {
                amount: amountNum,
                payment_method: paymentMethod,
                payment_date: paymentDate,
                reference: paymentReference,
                notes: paymentNotes,
            });

            setPaymentInvoice(null);
            await loadData();
        } catch (err) {
            setPaymentError(err.message || "Failed to record payment.");
        } finally {
            setIsSubmittingPayment(false);
        }
    }

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
                        <span className="quotation-breadcrumb">Dashboard / Invoices</span>
                    </div>
                </div>

                <div className="quotation-header-actions">
                    <ThemeToggle />
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
                {/* Welcome / Title Row matching Quotations styling */}
                <div className="quotation-welcome-bar">
                    <div className="quotation-welcome-text">
                        <h1>Invoices</h1>
                        <p className="quotation-subtitle">
                            Create, organize, and track your business invoices.
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

                {/* 4 Summary Cards matching Quotations card size & styling */}
                <section className="quotation-stats-grid" aria-label="Invoice statistics">
                    {statCards.map(({ label, value, icon: Icon, color, note }) => (
                        <article key={label} className="quotation-stat-card">
                            <div className={`quotation-stat-icon ${color}`}>
                                <Icon size={18} strokeWidth={1.9} />
                            </div>

                            <div className="quotation-stat-content">
                                <p>{label}</p>
                                <h3>{value}</h3>
                                <span className="quotation-stat-note">{note}</span>
                            </div>
                        </article>
                    ))}
                </section>

                {/* Filter & Search Bar */}
                <section className="inv-filters-bar">
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
                                className="inv-filter-btn"
                                onClick={() => setStatusDropdownOpen((prev) => !prev)}
                            >
                                <Filter size={14} />
                                <span>Status: {statusFilter}</span>
                                <ChevronDown size={14} />
                            </button>
                            {statusDropdownOpen && (
                                <div className="inv-dropdown-menu">
                                    {statusFilterOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            className={`inv-dropdown-item ${statusFilter === opt.value ? "active" : ""
                                                }`}
                                            onClick={() => {
                                                setStatusFilter(opt.value);
                                                setStatusDropdownOpen(false);
                                            }}
                                        >
                                            <span>{opt.label}</span>
                                            {statusFilter === opt.value && <Check size={14} />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Date Range Dropdown */}
                        <div className="inv-dropdown-wrap" ref={dateDropdownRef}>
                            <button
                                type="button"
                                className="inv-filter-btn"
                                onClick={() => setDateDropdownOpen((prev) => !prev)}
                            >
                                <Calendar size={14} />
                                <span>
                                    {
                                        dateRangeOptions.find((d) => d.value === dateFilter)?.label
                                    }
                                </span>
                                <ChevronDown size={14} />
                            </button>
                            {dateDropdownOpen && (
                                <div className="inv-dropdown-menu">
                                    {dateRangeOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            className={`inv-dropdown-item ${dateFilter === opt.value ? "active" : ""
                                                }`}
                                            onClick={() => {
                                                setDateFilter(opt.value);
                                                setDateDropdownOpen(false);
                                            }}
                                        >
                                            <span>{opt.label}</span>
                                            {dateFilter === opt.value && <Check size={14} />}
                                        </button>
                                    ))}
                                </div>
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
                            {/* Desktop Table View */}
                            <div className="inv-table-responsive">
                                <table className="inv-table">
                                    <thead>
                                        <tr>
                                            <th>Invoice # &amp; Date</th>
                                            <th>Customer</th>
                                            <th>Quotation Ref</th>
                                            <th>Due Date</th>
                                            <th style={{ textAlign: "right" }}>Total Amount</th>
                                            <th style={{ textAlign: "right" }}>Balance Due</th>
                                            <th style={{ textAlign: "center" }}>Status</th>
                                            <th style={{ textAlign: "center" }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredInvoices.map((inv) => {
                                            const status = inv.status || "Draft";
                                            const invNum =
                                                inv.invoice_number || `INV-${inv.invoice_id}`;
                                            const total = Number(inv.total_amount) || 0;
                                            const paid = Number(inv.amount_paid) || 0;
                                            const bal = Number(
                                                inv.balance_due ?? (total - paid)
                                            );
                                            const isOverdue =
                                                status !== "Paid" &&
                                                inv.due_date &&
                                                new Date(inv.due_date) < new Date();

                                            return (
                                                <tr key={inv.invoice_id}>
                                                    <td>
                                                        <strong className="inv-cell-number">{invNum}</strong>
                                                        <span className="inv-cell-date">
                                                            {formatDate(inv.invoice_date)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="inv-cell-customer">
                                                            <span className="inv-cust-name">
                                                                {inv.customer_name || "—"}
                                                            </span>
                                                            {inv.company_name && (
                                                                <span className="inv-cust-company">
                                                                    {inv.company_name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {inv.quotation_id ? (
                                                            <span className="inv-quo-ref">
                                                                {inv.quotation_id}
                                                            </span>
                                                        ) : (
                                                            <span className="inv-cell-muted">Direct</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span
                                                            className={`inv-cell-due ${isOverdue ? "overdue" : ""
                                                                }`}
                                                        >
                                                            {formatDate(inv.due_date)}
                                                            {isOverdue && (
                                                                <span className="inv-overdue-pill">Overdue</span>
                                                            )}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                                                        {formatCurrency(total, inv.currency)}
                                                    </td>
                                                    <td style={{ textAlign: "right" }}>
                                                        <span
                                                            style={{
                                                                color: bal > 0 ? "#dc2626" : "#16a34a",
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            {formatCurrency(bal, inv.currency)}
                                                        </span>
                                                        {paid > 0 && bal > 0 && (
                                                            <span className="inv-paid-hint">
                                                                ({formatCurrency(paid, inv.currency)} paid)
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: "center" }}>
                                                        <span
                                                            className={`inv-badge ${status.toLowerCase()}`}
                                                        >
                                                            {status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="inv-row-actions">
                                                            {/* View / Print */}
                                                            <button
                                                                type="button"
                                                                className="inv-action-btn"
                                                                onClick={() => handleOpenView(inv)}
                                                                title="View & Print Invoice"
                                                            >
                                                                <Eye size={15} />
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

                                                            {/* Quick Payment (if not fully paid) */}
                                                            {status !== "Paid" && (
                                                                <button
                                                                    type="button"
                                                                    className="inv-action-btn pay"
                                                                    onClick={() => handleOpenPaymentModal(inv)}
                                                                    title="Record Payment"
                                                                >
                                                                    <CreditCard size={15} />
                                                                </button>
                                                            )}

                                                            {/* Copy / Duplicate */}
                                                            <button
                                                                type="button"
                                                                className="inv-action-btn"
                                                                onClick={() => handleDuplicate(inv)}
                                                                title="Duplicate Invoice"
                                                            >
                                                                <Copy size={15} />
                                                            </button>

                                                            {/* Direct Details/Download */}
                                                            <button
                                                                type="button"
                                                                className="inv-action-btn"
                                                                onClick={() => handleOpenView(inv)}
                                                                title="Download PDF"
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
                                    const status = inv.status || "Draft";
                                    const invNum = inv.invoice_number || `INV-${inv.invoice_id}`;
                                    const total = Number(inv.total_amount) || 0;
                                    const paid = Number(inv.amount_paid) || 0;
                                    const bal = Number(inv.balance_due ?? (total - paid));
                                    const isOverdue =
                                        status !== "Paid" &&
                                        status !== "Cancelled" &&
                                        Boolean(inv.due_date) &&
                                        new Date(inv.due_date) < new Date();

                                    return (
                                        <article key={inv.invoice_id} className="inv-mobile-card">
                                            <div className="inv-mcard-top">
                                                <div>
                                                    <strong className="inv-mcard-num">{invNum}</strong>
                                                    <span className="inv-mcard-date">
                                                        {formatDate(inv.invoice_date)}
                                                    </span>
                                                </div>
                                                <span className={`inv-badge ${status.toLowerCase()}`}>
                                                    {status}
                                                </span>
                                            </div>

                                            <div className="inv-mcard-body">
                                                <div className="inv-mcard-row">
                                                    <span className="inv-mcard-lbl">Customer:</span>
                                                    <span className="inv-mcard-val">
                                                        {inv.customer_name || "—"}
                                                    </span>
                                                </div>
                                                {inv.quotation_id && (
                                                    <div className="inv-mcard-row">
                                                        <span className="inv-mcard-lbl">Quotation:</span>
                                                        <span className="inv-mcard-val">
                                                            {inv.quotation_id}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="inv-mcard-row">
                                                    <span className="inv-mcard-lbl">Due Date:</span>
                                                    <span className={`inv-mcard-val ${isOverdue ? "overdue" : ""}`}>
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
                                                    <span className="inv-mcard-lbl">Balance Due:</span>
                                                    <span
                                                        className="inv-mcard-val bold"
                                                        style={{ color: bal > 0 ? "#dc2626" : "#16a34a" }}
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
                                                <button
                                                    type="button"
                                                    className="inv-mcard-btn"
                                                    onClick={() => handleOpenEdit(inv)}
                                                >
                                                    <Pencil size={14} /> Edit
                                                </button>
                                                {status !== "Paid" && (
                                                    <button
                                                        type="button"
                                                        className="inv-mcard-btn pay"
                                                        onClick={() => handleOpenPaymentModal(inv)}
                                                    >
                                                        <CreditCard size={14} /> Pay
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    className="inv-mcard-btn"
                                                    onClick={() => handleDuplicate(inv)}
                                                >
                                                    <Copy size={14} /> Copy
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
                </section>
            </main>

            {/* Invoice Create / Edit Modal (9 Step Workflow) */}
            <InvoiceForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                invoiceToEdit={editingInvoice}
                onSuccess={() => {
                    setIsFormOpen(false);
                    loadData();
                }}
            />

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

            {/* Quick Record Payment Modal */}
            {paymentInvoice && (
                <div
                    className="inv-modal-overlay"
                    onClick={() => !isSubmittingPayment && setPaymentInvoice(null)}
                >
                    <div
                        className="inv-modal-card"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                    >
                        <div className="inv-modal-header">
                            <div className="inv-modal-header-info">
                                <h3>Record Payment</h3>
                                <p>
                                    Invoice:{" "}
                                    <strong>
                                        {paymentInvoice.invoice_number ||
                                            `INV-${paymentInvoice.invoice_id}`}
                                    </strong>{" "}
                                    — {paymentInvoice.customer_name}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="inv-modal-close"
                                onClick={() => setPaymentInvoice(null)}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSavePayment} className="inv-modal-form">
                            {paymentError && (
                                <div className="inv-form-error-banner">
                                    <AlertCircle size={15} />
                                    <span>{paymentError}</span>
                                </div>
                            )}

                            <div className="inv-pay-balance-info">
                                <div>
                                    <span>Total Amount:</span>
                                    <strong>
                                        {formatCurrency(
                                            paymentInvoice.total_amount,
                                            paymentInvoice.currency
                                        )}
                                    </strong>
                                </div>
                                <div>
                                    <span>Current Balance Due:</span>
                                    <strong style={{ color: "#dc2626" }}>
                                        {formatCurrency(
                                            paymentInvoice.balance_due ??
                                            paymentInvoice.total_amount -
                                            (paymentInvoice.amount_paid || 0),
                                            paymentInvoice.currency
                                        )}
                                    </strong>
                                </div>
                            </div>

                            <div className="inv-form-field">
                                <label>
                                    Payment Amount ({paymentInvoice.currency || "LKR"}) *
                                </label>
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    placeholder="0.00"
                                    required
                                />
                            </div>

                            <div className="inv-form-grid-2">
                                <div className="inv-form-field">
                                    <label>Payment Method</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                    >
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Credit Card">Credit Card</option>
                                        <option value="Cheque">Cheque</option>
                                        <option value="Online Gateway">Online Gateway</option>
                                    </select>
                                </div>

                                <div className="inv-form-field">
                                    <label>Payment Date</label>
                                    <input
                                        type="date"
                                        value={paymentDate}
                                        onChange={(e) => setPaymentDate(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="inv-form-field">
                                <label>Reference / Cheque #</label>
                                <input
                                    type="text"
                                    value={paymentReference}
                                    onChange={(e) => setPaymentReference(e.target.value)}
                                    placeholder="e.g. TXN-984392 / CHQ-00234"
                                />
                            </div>

                            <div className="inv-form-field">
                                <label>Payment Notes (Optional)</label>
                                <input
                                    type="text"
                                    value={paymentNotes}
                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                    placeholder="Notes or receipts summary"
                                />
                            </div>

                            <div className="inv-modal-actions">
                                <button
                                    type="button"
                                    className="inv-btn-secondary"
                                    onClick={() => setPaymentInvoice(null)}
                                    disabled={isSubmittingPayment}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="inv-btn-primary"
                                    disabled={isSubmittingPayment}
                                >
                                    {isSubmittingPayment ? "Recording..." : "Save Payment"}
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

