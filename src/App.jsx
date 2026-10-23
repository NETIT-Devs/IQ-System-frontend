
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

// Authentication pages
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";

// Dashboard pages
import SuperAdminDashboard from "./pages/SuperAdminDashboard";

// Quotation management page
import Quotations from "./pages/Quotations";

// Temporary placeholder for the Admin Dashboard
function AdminDashboardPlaceholder() {
  function handleSignOut() {
    sessionStorage.clear();
    window.location.href = "/login";
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8 text-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <span className="mb-3 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
          Authenticated Role: Admin
        </span>

        <h1 className="text-2xl font-bold text-slate-900">
          Admin Dashboard
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Role-based redirect confirmed successfully.
        </p>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-6 inline-block rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
        >
          Sign Out
        </button>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default route */}
        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />

        {/* Authentication pages */}
        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/forgot-password"
          element={<Navigate to="/login" replace />}
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        {/* Admin Dashboard */}
        <Route
          path="/admin-dashboard"
          element={<AdminDashboardPlaceholder />}
        />

        {/* Super Admin Dashboard */}
        <Route
          path="/super-admin-dashboard"
          element={<SuperAdminDashboard />}
        />

        {/* Quotations Management Page */}
        <Route
          path="/quotations"
          element={<Quotations />}
        />

        {/* Unknown routes redirect to Login */}
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
