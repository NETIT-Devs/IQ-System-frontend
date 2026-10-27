import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const mainNavigation = [
  { label: "Overview", icon: LayoutDashboard, path: "/super-admin-dashboard", isBuilt: true },
  { label: "Customers", icon: UserRound, path: "/super-admin/customers", isBuilt: false },
  { label: "Quotations", icon: FileText, path: "/quotations", isBuilt: true },
  { label: "Invoices", icon: Receipt, path: "/super-admin/invoices", isBuilt: false },
  { label: "Payments", icon: CreditCard, path: "/super-admin/payments", isBuilt: false },
  {
    label: "Reports & Analytics",
    icon: BarChart3,
    path: "/reports",
    isBuilt: true,
  },
];

const adminNavigation = [
  { label: "User Management", icon: Users, path: "/super-admin/users", isBuilt: false },
  {
    label: "Approvals",
    icon: CheckCircle2,
    path: "/super-admin/approvals",
    isBuilt: true,
  },
  {
    label: "Company Settings",
    icon: Settings,
    path: "/super-admin/settings",
    isBuilt: false,
  },
  {
    label: "Audit Logs",
    icon: ClipboardList,
    path: "/super-admin/audit-logs",
    isBuilt: true,
  },
];

export default function SuperAdminSidebar({ isOpen, onClose }) {
  function handleSignOut() {
    if (!window.confirm("Are you sure you want to sign out?")) return;

    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");
    window.location.assign("/login");
  }

  function renderNavigation(items) {
    return items.map(({ label, icon: Icon, path, isBuilt }) => {
      if (!isBuilt) {
        return (
          <div
            key={label}
            className="sa-nav-item"
            style={{ cursor: "default", opacity: 0.65 }}
            title={`${label} (Not available yet)`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
          </div>
        );
      }

      return (
        <NavLink
          key={path}
          to={path}
          end={path === "/super-admin-dashboard"}
          onClick={onClose}
          className={({ isActive }) =>
            `sa-nav-item ${isActive ? "active" : ""}`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {isActive && (
                <span className="sa-active-indicator" aria-hidden="true" />
              )}
            </>
          )}
        </NavLink>
      );
    });
  }

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="sa-sidebar-overlay"
          aria-label="Close navigation menu"
          onClick={onClose}
        />
      )}

      <aside className={`sa-sidebar ${isOpen ? "sidebar-open" : ""}`}>
        <div className="sa-brand">
          <img src="/logo.jpg" alt="Company Logo" className="sa-brand-logo" />
          <div className="sa-brand-text">
            <h2>Invoice &amp; Quotation</h2>
            <span>Management System</span>
          </div>
          <button
            type="button"
            className="sa-close-sidebar"
            aria-label="Close sidebar"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="sa-role-label">MAIN MENU</div>
        <nav className="sa-navigation" aria-label="Main navigation">
          {renderNavigation(mainNavigation)}
        </nav>

        <div className="sa-role-label sa-admin-label">ADMINISTRATION</div>
        <nav className="sa-navigation" aria-label="Administration navigation">
          {renderNavigation(adminNavigation)}
        </nav>

        <div className="sa-sidebar-bottom">
          <div className="sa-sidebar-profile">
            <div className="sa-avatar">SA</div>
            <div className="sa-user-info">
              <strong>Super Admin</strong>
              <span>System Administrator</span>
            </div>
            <ShieldCheck size={18} className="sa-shield-icon" />
          </div>
          <button
            type="button"
            className="sa-signout-button"
            onClick={handleSignOut}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
