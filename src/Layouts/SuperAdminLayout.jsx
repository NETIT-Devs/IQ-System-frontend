import SuperAdminSidebar from "../components/SuperAdminSidebar";
import DashboardLayout from "./DashboardLayout";

export default function SuperAdminLayout() {
  return <DashboardLayout SidebarComponent={SuperAdminSidebar} />;
}
