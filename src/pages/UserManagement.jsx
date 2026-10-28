import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import {
  fetchUsers,
  createAdminUser,
  updateUserAccount,
  toggleUserAccountStatus,
  deleteUserAccount,
} from "../services/userService";
import { getAuthenticatedUser } from "../utils/authStorage";
import "./UserManagement.css";

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

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const records = await fetchUsers();
      setUsers(Array.isArray(records) ? records : []);
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

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && u.is_active) ||
        (statusFilter === "inactive" && !u.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const activeAdmins = users.filter(
      (u) => u.role === "Admin" && u.is_active
    ).length;
    const superAdmins = users.filter((u) => u.role === "Super Admin").length;
    const inactive = users.filter((u) => !u.is_active).length;

    return { total, activeAdmins, superAdmins, inactive };
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
      await createAdminUser({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });

      setSuccessMsg(
        `Admin account for "${formData.username}" (${formData.email}) created successfully! They can now log in with their credentials.`
      );
      setShowAddModal(false);
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
      setSuccessMsg(`User account "${userToDelete.full_name}" deleted successfully.`);
      setUserToDelete(null);
      await loadData();
    } catch (err) {
      console.error("Delete user error:", err);
      setError(err?.message || "Failed to delete user account.");
    } finally {
      setDeleting(false);
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

      {/* Statistics Cards */}
      <section className="um-stats-grid">
        <div className="um-stat-card">
          <div className="um-stat-icon blue">
            <Users size={22} />
          </div>
          <div className="um-stat-info">
            <p>Total Users</p>
            <h3>{stats.total}</h3>
          </div>
        </div>

        <div className="um-stat-card">
          <div className="um-stat-icon navy">
            <UserCheck size={22} />
          </div>
          <div className="um-stat-info">
            <p>Active Admins</p>
            <h3>{stats.activeAdmins}</h3>
          </div>
        </div>

        <div className="um-stat-card">
          <div className="um-stat-icon green">
            <ShieldCheck size={22} />
          </div>
          <div className="um-stat-info">
            <p>Super Admins</p>
            <h3>{stats.superAdmins}</h3>
          </div>
        </div>

        <div className="um-stat-card">
          <div className="um-stat-icon amber">
            <UserX size={22} />
          </div>
          <div className="um-stat-info">
            <p>Inactive Accounts</p>
            <h3>{stats.inactive}</h3>
          </div>
        </div>
      </section>

      {/* Main Panel */}
      <section className="um-panel">
        {/* Toolbar */}
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

            <select
              className="um-filter-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="Super Admin">Super Admin</option>
            </select>

            <select
              className="um-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          <button
            type="button"
            className="um-refresh-btn"
            onClick={loadData}
            title="Refresh user list"
          >
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
        </div>

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
                            className={`um-user-avatar ${
                              user.role === "Super Admin" ? "super-admin" : ""
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
                          className={`um-badge ${
                            user.role === "Super Admin"
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
                          className={`um-badge ${
                            user.is_active ? "status-active" : "status-inactive"
                          }`}
                        >
                          <span className="um-status-dot" />
                          {user.is_active ? "Active" : "Inactive"}
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
                            className={`um-action-btn toggle ${
                              user.is_active ? "active-state" : ""
                            }`}
                            disabled={isCurrent || togglingId === user.user_id}
                            onClick={() => handleToggleStatus(user)}
                            title={
                              isCurrent
                                ? "Cannot toggle own status"
                                : user.is_active
                                ? "Deactivate account"
                                : "Activate account"
                            }
                          >
                            {user.is_active ? (
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
    </main>
  );
}
