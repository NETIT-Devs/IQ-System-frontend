import { useState } from "react";
import { Outlet } from "react-router-dom";

export default function DashboardLayout({ SidebarComponent }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="sa-layout">
      <SidebarComponent
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="sa-main">
        <Outlet context={{ openSidebar: () => setSidebarOpen(true) }} />
      </main>
    </div>
  );
}
