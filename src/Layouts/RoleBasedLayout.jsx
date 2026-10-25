import AdminSidebar from "../components/AdminSidebar";
import SuperAdminSidebar from "../components/SuperAdminSidebar";
import DashboardLayout from "./DashboardLayout";
import { getAuthenticatedUser } from "../utils/authStorage";

export default function RoleBasedLayout() {
  const user = getAuthenticatedUser();
  const SidebarComponent =
    String(user?.role || "").trim().toLowerCase() === "super admin"
      ? SuperAdminSidebar
      : AdminSidebar;

  return <DashboardLayout SidebarComponent={SidebarComponent} />;
}
