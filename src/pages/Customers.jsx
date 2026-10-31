import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  UserPlus,
  Star,
  Globe,
  FileText,
  CheckCircle2,
  Send,
  XCircle,
  Eye,
  Plus,
  Menu,
  Phone,
  Mail,
  MapPin,
  Building,
  TrendingUp,
  X,
  FileCheck,
  Calendar,
  Layers,
} from "lucide-react";
import {
  getCustomers,
  createCustomer,
  getQuotations,
  updateQuotationCustomerStatus,
} from "../services/quotationService";
import { getAuthenticatedUser } from "../utils/authStorage";
import "./Customers.css";

const PINNED_STORAGE_KEY = "iq_pinned_daily_customers";

function getPinnedCustomerIds() {
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePinnedCustomerIds(ids) {
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `Rs. ${num.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function Customers() {
  const { openSidebar } = useOutletContext() || {};
  const navigate = useNavigate();

  const authUser = getAuthenticatedUser();
  const isSuperAdmin =
    String(authUser?.role || "").trim().toLowerCase() === "super admin" ||
    authUser?.role === "super_admin";
  const userInitials = isSuperAdmin ? "SA" : "A";
  const userRoleTitle = isSuperAdmin ? "Super Admin" : "Admin";

  const [customers, setCustomers] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [pinnedIds, setPinnedIds] = useState(getPinnedCustomerIds);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // New Customer Form State
  const [newCustomer, setNewCustomer] = useState({
    customer_name: "",
    company_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    notes: "",
  });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [formError, setFormError] = useState("");

  // Load Customers & Quotations
  async function loadData() {
    try {
      setLoading(true);
      const [custList, quoteList] = await Promise.all([
        getCustomers(),
        getQuotations(),
      ]);
      setCustomers(Array.isArray(custList) ? custList : []);
      setQuotations(Array.isArray(quoteList) ? quoteList : []);
    } catch (err) {
      console.error("Failed to load customer records:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Toggle Pinned / Daily Client
  function togglePin(customerId) {
    const next = pinnedIds.includes(customerId)
      ? pinnedIds.filter((id) => id !== customerId)
      : [...pinnedIds, customerId];
    setPinnedIds(next);
    savePinnedCustomerIds(next);
  }

  // Handle Manual Quotation Customer Status Update (from modal)
  async function handleStatusChange(quotationId, newCustomerStatus) {
    try {
      setUpdatingStatusId(quotationId);
      await updateQuotationCustomerStatus(quotationId, newCustomerStatus);
      await loadData();
      setSelectedCustomer((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          quotes: (prev.quotes || []).map((q) =>
            (q.quotation_id || q.id) === quotationId
              ? { ...q, customer_status: newCustomerStatus }
              : q
          ),
        };
      });
    } catch (err) {
      alert(err?.message || "Failed to update quotation customer status.");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  // Handle Add Customer Form Submit
  async function handleAddCustomer(e) {
    e.preventDefault();
    setFormError("");

    if (!newCustomer.customer_name.trim()) {
      setFormError("Customer name is required.");
      return;
    }

    try {
      setSavingCustomer(true);
      await createCustomer(newCustomer);
      setShowAddModal(false);
      setNewCustomer({
        customer_name: "",
        company_name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        notes: "",
      });
      await loadData();
    } catch (err) {
      setFormError(err?.message || "Failed to create customer.");
    } finally {
      setSavingCustomer(false);
    }
  }

  // Augment Customers with Real-time Quotation Stats
  const enrichedCustomers = useMemo(() => {
    return customers.map((c) => {
      const cId = c.customer_id;
      const clientQuotes = quotations.filter((q) => q.customer_id === cId);

      const approvedQuotes = clientQuotes.filter(
        (q) =>
          q.customer_status === "Customer Accepted" ||
          q.customer_status === "Accepted"
      );
      const sentQuotes = clientQuotes.filter(
        (q) =>
          q.customer_status === "Sent to Customer" ||
          q.customer_status === "Sent"
      );
      const rejectedQuotes = clientQuotes.filter(
        (q) =>
          q.customer_status === "Customer Rejected" ||
          q.customer_status === "Rejected"
      );

      const approvedTotal = approvedQuotes.reduce(
        (sum, q) => sum + (Number(q.total_amount) || Number(q.total) || 0),
        0
      );

      // Check if website client (items have website_type or title has web/website)
      const hasWebProjects =
        Number(c.website_projects_count) > 0 ||
        clientQuotes.some((q) => {
          const items = q.items || [];
          return (
            items.some(
              (it) =>
                it.website_type ||
                (it.item_name && /web|site/i.test(it.item_name))
            ) || /web|site/i.test(q.project_name || "")
          );
        });

      // Recognize repeat customers (2+ services) by ID, name, or email
      const cName = String(c.customer_name || "").trim().toLowerCase();
      const cEmail = String(c.email || "").trim().toLowerCase();

      const matchingQuotes = quotations.filter((q) => {
        if (q.customer_id && q.customer_id === cId) return true;
        const qName = String(q.customer_name || q.clientName || "").trim().toLowerCase();
        if (cName && qName && qName === cName) return true;
        const qEmail = String(q.customer_email || q.email || "").trim().toLowerCase();
        if (cEmail && qEmail && qEmail === cEmail) return true;
        return false;
      });

      const serviceCount = Math.max(
        clientQuotes.length,
        matchingQuotes.length,
        Number(c.total_quotations) || 0
      );

      const isDailyClient =
        pinnedIds.includes(cId) ||
        serviceCount >= 2 ||
        (c.notes && /daily|frequent|regular/i.test(c.notes));

      return {
        ...c,
        quotes: clientQuotes,
        total_quotations: clientQuotes.length || Number(c.total_quotations) || 0,
        approved_quotations:
          approvedQuotes.length || Number(c.approved_quotations) || 0,
        sent_quotations: sentQuotes.length || Number(c.sent_quotations) || 0,
        rejected_quotations:
          rejectedQuotes.length || Number(c.rejected_quotations) || 0,
        total_approved_amount:
          approvedTotal || Number(c.total_approved_amount) || 0,
        hasWebProjects,
        isDailyClient,
      };
    });
  }, [customers, quotations, pinnedIds]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalClients = enrichedCustomers.length;
    const dailyClients = enrichedCustomers.filter((c) => c.isDailyClient).length;
    const totalApprovedQuotes = enrichedCustomers.reduce(
      (sum, c) => sum + c.approved_quotations,
      0
    );
    const totalApprovedVal = enrichedCustomers.reduce(
      (sum, c) => sum + Number(c.total_approved_amount),
      0
    );
    const totalSentQuotes = enrichedCustomers.reduce(
      (sum, c) => sum + c.sent_quotations,
      0
    );
    const totalRejectedQuotes = enrichedCustomers.reduce(
      (sum, c) => sum + c.rejected_quotations,
      0
    );

    return {
      totalClients,
      dailyClients,
      totalApprovedQuotes,
      totalApprovedVal,
      totalSentQuotes,
      totalRejectedQuotes,
    };
  }, [enrichedCustomers]);

  // Daily / Website Clients to display prominently at the top
  const dailyWebClients = useMemo(() => {
    return enrichedCustomers.filter((c) => c.isDailyClient);
  }, [enrichedCustomers]);

  // Filtered Customers for main table
  const filteredCustomers = useMemo(() => {
    return enrichedCustomers.filter((c) => {
      const matchSearch =
        !searchTerm ||
        c.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm);

      if (!matchSearch) return false;

      if (typeFilter === "daily") return c.isDailyClient;
      if (typeFilter === "web") return c.hasWebProjects;
      if (typeFilter === "approved") return c.approved_quotations > 0;
      if (typeFilter === "sent") return c.sent_quotations > 0;
      if (typeFilter === "rejected") return c.rejected_quotations > 0;

      return true;
    });
  }, [enrichedCustomers, searchTerm, typeFilter]);

  return (
    <div className="cust-page">
      {/* Top Header Bar */}
      <header className="cust-topbar">
        <div className="cust-topbar-left">
          {openSidebar && (
            <button
              type="button"
              className="cust-menu-button"
              aria-label="Open sidebar"
              onClick={openSidebar}
            >
              <Menu size={20} />
            </button>
          )}

          <div className="cust-breadcrumb-wrap">
            <span className="cust-breadcrumb">Dashboard / Customers</span>
            <span className="cust-breadcrumb-dot">•</span>
            <span className="cust-eyebrow-tag">Customer Relationship &amp; Tracking</span>
          </div>
        </div>

        <div className="cust-header-actions">
          <span className="cust-header-date" title="Today's Date">
            {new Intl.DateTimeFormat("en-US", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date())}
          </span>

          <div className="cust-header-profile" title={userRoleTitle}>
            <span className="cust-profile-avatar" aria-label={`${userRoleTitle} profile`}>
              {userInitials}
            </span>
          </div>
        </div>
      </header>

      <div className="cust-content">
        {/* Welcome / Title Row right below topbar */}
        <div className="cust-welcome-bar">
          <div className="cust-welcome-text">
            <h1>Customers &amp; Quotation Responses</h1>
            <p className="cust-subtitle">
              Monitor customer responses (Sent, Approved, Rejected) and daily website clients.
            </p>
          </div>

          <button
            type="button"
            className="cust-add-btn"
            onClick={() => setShowAddModal(true)}
            title="Add new customer"
          >
            <UserPlus size={16} />
            <span>Add Customer</span>
          </button>
        </div>

        {/* 4 Summary Stat Cards matching Overview Card Size (Customer Sent card removed) */}
        <section className="cust-stats-grid" aria-label="Customer statistics">
          <div className="cust-stat-card">
            <div className="cust-stat-icon blue">
              <Users size={22} strokeWidth={2} />
            </div>
            <div className="cust-stat-info">
              <p>Total Customers</p>
              <h3>{stats.totalClients}</h3>
              <span>Registered client accounts</span>
            </div>
          </div>

          <div className="cust-stat-card">
            <div className="cust-stat-icon purple">
              <Globe size={22} strokeWidth={2} />
            </div>
            <div className="cust-stat-info">
              <p>Daily / Web Clients</p>
              <h3>{stats.dailyClients}</h3>
              <span>Regular website clients</span>
            </div>
          </div>

          <div className="cust-stat-card">
            <div className="cust-stat-icon green">
              <CheckCircle2 size={22} strokeWidth={2} />
            </div>
            <div className="cust-stat-info">
              <p>Customer Approved</p>
              <h3>{stats.totalApprovedQuotes}</h3>
              <span>{formatCurrency(stats.totalApprovedVal)}</span>
            </div>
          </div>

          <div className="cust-stat-card">
            <div className="cust-stat-icon red">
              <XCircle size={22} strokeWidth={2} />
            </div>
            <div className="cust-stat-info">
              <p>Customer Rejected</p>
              <h3>{stats.totalRejectedQuotes}</h3>
              <span>Quotations declined</span>
            </div>
          </div>
        </section>

      {/* Main Customers Table Panel */}
      <section className="cust-panel" aria-label="Customer list">
        <div className="cust-toolbar">
          <label className="cust-search-box">
            <Search size={16} color="#64748b" />
            <input
              type="search"
              placeholder="Search by customer name, company, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search customers"
            />
          </label>

          <div className="cust-filters">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="cust-select"
              aria-label="Filter customer type"
            >
              <option value="all">All Customers</option>
              <option value="daily">⭐ Daily / Web Clients</option>
              <option value="web">🌐 Website Projects</option>
              <option value="approved">✅ Has Approved Quotations</option>
              <option value="sent">📤 Has Sent Quotations</option>
              <option value="rejected">❌ Has Rejected Quotations</option>
            </select>
          </div>
        </div>

        <div className="cust-table-wrap">
          <table className="cust-table">
            <thead>
              <tr>
                <th>CLIENT &amp; COMPANY</th>
                <th>CONTACT DETAILS</th>
                <th>CATEGORY</th>
                <th>QUOTATIONS BREAKDOWN</th>
                <th>APPROVED REVENUE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                    Loading customer records from database...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                    No customers found matching your search or filters.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((client) => {
                  const isPinned = pinnedIds.includes(client.customer_id);

                  return (
                    <tr key={client.customer_id}>
                      <td>
                        <div className="cust-client-cell">
                          <button
                            type="button"
                            className={`cust-star-btn ${isPinned ? "active" : ""}`}
                            title={isPinned ? "Unpin Daily Client" : "Pin as Daily Client"}
                            onClick={() => togglePin(client.customer_id)}
                          >
                            <Star size={16} fill={isPinned ? "#f59e0b" : "none"} />
                          </button>

                          <div className="cust-table-avatar">
                            {client.customer_name.charAt(0).toUpperCase()}
                          </div>

                          <div className="cust-client-meta">
                            <strong>{client.customer_name}</strong>
                            <span>{client.company_name || client.city || "—"}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ fontSize: "12px", color: "#475569" }}>
                          {client.email ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <Mail size={12} color="#64748b" /> {client.email}
                            </div>
                          ) : (
                            <div style={{ color: "#94a3b8" }}>No email</div>
                          )}
                          {client.phone && (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                              <Phone size={12} color="#64748b" /> {client.phone}
                            </div>
                          )}
                        </div>
                      </td>

                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {client.hasWebProjects && (
                            <span className="cust-tag-web" style={{ fontSize: "10.5px" }}>
                              <Globe size={10} /> Website Client
                            </span>
                          )}
                          {client.isDailyClient && (
                            <span className="cust-tag-daily" style={{ fontSize: "10.5px" }}>
                              <Star size={10} fill="#b45309" /> Daily Client
                            </span>
                          )}
                          {!client.hasWebProjects && !client.isDailyClient && (
                            <span style={{ color: "#64748b", fontSize: "11px" }}>Standard Client</span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="quote-pills">
                          <span className="quote-pill approved" title="Approved Quotations">
                            <CheckCircle2 size={12} /> {client.approved_quotations}
                          </span>
                          <span className="quote-pill sent" title="Sent to Customer">
                            <Send size={12} /> {client.sent_quotations}
                          </span>
                          <span className="quote-pill rejected" title="Rejected Quotations">
                            <XCircle size={12} /> {client.rejected_quotations}
                          </span>
                          <span className="quote-pill total" title="Total Quotations">
                            Total: {client.total_quotations}
                          </span>
                        </div>
                      </td>

                      <td>
                        <strong style={{ color: "#0f172a", fontSize: "13px" }}>
                          {formatCurrency(client.total_approved_amount)}
                        </strong>
                      </td>

                      <td>
                        <div className="cust-action-group">
                          <button
                            type="button"
                            className="cust-action-btn"
                            title="View Customer Details and Quotations"
                            aria-label={`View ${client.customer_name}`}
                            onClick={() => setSelectedCustomer(client)}
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            type="button"
                            className="cust-action-btn"
                            title="Create New Quotation for this client"
                            aria-label={`New Quotation for ${client.customer_name}`}
                            onClick={() => navigate("/quotations")}
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      </div>

      {/* Customer Details & Quotations History Modal */}
      {selectedCustomer && (
        <div className="cust-modal-overlay">
          <div className="cust-modal">
            <div className="cust-modal-header">
              <div>
                <h3>{selectedCustomer.customer_name}</h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  {selectedCustomer.company_name ? `${selectedCustomer.company_name} • ` : ""}
                  Customer ID #{selectedCustomer.customer_id}
                </span>
              </div>
              <button
                type="button"
                className="cust-modal-close"
                onClick={() => setSelectedCustomer(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="cust-modal-body">
              {/* Profile summary */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px",
                  padding: "14px 16px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  marginBottom: "20px",
                  fontSize: "12px",
                }}
              >
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Email</span>
                  <strong style={{ color: "#0f172a" }}>{selectedCustomer.email || "—"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Phone</span>
                  <strong style={{ color: "#0f172a" }}>{selectedCustomer.phone || "—"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Address</span>
                  <strong style={{ color: "#0f172a" }}>
                    {[selectedCustomer.address, selectedCustomer.city, selectedCustomer.country]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Total Approved Business</span>
                  <strong style={{ color: "#16a34a" }}>
                    {formatCurrency(selectedCustomer.total_approved_amount)}
                  </strong>
                </div>
              </div>

              {/* Quotations List with manual status update */}
              <h4 style={{ margin: "0 0 12px", color: "#0f172a", fontSize: "14px" }}>
                Quotations for this Customer ({selectedCustomer.quotes?.length || 0})
              </h4>

              {selectedCustomer.quotes?.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px", color: "#64748b", background: "#f8fafc", borderRadius: "6px" }}>
                  No quotations created for this customer yet.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="cust-table" style={{ fontSize: "12px" }}>
                    <thead>
                      <tr>
                        <th>QUOTATION #</th>
                        <th>DATE</th>
                        <th>AMOUNT</th>
                        <th>SYSTEM STATUS</th>
                        <th>CUSTOMER STATUS</th>
                        <th>CUSTOMER ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCustomer.quotes.map((q) => {
                        const isSystemApproved = q.status === "Approved" || q.status === "Accepted";
                        const custStatus = q.customer_status || "Not Sent";
                        const isCustAccepted = custStatus === "Customer Accepted" || custStatus === "Accepted";
                        const isCustSent = custStatus === "Sent to Customer" || custStatus === "Sent";
                        const isCustRejected = custStatus === "Customer Rejected" || custStatus === "Rejected";

                        return (
                          <tr key={q.quotation_id || q.id}>
                            <td>
                              <strong style={{ color: "#1d4ed8" }}>
                                {q.quotation_number || q.id}
                              </strong>
                            </td>
                            <td>{q.quotation_date || q.issuedDate || "—"}</td>
                            <td>
                              <strong>
                                {formatCurrency(q.total_amount || q.total)}
                              </strong>
                            </td>
                            <td>
                              <span
                                className={`quote-pill ${
                                  isSystemApproved
                                    ? "approved"
                                    : q.status === "Pending Approval"
                                    ? "sent"
                                    : q.status === "Rejected"
                                    ? "rejected"
                                    : "total"
                                }`}
                              >
                                {q.status || "Draft"}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`quote-pill ${
                                  isCustAccepted
                                    ? "approved"
                                    : isCustSent
                                    ? "sent"
                                    : isCustRejected
                                    ? "rejected"
                                    : "total"
                                }`}
                              >
                                {custStatus}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: "4px" }}>
                                <button
                                  type="button"
                                  disabled={updatingStatusId === (q.quotation_id || q.id) || isCustSent}
                                  onClick={() => handleStatusChange(q.quotation_id || q.id, "Sent to Customer")}
                                  style={{
                                    padding: "3px 8px",
                                    fontSize: "11px",
                                    borderRadius: "4px",
                                    border: "1px solid #bae6fd",
                                    background: isCustSent ? "#bae6fd" : "#e0f2fe",
                                    color: "#0369a1",
                                    cursor: isCustSent ? "default" : "pointer",
                                  }}
                                  title="Mark as Sent to Customer"
                                >
                                  📤 Sent
                                </button>

                                <button
                                  type="button"
                                  disabled={updatingStatusId === (q.quotation_id || q.id) || isCustAccepted}
                                  onClick={() => handleStatusChange(q.quotation_id || q.id, "Customer Accepted")}
                                  style={{
                                    padding: "3px 8px",
                                    fontSize: "11px",
                                    borderRadius: "4px",
                                    border: "1px solid #bbf7d0",
                                    background: isCustAccepted ? "#bbf7d0" : "#dcfce7",
                                    color: "#15803d",
                                    cursor: isCustAccepted ? "default" : "pointer",
                                  }}
                                  title="Mark as Customer Accepted"
                                >
                                  ✅ Accepted
                                </button>

                                <button
                                  type="button"
                                  disabled={updatingStatusId === (q.quotation_id || q.id) || isCustRejected}
                                  onClick={() => handleStatusChange(q.quotation_id || q.id, "Customer Rejected")}
                                  style={{
                                    padding: "3px 8px",
                                    fontSize: "11px",
                                    borderRadius: "4px",
                                    border: "1px solid #fecaca",
                                    background: isCustRejected ? "#fecaca" : "#fee2e2",
                                    color: "#b91c1c",
                                    cursor: isCustRejected ? "default" : "pointer",
                                  }}
                                  title="Mark as Customer Rejected"
                                >
                                  ❌ Rejected
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="cust-modal-footer">
              <button
                type="button"
                className="cust-btn-secondary"
                onClick={() => setSelectedCustomer(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Customer Modal */}
      {showAddModal && (
        <div className="cust-modal-overlay">
          <div className="cust-modal" style={{ maxWidth: "560px" }}>
            <div className="cust-modal-header">
              <h3>Register New Customer</h3>
              <button
                type="button"
                className="cust-modal-close"
                onClick={() => setShowAddModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddCustomer}>
              <div className="cust-modal-body">
                {formError && (
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "#fee2e2",
                      color: "#b91c1c",
                      borderRadius: "6px",
                      marginBottom: "14px",
                      fontSize: "13px",
                    }}
                  >
                    {formError}
                  </div>
                )}

                <div className="cust-form-grid">
                  <div className="cust-field">
                    <label>Customer Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={newCustomer.customer_name}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, customer_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="cust-field">
                    <label>Company Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Lanka Ltd"
                      value={newCustomer.company_name}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, company_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="cust-field">
                    <label>Email Address</label>
                    <input
                      type="email"
                      placeholder="client@example.com"
                      value={newCustomer.email}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, email: e.target.value })
                      }
                    />
                  </div>

                  <div className="cust-field">
                    <label>Phone Number</label>
                    <input
                      type="text"
                      placeholder="+94 77 123 4567"
                      value={newCustomer.phone}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, phone: e.target.value })
                      }
                    />
                  </div>

                  <div className="cust-field">
                    <label>City</label>
                    <input
                      type="text"
                      placeholder="Colombo"
                      value={newCustomer.city}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, city: e.target.value })
                      }
                    />
                  </div>

                  <div className="cust-field">
                    <label>Address</label>
                    <input
                      type="text"
                      placeholder="Street address"
                      value={newCustomer.address}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, address: e.target.value })
                      }
                    />
                  </div>

                  <div className="cust-field cust-field-full">
                    <label>Notes (e.g. Website Client, Daily Customer)</label>
                    <textarea
                      rows={2}
                      placeholder="Additional notes about customer requirements..."
                      value={newCustomer.notes}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, notes: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="cust-modal-footer">
                <button
                  type="button"
                  className="cust-btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="cust-btn-primary"
                  disabled={savingCustomer}
                >
                  {savingCustomer ? "Saving..." : "Create Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
