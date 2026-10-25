import {
  BarChart3,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Receipt,
  UserRound,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const navigation = [
  { label: "Overview", icon: LayoutDashboard, path: "/admin-dashboard" },
  { label: "Customers", icon: UserRound, path: "/admin/customers" },
  { label: "Quotations", icon: FileText, path: "/quotations" },
  { label: "Invoices", icon: Receipt, path: "/admin/invoices" },
  { label: "Payments", icon: CreditCard, path: "/admin/payments" },
  { label: "Reports & Analytics", icon: BarChart3, path: "/admin/reports" },
];

export default function AdminSidebar({ isOpen, onClose }) {
  function handleSignOut() {
    if (!window.confirm("Are you sure you want to sign out?")) return;

    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");
    window.location.assign("/login");
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
          {navigation.map(({ label, icon: Icon, path }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/admin-dashboard"}
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
          ))}
        </nav>

        <div className="sa-sidebar-bottom">
          <div className="sa-sidebar-profile">
            <div className="sa-avatar">AD</div>
            <div className="sa-user-info">
              <strong>Admin</strong>
              <span>System Administrator</span>
            </div>
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
