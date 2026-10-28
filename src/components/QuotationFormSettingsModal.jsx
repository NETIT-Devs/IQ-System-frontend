import { useState, useEffect } from "react";
import { X, Plus, Edit2, Trash2, Check, AlertCircle, Layers, DollarSign, RefreshCw } from "lucide-react";
import {
  getCatalogServices,
  createCatalogService,
  updateCatalogService,
  deleteCatalogService,
} from "../services/quotationService";
import "./QuotationSettings.css";

export default function QuotationFormSettingsModal({ isOpen, onClose, onServicesUpdated }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Editing / Creating State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    item_name: "",
    description: "",
    default_price: "",
    hosting_domain: "",
    core_features: "",
    maintenance_support: "",
    content_seo: "",
    is_active: 1,
  });

  const loadServices = async () => {
    try {
      setLoading(true);
      setError("");
      const list = await getCatalogServices();
      setServices(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.message || "Failed to load service options.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadServices();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setForm({
      item_name: "",
      description: "",
      default_price: "",
      hosting_domain: "",
      core_features: "",
      maintenance_support: "",
      content_seo: "",
      is_active: 1,
    });
    setError("");
    setSuccess("");
  };

  const handleStartCreate = () => {
    resetForm();
    setIsEditing(true);
    setEditingId("new");
  };

  const handleStartEdit = (service) => {
    setIsEditing(true);
    setEditingId(service.service_id);
    setForm({
      item_name: service.item_name || "",
      description: service.description || "",
      default_price: service.default_price || "",
      hosting_domain: service.hosting_domain || "",
      core_features: service.core_features || "",
      maintenance_support: service.maintenance_support || "",
      content_seo: service.content_seo || "",
      is_active: service.is_active ?? 1,
    });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.item_name.trim()) {
      setError("Service / Item name is required.");
      return;
    }

    try {
      setSaving(true);
      if (editingId === "new") {
        await createCatalogService(form);
        setSuccess(`Service "${form.item_name}" added successfully.`);
      } else {
        await updateCatalogService(editingId, form);
        setSuccess(`Service "${form.item_name}" updated successfully.`);
      }

      await loadServices();
      setIsEditing(false);
      setEditingId(null);
      if (onServicesUpdated) onServicesUpdated();
    } catch (err) {
      setError(err?.message || "Failed to save service option.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete service "${service.item_name}"? Existing quotations will not be affected.`
    );
    if (!confirmDelete) return;

    try {
      setLoading(true);
      await deleteCatalogService(service.service_id);
      setSuccess(`Service "${service.item_name}" removed.`);
      await loadServices();
      if (onServicesUpdated) onServicesUpdated();
    } catch (err) {
      setError(err?.message || "Failed to delete service.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="qs-modal-overlay" onClick={onClose}>
      <div className="qs-modal-box qs-modal-large" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="qs-modal-header">
          <div className="qs-header-icon-box">
            <Layers size={20} />
          </div>
          <div>
            <h3>Quotation Form Settings (Service Types)</h3>
            <p>Manage service options available in the quotation creation form for Admin and Super Admin.</p>
          </div>
          <button type="button" className="qs-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="qs-modal-body">
          {error && (
            <div className="qs-alert qs-alert-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="qs-alert qs-alert-success">
              <Check size={16} />
              <span>{success}</span>
            </div>
          )}

          {!isEditing ? (
            <div className="qs-list-section">
              <div className="qs-list-toolbar">
                <div>
                  <span className="qs-section-title">Current Service Catalog ({services.length})</span>
                  <p className="qs-section-desc">These items populate the service dropdown on the quotation form.</p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button" className="qs-btn-secondary" onClick={loadServices} disabled={loading} title="Refresh list">
                    <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
                  </button>
                  <button type="button" className="qs-btn-primary" onClick={handleStartCreate}>
                    <Plus size={14} /> Add New Service
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="qs-loading-box">Loading service catalog...</div>
              ) : services.length === 0 ? (
                <div className="qs-empty-box">No services found. Click &quot;Add New Service&quot; to create one.</div>
              ) : (
                <div className="qs-table-wrap">
                  <table className="qs-table">
                    <thead>
                      <tr>
                        <th>SERVICE / ITEM NAME</th>
                        <th>DESCRIPTION / SCOPE</th>
                        <th>DEFAULT PRICE</th>
                        <th>STATUS</th>
                        <th style={{ textAlign: "right" }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((svc) => (
                        <tr key={svc.service_id}>
                          <td>
                            <strong>{svc.item_name}</strong>
                          </td>
                          <td style={{ maxWidth: "260px" }}>
                            <span className="qs-text-clamp">{svc.description || "—"}</span>
                          </td>
                          <td>
                            <strong>
                              {Number(svc.default_price || 0) > 0
                                ? `LKR ${Number(svc.default_price).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                                : "Variable"}
                            </strong>
                          </td>
                          <td>
                            <span className={`qs-status-pill ${svc.is_active ? "active" : "inactive"}`}>
                              {svc.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div className="qs-row-actions">
                              <button
                                type="button"
                                className="qs-icon-btn edit"
                                title="Edit service"
                                onClick={() => handleStartEdit(svc)}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                className="qs-icon-btn delete"
                                title="Delete service"
                                onClick={() => handleDelete(svc)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* Create / Edit Form */
            <form className="qs-form" onSubmit={handleSubmit}>
              <div className="qs-form-header">
                <h4>{editingId === "new" ? "Add New Service Option" : `Edit Service: ${form.item_name}`}</h4>
                <button type="button" className="qs-btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
              </div>

              <div className="qs-form-grid">
                <div className="qs-form-group full-width">
                  <label>
                    Service / Item Name <span className="qs-required">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mobile App Development, E-Commerce Portal, SEO & Marketing"
                    value={form.item_name}
                    onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                  />
                  <small>This name will appear directly in the quotation service dropdown for all users.</small>
                </div>

                <div className="qs-form-group">
                  <label>Default Price (LKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00 (leave 0 for custom price)"
                    value={form.default_price}
                    onChange={(e) => setForm({ ...form, default_price: e.target.value })}
                  />
                </div>

                <div className="qs-form-group">
                  <label>Status</label>
                  <select
                    value={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: Number(e.target.value) })}
                  >
                    <option value={1}>Active (Visible in Dropdown)</option>
                    <option value={0}>Inactive (Hidden)</option>
                  </select>
                </div>

                <div className="qs-form-group full-width">
                  <label>Scope / Service Description</label>
                  <textarea
                    rows={2}
                    placeholder="Brief description of the service deliverables..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>

                <div className="qs-form-group">
                  <label>Default Hosting &amp; Domain Details</label>
                  <input
                    type="text"
                    placeholder="e.g. 1 Year High-Speed Cloud Hosting & Free .COM Domain"
                    value={form.hosting_domain}
                    onChange={(e) => setForm({ ...form, hosting_domain: e.target.value })}
                  />
                </div>

                <div className="qs-form-group">
                  <label>Default Core Features</label>
                  <input
                    type="text"
                    placeholder="e.g. Responsive Design, Admin Panel, Payment Gateway"
                    value={form.core_features}
                    onChange={(e) => setForm({ ...form, core_features: e.target.value })}
                  />
                </div>

                <div className="qs-form-group">
                  <label>Default Maintenance &amp; Support</label>
                  <input
                    type="text"
                    placeholder="e.g. 3 Months Free Technical Support and Bug Fixes"
                    value={form.maintenance_support}
                    onChange={(e) => setForm({ ...form, maintenance_support: e.target.value })}
                  />
                </div>

                <div className="qs-form-group">
                  <label>Default Content &amp; SEO Scope</label>
                  <input
                    type="text"
                    placeholder="e.g. On-Page SEO, Speed Optimization, Google Indexing"
                    value={form.content_seo}
                    onChange={(e) => setForm({ ...form, content_seo: e.target.value })}
                  />
                </div>
              </div>

              <div className="qs-modal-footer">
                <button type="button" className="qs-btn-secondary" onClick={resetForm} disabled={saving}>
                  Back to List
                </button>
                <button type="submit" className="qs-btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingId === "new" ? "Save Service Option" : "Update Service Option"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
