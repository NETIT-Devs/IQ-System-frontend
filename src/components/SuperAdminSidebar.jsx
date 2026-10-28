import { useState } from "react";
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
import SignOutModal from "./SignOutModal";
import { useCompanyBranding } from "../hooks/useCompanyBranding";

const mainNavigation = [
  { label: "Overview", icon: LayoutDashboard, path: "/super-admin-dashboard", isBuilt: true },
  { label: "Customers", icon: UserRound, path: "/super-admin/customers", isBuilt: true },
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
  { label: "User Management", icon: Users, path: "/super-admin/users", isBuilt: true },
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
    isBuilt: true,
  },
  {
    label: "Audit Logs",
    icon: ClipboardList,
    path: "/super-admin/audit-logs",
    isBuilt: true,
  },
];

export default function SuperAdminSidebar({ isOpen, onClose }) {
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const { logoUrl, companyName } = useCompanyBranding();

  function handleConfirmSignOut() {
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
      <SignOutModal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        onConfirm={handleConfirmSignOut}
      />
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
          <img
            src={logoUrl || "/logo.jpg"}
            alt={companyName || "Company Logo"}
            className="sa-brand-logo"
            onError={(e) => {
              if (e.currentTarget.src !== window.location.origin + "/logo.jpg") {
                e.currentTarget.src = "/logo.jpg";
              }
            }}
          />
          <div className="sa-brand-text">
            <h2>{companyName || "Invoice & Quotation"}</h2>
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
            onClick={() => setShowSignOutModal(true)}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
