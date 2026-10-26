
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

import ProtectedRoute from "./components/ProtectedRoute";

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
          </Route>
        </Route>

        {/* Redirect unknown routes to the login page. */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
