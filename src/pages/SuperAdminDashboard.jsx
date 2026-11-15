
import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Calendar,
  Users,
  FileText,
  Receipt,
  BarChart3,
  Search,
  Bell,
  Menu,
  X,
  Eye,
  FileCheck,
  Building2,
  Activity,
  ChevronRight,
  Wallet,
  TrendingUp,
  CheckCircle2,
  Clock,
} from "lucide-react";
import NotificationBell from "../components/NotificationBell";
import ThemeToggle from "../components/ThemeToggle";
import OverviewPeriodFilter from "../components/OverviewPeriodFilter";
import { getQuotations, getCustomers } from "../services/quotationService";
import { getInvoices } from "../services/invoiceService";
import { getPayments } from "../services/paymentService";
import { filterByOverviewPeriod } from "../utils/formatters";
import "./SuperAdminDashboard.css";

const BUILT_PATHS = new Set([
  "/super-admin-dashboard",
  "/quotations",
  "/reports",
  "/super-admin/approvals",
  "/super-admin/audit-logs",
  "/super-admin/settings",
  "/settings",
  "/company-settings",
  "/super-admin/users",
  "/super-admin/customers",
  "/customers",
  "/super-admin/invoices",
  "/notifications",
]);

// Searchable dashboard items and pages by name
const dashboardSearchItems = [
  {
    name: "Dashboard / Overview",
    label: "Dashboard",
    description: "Business summary, financial metrics and analytics",
    icon: BarChart3,
    path: "/super-admin-dashboard",
    keywords: ["dashboard", "overview", "home", "main"],
  },
  {
    name: "Customers",
    label: "Customers",
    description: "Manage registered customers directory",
    icon: Users,
    path: "/super-admin/customers",
    keywords: ["customer", "customers", "client", "clients", "directory"],
  },
  {
    name: "Quotations",
    label: "Quotations",
    description: "Create, view and manage price quotations",
    icon: FileText,
    path: "/quotations",
    keywords: ["quotation", "quotations", "quote", "proposals", "pricing"],
  },
  {
    name: "Review Approvals",
    label: "Review Approvals",
    description: "Review pending submissions and quotations",
    icon: Eye,
    path: "/super-admin/approvals",
    keywords: ["approval", "approvals", "pending", "review"],
  },
  {
    name: "User Management",
    label: "User Management",
    description: "Manage administrators and staff user accounts",
    icon: Users,
    path: "/super-admin/users",
    keywords: ["user", "users", "staff", "admin", "management", "roles"],
  },
  {
    name: "Company Settings",
    label: "Company Settings",
    description: "Company profile, logo, signature and catalog",
    icon: Building2,
    path: "/super-admin/settings",
    keywords: ["company", "settings", "profile", "logo", "signature", "catalog"],
  },
  {
    name: "Reports & Analytics",
    label: "Reports & Analytics",
    description: "Financial performance, revenue and quotation metrics",
    icon: BarChart3,
    path: "/reports",
    keywords: ["report", "reports", "analytics", "revenue", "financial"],
  },
  {
    name: "Audit Logs",
    label: "Audit Logs",
    description: "System security events and activity logs",
    icon: Activity,
    path: "/super-admin/audit-logs",
    keywords: ["audit", "logs", "activity", "security", "events"],
  },
  {
    name: "Invoices",
    label: "Invoices",
    description: "Track customer invoices and payment balances",
    icon: Receipt,
    path: "/super-admin/invoices",
    keywords: ["invoice", "invoices", "billing", "payment", "payments"],
  },
];

// Quick links to commonly used administration pages.
const quickLinks = [
  {
    label: "Approvals",
    description: "Review pending submissions",
    icon: Eye,
    path: "/super-admin/approvals",
  },
  {
    label: "Company Settings",
    description: "Company and bank information",
    icon: Building2,
    path: "/super-admin/settings",
  },
  {
    label: "Reports & Analytics",
    description: "Review financial reports",
    icon: BarChart3,
    path: "/reports",
  },
  {
    label: "Audit Logs",
    description: "Review system activities",
    icon: Activity,
    path: "/super-admin/audit-logs",
  },
];

// Render an individual summary card.
function StatCard({ item }) {
  const Icon = item.icon;

  return (
    <article className="sa-stat-card">
      <div className={`sa-stat-icon ${item.color}`}>
        <Icon size={18} strokeWidth={1.9} />
      </div>

      <div className="sa-stat-content">
        <p>{item.title}</p>
        <h3>{item.value}</h3>
      </div>
    </article>
  );
}

// Render a chart panel with an empty-data state.
function ChartEmptyState({ icon: Icon, title, description }) {
  return (
    <div className="sa-chart-empty">
      <div className="sa-chart-empty-icon">
        <Icon size={23} strokeWidth={1.6} />
      </div>
      <p>{title}</p>
      <span>{description}</span>
    </div>
  );
}

