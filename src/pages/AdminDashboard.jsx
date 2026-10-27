
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Users,
  FileText,
  Receipt,
  CreditCard,
  BarChart3,
  Search,
  Bell,
  Menu,
  X,
  FileCheck,
  Activity,
  ChevronRight,
  Wallet,
  TrendingUp,
  CheckCircle2,
  Clock,
} from "lucide-react";
import NotificationBell from "../components/NotificationBell";
import { getQuotations } from "../services/quotationService";
import "./AdminDashboard.css";

// Summary cards show zero until real backend data is connected.
const statistics = [
  {
    title: "Total Customers",
    value: "0",
    description: "Registered customers",
    icon: Users,
    color: "blue",
  },
  {
    title: "Total Quotations",
    value: "0",
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

const BUILT_PATHS = new Set([
  "/admin-dashboard",
  "/quotations",
  "/reports",
]);

// Quick links for everyday Admin tasks.
const quickLinks = [
  {
    label: "Customers",
    description: "View and manage customers",
    icon: Users,
    path: "/admin/customers",
  },
  {
    label: "Create Quotations",
    description: "Prepare customer quotations",
    icon: FileText,
    path: "/quotations",
  },
  {
    label: "Invoices",
    description: "Manage invoices and payments",
    icon: Receipt,
    path: "/admin/invoices",
  },
  {
    label: "Payments",
    description: "Review invoice payment records",
    icon: CreditCard,
    path: "/admin/payments",
  },
];

// Navigate to a selected page if built, otherwise do nothing
function navigateTo(path) {
  if (BUILT_PATHS.has(path)) {
    window.location.href = path;
  }
}

// Reusable dashboard summary card.
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

// Display an empty state when no records are available.
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

// Financial overview chart placeholder.
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

      <div className="sa-chart-empty">
        <div className="sa-chart-empty-icon">
          <BarChart3 size={23} strokeWidth={1.6} />
        </div>
        <p>No financial data available</p>
        <span>
          Income and expense data will appear when financial records are
          connected.
        </span>
      </div>
    </section>
  );
}

// Invoice status chart placeholder.
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
        Invoice statuses will update when actual records are connected.
      </p>
    </section>
  );
}

// Main Admin Dashboard component.
export default function AdminDashboard() {
  const { openSidebar } = useOutletContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [quotations, setQuotations] = useState([]);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const records = await getQuotations();
        if (isMounted) {
          setQuotations(Array.isArray(records) ? records : []);
        }
      } catch (err) {
        console.warn("Failed to load dashboard quotation data:", err);
      }
    }
    loadData();
    const timer = setInterval(loadData, 15000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const pendingCount = quotations.filter(
    (q) => q.status === "Pending Approval" || q.approval_status === "Pending"
  ).length;

  const dynamicStats = [
    {
      title: "Total Customers",
      value: "0",
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
      {/* Top bar */}
      <header className="sa-topbar">
          <div className="sa-topbar-left">
            <button
              type="button"
              className="sa-menu-button"
              aria-label="Open navigation menu"
              onClick={openSidebar}
            >
              <Menu size={21} />
            </button>

            <div>
              <p className="sa-breadcrumb">Dashboard / Overview</p>
              <h1>Welcome to Admin Dashboard</h1>
              <p className="sa-subtitle">
                Manage customers, quotations, invoices and payments.
              </p>
            </div>
          </div>

          <div className="sa-header-actions">
            <label className="sa-search-box">
              <Search size={17} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search dashboard..."
                aria-label="Search dashboard"
              />

              {search && (
                <button
                  type="button"
                  className="sa-clear-search"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </label>

            <NotificationBell />
          </div>
      </header>

        <div className="sa-dashboard-content">
          {/* Business summary cards */}
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

          {/* Pending submissions and quick access */}
          <section className="sa-lower-grid">
            <div className="sa-panel">
              <div className="sa-panel-heading">
                <div>
                  <h2>Pending Submissions</h2>
                  <p>Invoices and quotations submitted for approval</p>
                </div>

                <span className="sa-neutral-badge">{pendingCount} Pending</span>
              </div>

              <div className="sa-approval-items">
                <div className="sa-approval-item">
                  <div className="sa-panel-icon blue">
                    <Receipt size={20} />
                  </div>

                  <div className="sa-approval-item-text">
                    <strong>Invoices</strong>
                    <span>Awaiting Super Admin review</span>
                  </div>

                  <strong className="sa-approval-count">0</strong>
                </div>

                <div className="sa-approval-item">
                  <div className="sa-panel-icon purple">
                    <FileText size={20} />
                  </div>

                  <div className="sa-approval-item-text">
                    <strong>Quotations</strong>
                    <span>Awaiting Super Admin review</span>
                  </div>

                  <strong className="sa-approval-count">{pendingCount}</strong>
                </div>
              </div>

              {pendingCount > 0 ? (
                <div
                  className="sa-approval-message"
                  style={{ color: "#b45309", background: "#fef3c7" }}
                >
                  <Clock size={17} />
                  <span>
                    {pendingCount} quotation(s) awaiting Super Admin review.
                  </span>
                </div>
              ) : (
                <div className="sa-approval-message">
                  <CheckCircle2 size={17} />
                  <span>No pending submissions to display.</span>
                </div>
              )}
            </div>

            <div className="sa-panel">
              <div className="sa-panel-heading">
                <div>
                  <h2>Quick Access</h2>
                  <p>Frequently used pages</p>
                </div>
              </div>

              <div className="sa-quick-links">
                {quickLinks.map((item) => {
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

                      <ChevronRight
                        size={17}
                        className="sa-quick-arrow"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Recent invoices and activity */}
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
                  onClick={() => navigateTo("/admin/invoices")}
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
                  <p>Latest account activity</p>
                </div>
              </div>

              <EmptyState
                icon={Activity}
                title="No recent activity"
                description="Recent activity will appear here when records are available."
              />
            </div>
          </section>

          {/* Invoice payment summary */}
          <section className="sa-panel sa-payment-summary">
            <div className="sa-panel-heading">
              <div>
                <h2>Invoice Payment Summary</h2>
                <p>Current invoice payment status overview</p>
              </div>

              <button
                type="button"
                className="sa-text-button"
                onClick={() => navigateTo("/admin/payments")}
                style={{ cursor: "default", opacity: 0.7 }}
                title="Not available yet"
              >
                View Payments <ChevronRight size={15} />
              </button>
            </div>

            <div className="sa-status-grid">
              <div className="sa-status-card">
                <span className="sa-status-dot paid" />
                <div>
                  <p>Paid</p>
                  <h3>0</h3>
                </div>
              </div>

              <div className="sa-status-card">
                <span className="sa-status-dot unpaid" />
                <div>
                  <p>Unpaid</p>
                  <h3>0</h3>
                </div>
              </div>

              <div className="sa-status-card">
                <span className="sa-status-dot partial" />
                <div>
                  <p>Partially Paid</p>
                  <h3>0</h3>
                </div>
              </div>

              <div className="sa-status-card">
                <span className="sa-status-dot overdue" />
                <div>
                  <p>Overdue</p>
                  <h3>0</h3>
                </div>
              </div>
            </div>
          </section>

          {/* Dashboard footer */}
          <footer className="sa-footer">
            <span>Invoice &amp; Quotation Management System</span>
            <span>Admin Workspace</span>
          </footer>
        </div>
    </>
  );
}
