import AdminSidebar from "../components/AdminSidebar";
import DashboardLayout from "./DashboardLayout";

export default function AdminLayout() {
  return <DashboardLayout SidebarComponent={AdminSidebar} />;
}
