
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AdminLayout from "./layouts/AdminLayout";
import RoleBasedLayout from "./layouts/RoleBasedLayout";
import SuperAdminLayout from "./layouts/SuperAdminLayout";

import ForgotPassword from "./pages/ForgotPassword";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import AdminDashboard from "./pages/AdminDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import Quotations from "./pages/Quotations";
import Reports from "./pages/Reports";
import Approvals from "./pages/Approvals";
import AuditLogs from "./pages/AuditLogs";
import Notifications from "./pages/Notifications";

import ProtectedRoute from "./components/ProtectedRoute";
import { getAuthenticatedUser } from "./utils/authStorage";

function FallbackRedirect() {
  const user = getAuthenticatedUser();
  if (user) {
    const role = String(user.role || "").trim().toLowerCase();
    const destination =
      role === "super admin" ? "/super-admin-dashboard" : "/admin-dashboard";
    return <Navigate to={destination} replace />;
  }
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect the root path to the login page. */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public authentication routes. */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Admin dashboard routes. */}
        <Route element={<ProtectedRoute allowedRoles={["Admin"]} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
          </Route>
        </Route>

        {/* Super Admin dashboard routes. */}
        <Route element={<ProtectedRoute allowedRoles={["Super Admin"]} />}>
          <Route element={<SuperAdminLayout />}>
            <Route
              path="/super-admin-dashboard"
              element={<SuperAdminDashboard />}
            />
            <Route
              path="/super-admin/approvals"
              element={<Approvals />}
            />
            <Route
              path="/super-admin/audit-logs"
              element={<AuditLogs />}
            />
          </Route>
        </Route>

        {/* Shared routes accessible by Admin and Super Admin. */}
        <Route
          element={
            <ProtectedRoute allowedRoles={["Admin", "Super Admin"]} />
          }
        >
          <Route element={<RoleBasedLayout />}>
            <Route path="/quotations" element={<Quotations />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/admin/reports" element={<Reports />} />
            <Route path="/super-admin/reports" element={<Reports />} />
            <Route path="/notifications" element={<Notifications />} />
          </Route>
        </Route>

        {/* Redirect unknown routes */}
        <Route path="*" element={<FallbackRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
