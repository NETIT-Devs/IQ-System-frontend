import { Navigate, Outlet } from "react-router-dom";
import { getAuthenticatedUser } from "../utils/authStorage";

export default function ProtectedRoute({ allowedRoles }) {
  const user = getAuthenticatedUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = String(user.role).trim().toLowerCase();
  const authorizedRoles = allowedRoles.map((allowedRole) =>
    allowedRole.toLowerCase()
  );

  if (!authorizedRoles.includes(role)) {
    const destination =
      role === "super admin" ? "/super-admin-dashboard" : "/admin-dashboard";
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
}