// Render the financial overview chart from live invoice data.
function FinancialChart({ invoices = [] }) {
  const monthlyData = useMemo(() => {
    const buckets = new Map();
    invoices.forEach((inv) => {
      const s = String(inv?.status || "").trim().toLowerCase();
      if (s === "cancelled" || s === "rejected") return;
      const rawDate = inv?.invoice_date || inv?.created_at;
      if (!rawDate) return;
      const d = new Date(String(rawDate).includes("T") ? rawDate : `${rawDate}T00:00:00`);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short" });
      if (!buckets.has(key)) {
        buckets.set(key, { key, label, collected: 0, outstanding: 0 });
      }
      const b = buckets.get(key);
      const total = Number(inv.total_amount) || 0;
      const paid = Math.max(0, Number(inv.amount_paid) || 0);
      const bal = Math.max(0, Number(inv.balance_due ?? total - paid));
      b.collected += paid;
      b.outstanding += bal;
    });
    return Array.from(buckets.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6);
  }, [invoices]);

  const maxVal = useMemo(() => {
    const peak = monthlyData.reduce(
      (m, item) => Math.max(m, item.collected, item.outstanding),
      0
    );
    return peak > 0 ? peak : 100;
  }, [monthlyData]);

  const formatAxis = (val) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${Math.round(val / 1_000)}K`;
    return String(Math.round(val));
  };

  const hasData = monthlyData.some((m) => m.collected > 0 || m.outstanding > 0);

  return (
    <section className="sa-panel">
      <div className="sa-panel-heading">
        <div className="sa-panel-title">
          <div className="sa-panel-icon blue">
            <TrendingUp size={20} />
          </div>
          <div>
            <h2>Financial Overview</h2>
            <p>Collected vs. outstanding</p>
          </div>
        </div>

        <span className="sa-neutral-badge">Overview</span>
      </div>

      <div className="sa-chart-legend">
        <span>
          <i className="sa-legend-income" />
          Collected
        </span>
        <span>
          <i className="sa-legend-expenses" />
          Outstanding
        </span>
      </div>

      <div className="sa-bar-chart">
        <div className="sa-chart-y-axis">
          <span>{formatAxis(maxVal)}</span>
          <span>{formatAxis(maxVal * 0.75)}</span>
          <span>{formatAxis(maxVal * 0.5)}</span>
          <span>{formatAxis(maxVal * 0.25)}</span>
          <span>0</span>
        </div>

        <div className="sa-chart-plot">
          {[0, 1, 2, 3, 4].map((line) => (
            <div className="sa-chart-grid-line" key={line} />
          ))}

          {hasData && (
            <div className="sa-chart-bars-layer">
              {monthlyData.map((m) => {
                const colH = Math.max(m.collected > 0 ? 4 : 0, (m.collected / maxVal) * 100);
                const outH = Math.max(m.outstanding > 0 ? 4 : 0, (m.outstanding / maxVal) * 100);
                return (
                  <div className="sa-chart-bar-group" key={m.key}>
                    <div className="sa-chart-bars-pair">
                      <div
                        className="sa-chart-bar income"
                        style={{ height: `${colH}%` }}
                        title={`Collected: Rs. ${m.collected.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`}
                      />
                      <div
                        className="sa-chart-bar expense"
                        style={{ height: `${outH}%` }}
                        title={`Outstanding: Rs. ${m.outstanding.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`}
                      />
                    </div>
                    <span className="sa-chart-bar-label">{m.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="sa-chart-zero-line">
            <span>0</span>
          </div>
        </div>
      </div>

      {!hasData && (
        <ChartEmptyState
          icon={BarChart3}
          title="No financial data available"
          description="Income and outstanding bars will appear when invoices are recorded."
        />
      )}
    </section>
  );
}

// Render the invoice status chart from live invoice records.
function InvoiceStatusChart({ invoices = [] }) {
  const counts = useMemo(() => {
    const c = { paid: 0, unpaid: 0, overdue: 0, partial: 0 };
    const today = new Date().toISOString().slice(0, 10);

    invoices.forEach((inv) => {
      const s = String(inv?.payment_status || inv?.status || "")
        .trim()
        .toLowerCase();
      if (s === "draft" || s === "cancelled" || s === "rejected") return;

      const totalAmt = Number(inv?.total_amount) || 0;
      const paidAmt = Math.max(0, Number(inv?.amount_paid) || 0);
      const balAmt = Math.max(0, Number(inv?.balance_due ?? totalAmt - paidAmt));
      const dueStr = inv?.due_date ? String(inv.due_date).slice(0, 10) : "";

      if (s.includes("partial") || (paidAmt > 0 && balAmt > 0)) {
        c.partial += 1;
      } else if (s.includes("paid") && !s.includes("unpaid")) {
        c.paid += 1;
      } else if (s.includes("overdue") || (dueStr && dueStr < today && balAmt > 0)) {
        c.overdue += 1;
      } else {
        c.unpaid += 1;
      }
    });

    return c;
  }, [invoices]);

  const total = counts.paid + counts.unpaid + counts.overdue + counts.partial;
  const invoiceStatuses = [
    { label: "Paid", value: counts.paid, color: "paid", hex: "#199b69" },
    { label: "Unpaid", value: counts.unpaid, color: "unpaid", hex: "#3478f6" },
    { label: "Overdue", value: counts.overdue, color: "overdue", hex: "#df5454" },
    { label: "Partially Paid", value: counts.partial, color: "partial", hex: "#e4a72e" },
  ];

  const paidEnd = total ? (counts.paid / total) * 100 : 0;
  const unpaidEnd = paidEnd + (total ? (counts.unpaid / total) * 100 : 0);
  const overdueEnd = unpaidEnd + (total ? (counts.overdue / total) * 100 : 0);

  const donutStyle = total
    ? {
        background: `conic-gradient(
          #199b69 0% ${paidEnd}%,
          #3478f6 ${paidEnd}% ${unpaidEnd}%,
          #df5454 ${unpaidEnd}% ${overdueEnd}%,
          #e4a72e ${overdueEnd}% 100%
        )`,
      }
    : undefined;

  return (
    <section className="sa-panel">
      <div className="sa-panel-heading">
        <div className="sa-panel-title">
          <div className="sa-panel-icon purple">
            <Receipt size={20} />
          </div>
          <div>
            <h2>Invoice Status</h2>
            <p>Invoice distribution by payment status</p>
          </div>
        </div>

        <span className="sa-neutral-badge">Overview</span>
      </div>

      <div className="sa-donut-layout">
        <div className="sa-donut" style={donutStyle}>
          <div className="sa-donut-center">
            <strong>{total}</strong>
            <span>Total invoices</span>
          </div>
        </div>

        <div className="sa-status-legend">
          {invoiceStatuses.map((status) => (
            <div className="sa-status-legend-item" key={status.label}>
              <span className={`sa-status-dot ${status.color}`} />
              <span className="sa-status-label">{status.label}</span>
              <strong>{status.value}</strong>
            </div>
          ))}
        </div>
      </div>

      <p className="sa-chart-footnote">
        {total > 0
          ? "Live invoice distribution calculated from active database records."
          : "The chart will reflect actual invoice statuses after integration."}
      </p>
    </section>
  );
}

// Render an empty state for sections without records.
function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="sa-empty-state">
      <div className="sa-empty-icon">
        <Icon size={23} strokeWidth={1.6} />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function getInvoicePaymentStatus(inv) {
  const s = String(inv?.status || "").trim().toLowerCase();
  if (s === "draft") return "Draft";
  if (s === "pending approval" || inv?.approval_status === "Pending") return "Pending Approval";
  if (s === "rejected" || inv?.approval_status === "Rejected") return "Rejected";
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

function getInvoiceStatusBadge(inv) {
  const s = String(inv?.status || "").trim().toLowerCase();
  const a = String(inv?.approval_status || "").trim().toLowerCase();

  if (a === "pending" || s === "pending approval") {
    return { label: "Pending Approval", className: "pending" };
  }
  if (a === "rejected" || s === "rejected") {
    return { label: "Rejected", className: "unpaid" };
  }
  if (s === "draft") {
    return { label: "Draft", className: "draft" };
  }
  if (s === "cancelled") {
    return { label: "Cancelled", className: "draft" };
  }

  const payStatus = getInvoicePaymentStatus(inv);
  if (payStatus === "Paid") return { label: "Paid", className: "paid" };
  if (payStatus === "Overdue") return { label: "Overdue", className: "overdue" };
  if (payStatus === "Partially Paid") return { label: "Partially Paid", className: "partial" };
  return { label: "Unpaid", className: "unpaid" };
}


// Main Super Admin Dashboard component.
export default function SuperAdminDashboard() {
  const { openSidebar } = useOutletContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [quotations, setQuotations] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [dateRange, setDateRange] = useState({
    period: "all",
    startDate: "",
    endDate: "",
  });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
        setMobileSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const matchingDashboardItems = useMemo(() => {
    if (!search.trim()) return [];
    const query = search.trim().toLowerCase();
    return dashboardSearchItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.label.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.keywords?.some((k) => k.toLowerCase().includes(query))
    );
  }, [search]);

  const filteredQuickLinks = useMemo(() => {
    if (!search.trim()) return quickLinks;
    const query = search.trim().toLowerCase();
    return quickLinks.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
    );
  }, [search]);

  function handleSearchSubmit(e) {
    if (e) e.preventDefault();
    if (matchingDashboardItems.length > 0) {
      navigate(matchingDashboardItems[0].path);
      setSearch("");
      setIsSearchOpen(false);
      setMobileSearchOpen(false);
    }
  }

  function navigateTo(path) {
    navigate(path);
  }

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [records, custList, invList, payList] = await Promise.all([
          getQuotations(),
          getCustomers(),
          getInvoices().catch(() => []),
          getPayments({ approval_queue: true }).catch(() => []),
        ]);
        if (isMounted) {
          setQuotations(Array.isArray(records) ? records : []);
          setCustomers(Array.isArray(custList) ? custList : []);
          setInvoices(Array.isArray(invList) ? invList : []);
          const pendingPay = (Array.isArray(payList) ? payList : []).filter(
            (p) => {
              const s = String(p?.status || "").trim().toLowerCase();
              return s.includes("pending");
            }
          ).length;
          setPendingPaymentsCount(pendingPay);
        }
      } catch (err) {
        console.warn("Failed to load dashboard data:", err);
      }
    }
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener("iq-notifications-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    const timer = setInterval(loadData, 10000);

    return () => {
      isMounted = false;
      clearInterval(timer);
      window.removeEventListener("iq-notifications-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const filteredCustomers = useMemo(
    () =>
      filterByOverviewPeriod(
        customers,
        dateRange,
        (c) => c?.created_at || c?.updated_at
      ),
    [customers, dateRange]
  );

  const filteredQuotations = useMemo(
    () =>
      filterByOverviewPeriod(
        quotations,
        dateRange,
        (q) => q?.quotation_date || q?.issuedDate || q?.created_at
      ),
    [quotations, dateRange]
  );

  const filteredInvoices = useMemo(
    () =>
      filterByOverviewPeriod(
        invoices,
        dateRange,
        (inv) => inv?.invoice_date || inv?.created_at
      ),
    [invoices, dateRange]
  );

  const recentInvoices = useMemo(() => {
    const list = Array.isArray(filteredInvoices) ? filteredInvoices : [];
    return [...list]
      .sort((a, b) => {
        const dateA = new Date(a.invoice_date || a.created_at || 0).getTime();
        const dateB = new Date(b.invoice_date || b.created_at || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return (Number(b.invoice_id || b.id) || 0) - (Number(a.invoice_id || a.id) || 0);
      })
      .slice(0, 5);
  }, [filteredInvoices]);

  const invoicePaymentSummary = useMemo(() => {
    const summary = { paid: 0, unpaid: 0, partiallyPaid: 0, overdue: 0 };
    const list = Array.isArray(filteredInvoices) ? filteredInvoices : [];

    list.forEach((inv) => {
      const status = getInvoicePaymentStatus(inv);
      if (status === "Paid") summary.paid += 1;
      else if (status === "Unpaid") summary.unpaid += 1;
      else if (status === "Partially Paid") summary.partiallyPaid += 1;
      else if (status === "Overdue") summary.overdue += 1;
    });

    return summary;
  }, [filteredInvoices]);

  const pendingQuotationsCount = useMemo(() => {
    return quotations.filter((q) => {
      const s = String(q.status || "").trim().toLowerCase();
      const a = String(q.approval_status || "").trim().toLowerCase();
      const role = String(q.created_by_role || q.creator_role || "").trim().toLowerCase();
      const name = String(q.created_by_name || "").trim().toLowerCase();
      if (role.includes("super") || name.includes("super admin") || q.created_by === 2) {
        return false;
      }
      if (a === "approved" || s.includes("approv") || s.includes("accept")) return false;
      if (a === "rejected" || s.includes("reject") || s.includes("declin")) return false;
      if (s === "draft" && a !== "pending") return false;
      return a === "pending" || s.includes("pending") || s === "sent";
    }).length;
  }, [quotations]);

  const pendingInvoicesCount = useMemo(() => {
    return invoices.filter((inv) => {
      const s = String(inv.status || inv.payment_status || "").trim().toLowerCase();
      const a = String(inv.approval_status || "").trim().toLowerCase();
      const role = String(inv.created_by_role || inv.creator_role || "").trim().toLowerCase();
      const name = String(inv.created_by_name || "").trim().toLowerCase();
      if (role.includes("super") || name.includes("super admin") || inv.created_by === 2) {
        return false;
      }
      if (s === "draft" && a !== "pending") return false;
      if (a === "rejected" || s.includes("reject") || s.includes("declin")) return false;
      if (a === "pending" || s.includes("pending")) return true;
      return false;
    }).length;
  }, [invoices]);

  const totalPendingApprovals =
    pendingQuotationsCount + pendingInvoicesCount + pendingPaymentsCount;
  const pendingApprovalsCount = totalPendingApprovals;


  const quotationDistribution = useMemo(() => {
    const counts = { draft: 0, pending: 0, approved: 0, rejected: 0 };
    const list = Array.isArray(filteredQuotations) ? filteredQuotations : [];

    list.forEach((q) => {
      const approval = String(q.approval_status || "").trim().toLowerCase();
      const rawStatus = String(q.status || "").trim().toLowerCase();
      const custStatus = String(q.customer_status || "").trim().toLowerCase();
      const role = String(q.created_by_role || "").trim().toLowerCase();
      const isSuperCreator = role === "super_admin" || role === "super admin";

      if (
        approval === "rejected" ||
        rawStatus === "rejected" ||
        rawStatus === "declined" ||
        custStatus === "customer rejected"
      ) {
        counts.rejected += 1;
      } else if (rawStatus === "draft") {
        counts.draft += 1;
      } else if (
        approval === "pending" ||
        rawStatus.includes("pending") ||
        rawStatus === "sent"
      ) {
        counts.pending += 1;
      } else if (
        approval === "approved" ||
        rawStatus === "approved" ||
        rawStatus === "accepted" ||
        custStatus === "customer accepted" ||
        isSuperCreator
      ) {
        counts.approved += 1;
      } else {
        counts.draft += 1;
      }
    });

    const total = list.length;
    const pct = (val) => (total > 0 ? Math.round((val / total) * 100) : 0);

    return {
      total,
      draft: { count: counts.draft, pct: pct(counts.draft) },
      pending: { count: counts.pending, pct: pct(counts.pending) },
      approved: { count: counts.approved, pct: pct(counts.approved) },
      rejected: { count: counts.rejected, pct: pct(counts.rejected) },
    };
  }, [filteredQuotations]);

  const outstandingBalance = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => {
      const s = String(inv?.status || "").trim().toLowerCase();
      if (s === "draft" || s === "cancelled" || s === "rejected") return sum;
      const total = Number(inv?.total_amount) || 0;
      const paid = Math.max(0, Number(inv?.amount_paid) || 0);
      const bal = Math.max(0, Number(inv?.balance_due ?? total - paid));
      return sum + bal;
    }, 0);
  }, [filteredInvoices]);

  const dynamicStats = [
    {
      title: "Total Customers",
      value: String(filteredCustomers.length),
      description: "Registered customers",
      icon: Users,
      color: "blue",
    },
    {
      title: "Total Quotations",
      value: String(filteredQuotations.length),
      description: "All quotations",
      icon: FileText,
      color: "purple",
    },
    {
      title: "Total Invoices",
      value: String(filteredInvoices.length),
      description: "All invoices",
      icon: Receipt,
      color: "cyan",
    },
    {
      title: "Outstanding Balance",
      value: `Rs. ${outstandingBalance.toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      description: "Remaining unpaid amount",
      icon: Wallet,
      color: "orange",
    },
  ];

  return (
    <>
      {/* Top bar with reduced height */}
      <header className="sa-topbar">
        <div className="sa-topbar-left">
          <button
            type="button"
            className="sa-menu-button"
            aria-label="Open navigation menu"
            onClick={openSidebar}
          >
            <Menu size={20} />
          </button>
          <p className="sa-breadcrumb">
            <span className="sa-breadcrumb-full">Dashboard / Overview</span>
            <span className="sa-breadcrumb-short">Overview</span>
          </p>
        </div>

        <div className="sa-header-actions">
          {/* Search bar */}
          <div
            className={`sa-search-container ${mobileSearchOpen ? "mobile-open" : ""}`}
            ref={searchRef}
          >
            <form
              className="sa-search-box"
              onSubmit={handleSearchSubmit}
              onClick={() => {
                if (!mobileSearchOpen) {
                  setMobileSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }
              }}
            >
              <button
                type="button"
                className="sa-search-btn"
                title="Search dashboard"
                aria-label="Search dashboard"
                onClick={(e) => {
                  if (!mobileSearchOpen) {
                    e.preventDefault();
                    setMobileSearchOpen(true);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                    return;
                  }
                  handleSearchSubmit(e);
                }}
              >
                <Search size={16} />
              </button>
              <input
                ref={searchInputRef}
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => {
                  setMobileSearchOpen(true);
                  if (search.trim()) setIsSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearchSubmit(e);
                  }
                  if (e.key === "Escape") {
                    setIsSearchOpen(false);
                    setMobileSearchOpen(false);
                  }
                }}
                placeholder="Search dashboard..."
                aria-label="Search dashboard"
              />
              {(Boolean(search) || mobileSearchOpen) && (
                <button
                  type="button"
                  className="sa-clear-search"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearch("");
                    setIsSearchOpen(false);
                    setMobileSearchOpen(false);
                  }}
                  aria-label="Close search"
                  title="Close search"
                >
                  <X size={14} />
                </button>
              )}
            </form>

            {/* Live search results dropdown: only dashboard items */}
            {isSearchOpen && search.trim() && (
              <div className="sa-search-dropdown">
                <div className="sa-search-group-title">Dashboard Pages &amp; Modules</div>
                {matchingDashboardItems.length > 0 ? (
                  matchingDashboardItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        type="button"
                        key={item.path}
                        className="sa-search-result-item"
                        onClick={() => {
                          navigateTo(item.path);
                          setSearch("");
                          setIsSearchOpen(false);
                          setMobileSearchOpen(false);
                        }}
                      >
                        <div className="sa-search-result-icon">
                          <Icon size={16} />
                        </div>
                        <div className="sa-search-result-info">
                          <strong>{item.name}</strong>
                          <span>{item.description}</span>
                        </div>
                        <ChevronRight size={14} className="sa-search-result-arrow" />
                      </button>
                    );
                  })
                ) : (
                  <div className="sa-search-no-results">
                    <Search size={20} color="#94a3b8" />
                    <p>No dashboard pages found matching &ldquo;{search}&rdquo;</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notification icon */}
          <ThemeToggle />
          <NotificationBell filter="all" />

          {/* Date badge */}
          <span className="sa-header-date" title="Today's Date">
            <span className="sa-date-full">
              {new Intl.DateTimeFormat("en-US", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date())}
            </span>
            <span className="sa-date-short">
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
              }).format(new Date())}
            </span>
          </span>

          {/* Profile circle icon for Super Admin */}
          <div className="sa-header-profile" title="Super Admin">
            <span className="sa-profile-avatar" aria-label="Super Admin profile">SA</span>
          </div>
        </div>
      </header>

      <div className="sa-dashboard-content">
        {/* Welcome bar: Title on left, Overview Period Filter on right */}
        <div className="sa-welcome-bar">
          <div className="sa-welcome-text">
            <h1>
              Welcome to Super Admin Dashboard <span className="sa-wave-hand" role="img" aria-label="wave">👋</span>
            </h1>
            <p className="sa-subtitle">
              Monitor your business operations and financial performance.
            </p>
          </div>

          <div className="sa-welcome-actions">
            <OverviewPeriodFilter value={dateRange} onChange={setDateRange} />
            <button
              type="button"
              className="sa-review-approvals-btn"
              onClick={() => navigate("/super-admin/approvals")}
              title="Review Approvals"
            >
              <span>Review Approvals</span>
              {totalPendingApprovals > 0 && (
                <span className="sa-review-approvals-badge">
                  {totalPendingApprovals}
                </span>
              )}
            </button>
          </div>
        </div>
        {/* Summary cards */}
        <section className="sa-stats-grid" aria-label="Business summary">
          {dynamicStats.map((item) => (
            <StatCard key={item.title} item={item} />
          ))}
        </section>

        {/* Financial and invoice charts */}
        <section className="sa-charts-grid">
          <FinancialChart invoices={filteredInvoices} />
          <InvoiceStatusChart invoices={filteredInvoices} />
        </section>

        {/* Approval queue and quick access */}
        <section className="sa-lower-grid">
          <div className="sa-panel sa-approval-panel">
            <div className="sa-panel-heading">
              <div>
                <h2>Approval Queue</h2>
                <p>Invoices and quotations awaiting your review</p>
              </div>

              <span className="sa-neutral-badge">
                {pendingApprovalsCount} Pending
              </span>
            </div>

            <div className="sa-approval-items">
              <div className="sa-approval-item">
                <div className="sa-panel-icon blue">
                  <Receipt size={20} />
                </div>
                <div className="sa-approval-item-text">
                  <strong>Invoices</strong>
                  <span>Waiting for approval</span>
                </div>
                <strong className="sa-approval-count">
                  {pendingInvoicesCount}
                </strong>
              </div>

              <div className="sa-approval-item">
                <div className="sa-panel-icon purple">
                  <FileText size={20} />
                </div>
                <div className="sa-approval-item-text">
                  <strong>Quotations</strong>
                  <span>Waiting for approval</span>
                </div>
                <strong className="sa-approval-count">
                  {pendingQuotationsCount}
                </strong>
              </div>
            </div>

            {totalPendingApprovals > 0 ? (
              <div
                className="sa-approval-message"
                style={{ color: "#b45309", background: "#fef3c7" }}
              >
                <Clock size={17} />
                <span>
                  {totalPendingApprovals} submission(s) ({pendingQuotationsCount} quotation{pendingQuotationsCount === 1 ? "" : "s"}, {pendingInvoicesCount} invoice{pendingInvoicesCount === 1 ? "" : "s"}) waiting for your review.
                </span>
              </div>
            ) : (
              <div className="sa-approval-message">
                <CheckCircle2 size={17} />
                <span>No pending approvals to display.</span>
              </div>
            )}

            <button
              type="button"
              className="sa-secondary-button sa-full-button"
              onClick={() => navigate("/super-admin/approvals")}
              title="View Approval Queue"
            >
              View Approval Queue
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="sa-panel">
            <div className="sa-panel-heading">
              <div>
                <h2>Quick Access</h2>
                <p>Frequently used administration pages</p>
              </div>
            </div>

            <div className="sa-quick-links">
              {filteredQuickLinks.map((item) => {
                const Icon = item.icon;
                const isBuilt = BUILT_PATHS.has(item.path);

                return (
                  <button
                    type="button"
                    key={item.path}
                    className="sa-quick-link"
                    onClick={() => navigateTo(item.path)}
                    style={!isBuilt ? { cursor: "default", opacity: 0.65 } : {}}
                    title={!isBuilt ? "Not available yet" : undefined}
                  >
                    <span className="sa-quick-icon">
                      <Icon size={19} />
                    </span>

                    <span className="sa-quick-text">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>

                    <ChevronRight size={17} className="sa-quick-arrow" />
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Recent invoice and system activity sections */}
        <section className="sa-recent-grid">
          <div className="sa-panel">
            <div className="sa-panel-heading">
              <div>
                <h2>Recent Invoices</h2>
                <p>Latest invoice records</p>
              </div>

              <button
                type="button"
                className="sa-text-button"
                onClick={() => navigateTo("/super-admin/invoices")}
                title="View all invoices"
              >
                View All <ChevronRight size={15} />
              </button>
            </div>

            <div className="sa-table-wrapper">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="sa-empty-table-cell">
                        <EmptyState
                          icon={FileCheck}
                          title="No invoices available"
                          description="Invoice records will appear here when available."
                        />
                      </td>
                    </tr>
                  ) : (
                    recentInvoices.map((inv) => {
                      const invId = inv.invoice_id || inv.id;
                      const invNumber =
                        inv.invoice_number ||
                        `INV-${String(invId || "").padStart(4, "0")}`;
                      const customerName =
                        inv.customer_name ||
                        inv.company_name ||
                        inv.customer_company ||
                        "—";
                      const amount = Number(inv.total_amount) || 0;
                      const statusInfo = getInvoiceStatusBadge(inv);

                      return (
                        <tr
                          key={invId || invNumber}
                          onClick={() => navigateTo("/super-admin/invoices")}
                          className="sa-clickable-row"
                        >
                          <td className="sa-table-cell-bold">
                            {invNumber}
                          </td>
                          <td>{customerName}</td>
                          <td className="sa-table-cell-amount">
                            Rs.{" "}
                            {amount.toLocaleString("en-LK", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td>
                            <span
                              className={`sa-invoice-badge ${statusInfo.className}`}
                            >
                              <span className="sa-badge-dot" />
                              {statusInfo.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="sa-panel sa-quotation-performance-panel">
            <div className="sa-panel-heading">
              <div>
                <h2>Quotation Performance</h2>
                <p>Quotation status distribution</p>
              </div>

              <button
                type="button"
                className="sa-text-button"
                onClick={() => navigateTo("/quotations")}
                title="View Quotations"
              >
                View Quotations <ChevronRight size={15} />
              </button>
            </div>

            <div className="sa-qp-content">
              {/* Segmented Distribution Bar */}
              <div className="sa-qp-bar-container">
                <div className="sa-qp-bar-header">
                  <span className="sa-qp-bar-title">Overall Distribution</span>
                  <span className="sa-qp-bar-total">
                    Total: <strong>{quotationDistribution.total}</strong>
                  </span>
                </div>
                <div className="sa-qp-progress-bar">
                  {quotationDistribution.total === 0 ? (
                    <div className="sa-qp-segment empty" style={{ width: "100%" }} />
                  ) : (
                    <>
                      {quotationDistribution.approved.pct > 0 && (
                        <div
                          className="sa-qp-segment approved"
                          style={{ width: `${quotationDistribution.approved.pct}%` }}
                          title={`Approved: ${quotationDistribution.approved.count} (${quotationDistribution.approved.pct}%)`}
                        />
                      )}
                      {quotationDistribution.pending.pct > 0 && (
                        <div
                          className="sa-qp-segment pending"
                          style={{ width: `${quotationDistribution.pending.pct}%` }}
                          title={`Pending: ${quotationDistribution.pending.count} (${quotationDistribution.pending.pct}%)`}
                        />
                      )}
                      {quotationDistribution.draft.pct > 0 && (
                        <div
                          className="sa-qp-segment draft"
                          style={{ width: `${quotationDistribution.draft.pct}%` }}
                          title={`Draft: ${quotationDistribution.draft.count} (${quotationDistribution.draft.pct}%)`}
                        />
                      )}
                      {quotationDistribution.rejected.pct > 0 && (
                        <div
                          className="sa-qp-segment rejected"
                          style={{ width: `${quotationDistribution.rejected.pct}%` }}
                          title={`Rejected: ${quotationDistribution.rejected.count} (${quotationDistribution.rejected.pct}%)`}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Status Grid Cards */}
              <div className="sa-qp-grid">
                <div className="sa-qp-card draft">
                  <div className="sa-qp-card-header">
                    <span className="sa-qp-dot draft" />
                    <span className="sa-qp-label">Draft</span>
                    <span className="sa-qp-pct">{quotationDistribution.draft.pct}%</span>
                  </div>
                  <div className="sa-qp-card-body">
                    <h3>{quotationDistribution.draft.count}</h3>
                    <p>Not yet submitted</p>
                  </div>
                </div>

                <div className="sa-qp-card pending">
                  <div className="sa-qp-card-header">
                    <span className="sa-qp-dot pending" />
                    <span className="sa-qp-label">Pending</span>
                    <span className="sa-qp-pct">{quotationDistribution.pending.pct}%</span>
                  </div>
                  <div className="sa-qp-card-body">
                    <h3>{quotationDistribution.pending.count}</h3>
                    <p>Awaiting review</p>
                  </div>
                </div>

                <div className="sa-qp-card approved">
                  <div className="sa-qp-card-header">
                    <span className="sa-qp-dot approved" />
                    <span className="sa-qp-label">Approved</span>
                    <span className="sa-qp-pct">{quotationDistribution.approved.pct}%</span>
                  </div>
                  <div className="sa-qp-card-body">
                    <h3>{quotationDistribution.approved.count}</h3>
                    <p>Ready / Accepted</p>
                  </div>
                </div>

                <div className="sa-qp-card rejected">
                  <div className="sa-qp-card-header">
                    <span className="sa-qp-dot rejected" />
                    <span className="sa-qp-label">Rejected</span>
                    <span className="sa-qp-pct">{quotationDistribution.rejected.pct}%</span>
                  </div>
                  <div className="sa-qp-card-body">
                    <h3>{quotationDistribution.rejected.count}</h3>
                    <p>Declined / Rework</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Grid: Invoice Payment Summary & Reports Promo Card */}
        <section className="sa-bottom-grid">
          <div className="sa-panel sa-payment-summary">
            <div className="sa-panel-heading">
              <div>
                <h2>Invoice Payment Summary</h2>
                <p>Current invoice payment status overview</p>
              </div>

              <button
                type="button"
                className="sa-text-button"
                onClick={() => navigateTo("/super-admin/invoices")}
                title="Go to Invoices"
              >
                View Invoices <ChevronRight size={15} />
              </button>
            </div>

            <div className="sa-status-rows">
              <div
                className="sa-status-row"
                onClick={() => navigateTo("/super-admin/invoices")}
                style={{ cursor: "pointer" }}
                title="View Paid Invoices"
              >
                <div className="sa-status-row-left">
                  <span className="sa-status-dot paid" />
                  <p>Paid</p>
                </div>
                <h3>{invoicePaymentSummary.paid}</h3>
              </div>

              <div
                className="sa-status-row"
                onClick={() => navigateTo("/super-admin/invoices")}
                style={{ cursor: "pointer" }}
                title="View Unpaid Invoices"
              >
                <div className="sa-status-row-left">
                  <span className="sa-status-dot unpaid" />
                  <p>Unpaid</p>
                </div>
                <h3>{invoicePaymentSummary.unpaid}</h3>
              </div>

              <div
                className="sa-status-row"
                onClick={() => navigateTo("/super-admin/invoices")}
                style={{ cursor: "pointer" }}
                title="View Partially Paid Invoices"
              >
                <div className="sa-status-row-left">
                  <span className="sa-status-dot partial" />
                  <p>Partially Paid</p>
                </div>
                <h3>{invoicePaymentSummary.partiallyPaid}</h3>
              </div>

              <div
                className="sa-status-row"
                onClick={() => navigateTo("/super-admin/invoices")}
                style={{ cursor: "pointer" }}
                title="View Overdue Invoices"
              >
                <div className="sa-status-row-left">
                  <span className="sa-status-dot overdue" />
                  <p>Overdue</p>
                </div>
                <h3>{invoicePaymentSummary.overdue}</h3>
              </div>
            </div>
          </div>

          {/* Navy Blue Reports Feature Card */}
          <div className="sa-promo-card">
            <div className="sa-promo-left">
              <div className="sa-promo-tag">
                <TrendingUp size={11} />
                <span>Financial Analytics</span>
              </div>
              <h3 className="sa-promo-title">Better Process, Bigger Growth</h3>
              <p className="sa-promo-desc">
                Manage your quotations, invoices and revenue all in one place.
              </p>
              <button
                type="button"
                className="sa-promo-action-btn"
                onClick={() => navigate("/reports")}
                title="View Reports"
              >
                <span>View Reports</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="sa-promo-right">
              <div className="sa-promo-icon-badge">
                <BarChart3 size={26} />
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard footer */}
        <footer className="sa-footer">
          <span>Invoice &amp; Quotation Management System</span>
          <span>Super Admin Workspace</span>
        </footer>
      </div>
    </>
  );
}
