
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserRound,
  FileText,
  Receipt,
  CreditCard,
  BarChart3,
  Settings,
  ClipboardList,
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
  LogOut,
  ShieldCheck,
} from "lucide-react";

const navigation = [
  { label: "Overview", icon: LayoutDashboard, path: "/super-admin-dashboard" },
  { label: "User Management", icon: Users, path: "/super-admin/users" },
  { label: "Customers", icon: UserRound, path: "/super-admin/customers" },
  { label: "Quotations", icon: FileText, path: "/quotations" },
  { label: "Invoices", icon: Receipt, path: "/super-admin/invoices" },
  { label: "Payments", icon: CreditCard, path: "/super-admin/payments" },
  { label: "Reports & Analytics", icon: BarChart3, path: "/super-admin/reports" },
];

const managementNavigation = [
  { label: "Company Settings", icon: Settings, path: "/super-admin/settings" },
  { label: "Audit Logs", icon: ClipboardList, path: "/super-admin/audit-logs" },
];

const financialData = [
  { month: "May", income: 42, expenses: 32 },
  { month: "Jun", income: 55, expenses: 40 },
  { month: "Jul", income: 46, expenses: 37 },
  { month: "Aug", income: 69, expenses: 49 },
  { month: "Sep", income: 60, expenses: 45 },
  { month: "Oct", income: 82, expenses: 57 },
];

const stats = [
  {
    title: "Total Customers",
    value: "0",
    subtitle: "Registered customers",
    icon: Users,
    color: "blue",
  },
  {
    title: "Total Quotations",
    value: "0",
    subtitle: "All quotations",
    icon: FileText,
    color: "violet",
  },
  {
    title: "Total Invoices",
    value: "0",
    subtitle: "All invoices",
    icon: Receipt,
    color: "cyan",
  },
  {
    title: "Outstanding Balance",
    value: "Rs. 0",
    subtitle: "Unpaid balance",
    icon: Wallet,
    color: "amber",
  },
];

const quickLinks = [
  {
    label: "Manage Users",
    description: "Admin accounts and permissions",
    icon: Users,
    path: "/super-admin/users",
    color: "blue",
  },
  {
    label: "Company Settings",
    description: "Company and bank details",
    icon: Building2,
    path: "/super-admin/settings",
    color: "violet",
  },
  {
    label: "View Reports",
    description: "Business reports and analytics",
    icon: BarChart3,
    path: "/super-admin/reports",
    color: "cyan",
  },
  {
    label: "Audit Logs",
    description: "Review system activity",
    icon: Activity,
    path: "/super-admin/audit-logs",
    color: "amber",
  },
];

const quickColors = {
  blue: "bg-blue-50 text-blue-700",
  violet: "bg-indigo-50 text-indigo-700",
  cyan: "bg-sky-50 text-sky-700",
  amber: "bg-amber-50 text-amber-700",
};

function goToPage(path) {
  window.location.href = path;
}

function SidebarLink({ item, active, onClick }) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-200 ${
        active
          ? "bg-blue-600 font-semibold text-white shadow-lg shadow-blue-950/30"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <Icon
        size={18}
        strokeWidth={1.8}
        className={
          active
            ? "text-white"
            : "text-slate-400 transition group-hover:text-blue-300"
        }
      />

      <span className="flex-1">{item.label}</span>

      {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
    </button>
  );
}

function StatCard({ item }) {
  const Icon = item.icon;

  const iconColors = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    violet: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    cyan: "bg-sky-50 text-sky-700 ring-sky-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
  };

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-50/70 via-white to-white" />

      <div className="relative flex items-center justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${iconColors[item.color]}`}
        >
          <Icon size={20} strokeWidth={1.8} />
        </div>

        <span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-400">
          0%
        </span>
      </div>

      <p className="relative mt-4 text-sm font-medium text-slate-500">
        {item.title}
      </p>

      <h3 className="relative mt-1 text-2xl font-bold tracking-tight text-slate-900">
        {item.value}
      </h3>

      <p className="relative mt-1 text-xs text-slate-400">
        {item.subtitle}
      </p>
    </article>
  );
}

