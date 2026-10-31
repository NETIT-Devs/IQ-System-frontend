
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
import { getQuotations, getCustomers } from "../services/quotationService";
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
        <Icon size={21} strokeWidth={1.8} />
      </div>

      <div className="sa-stat-content">
        <p>{item.title}</p>
        <h3>{item.value}</h3>
        <span className="sa-stat-note">{item.description}</span>
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

// Render the financial overview chart without fabricated values.
function FinancialChart() {
  return (
    <section className="sa-panel">
      <div className="sa-panel-heading">
        <div className="sa-panel-title">
          <div className="sa-panel-icon blue">
            <TrendingUp size={20} />
          </div>
          <div>
            <h2>Financial Overview</h2>
            <p>Income vs. expenses</p>
          </div>
        </div>

        <span className="sa-neutral-badge">Overview</span>
      </div>

      <div className="sa-chart-legend">
        <span>
          <i className="sa-legend-income" />
          Income
        </span>
        <span>
          <i className="sa-legend-expenses" />
          Expenses
        </span>
      </div>

      <div className="sa-bar-chart">
        <div className="sa-chart-y-axis">
          <span>100</span>
          <span>75</span>
          <span>50</span>
          <span>25</span>
          <span>0</span>
        </div>

        <div className="sa-chart-plot">
          {[0, 1, 2, 3, 4].map((line) => (
            <div className="sa-chart-grid-line" key={line} />
          ))}

          <div className="sa-chart-zero-line">
            <span>0</span>
          </div>
        </div>
      </div>

      <ChartEmptyState
        icon={BarChart3}
        title="No financial data available"
        description="Income and expense bars will appear when financial records are connected."
      />
    </section>
  );
}

