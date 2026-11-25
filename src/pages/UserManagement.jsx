import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Users,
  UserPlus,
  ShieldCheck,
  Search,
  RefreshCw,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  Menu,
  Info,
  UserCheck,
  UserX,
  Pencil,
  ChevronDown,
  Check,
  ArrowRightLeft,
  AlertTriangle,
} from "lucide-react";
import {
  fetchUsers,
  createAdminUser,
  updateUserAccount,
  toggleUserAccountStatus,
  deleteUserAccount,
  transferUserAccount,
} from "../services/userService";
import { getAuthenticatedUser } from "../utils/authStorage";
import "./UserManagement.css";
import ThemeToggle from "../components/ThemeToggle";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateStr);
  }
}

export default function UserManagement() {
  const { openSidebar } = useOutletContext();
  const currentUser = getAuthenticatedUser();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openUmDropdown, setOpenUmDropdown] = useState(null); // null | "role" | "status"
  const umDropdownRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (
        umDropdownRef.current &&
        !umDropdownRef.current.contains(e.target)
      ) {
        setOpenUmDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "Admin",
  });

  // Delete User Modal State
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "Admin",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Status toggle state
  const [togglingId, setTogglingId] = useState(null);

  // Transfer / Merge Account Modal State
  const [transferModalUser, setTransferModalUser] = useState(null);
  const [transferStep, setTransferStep] = useState(1); // 1 = details & form, 2 = confirmation
  const [transferTargetUserId, setTransferTargetUserId] = useState("");
  const [transferTargetEmail, setTransferTargetEmail] = useState("");
  const [transferPassword, setTransferPassword] = useState("");
  const [showTransferPassword, setShowTransferPassword] = useState(false);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      try {
        localStorage.removeItem("iq_deleted_user_ids");
      } catch {
        // Ignore storage errors
      }
      const records = await fetchUsers();
      const list = Array.isArray(records) ? records : [];
      setUsers(list);
    } catch (err) {
      console.error("Failed to load users:", err);
      setError(err?.message || "Failed to load user accounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Filtered users list
  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((u) => {
      const matchesSearch =
        !term ||
        [u.full_name, u.email, u.role].some((val) =>
          String(val || "").toLowerCase().includes(term)
        );

      const matchesRole =
        roleFilter === "all" ||
        String(u.role || "").toLowerCase() === roleFilter.toLowerCase();

      const isActive = Number(u.is_active) === 1 || u.is_active === true;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && isActive) ||
        (statusFilter === "inactive" && !isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === "Admin").length;
    const activeAdmins = users.filter(
      (u) => u.role === "Admin" && (Number(u.is_active) === 1 || u.is_active === true)
    ).length;
    const superAdmins = users.filter((u) => u.role === "Super Admin").length;
    const active = users.filter(
      (u) => Number(u.is_active) === 1 || u.is_active === true
    ).length;
    const inactive = users.filter(
      (u) => Number(u.is_active) !== 1 && u.is_active !== true
    ).length;

    return { total, admins, activeAdmins, superAdmins, active, inactive };
  }, [users]);

  // Handle Create User
  async function handleAddSubmit(e) {
    e.preventDefault();
    setAddError("");

    if (!formData.username.trim()) {
      setAddError("Please enter a username or full name.");
      return;
    }
    if (!formData.email.trim()) {
      setAddError("Please enter a valid email address.");
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setAddError("Password must be at least 6 characters long.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await createAdminUser({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });

      setSuccessMsg(
        `Admin account for "${formData.username}" (${formData.email}) created successfully! They can now log in with their credentials.`
      );
      setShowAddModal(false);

      if (res?.user) {
        const createdUser = {
          user_id: res.user.user_id,
          full_name: res.user.full_name || formData.username.trim(),
          email: res.user.email || formData.email.trim().toLowerCase(),
          role: res.user.role || formData.role || "Admin",
          is_active: 1,
          created_at: new Date().toISOString(),
        };
        setUsers((prev) => [
          createdUser,
          ...prev.filter((u) => u.user_id !== createdUser.user_id),
        ]);
      }

      setFormData({ username: "", email: "", password: "", role: "Admin" });
      setShowPassword(false);
      await loadData();
    } catch (err) {
      console.error("Create user failed:", err);
      setAddError(err?.message || "Failed to create administrator account.");
    } finally {
      setSubmitting(false);
    }
  }

  // Open Edit Modal
  function handleOpenEdit(user) {
    setEditError("");
    setEditingUser(user);
    setEditFormData({
      username: user.full_name || "",
      email: user.email || "",
      password: "",
      role: user.role || "Admin",
    });
    setShowEditPassword(false);
  }

  // Handle Edit Submit
  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditError("");

    if (!editFormData.username.trim()) {
      setEditError("Please enter a username or full name.");
      return;
    }
    if (!editFormData.email.trim()) {
      setEditError("Please enter a valid email address.");
      return;
    }
    if (editFormData.password && editFormData.password.length < 6) {
      setEditError("New password must be at least 6 characters long.");
      return;
    }

    try {
      setEditSubmitting(true);
      await updateUserAccount(editingUser.user_id, {
        username: editFormData.username,
        full_name: editFormData.username,
        email: editFormData.email,
        password: editFormData.password || undefined,
        role: editFormData.role,
      });

      setSuccessMsg(
        `Administrator account for "${editFormData.username}" updated successfully!`
      );
      setEditingUser(null);
      await loadData();
    } catch (err) {
      console.error("Update user failed:", err);
      setEditError(err?.message || "Failed to update administrator account.");
    } finally {
      setEditSubmitting(false);
    }
  }

  // Handle Toggle Status
  async function handleToggleStatus(user) {
    if (user.user_id === currentUser?.user_id) {
      setError("You cannot change the status of your current account.");
      return;
    }

    try {
      setTogglingId(user.user_id);
      await toggleUserAccountStatus(user.user_id);
      setSuccessMsg(
        `User "${user.full_name}" is now ${user.is_active ? "Deactivated" : "Activated"}.`
      );
      await loadData();
    } catch (err) {
      console.error("Toggle status error:", err);
      setError(err?.message || "Failed to change user status.");
    } finally {
      setTogglingId(null);
    }
  }

  // Handle Delete User
  async function handleConfirmDelete() {
    if (!userToDelete) return;

    try {
      setDeleting(true);
      await deleteUserAccount(userToDelete.user_id);
      try {
        localStorage.removeItem("iq_deleted_user_ids");
      } catch {
        // Ignore storage errors
      }
      setUsers((prev) =>
        prev.filter((u) => u.user_id !== userToDelete.user_id)
      );
      setSuccessMsg(
        `User account "${userToDelete.full_name}" deleted successfully.`
      );
      setUserToDelete(null);
      await loadData();
    } catch (err) {
      console.error("Delete user error:", err);
      setError(err?.message || "Failed to delete user account.");
    } finally {
      setDeleting(false);
    }
  }

  // Open Transfer Account / Merge Modal
  function handleOpenTransfer(user) {
    setTransferError("");
    setTransferModalUser(user);
    setTransferStep(1);
    setTransferTargetUserId("");
    setTransferTargetEmail("");
    setTransferPassword("");
    setShowTransferPassword(false);
  }

  function handleTargetUserChange(userId) {
    setTransferTargetUserId(userId);
    const found = users.find((u) => String(u.user_id) === String(userId));
    if (found) {
      setTransferTargetEmail(found.email || "");
    }
  }

  function handleProceedToConfirm(e) {
    e.preventDefault();
    setTransferError("");

    if (!transferTargetUserId && !transferTargetEmail.trim()) {
      setTransferError("Please select an eligible recipient administrator.");
      return;
    }

    if (!transferPassword) {
      setTransferError("Please enter your Super Admin password to authorize this transfer.");
      return;
    }

    setTransferStep(2);
  }

  async function handleExecuteTransfer() {
    if (!transferModalUser) return;

    try {
      setTransferSubmitting(true);
      setTransferError("");

      const res = await transferUserAccount({
        targetUserId: transferTargetUserId,
        sourceUserId: transferModalUser.user_id,
        password: transferPassword,
        email: transferTargetEmail.trim().toLowerCase(),
      });

      if (res?.is_self_transfer) {
        localStorage.removeItem("authToken");
        sessionStorage.removeItem("authToken");
        localStorage.removeItem("user");
        sessionStorage.removeItem("user");
        window.location.href = "/login?transferred=true";
        return;
      }

      const recipientName =
        users.find((u) => String(u.user_id) === String(transferTargetUserId))?.full_name ||
        transferTargetEmail;

      setSuccessMsg(
        res?.message ||
          `Account data from "${transferModalUser.full_name}" was successfully transferred to "${recipientName}". The source account is now deactivated.`
      );
      setTransferModalUser(null);
      await loadData();
    } catch (err) {
      console.error("Transfer error:", err);
      setTransferError(err?.message || "Failed to transfer account.");
    } finally {
      setTransferSubmitting(false);
    }
  }

  return (
    <main className="um-page">
      {/* Top Header */}
      <header className="um-header">
        <div className="um-header-left">
          <button
            type="button"
            className="um-menu-button"
            aria-label="Open menu"
            onClick={openSidebar}
          >
            <Menu size={20} />
          </button>
          <div>
            <p className="um-eyebrow">Administration / User Management</p>
            <h1>User Management</h1>
            <p className="um-subtitle">
              Add and manage administrator accounts and login credentials.
            </p>
          </div>
        </div>

        <div className="um-header-actions">
          <ThemeToggle />
          <button
            type="button"
            className="um-add-btn"
            onClick={() => {
              setAddError("");
              setShowAddModal(true);
            }}
          >
            <UserPlus size={17} />
            <span>Add New Admin</span>
          </button>
        </div>
      </header>

      {/* Global Alerts */}
      {successMsg && (
        <div className="um-alert success">
          <CheckCircle size={18} />
          <span>{successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg("")}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <div className="um-alert error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Separated Search & Filter Toolbar */}
      <div className="um-toolbar">
          <div className="um-toolbar-left">
            <div className="um-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search by name, email or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="um-dropdowns-group" ref={umDropdownRef}>
              {/* 1. All Roles Dropdown */}
              <div className="um-dropdown-wrap">
                <button
                  type="button"
                  className={`um-dropdown-btn ${openUmDropdown === "role" ? "active" : ""}`}
                  onClick={() =>
                    setOpenUmDropdown((prev) => (prev === "role" ? null : "role"))
                  }
                  aria-expanded={openUmDropdown === "role"}
                >
                  <span className="um-dropdown-label">
                    {roleFilter === "Admin"
                      ? `Admin (${stats.admins})`
                      : roleFilter === "Super Admin"
                        ? `Super Admin (${stats.superAdmins})`
                        : "All Roles"}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`um-dropdown-chevron ${openUmDropdown === "role" ? "open" : ""}`}
                  />
                </button>

                {openUmDropdown === "role" && (
                  <div className="um-dropdown-menu" role="listbox">
                    <div className="um-dropdown-header">
                      <span>Filter by Role</span>
                    </div>
                    <div className="um-dropdown-list">
                      {[
                        { value: "all", label: "All Roles", count: stats.total, color: "#64748b" },
                        { value: "Admin", label: "Admin", count: stats.admins, color: "#2563eb" },
                        { value: "Super Admin", label: "Super Admin", count: stats.superAdmins, color: "#16a34a" },
                      ].map((opt) => {
                        const isSelected = roleFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className={`um-dropdown-item ${isSelected ? "selected" : ""}`}
                            onClick={() => {
                              setRoleFilter(opt.value);
                              setOpenUmDropdown(null);
                            }}
                          >
                            <div className="um-dropdown-item-left">
                              <span
                                className="um-dropdown-dot"
                                style={{ backgroundColor: opt.color }}
                              />
                              <span className="um-dropdown-item-text">{opt.label}</span>
                            </div>
                            <div className="um-dropdown-item-right">
                              <span className="um-dropdown-badge">{opt.count}</span>
                              {isSelected && <Check size={14} className="um-dropdown-check" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. All Statuses Dropdown */}
              <div className="um-dropdown-wrap">
                <button
                  type="button"
                  className={`um-dropdown-btn ${openUmDropdown === "status" ? "active" : ""}`}
                  onClick={() =>
                    setOpenUmDropdown((prev) => (prev === "status" ? null : "status"))
                  }
                  aria-expanded={openUmDropdown === "status"}
                >
                  <span className="um-dropdown-label">
                    {statusFilter === "active"
                      ? `Active Only (${stats.active})`
                      : statusFilter === "inactive"
                        ? `Inactive Only (${stats.inactive})`
                        : "All Status"}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`um-dropdown-chevron ${openUmDropdown === "status" ? "open" : ""}`}
                  />
                </button>

                {openUmDropdown === "status" && (
                  <div className="um-dropdown-menu" role="listbox">
                    <div className="um-dropdown-header">
                      <span>Filter by Status</span>
                    </div>
                    <div className="um-dropdown-list">
                      {[
                        { value: "all", label: "All Status", count: stats.total, color: "#64748b" },
                        { value: "active", label: "Active Only", count: stats.active, color: "#16a34a" },
                        { value: "inactive", label: "Inactive Only", count: stats.inactive, color: "#f59e0b" },
                      ].map((opt) => {
                        const isSelected = statusFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className={`um-dropdown-item ${isSelected ? "selected" : ""}`}
                            onClick={() => {
                              setStatusFilter(opt.value);
                              setOpenUmDropdown(null);
                            }}
                          >
                            <div className="um-dropdown-item-left">
                              <span
                                className="um-dropdown-dot"
                                style={{ backgroundColor: opt.color }}
                              />
                              <span className="um-dropdown-item-text">{opt.label}</span>
                            </div>
                            <div className="um-dropdown-item-right">
                              <span className="um-dropdown-badge">{opt.count}</span>
                              {isSelected && <Check size={14} className="um-dropdown-check" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
        </div>

      {/* Main Panel (Users Table) */}
      <section className="um-panel">
        {/* Users Table */}
        <div className="um-table-wrap">
          {loading ? (
            <div className="um-loading">
              <RefreshCw size={20} className="um-loading-spinner" />
              <span>Loading user accounts...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="um-empty-state">
              <Users size={36} />
              <strong>No Users Found</strong>
              <p>
                {search || roleFilter !== "all" || statusFilter !== "all"
                  ? "No accounts match your current filters."
                  : "No user accounts are registered yet."}
              </p>
            </div>
          ) : (
            <table className="um-table">
              <thead>
                <tr>
                  <th>User / Username</th>
                  <th>Email Address</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const isCurrent = user.user_id === currentUser?.user_id;
                  const initials = (user.full_name || "AD")
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0].toUpperCase())
                    .join("");

                  return (
                    <tr key={user.user_id}>
                      <td>
                        <div className="um-user-cell">
                          <div
                            className={`um-user-avatar ${user.role === "Super Admin" ? "super-admin" : ""
                              }`}
                          >
                            {initials || "U"}
                          </div>
                          <div className="um-user-details">
                            <span className="um-user-name">
                              {user.full_name}
                              {isCurrent && (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    color: "#2563eb",
                                    marginLeft: "6px",
                                    fontWeight: "600",
                                  }}
                                >
                                  (You)
                                </span>
                              )}
                            </span>
                            <span className="um-user-subtext">
                              ID: #{user.user_id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span style={{ color: "#334155" }}>{user.email}</span>
                      </td>

                      <td>
                        <span
                          className={`um-badge ${user.role === "Super Admin"
                              ? "role-super-admin"
                              : "role-admin"
                            }`}
                        >
                          {user.role === "Super Admin" && (
                            <ShieldCheck size={12} />
                          )}
                          {user.role}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`um-badge ${Number(user.is_active) === 1 || user.is_active === true ? "status-active" : "status-inactive"
                            }`}
                        >
                          <span className="um-status-dot" />
                          {Number(user.is_active) === 1 || user.is_active === true ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td>
                        <span style={{ color: "#64748b", fontSize: "12.5px" }}>
                          {formatDate(user.created_at)}
                        </span>
                      </td>

                      <td>
                        <div
                          className="um-actions-cell"
                          style={{ justifyContent: "flex-end" }}
                        >
                          {/* Toggle Active/Inactive */}
                          <button
                            type="button"
                            className={`um-action-btn toggle ${Number(user.is_active) === 1 || user.is_active === true ? "active-state" : ""
                              }`}
                            disabled={isCurrent || togglingId === user.user_id}
                            onClick={() => handleToggleStatus(user)}
                            title={
                              isCurrent
                                ? "Cannot toggle own status"
                                : (Number(user.is_active) === 1 || user.is_active === true)
                                  ? "Deactivate account"
                                  : "Activate account"
                            }
                          >
                            {(Number(user.is_active) === 1 || user.is_active === true) ? (
                              <UserX size={15} />
                            ) : (
                              <UserCheck size={15} />
                            )}
                          </button>

                          {/* Edit Administrator */}
                          <button
                            type="button"
                            className="um-action-btn edit"
                            onClick={() => handleOpenEdit(user)}
                            title="Edit administrator details or reset password"
                          >
                            <Pencil size={15} />
                          </button>

                          {/* Delete Account */}
                          <button
                            type="button"
                            className="um-action-btn delete"
                            disabled={isCurrent}
                            onClick={() => setUserToDelete(user)}
                            title={
                              isCurrent
                                ? "Cannot delete own account"
                                : "Delete account"
                            }
                          >
                            <Trash2 size={15} />
                          </button>

                          {/* Transfer Account / Merge Data — Super Admin only */}
                          {currentUser?.role === "Super Admin" && (
                            <button
                              type="button"
                              className="um-action-btn transfer"
                              onClick={() => handleOpenTransfer(user)}
                              title={
                                user.role === "Super Admin"
                                  ? "Transfer Super Admin privileges & account"
                                  : "Transfer & merge administrator data"
                              }
                            >
                              <ArrowRightLeft size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Add New Admin Modal */}
      {showAddModal && (
        <div
          className="um-modal-overlay"
          onClick={() => !submitting && setShowAddModal(false)}
        >
          <div
            className="um-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="um-modal-header">
              <div className="um-modal-header-text">
                <h3>Add New Administrator</h3>
                <p>
                  Create login credentials for a new Admin. They will have their
                  own isolated quotation and dashboard workspace.
                </p>
              </div>
              <button
                type="button"
                className="um-modal-close"
                disabled={submitting}
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form className="um-modal-form" onSubmit={handleAddSubmit}>
              {addError && (
                <div className="um-alert error" style={{ marginBottom: "16px" }}>
                  <AlertCircle size={16} />
                  <span>{addError}</span>
                </div>
              )}

              <div className="um-form-group">
                <label>
                  Username / Full Name <span className="required">*</span>
                </label>
                <div className="um-input-wrap">
                  <User size={16} className="icon-lead" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ruwan Silva"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="um-form-group">
                <label>
                  Email Address <span className="required">*</span>
                </label>
                <div className="um-input-wrap">
                  <Mail size={16} className="icon-lead" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. ruwan@example.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <small className="um-field-note">
                  This email will be used to log in to the admin dashboard.
                </small>
              </div>

              <div className="um-form-group">
                <label>
                  Password <span className="required">*</span>
                </label>
                <div className="um-input-wrap">
                  <Lock size={16} className="icon-lead" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Enter password (minimum 6 characters)"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="pwd-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <small className="um-field-note">
                  Must be at least 6 characters long.
                </small>
              </div>

              <div className="um-form-notice">
                <Info size={18} style={{ flexShrink: 0 }} />
                <span>
                  The new administrator will log in using this email and password,
                  and will immediately access a brand-new Admin Dashboard showing
                  only their own quotations.
                </span>
              </div>

              <div className="um-modal-actions">
                <button
                  type="button"
                  className="um-btn cancel"
                  disabled={submitting}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="um-btn primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={15} className="um-loading-spinner" />
                      <span>Creating Admin...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      <span>Create Admin</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {editingUser && (
        <div
          className="um-modal-overlay"
          onClick={() => !editSubmitting && setEditingUser(null)}
        >
          <div
            className="um-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="um-modal-header">
              <div className="um-modal-header-text">
                <h3>Edit Administrator Account</h3>
                <p>
                  Update details or assign a new password for {editingUser.full_name}.
                </p>
              </div>
              <button
                type="button"
                className="um-modal-close"
                disabled={editSubmitting}
                onClick={() => setEditingUser(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form className="um-modal-form" onSubmit={handleEditSubmit}>
              {editError && (
                <div className="um-alert error" style={{ marginBottom: "16px" }}>
                  <AlertCircle size={16} />
                  <span>{editError}</span>
                </div>
              )}

              <div className="um-form-group">
                <label>
                  Username / Full Name <span className="required">*</span>
                </label>
                <div className="um-input-wrap">
                  <User size={16} className="icon-lead" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ruwan Silva"
                    value={editFormData.username}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, username: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="um-form-group">
                <label>
                  Email Address <span className="required">*</span>
                </label>
                <div className="um-input-wrap">
                  <Mail size={16} className="icon-lead" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. ruwan@example.com"
                    value={editFormData.email}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, email: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="um-form-group">
                <label>
                  New Password (Optional)
                </label>
                <div className="um-input-wrap">
                  <Lock size={16} className="icon-lead" />
                  <input
                    type={showEditPassword ? "text" : "password"}
                    placeholder="Leave blank to keep existing password"
                    value={editFormData.password}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, password: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="pwd-toggle"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    tabIndex={-1}
                  >
                    {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <small className="um-field-note">
                  Enter a new password (min. 6 characters) only if you want to reset it.
                </small>
              </div>

              <div className="um-modal-actions">
                <button
                  type="button"
                  className="um-btn cancel"
                  disabled={editSubmitting}
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="um-btn primary"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? (
                    <>
                      <RefreshCw size={15} className="um-loading-spinner" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div
          className="um-modal-overlay"
          onClick={() => !deleting && setUserToDelete(null)}
        >
          <div
            className="um-modal-card um-delete-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="um-delete-icon-wrap">
              <Trash2 size={24} />
            </div>

            <h3 className="um-delete-title">Delete User Account</h3>
            <p className="um-delete-desc">
              Are you sure you want to permanently delete the account for{" "}
              <strong>{userToDelete.full_name}</strong> ({userToDelete.email})?
              This action cannot be undone.
            </p>

            <div className="um-delete-actions">
              <button
                type="button"
                className="um-btn cancel"
                style={{ flex: 1 }}
                disabled={deleting}
                onClick={() => setUserToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="um-btn danger"
                style={{ flex: 1 }}
                disabled={deleting}
                onClick={handleConfirmDelete}
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer / Merge Account Modal */}
      {transferModalUser && (
        <div
          className="um-modal-overlay"
          onClick={() => !transferSubmitting && setTransferModalUser(null)}
        >
          <div
            className="um-modal-card um-transfer-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="um-modal-header um-transfer-header">
              <div className="um-modal-header-text">
                <div className="um-transfer-title-row">
                  <h3>
                    {transferStep === 1
                      ? transferModalUser.role === "Super Admin"
                        ? "Transfer Super Admin Ownership"
                        : "Transfer & Merge Admin Data"
                      : "Confirm Account & Data Transfer"}
                  </h3>
                  <span
                    className={`um-badge ${
                      transferModalUser.role === "Super Admin"
                        ? "role-super-admin"
                        : "role-admin"
                    }`}
                  >
                    {transferModalUser.role}
                  </span>
                </div>
                <p className="um-transfer-subtitle">
                  {transferStep === 1
                    ? transferModalUser.role === "Super Admin"
                      ? "Assign Super Admin control and ownership to an active administrator."
                      : `Transfer all invoices, quotations, customers, and records of ${transferModalUser.full_name} to another active administrator.`
                    : "Please review the confirmation warning below before completing this irreversible operation."}
                </p>
              </div>
              <button
                type="button"
                className="um-modal-close"
                disabled={transferSubmitting}
                onClick={() => setTransferModalUser(null)}
              >
                <X size={18} />
              </button>
            </div>

            {transferError && (
              <div className="um-alert error um-transfer-alert">
                <AlertCircle size={15} />
                <span>{transferError}</span>
              </div>
            )}

            {transferStep === 1 ? (
              <form className="um-modal-form um-transfer-form" onSubmit={handleProceedToConfirm}>
                {/* Source Account Slim Banner */}
                <div className="um-transfer-source-pill">
                  <span className="um-transfer-pill-tag">From (Source):</span>
                  <div className="um-transfer-pill-user">
                    <span className="um-transfer-pill-avatar">
                      {(transferModalUser.full_name || "AD")
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0].toUpperCase())
                        .join("")}
                    </span>
                    <strong className="um-transfer-pill-name">{transferModalUser.full_name}</strong>
                    <span className="um-transfer-pill-meta">({transferModalUser.email} &bull; ID: #{transferModalUser.user_id})</span>
                  </div>
                  <span className="um-transfer-deact-tag">Will Deactivate</span>
                </div>

                {/* Recipient Admin */}
                <div className="um-form-group um-compact-group">
                  <label>
                    Recipient Administrator <span className="required">*</span>
                  </label>
                  <div className="um-input-wrap">
                    <User size={15} className="icon-lead" />
                    <select
                      className="um-select-input"
                      required
                      value={transferTargetUserId}
                      onChange={(e) => handleTargetUserChange(e.target.value)}
                    >
                      <option value="">-- Select Recipient Admin --</option>
                      {users
                        .filter(
                          (u) =>
                            u.user_id !== transferModalUser.user_id &&
                            (Number(u.is_active) === 1 || u.is_active === true)
                        )
                        .map((target) => (
                          <option key={target.user_id} value={target.user_id}>
                            {target.full_name} ({target.email})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Recipient Email Address */}
                <div className="um-form-group um-compact-group">
                  <label>
                    Recipient Email Address <span className="required">*</span>
                  </label>
                  <div className="um-input-wrap">
                    <Mail size={15} className="icon-lead" />
                    <input
                      type="email"
                      required
                      placeholder="Recipient's registered email"
                      value={transferTargetEmail}
                      onChange={(e) => setTransferTargetEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* Super Admin Password for Security Authorization */}
                <div className="um-form-group um-compact-group">
                  <label>
                    Super Admin Password (Authorization) <span className="required">*</span>
                  </label>
                  <div className="um-input-wrap">
                    <Lock size={15} className="icon-lead" />
                    <input
                      type={showTransferPassword ? "text" : "password"}
                      required
                      placeholder="Enter your password to authorize transfer"
                      value={transferPassword}
                      onChange={(e) => setTransferPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="pwd-toggle"
                      onClick={() => setShowTransferPassword(!showTransferPassword)}
                      tabIndex={-1}
                    >
                      {showTransferPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Compact Explanatory Notice */}
                <div className="um-transfer-compact-notice">
                  <Info size={15} style={{ flexShrink: 0 }} />
                  <span>
                    {transferModalUser.role === "Super Admin"
                      ? "Super Admin ownership and data will be transferred to the selected Admin. Your account will be deactivated and your active session will end."
                      : `All invoices, quotations, customers, and payments of ${transferModalUser.full_name} will be merged into the recipient Admin's account, and ${transferModalUser.full_name} will be deactivated.`}
                  </span>
                </div>

                <div className="um-modal-actions um-transfer-actions">
                  <button
                    type="button"
                    className="um-btn cancel"
                    disabled={transferSubmitting}
                    onClick={() => setTransferModalUser(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="um-btn primary"
                    disabled={transferSubmitting}
                  >
                    <ArrowRightLeft size={15} />
                    <span>Review & Proceed</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Step 2: Confirmation Warning Modal */
              <div className="um-modal-form um-transfer-form">
                <div className="um-transfer-warning-banner">
                  <div className="um-warning-icon-wrap">
                    <AlertTriangle size={22} />
                  </div>
                  <div className="um-warning-text">
                    <h4>Warning: Confirm Account and Data Transfer</h4>
                    <p className="um-warning-sinhala">
                      Once data and permissions of this Super Admin / Admin are transferred to the new Admin, this account will be deactivated. All Invoices, Quotations, and Dashboard data will be transferred to the new Admin. This action cannot be undone.
                    </p>
                    <p className="um-warning-english">
                      All records (Invoices, Quotations, Customers, and Payments) will be permanently reassigned to the recipient. The source account will be deactivated immediately.
                    </p>
                  </div>
                </div>

                {/* Transfer Flow Visual Summary */}
                <div className="um-transfer-summary-box">
                  <div className="um-summary-col">
                    <span className="summary-title">From Account:</span>
                    <strong>{transferModalUser.full_name}</strong>
                    <span>{transferModalUser.email}</span>
                    <span className="summary-badge source">{transferModalUser.role} (Deactivating)</span>
                  </div>

                  <div className="um-summary-arrow">
                    <ArrowRightLeft size={18} />
                  </div>

                  <div className="um-summary-col">
                    <span className="summary-title">To Recipient:</span>
                    <strong>
                      {users.find((u) => String(u.user_id) === String(transferTargetUserId))?.full_name ||
                        "Selected Administrator"}
                    </strong>
                    <span>{transferTargetEmail}</span>
                    <span className="summary-badge target">
                      {transferModalUser.role === "Super Admin" ? "New Super Admin" : "Active Admin (Recipient)"}
                    </span>
                  </div>
                </div>

                <div className="um-modal-actions um-transfer-actions">
                  <button
                    type="button"
                    className="um-btn cancel"
                    disabled={transferSubmitting}
                    onClick={() => setTransferStep(1)}
                  >
                    Back to Edit
                  </button>
                  <button
                    type="button"
                    className="um-btn danger"
                    disabled={transferSubmitting}
                    onClick={handleExecuteTransfer}
                  >
                    {transferSubmitting ? (
                      <>
                        <RefreshCw size={15} className="um-loading-spinner" />
                        <span>Transferring Account...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={15} />
                        <span>Confirm & Transfer Now</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