function FinancialChart() {
  const maxValue = 90;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <TrendingUp size={19} />
          </div>

          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Financial Overview
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Income vs expenses
            </p>
          </div>
        </div>

        <span className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[10px] font-semibold text-blue-700">
          Sample data
        </span>
      </div>

      <div className="mt-5 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#163B73]" />
          Income
        </span>

        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#78B9E8]" />
          Expenses
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[26px_minmax(0,1fr)] gap-2">
        <div className="flex h-36 flex-col justify-between pb-5 text-[10px] text-slate-400">
          <span>90</span>
          <span>60</span>
          <span>30</span>
          <span>0</span>
        </div>

        <div className="relative h-36">
          <div className="absolute inset-0 flex flex-col justify-between pb-5">
            {[0, 1, 2, 3].map((line) => (
              <div
                key={line}
                className="border-t border-dashed border-slate-100"
              />
            ))}
          </div>

          <div className="relative flex h-full items-end justify-around gap-2 px-1">
            {financialData.map((item) => (
              <div
                key={item.month}
                className="flex h-full flex-1 items-end justify-center gap-1"
              >
                <div
                  title={`Sample income: ${item.income}`}
                  className="w-[35%] max-w-7 rounded-t-md bg-[#163B73] transition-all duration-300 hover:bg-[#0B2447]"
                  style={{
                    height: `${(item.income / maxValue) * 85}%`,
                  }}
                />

                <div
                  title={`Sample expenses: ${item.expenses}`}
                  className="w-[35%] max-w-7 rounded-t-md bg-[#78B9E8] transition-all duration-300 hover:bg-[#529CD3]"
                  style={{
                    height: `${(item.expenses / maxValue) * 85}%`,
                  }}
                />
              </div>
            ))}
          </div>

          <div className="absolute -bottom-1 left-0 flex w-full justify-around">
            {financialData.map((item) => (
              <span
                key={item.month}
                className="text-[10px] font-medium text-slate-400"
              >
                {item.month}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function InvoiceStatusChart() {
  const segments = [
    { label: "Paid", value: 45, color: "#163B73" },
    { label: "Unpaid", value: 25, color: "#78B9E8" },
    { label: "Overdue", value: 15, color: "#E05252" },
    { label: "Partially Paid", value: 15, color: "#E9B44C" },
  ];

  let currentAngle = 0;

  const gradient = segments
    .map((segment) => {
      const start = currentAngle;
      currentAngle += segment.value * 3.6;

      return `${segment.color} ${start}deg ${currentAngle}deg`;
    })
    .join(", ");

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
            <Receipt size={19} />
          </div>

          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Invoice Status
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Distribution by status
            </p>
          </div>
        </div>

        <span className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[10px] font-semibold text-blue-700">
          Sample data
        </span>
      </div>

      <div className="mt-5 flex items-center justify-center gap-5 sm:gap-7">
        <div
          className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full sm:h-36 sm:w-36"
          style={{ background: `conic-gradient(${gradient})` }}
        >
          <div className="absolute inset-[13px] flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              0
            </span>

            <span className="mt-0.5 text-[10px] font-medium text-slate-400">
              Total invoices
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          {segments.map((segment) => (
            <div
              key={segment.label}
              className="flex items-center gap-2"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: segment.color }}
              />

              <span className="min-w-0 flex-1 text-xs text-slate-500">
                {segment.label}
              </span>

              <span className="text-xs font-semibold tabular-nums text-slate-700">
                0
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
        <Icon size={19} strokeWidth={1.8} />
      </div>

      <p className="mt-3 text-sm font-semibold text-slate-700">
        {title}
      </p>

      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">
        {description}
      </p>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activePage, setActivePage] = useState("Overview");

  function handleNavigation(item) {
    setActivePage(item.label);
    setSidebarOpen(false);

    if (item.path !== "/super-admin-dashboard") {
      goToPage(item.path);
    }
  }

  function handleSignOut() {
    const confirmed = window.confirm(
      "Are you sure you want to sign out?"
    );

    if (confirmed) {
      // Connect this to your authentication logout logic when available.
      window.location.href = "/login";
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F7FC] text-slate-800">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-[#07152C]/55 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col overflow-y-auto bg-[#0B1730] px-4 py-5 text-white transition-transform duration-300 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex shrink-0 items-center gap-3 px-2">
          <img
            src="/logo.jpg"
            alt="Company Logo"
            className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-1 shadow-md shadow-black/10"
          />

          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-wide text-white">
              INVOICE & QUOTATION
            </p>

            <p className="mt-1 text-[10px] tracking-[0.14em] text-slate-400">
              MANAGEMENT SYSTEM
            </p>
          </div>

          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-800 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-8 shrink-0 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Main Menu
        </div>

        <nav className="mt-3 shrink-0 space-y-1">
          {navigation.map((item) => (
            <SidebarLink
              key={item.label}
              item={item}
              active={activePage === item.label}
              onClick={() => handleNavigation(item)}
            />
          ))}
        </nav>

        <div className="mt-7 shrink-0 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Administration
        </div>

        <nav className="mt-3 shrink-0 space-y-1">
          {managementNavigation.map((item) => (
            <SidebarLink
              key={item.label}
              item={item}
              active={activePage === item.label}
              onClick={() => handleNavigation(item)}
            />
          ))}
        </nav>

        <div className="mt-auto shrink-0 pt-6">
          <div className="rounded-xl border border-slate-700/70 bg-slate-800/50 p-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>

              <span className="text-xs font-medium text-slate-200">
                System Operational
              </span>
            </div>

            <p className="mt-2 text-[10px] text-slate-400">
              All services are running
            </p>
          </div>

          <div className="mt-4 flex items-center gap-3 border-t border-slate-800 px-2 pt-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold shadow-lg shadow-blue-950/30">
              SA
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                Super Admin
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Administrator
              </p>
            </div>

            <ShieldCheck size={17} className="text-blue-300" />
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="min-h-screen lg:ml-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl p-2 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 lg:hidden"
            >
              <Menu size={20} />
            </button>

            <div>
              <p className="text-sm font-bold text-slate-800">
                Dashboard Overview
              </p>

              <p className="hidden text-xs text-slate-400 sm:block">
                Manage your business operations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative hidden md:block">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search..."
                className="w-48 rounded-xl border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <button
              type="button"
              aria-label="Notifications"
              className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <Bell size={18} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-blue-600" />
            </button>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800 ring-2 ring-white">
              SA
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
          <section className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">
                Super Admin Dashboard
              </p>

              <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#102544] sm:text-3xl">
                Good morning, Super Admin
              </h1>

              <p className="mt-1.5 text-sm text-slate-500">
                Here is your business overview.
              </p>
            </div>

            <button
              type="button"
              onClick={() => goToPage("/super-admin/approvals")}
              className="flex items-center gap-2 rounded-xl bg-[#163B73] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-[#0B2447] hover:shadow-lg"
            >
              <Eye size={16} />
              Review Approvals
              <ChevronRight size={15} />
            </button>
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => (
              <StatCard key={item.title} item={item} />
            ))}
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <FinancialChart />
            <InvoiceStatusChart />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Approval Queue
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Items awaiting your review
                  </p>
                </div>

                <span className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                  0 Pending
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition hover:border-blue-100 hover:bg-blue-50/50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Receipt size={19} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">
                      Invoices
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Waiting for approval
                    </p>
                  </div>

                  <span className="text-xl font-bold tabular-nums text-slate-800">
                    0
                  </span>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition hover:border-blue-100 hover:bg-blue-50/50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                    <FileText size={19} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">
                      Quotations
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Waiting for approval
                    </p>
                  </div>

                  <span className="text-xl font-bold tabular-nums text-slate-800">
                    0
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50/70 px-3 py-3 text-xs text-slate-600">
                <CheckCircle2 size={15} className="text-blue-700" />
                No pending approvals to display.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-sm font-bold text-slate-900">
                Quick Access
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Common administration tasks
              </p>

              <div className="mt-4 space-y-2">
                {quickLinks.map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      type="button"
                      key={item.label}
                      onClick={() => goToPage(item.path)}
                      className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/60"
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${quickColors[item.color]}`}
                      >
                        <Icon size={17} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-700 transition group-hover:text-blue-800">
                          {item.label}
                        </p>

                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {item.description}
                        </p>
                      </div>

                      <ChevronRight
                        size={16}
                        className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-700"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Recent Invoices
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Latest invoice records
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => goToPage("/super-admin/invoices")}
                  className="rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                  View All
                </button>
              </div>

              <EmptyState
                icon={FileCheck}
                title="No invoices available"
                description="Invoice records will appear here after backend integration."
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Recent Activity
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Latest system events
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => goToPage("/super-admin/audit-logs")}
                  className="rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                  View Logs
                </button>
              </div>

              <EmptyState
                icon={Activity}
                title="No recent activity"
                description="System activity will appear here when connected."
              />
            </div>
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 py-4 text-xs text-slate-400">
            <p>Invoice & Quotation Management System</p>
            <p>Super Admin Dashboard</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