// Render the invoice status chart with zero counts.
function InvoiceStatusChart() {
  const invoiceStatuses = [
    { label: "Paid", value: 0, color: "paid" },
    { label: "Unpaid", value: 0, color: "unpaid" },
    { label: "Overdue", value: 0, color: "overdue" },
    { label: "Partially Paid", value: 0, color: "partial" },
  ];

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
        <div className="sa-donut">
          <div className="sa-donut-center">
            <strong>0</strong>
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
        The chart will reflect actual invoice statuses after integration.
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

// Main Super Admin Dashboard component.
export default function SuperAdminDashboard() {
  const { openSidebar } = useOutletContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [quotations, setQuotations] = useState([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
    }
  }

  function navigateTo(path) {
    navigate(path);
  }

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [records, custList] = await Promise.all([
          getQuotations(),
          getCustomers(),
        ]);
        if (isMounted) {
          setQuotations(Array.isArray(records) ? records : []);
          setCustomerCount(Array.isArray(custList) ? custList.length : 0);
        }
      } catch (err) {
        console.warn("Failed to load dashboard data:", err);
      }
    }
    loadData();
    const timer = setInterval(loadData, 15000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const pendingApprovalsCount = quotations.filter(
    (q) => q.status === "Pending Approval" || q.approval_status === "Pending"
  ).length;

  const dynamicStats = [
    {
      title: "Total Customers",
      value: String(customerCount),
      description: "Registered customers",
      icon: Users,
      color: "blue",
    },
    {
      title: "Total Quotations",
      value: String(quotations.length),
      description: "All quotations",
      icon: FileText,
      color: "purple",
    },
    {
      title: "Total Invoices",
      value: "0",
      description: "All invoices",
      icon: Receipt,
      color: "cyan",
    },
    {
      title: "Outstanding Balance",
      value: "Rs. 0.00",
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
          <p className="sa-breadcrumb">Dashboard / Overview</p>
        </div>

        <div className="sa-header-actions">
          {/* Search bar */}
          <div className="sa-search-container" ref={searchRef}>
            <form className="sa-search-box" onSubmit={handleSearchSubmit}>
              <button
                type="submit"
                className="sa-search-btn"
                title="Search dashboard"
                aria-label="Search dashboard"
                onClick={handleSearchSubmit}
              >
                <Search size={16} />
              </button>
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => {
                  if (search.trim()) setIsSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearchSubmit(e);
                  }
                }}
                placeholder="Search dashboard..."
                aria-label="Search dashboard"
              />
              {search && (
                <button
                  type="button"
                  className="sa-clear-search"
                  onClick={() => {
                    setSearch("");
                    setIsSearchOpen(false);
                  }}
                  aria-label="Clear search"
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
          <NotificationBell />

          {/* Date badge */}
          <span className="sa-header-date" title="Today's Date">
            {new Intl.DateTimeFormat("en-US", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date())}
          </span>

          {/* Profile circle icon for Super Admin */}
          <div className="sa-header-profile" title="Super Admin">
            <span className="sa-profile-avatar" aria-label="Super Admin profile">SA</span>
          </div>
        </div>
      </header>

      <div className="sa-dashboard-content">
        {/* Welcome bar: Title on left, Review Approvals button on right */}
        <div className="sa-welcome-bar">
          <div className="sa-welcome-text">
            <h1>Welcome to Super Admin Dashboard</h1>
            <p className="sa-subtitle">
              Monitor your business operations and financial performance.
            </p>
          </div>

          <button
            type="button"
            className="sa-primary-button sa-approval-button"
            onClick={() => navigate("/super-admin/approvals")}
            title="Review pending submissions"
          >
            <Eye size={15} />
            <span>Review Approvals</span>
            {pendingApprovalsCount > 0 && (
              <span
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  borderRadius: "10px",
                  padding: "1px 6px",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {pendingApprovalsCount}
              </span>
            )}
            <ChevronRight size={14} />
          </button>
        </div>
          {/* Summary cards */}
          <section className="sa-stats-grid" aria-label="Business summary">
            {dynamicStats.map((item) => (
              <StatCard key={item.title} item={item} />
            ))}
          </section>

          {/* Financial and invoice charts */}
          <section className="sa-charts-grid">
            <FinancialChart />
            <InvoiceStatusChart />
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
                  <strong className="sa-approval-count">0</strong>
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
                    {pendingApprovalsCount}
                  </strong>
                </div>
              </div>

              {pendingApprovalsCount > 0 ? (
                <div
                  className="sa-approval-message"
                  style={{ color: "#b45309", background: "#fef3c7" }}
                >
                  <Clock size={17} />
                  <span>
                    {pendingApprovalsCount} quotation(s) waiting for your review.
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
                  style={{ cursor: "default", opacity: 0.7 }}
                  title="Not available yet"
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
                    <tr>
                      <td colSpan={4} className="sa-empty-table-cell">
                        <EmptyState
                          icon={FileCheck}
                          title="No invoices available"
                          description="Invoice records will appear here when available."
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sa-panel">
              <div className="sa-panel-heading">
                <div>
                  <h2>Recent Activity</h2>
                  <p>Latest system events</p>
                </div>

                <button
                  type="button"
                  className="sa-text-button"
                  onClick={() => navigateTo("/super-admin/audit-logs")}
                  style={{ cursor: "default", opacity: 0.7 }}
                  title="Not available yet"
                >
                  View Logs <ChevronRight size={15} />
                </button>
              </div>

              <EmptyState
                icon={Activity}
                title="No recent activity"
                description="System activity will appear here when audit logs are connected."
              />
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
                  onClick={() => navigateTo("/super-admin/payments")}
                  style={{ cursor: "default", opacity: 0.7 }}
                  title="Not available yet"
                >
                  View Payments <ChevronRight size={15} />
                </button>
              </div>

              <div className="sa-status-rows">
                <div className="sa-status-row">
                  <div className="sa-status-row-left">
                    <span className="sa-status-dot paid" />
                    <p>Paid</p>
                  </div>
                  <h3>0</h3>
                </div>

                <div className="sa-status-row">
                  <div className="sa-status-row-left">
                    <span className="sa-status-dot unpaid" />
                    <p>Unpaid</p>
                  </div>
                  <h3>0</h3>
                </div>

                <div className="sa-status-row">
                  <div className="sa-status-row-left">
                    <span className="sa-status-dot partial" />
                    <p>Partially Paid</p>
                  </div>
                  <h3>0</h3>
                </div>

                <div className="sa-status-row">
                  <div className="sa-status-row-left">
                    <span className="sa-status-dot overdue" />
                    <p>Overdue</p>
                  </div>
                  <h3>0</h3>
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
