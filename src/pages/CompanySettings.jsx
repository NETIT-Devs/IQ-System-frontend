import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Landmark,
  FileText,
  Upload,
  Check,
  AlertCircle,
  Save,
  Trash2,
  RefreshCw,
  Eye,
  ShieldCheck,
  CreditCard,
  Sliders,
  Menu,
  ImageIcon,
  FileCheck,
  Plus,
  Edit2,
  Layers,
  SlidersHorizontal,
  X,
  Receipt,
  Sparkles,
} from "lucide-react";
import {
  getCompanySettings,
  updateCompanySettings,
  uploadCompanyLogo,
  uploadCompanySignature,
  removeCompanyLogo,
  removeCompanySignature,
} from "../services/companySettingsService";
import {
  getCatalogServices,
  createCatalogService,
  updateCatalogService,
  deleteCatalogService,
} from "../services/quotationService";
import "./CompanySettings.css";

export default function CompanySettings() {
  const { openSidebar } = useOutletContext?.() || {};

  // Active top-level navigation tab: "profile" | "signature" | "banking" | "quotation"
  const [activeTab, setActiveTab] = useState("profile");

  // Quotation sub-tab switcher: "template" (PDF layout) | "form" (Service catalog)
  const [quotationSubTab, setQuotationSubTab] = useState("template");

  // Main company form data matching company_settings schema
  const [formData, setFormData] = useState({
    company_name: "",
    email_address: "",
    contact_number: "",
    company_address: "",
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_branch: "",
    bank_swift_code: "",
    default_terms_and_conditions: "",
    pdf_heading: "QUOTATION",
    pdf_subheading: "PROFESSIONAL SERVICES PROPOSAL",
    pdf_custom_lines: "",
    pdf_footer_note: "",
  });

  // Custom headings & sub-sections state (e.g. SERVICE SCOPE, DELIVERABLES)
  const [customSections, setCustomSections] = useState([]);

  // Image URLs and preview state
  const [logoUrl, setLogoUrl] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");

  // Loading and feedback states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Service Catalog state (Form Settings feature)
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [isEditingService, setIsEditingService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    item_name: "",
    description: "",
    default_price: "",
    hosting_domain: "",
    core_features: "",
    maintenance_support: "",
    content_seo: "",
    is_active: 1,
  });

  // File input refs
  const logoInputRef = useRef(null);
  const signatureInputRef = useRef(null);

  /**
   * Load company settings and custom template sections from backend API
   */
  async function loadSettings() {
    try {
      setLoading(true);
      setError("");
      const data = await getCompanySettings();

      if (data) {
        setFormData({
          company_name: data.company_name || "",
          email_address: data.email_address || "",
          contact_number: data.contact_number || "",
          company_address: data.company_address || "",
          bank_name: data.bank_name || "",
          bank_account_name: data.bank_account_name || "",
          bank_account_number: data.bank_account_number || "",
          bank_branch: data.bank_branch || "",
          bank_swift_code: data.bank_swift_code || "",
          default_terms_and_conditions: data.default_terms_and_conditions || "",
          pdf_heading: data.pdf_heading || "QUOTATION",
          pdf_subheading:
            data.pdf_subheading || "PROFESSIONAL SERVICES PROPOSAL",
          pdf_custom_lines: data.pdf_custom_lines || "",
          pdf_footer_note: data.pdf_footer_note || "",
        });

        setLogoUrl(data.logo_url || "");
        setSignatureUrl(data.signature_url || "");

        // Parse custom headings / sections if available
        let loadedSections = [];
        if (data.pdf_custom_sections) {
          try {
            loadedSections =
              typeof data.pdf_custom_sections === "string"
                ? JSON.parse(data.pdf_custom_sections)
                : data.pdf_custom_sections;
          } catch {
            loadedSections = [];
          }
        }
        setCustomSections(Array.isArray(loadedSections) ? loadedSections : []);
      }
    } catch (err) {
      console.error("Failed to load company settings:", err);
      setError(
        err?.message || "Could not retrieve company settings from server."
      );
    } finally {
      setLoading(false);
    }
  }

  /**
   * Load service options catalog for Quotation Form Settings
   */
  async function loadServices() {
    try {
      setLoadingServices(true);
      const list = await getCatalogServices();
      setServices(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn("Failed to load service options:", err);
    } finally {
      setLoadingServices(false);
    }
  }

  useEffect(() => {
    loadSettings();
    loadServices();
  }, []);

  /**
   * Handle text and textarea input updates
   */
  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  /**
   * Custom sections (Headings + Sub-text) handlers
   */
  const handleAddCustomSection = () => {
    setCustomSections((prev) => [
      ...prev,
      {
        id: Date.now(),
        heading: "",
        sub_text: "",
      },
    ]);
  };

  const handleUpdateCustomSection = (index, field, value) => {
    setCustomSections((prev) =>
      prev.map((sec, idx) => (idx === index ? { ...sec, [field]: value } : sec))
    );
  };

  const handleDeleteCustomSection = (index) => {
    setCustomSections((prev) => prev.filter((_, idx) => idx !== index));
  };

  /**
   * Service Catalog handlers (Form Settings)
   */
  const handleStartCreateService = () => {
    setIsEditingService(true);
    setEditingServiceId("new");
    setServiceForm({
      item_name: "",
      description: "",
      default_price: "",
      hosting_domain: "",
      core_features: "",
      maintenance_support: "",
      content_seo: "",
      is_active: 1,
    });
  };

  const handleStartEditService = (service) => {
    setIsEditingService(true);
    setEditingServiceId(service.service_id);
    setServiceForm({
      item_name: service.item_name || "",
      description: service.description || "",
      default_price: service.default_price || "",
      hosting_domain: service.hosting_domain || "",
      core_features: service.core_features || "",
      maintenance_support: service.maintenance_support || "",
      content_seo: service.content_seo || "",
      is_active: service.is_active ?? 1,
    });
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!serviceForm.item_name.trim()) {
      setError("Service / Item name is required.");
      return;
    }

    try {
      setSaving(true);
      if (editingServiceId === "new") {
        await createCatalogService(serviceForm);
        setSuccess(`Service option "${serviceForm.item_name}" added to quotation form.`);
      } else {
        await updateCatalogService(editingServiceId, serviceForm);
        setSuccess(`Service option "${serviceForm.item_name}" updated successfully.`);
      }

      await loadServices();
      setIsEditingService(false);
      setEditingServiceId(null);
    } catch (err) {
      setError(err?.message || "Failed to save service option.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = async (service) => {
    const confirmed = window.confirm(
      `Delete service option "${service.item_name}"? Existing quotations will remain unaffected.`
    );
    if (!confirmed) return;

    try {
      setLoadingServices(true);
      await deleteCatalogService(service.service_id);
      setSuccess(`Service option "${service.item_name}" removed from quotation dropdown.`);
      await loadServices();
    } catch (err) {
      setError(err?.message || "Failed to delete service option.");
    } finally {
      setLoadingServices(false);
    }
  };

  /**
   * Handle official logo upload
   */
  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Logo image size exceeds 2MB limit. Please choose a smaller file.");
      return;
    }

    try {
      setUploadingLogo(true);
      setError("");
      setSuccess("");

      const result = await uploadCompanyLogo(file);
      const newLogoPath = result?.companySettings?.company_logo;

      if (newLogoPath) {
        setLogoUrl(newLogoPath);
      }
      setSuccess("Company logo updated successfully! All sidebars, login page, and PDF documents now reflect the new logo.");
      await loadSettings();
    } catch (err) {
      console.error("Logo upload error:", err);
      setError(err?.message || "Failed to upload company logo.");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  /**
   * Handle digital signature upload
   */
  async function handleSignatureUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Signature image size exceeds 2MB limit. Please choose a smaller file.");
      return;
    }

    try {
      setUploadingSignature(true);
      setError("");
      setSuccess("");

      const result = await uploadCompanySignature(file);
      const newSignaturePath = result?.companySettings?.company_signature;

      if (newSignaturePath) {
        setSignatureUrl(newSignaturePath);
      }
      setSuccess("Digital signature uploaded successfully! All generated quotation PDFs will now include this authorized signature.");
      await loadSettings();
    } catch (err) {
      console.error("Signature upload error:", err);
      setError(err?.message || "Failed to upload authorized signature.");
    } finally {
      setUploadingSignature(false);
      if (signatureInputRef.current) signatureInputRef.current.value = "";
    }
  }

  /**
   * Handle logo removal
   */
  async function handleRemoveLogo() {
    if (!window.confirm("Are you sure you want to remove the company logo?")) return;
    try {
      setUploadingLogo(true);
      await removeCompanyLogo();
      setLogoUrl("");
      setSuccess("Company logo removed. System default branding restored.");
      await loadSettings();
    } catch (err) {
      setError(err?.message || "Failed to remove company logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  /**
   * Handle signature removal
   */
  async function handleRemoveSignature() {
    if (!window.confirm("Are you sure you want to remove the authorized signature?")) return;
    try {
      setUploadingSignature(true);
      await removeCompanySignature();
      setSignatureUrl("");
      setSuccess("Digital signature removed from PDF generation.");
      await loadSettings();
    } catch (err) {
      setError(err?.message || "Failed to remove signature.");
    } finally {
      setUploadingSignature(false);
    }
  }

  /**
   * Submit updated company settings to backend
   */
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.company_name.trim()) {
      setError("Company Name is required.");
      return;
    }

    if (!formData.email_address.trim()) {
      setError("Company Email Address is required.");
      return;
    }

    // Clean custom headings/sections
    const cleanedSections = customSections
      .map((s) => ({
        heading: String(s.heading || "").trim(),
        sub_text: String(s.sub_text || "").trim(),
      }))
      .filter((s) => s.heading || s.sub_text);

    try {
      setSaving(true);

      await updateCompanySettings({
        company_name: formData.company_name.trim(),
        email_address: formData.email_address.trim(),
        contact_number: formData.contact_number.trim(),
        company_address: formData.company_address.trim(),
        bank_name: formData.bank_name.trim(),
        bank_account_name: formData.bank_account_name.trim(),
        bank_account_number: formData.bank_account_number.trim(),
        bank_branch: formData.bank_branch.trim(),
        bank_swift_code: formData.bank_swift_code.trim(),
        default_terms_and_conditions: formData.default_terms_and_conditions.trim(),
        pdf_heading: formData.pdf_heading.trim(),
        pdf_subheading: formData.pdf_subheading.trim(),
        pdf_custom_lines: formData.pdf_custom_lines.trim(),
        pdf_footer_note: formData.pdf_footer_note.trim(),
        pdf_custom_sections: cleanedSections.length > 0 ? cleanedSections : null,
      });

      setSuccess("Company settings and quotation policies saved successfully! All quotations, invoices, and PDF downloads are now synchronized.");
      await loadSettings();
    } catch (err) {
      console.error("Failed to save company settings:", err);
      setError(err?.message || "Failed to save company settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="cs-page">
      {/* Page Header */}
      <header className="cs-header">
        <div className="cs-header-left">
          {openSidebar && (
            <button
              type="button"
              className="cs-menu-button"
              onClick={openSidebar}
              aria-label="Toggle menu"
            >
              <Menu size={20} />
            </button>
          )}
          <div>
            <p className="cs-eyebrow">Administration / Company Settings</p>
            <h1>Company Settings</h1>
          </div>
        </div>

        <div className="cs-header-actions">
          <button
            type="button"
            className="cs-refresh-btn"
            onClick={loadSettings}
            disabled={loading || saving}
            title="Refresh settings from server"
          >
            <RefreshCw size={14} className={loading ? "cs-spin" : ""} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="cs-primary-save-btn"
            onClick={handleSubmit}
            disabled={loading || saving}
          >
            <Save size={15} />
            <span>{saving ? "Saving Changes..." : "Save Settings"}</span>
          </button>
        </div>
      </header>

      {/* Alert Notices */}
      {error && (
        <div className="cs-alert cs-alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      {success && (
        <div className="cs-alert cs-alert-success">
          <Check size={18} />
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess("")} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      {loading ? (
        <div className="cs-loading-card">
          <RefreshCw size={24} className="cs-spin" />
          <p>Loading company configuration and branding...</p>
        </div>
      ) : (
        <div className="cs-content-wrapper">
          {/* Top Level Modern Tab Navigation */}
          <div className="cs-tabs-bar">
            <button
              type="button"
              className={`cs-tab-btn ${activeTab === "profile" ? "active" : ""}`}
              onClick={() => setActiveTab("profile")}
            >
              <Building2 size={16} />
              <span>Company Profile</span>
            </button>

            <button
              type="button"
              className={`cs-tab-btn ${activeTab === "quotation" ? "active" : ""}`}
              onClick={() => setActiveTab("quotation")}
            >
              <SlidersHorizontal size={16} />
              <span>Quotation Settings</span>
            </button>

            <button
              type="button"
              className={`cs-tab-btn ${activeTab === "invoice" ? "active" : ""}`}
              onClick={() => setActiveTab("invoice")}
            >
              <Receipt size={16} />
              <span>Invoice Settings</span>
            </button>
          </div>

            {/* TAB 1: Unified Company Profile (Identity, Bank Details & Signature) */}
            {activeTab === "profile" && (
              <div className="cs-profile-layout">
                <form onSubmit={handleSubmit} className="cs-profile-form-col">
                <section className="cs-section-card">
                  <div className="cs-section-header">
                    <div className="cs-section-icon">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <h3>Company Profile &amp; Identity</h3>
                      <p>
                        Official registered details appearing on all documents, emails, and client communications.
                      </p>
                    </div>
                  </div>

                  {/* Logo Upload Box */}
                  <div className="cs-logo-upload-group">
                    <div className="cs-logo-preview-box">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Official Company Logo"
                          className="cs-logo-img"
                        />
                      ) : (
                        <div className="cs-logo-placeholder">
                          <ImageIcon size={32} color="#94a3b8" />
                          <span>No Logo Uploaded</span>
                        </div>
                      )}
                    </div>

                    <div className="cs-logo-actions">
                      <h4>Official Company Logo</h4>
                      <p>
                        This logo will automatically update the login screen, sidebar header, and top banner of all Quotation PDFs.
                      </p>
                      <div className="cs-logo-btn-row">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={handleLogoUpload}
                          style={{ display: "none" }}
                          id="cs-logo-input"
                        />
                        <button
                          type="button"
                          className="cs-btn-upload"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={uploadingLogo}
                        >
                          <Upload size={14} />
                          <span>{uploadingLogo ? "Uploading..." : "Upload Logo"}</span>
                        </button>

                        {logoUrl && (
                          <button
                            type="button"
                            className="cs-btn-remove"
                            onClick={handleRemoveLogo}
                            disabled={uploadingLogo}
                          >
                            <Trash2 size={13} />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                      <small>Supported formats: PNG, JPG, JPEG (Max: 2MB). Transparent PNG recommended.</small>
                    </div>
                  </div>

                  <div className="cs-fields-grid">
                    <div className="cs-field-group">
                      <label htmlFor="company_name">
                        Company Name <span className="cs-required">*</span>
                      </label>
                      <div className="cs-input-icon-wrap">
                        <Building2 size={16} />
                        <input
                          id="company_name"
                          name="company_name"
                          type="text"
                          required
                          placeholder="e.g. NetIT Technology (Pvt) Ltd"
                          value={formData.company_name}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    <div className="cs-field-group">
                      <label htmlFor="email_address">
                        Official Email Address <span className="cs-required">*</span>
                      </label>
                      <div className="cs-input-icon-wrap">
                        <Mail size={16} />
                        <input
                          id="email_address"
                          name="email_address"
                          type="email"
                          required
                          placeholder="e.g. info@netittechnology.com"
                          value={formData.email_address}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    <div className="cs-field-group">
                      <label htmlFor="contact_number">
                        Phone / Contact Numbers <span className="cs-required">*</span>
                      </label>
                      <div className="cs-input-icon-wrap">
                        <Phone size={16} />
                        <input
                          id="contact_number"
                          name="contact_number"
                          type="text"
                          required
                          placeholder="e.g. +94 81 234 5678 / +94 77 123 4567"
                          value={formData.contact_number}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    <div className="cs-field-group cs-full-width">
                      <label htmlFor="company_address">
                        Physical Registered Address <span className="cs-required">*</span>
                      </label>
                      <div className="cs-input-icon-wrap textarea-wrap">
                        <MapPin size={16} className="textarea-icon" />
                        <textarea
                          id="company_address"
                          name="company_address"
                          rows={3}
                          required
                          placeholder="e.g. No. 124, Commercial Complex, Ampitiya Road, Kandy, Sri Lanka"
                          value={formData.company_address}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                  {/* Section 2: Banking & Payment Remittance Details (Underneath Profile) */}
                  <section className="cs-section-card">
                    <div className="cs-section-header">
                      <div className="cs-section-icon">
                        <Landmark size={18} />
                      </div>
                      <div>
                        <h3>Bank &amp; Payment Remittance Details</h3>
                        <p>
                          Bank details rendered in quotation and invoice payment boxes for direct client bank transfers.
                        </p>
                      </div>
                    </div>

                    <div className="cs-fields-grid">
                      <div className="cs-field-group">
                        <label htmlFor="bank_name">Bank Name</label>
                        <input
                          id="bank_name"
                          name="bank_name"
                          type="text"
                          placeholder="e.g. Commercial Bank of Ceylon PLC"
                          value={formData.bank_name}
                          onChange={handleInputChange}
                        />
                      </div>

                      <div className="cs-field-group">
                        <label htmlFor="bank_account_name">Account Name (Beneficiary)</label>
                        <input
                          id="bank_account_name"
                          name="bank_account_name"
                          type="text"
                          placeholder="e.g. NetIT Technology (Pvt) Ltd"
                          value={formData.bank_account_name}
                          onChange={handleInputChange}
                        />
                      </div>

                      <div className="cs-field-group">
                        <label htmlFor="bank_account_number">Bank Account Number</label>
                        <input
                          id="bank_account_number"
                          name="bank_account_number"
                          type="text"
                          placeholder="e.g. 8001234567"
                          value={formData.bank_account_number}
                          onChange={handleInputChange}
                        />
                      </div>

                      <div className="cs-field-group">
                        <label htmlFor="bank_branch">Branch Name</label>
                        <input
                          id="bank_branch"
                          name="bank_branch"
                          type="text"
                          placeholder="e.g. Kandy Main Branch"
                          value={formData.bank_branch}
                          onChange={handleInputChange}
                        />
                      </div>

                      <div className="cs-field-group">
                        <label htmlFor="bank_swift_code">SWIFT / BIC Code</label>
                        <input
                          id="bank_swift_code"
                          name="bank_swift_code"
                          type="text"
                          placeholder="e.g. CCBLKLX"
                          value={formData.bank_swift_code}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  </section>

                  {/* Section 3: Authorized Digital Signature (Underneath Bank Details) */}
                  <section className="cs-section-card">
                    <div className="cs-section-header">
                      <div className="cs-section-icon">
                        <FileCheck size={18} />
                      </div>
                      <div>
                        <h3>Authorized Digital Signature</h3>
                        <p>
                          Authorized company signature appended at the bottom right of official Quotation &amp; Invoice PDFs.
                        </p>
                      </div>
                    </div>

                    <div className="cs-signature-box">
                      <div className="cs-signature-preview-card">
                        {signatureUrl ? (
                          <img
                            src={signatureUrl}
                            alt="Authorized Digital Signature"
                            className="cs-signature-img"
                          />
                        ) : (
                          <div className="cs-signature-placeholder">
                            <ShieldCheck size={36} color="#94a3b8" />
                            <span>No Authorized Signature Uploaded</span>
                          </div>
                        )}
                      </div>

                      <div className="cs-signature-info">
                        <h4>Upload Authorized Signature</h4>
                        <p>
                          Upload a clean, high-resolution signature image on a transparent or white background. It will automatically populate the &quot;Authorized Signature&quot; field on quotation documents.
                        </p>

                        <div className="cs-logo-btn-row">
                          <input
                            ref={signatureInputRef}
                            type="file"
                            accept="image/png, image/jpeg, image/jpg"
                            onChange={handleSignatureUpload}
                            style={{ display: "none" }}
                            id="cs-signature-input"
                          />
                          <button
                            type="button"
                            className="cs-btn-upload"
                            onClick={() => signatureInputRef.current?.click()}
                            disabled={uploadingSignature}
                          >
                            <Upload size={14} />
                            <span>
                              {uploadingSignature ? "Uploading Signature..." : "Upload Signature"}
                            </span>
                          </button>

                          {signatureUrl && (
                            <button
                              type="button"
                              className="cs-btn-remove"
                              onClick={handleRemoveSignature}
                              disabled={uploadingSignature}
                            >
                              <Trash2 size={13} />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                        <small>Recommended aspect ratio: 3:1 width to height (e.g. 400x120px PNG).</small>
                      </div>
                    </div>
                  </section>

                  {/* Unified Action Bar */}
                  <div className="cs-action-bar">
                    <button
                      type="button"
                      className="cs-btn-secondary"
                      onClick={loadSettings}
                      disabled={saving || loading}
                    >
                      Discard Changes
                    </button>
                    <button
                      type="submit"
                      className="cs-btn-save"
                      disabled={saving || loading}
                    >
                      <Save size={16} />
                      <span>{saving ? "Saving..." : "Save Company Profile & Settings"}</span>
                    </button>
                  </div>
                </form>

                {/* Right Column: Live Branding Preview for Company Profile */}
                <aside className="cs-profile-preview-col">
                  <div className="cs-preview-sticky">
                    <div className="cs-preview-panel">
                      <div className="cs-preview-title-bar">
                        <div className="cs-preview-title-wrap">
                          <Eye size={15} color="#2563eb" />
                          <h4>Live Branding Preview</h4>
                        </div>
                        <span className="cs-live-pill">Live Sync</span>
                      </div>

                      <div className="cs-preview-card">
                        {/* Company Header */}
                        <div className="cs-prev-header">
                          <div className="cs-prev-logo-wrap">
                            {logoUrl ? (
                              <img src={logoUrl} alt="Logo" className="cs-prev-logo" />
                            ) : (
                              <div className="cs-prev-logo-fallback">
                                <Building2 size={24} color="#2563eb" />
                              </div>
                            )}
                          </div>
                          <div>
                            <h3 className="cs-prev-company-name">
                              {formData.company_name || "Company Name"}
                            </h3>
                            <p className="cs-prev-tagline">
                              {formData.pdf_subheading || "Professional Services"}
                            </p>
                          </div>
                        </div>

                        <div className="cs-prev-divider" />

                        {/* Contact Meta */}
                        <div className="cs-prev-details">
                          <div className="cs-prev-item">
                            <Mail size={13} color="#64748b" />
                            <span>{formData.email_address || "email@company.com"}</span>
                          </div>
                          <div className="cs-prev-item">
                            <Phone size={13} color="#64748b" />
                            <span>{formData.contact_number || "Phone numbers"}</span>
                          </div>
                          <div className="cs-prev-item">
                            <MapPin size={13} color="#64748b" />
                            <span>{formData.company_address || "Company address"}</span>
                          </div>
                        </div>

                        {/* Banking Preview */}
                        {formData.bank_name && (
                          <div className="cs-prev-bank-box">
                            <div className="cs-prev-bank-head">
                              <Landmark size={12} color="#1d4ed8" />
                              <strong>{formData.bank_name}</strong>
                            </div>
                            <div className="cs-prev-bank-row">
                              <span>A/C Name:</span>
                              <strong>{formData.bank_account_name || "—"}</strong>
                            </div>
                            <div className="cs-prev-bank-row">
                              <span>A/C No:</span>
                              <strong>{formData.bank_account_number || "—"}</strong>
                            </div>
                            {formData.bank_branch && (
                              <div className="cs-prev-bank-row">
                                <span>Branch:</span>
                                <span>{formData.bank_branch}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Digital Signature Preview */}
                        <div className="cs-prev-signature-box">
                          <span className="cs-prev-sig-label">Authorized Sign-off</span>
                          {signatureUrl ? (
                            <img
                              src={signatureUrl}
                              alt="Signature"
                              className="cs-prev-signature-img"
                            />
                          ) : (
                            <div className="cs-prev-sig-empty">Signature Pending</div>
                          )}
                        </div>
                      </div>

                      <div className="cs-preview-footnote">
                        <ShieldCheck size={14} color="#10b981" />
                        <span>Synchronized with PDF generator &amp; system dashboards</span>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            )}

            {/* TAB 2: Combined Quotation Settings (Template Settings + Form Settings) */}
            {activeTab === "quotation" && (
              <div className="cs-quotation-settings-container">
                {/* Quotation Sub-Tabs */}
                <div className="cs-subtabs-bar">
                  <button
                    type="button"
                    className={`cs-subtab-btn ${quotationSubTab === "template" ? "active" : ""}`}
                    onClick={() => setQuotationSubTab("template")}
                  >
                    <FileText size={15} />
                    <span>Quotation Template Settings (PDF Layout &amp; Headings)</span>
                  </button>

                  <button
                    type="button"
                    className={`cs-subtab-btn ${quotationSubTab === "form" ? "active" : ""}`}
                    onClick={() => {
                      setQuotationSubTab("form");
                      setIsEditingService(false);
                      loadServices();
                    }}
                  >
                    <Layers size={15} />
                    <span>Quotation Form Settings (Services &amp; Item Catalog)</span>
                  </button>
                </div>

                {/* SUB-TAB 1: Template Settings (PDF Layout & Headings) */}
                {quotationSubTab === "template" && (
                  <form onSubmit={handleSubmit} className="cs-form-body">
                    {/* Live PDF Layout Preview Box */}
                    <div className="cs-preview-card-box">
                      <div className="cs-preview-header">
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Eye size={14} color="#2563eb" />
                          <strong>Live PDF Layout Preview</strong>
                        </div>
                        <span className="cs-preview-badge">Reflected in generated PDFs</span>
                      </div>

                      <div className="cs-pdf-preview-sheet">
                        <div className="cs-pdf-header-row">
                          <div>
                            <div className="cs-pdf-company-name">
                              {formData.company_name || "NetIT Technology"}
                            </div>
                            <div className="cs-pdf-meta">
                              {formData.company_address || "Ampitiya, Kandy, Sri Lanka"} | {formData.email_address || "info@netittechnology.com"}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div className="cs-pdf-title">
                              {formData.pdf_heading || "QUOTATION"}
                            </div>
                            <div className="cs-pdf-subtitle">
                              {formData.pdf_subheading || "PROFESSIONAL SERVICES PROPOSAL"}
                            </div>
                          </div>
                        </div>

                        <div className="cs-pdf-divider" />

                        {formData.pdf_custom_lines && (
                          <div className="cs-pdf-custom-line">
                            <span>{formData.pdf_custom_lines}</span>
                          </div>
                        )}

                        <div className="cs-pdf-mock-table">
                          <div className="cs-mock-th">
                            <span>#</span>
                            <span>SERVICE SCOPE</span>
                            <span>UNIT PRICE</span>
                            <span>TOTAL</span>
                          </div>
                          <div className="cs-mock-tr">
                            <span>1</span>
                            <span>Web &amp; Software Development (Sample Item)</span>
                            <span>LKR 75,000.00</span>
                            <span>LKR 75,000.00</span>
                          </div>
                        </div>

                        {/* Custom Template Sections Live Preview */}
                        {customSections.length > 0 && (
                          <div style={{ marginTop: "10px" }}>
                            {customSections.map((sec, idx) => {
                              if (!sec.heading && !sec.sub_text) return null;
                              return (
                                <div key={idx} className="cs-pdf-preview-section">
                                  {sec.heading && (
                                    <div className="cs-pdf-section-banner">
                                      {sec.heading.toUpperCase()}
                                    </div>
                                  )}
                                  {sec.sub_text && (
                                    <div className="cs-pdf-section-body">
                                      {sec.sub_text}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {formData.pdf_footer_note && (
                          <div className="cs-pdf-footer-box">
                            <strong>Important Notice / Declaration:</strong>
                            <p>{formData.pdf_footer_note}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PDF Settings Fields */}
                    <section className="cs-section-card">
                      <div className="cs-section-header">
                        <div className="cs-section-icon">
                          <FileText size={18} />
                        </div>
                        <div>
                          <h3>PDF Document Headings &amp; Notices</h3>
                          <p>
                            Titles, announcement banners, and legal declarations printed on customer quotation PDFs.
                          </p>
                        </div>
                      </div>

                      <div className="cs-fields-grid">
                        <div className="cs-field-group">
                          <label htmlFor="pdf_heading">
                            PDF Main Document Heading <span className="cs-required">*</span>
                          </label>
                          <input
                            id="pdf_heading"
                            name="pdf_heading"
                            type="text"
                            required
                            placeholder="e.g. QUOTATION"
                            value={formData.pdf_heading}
                            onChange={handleInputChange}
                          />
                          <small>Displayed prominently on the top right of the generated PDF document.</small>
                        </div>

                        <div className="cs-field-group">
                          <label htmlFor="pdf_subheading">PDF Sub-Heading</label>
                          <input
                            id="pdf_subheading"
                            name="pdf_subheading"
                            type="text"
                            placeholder="e.g. PROFESSIONAL SERVICES PROPOSAL"
                            value={formData.pdf_subheading}
                            onChange={handleInputChange}
                          />
                          <small>Small blue subtitle line directly underneath the main heading.</small>
                        </div>

                        <div className="cs-field-group cs-full-width">
                          <label htmlFor="pdf_custom_lines">
                            Header Custom Line / Announcement Text
                          </label>
                          <input
                            id="pdf_custom_lines"
                            name="pdf_custom_lines"
                            type="text"
                            placeholder="e.g. ISO 9001:2015 Certified IT Solutions Provider | Reg: PV-002498"
                            value={formData.pdf_custom_lines}
                            onChange={handleInputChange}
                          />
                          <small>Appears as a clean subtitle bar right below the header divider line.</small>
                        </div>

                        <div className="cs-field-group cs-full-width">
                          <label htmlFor="pdf_footer_note">Footer Additional Notice / Terms Line</label>
                          <textarea
                            id="pdf_footer_note"
                            name="pdf_footer_note"
                            rows={2}
                            placeholder="e.g. All quotations valid for 30 calendar days. Cheques payable to NetIT Technology."
                            value={formData.pdf_footer_note}
                            onChange={handleInputChange}
                          />
                          <small>Appears at the bottom of the quotation as an authoritative notice / declaration.</small>
                        </div>

                        <div className="cs-field-group cs-full-width">
                          <label htmlFor="default_terms_and_conditions">
                            Default Terms &amp; Conditions (Auto-filled on new quotations)
                          </label>
                          <textarea
                            id="default_terms_and_conditions"
                            name="default_terms_and_conditions"
                            rows={3}
                            placeholder="1. Payment terms as agreed upon...\n2. Quotation validity period is 30 days..."
                            value={formData.default_terms_and_conditions}
                            onChange={handleInputChange}
                          />
                          <small>Whenever Admin or Super Admin creates a quotation, these terms are loaded by default.</small>
                        </div>
                      </div>

                      {/* Custom Additional Headings (e.g. SERVICE SCOPE, WORK DELIVERABLES) */}
                      <div className="cs-sections-box">
                        <div className="cs-sections-top">
                          <div className="cs-sections-top-info">
                            <h4>Custom PDF Headings &amp; Sub-Sections</h4>
                            <p>
                              Add extra headings enclosed in navy blue lines/bars on the quotation PDF, with matching descriptive sub-text.
                            </p>
                          </div>
                          <button
                            type="button"
                            className="cs-add-section-btn"
                            onClick={handleAddCustomSection}
                          >
                            <Plus size={14} />
                            <span>Add Heading / Section</span>
                          </button>
                        </div>

                        {customSections.length === 0 ? (
                          <div className="cs-empty-sections-note">
                            No custom headings added yet. Click &quot;Add Heading / Section&quot; if you want to include custom sections on the PDF.
                          </div>
                        ) : (
                          <div className="cs-sections-list">
                            {customSections.map((sec, index) => (
                              <div key={sec.id || index} className="cs-section-card-item">
                                <div className="cs-section-card-head">
                                  <span>
                                    <FileText size={13} color="#2563eb" />
                                    Section #{index + 1}: {sec.heading ? sec.heading.toUpperCase() : "Untitled Heading"}
                                  </span>
                                  <button
                                    type="button"
                                    className="cs-section-delete-btn"
                                    onClick={() => handleDeleteCustomSection(index)}
                                    title="Delete this heading section"
                                  >
                                    <Trash2 size={12} />
                                    <span>Delete</span>
                                  </button>
                                </div>

                                <div className="cs-section-fields">
                                  <div className="cs-section-field">
                                    <label>Section Heading Title</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. SERVICE SCOPE, WORK DELIVERABLES"
                                      value={sec.heading}
                                      onChange={(e) =>
                                        handleUpdateCustomSection(index, "heading", e.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="cs-section-field">
                                    <label>Section Sub-Text / Description Line</label>
                                    <textarea
                                      rows={2}
                                      placeholder="Enter the details or scope lines that will appear underneath this navy blue heading..."
                                      value={sec.sub_text}
                                      onChange={(e) =>
                                        handleUpdateCustomSection(index, "sub_text", e.target.value)
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>

                    <div className="cs-action-bar">
                      <button
                        type="button"
                        className="cs-btn-secondary"
                        onClick={loadSettings}
                        disabled={saving || loading}
                      >
                        Discard Changes
                      </button>
                      <button
                        type="submit"
                        className="cs-btn-save"
                        disabled={saving || loading}
                      >
                        <Save size={16} />
                        <span>{saving ? "Saving Template..." : "Save Template Settings"}</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* SUB-TAB 2: Form Settings (Services & Item Catalog) */}
                {quotationSubTab === "form" && (
                  <div className="cs-form-settings-section">
                    {!isEditingService ? (
                      <section className="cs-section-card">
                        <div className="cs-service-toolbar">
                          <div>
                            <h3>Quotation Form Service Options ({services.length})</h3>
                            <p>
                              These services populate the service selection dropdown on the quotation creation form for all staff.
                            </p>
                          </div>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              type="button"
                              className="cs-refresh-btn"
                              onClick={loadServices}
                              disabled={loadingServices}
                              title="Refresh list"
                            >
                              <RefreshCw size={14} className={loadingServices ? "cs-spin" : ""} />
                              <span>Refresh</span>
                            </button>
                            <button
                              type="button"
                              className="cs-primary-save-btn"
                              onClick={handleStartCreateService}
                            >
                              <Plus size={14} />
                              <span>Add New Service</span>
                            </button>
                          </div>
                        </div>

                        {loadingServices ? (
                          <div className="cs-loading-card">
                            <RefreshCw size={24} className="cs-spin" />
                            <p>Loading service options catalog...</p>
                          </div>
                        ) : services.length === 0 ? (
                          <div className="cs-empty-box">
                            No service options found in catalog. Click &quot;Add New Service&quot; to create one.
                          </div>
                        ) : (
                          <div className="cs-table-wrap">
                            <table className="cs-table">
                              <thead>
                                <tr>
                                  <th>SERVICE / ITEM NAME</th>
                                  <th>SCOPE &amp; DESCRIPTION</th>
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
                                      <span className="cs-text-clamp">{svc.description || "—"}</span>
                                    </td>
                                    <td>
                                      <strong>
                                        {Number(svc.default_price || 0) > 0
                                          ? `LKR ${Number(svc.default_price).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                                          : "Variable Price"}
                                      </strong>
                                    </td>
                                    <td>
                                      <span className={`cs-status-pill ${svc.is_active ? "active" : "inactive"}`}>
                                        {svc.is_active ? "Active" : "Inactive"}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: "right" }}>
                                      <div className="cs-row-actions">
                                        <button
                                          type="button"
                                          className="cs-icon-btn edit"
                                          title="Edit service"
                                          onClick={() => handleStartEditService(svc)}
                                        >
                                          <Edit2 size={14} />
                                        </button>
                                        <button
                                          type="button"
                                          className="cs-icon-btn delete"
                                          title="Delete service"
                                          onClick={() => handleDeleteService(svc)}
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
                      </section>
                    ) : (
                      /* Create / Edit Service Option Form */
                      <form onSubmit={handleSaveService} className="cs-form-body">
                        <section className="cs-section-card">
                          <div className="cs-section-header">
                            <div className="cs-section-icon">
                              <Layers size={18} />
                            </div>
                            <div>
                              <h3>
                                {editingServiceId === "new"
                                  ? "Add New Service Option"
                                  : `Edit Service: ${serviceForm.item_name}`}
                              </h3>
                              <p>
                                Configure service details and default scope descriptions for the quotation form.
                              </p>
                            </div>
                          </div>

                          <div className="cs-fields-grid">
                            <div className="cs-field-group cs-full-width">
                              <label>
                                Service / Item Name <span className="cs-required">*</span>
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. Mobile App Development, E-Commerce Portal, Cloud Infrastructure"
                                value={serviceForm.item_name}
                                onChange={(e) =>
                                  setServiceForm({ ...serviceForm, item_name: e.target.value })
                                }
                              />
                              <small>This name will appear in the service dropdown when creating quotations.</small>
                            </div>

                            <div className="cs-field-group">
                              <label>Default Price (LKR)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00 (leave 0 for variable/custom price)"
                                value={serviceForm.default_price}
                                onChange={(e) =>
                                  setServiceForm({ ...serviceForm, default_price: e.target.value })
                                }
                              />
                              <small>Optional baseline unit price auto-filled in the quotation item row.</small>
                            </div>

                            <div className="cs-field-group">
                              <label>Status</label>
                              <select
                                value={serviceForm.is_active}
                                onChange={(e) =>
                                  setServiceForm({
                                    ...serviceForm,
                                    is_active: Number(e.target.value),
                                  })
                                }
                              >
                                <option value={1}>Active (Available on quotation form)</option>
                                <option value={0}>Inactive (Hidden from dropdown)</option>
                              </select>
                            </div>

                            <div className="cs-field-group cs-full-width">
                              <label>Default Description / Scope</label>
                              <textarea
                                rows={2}
                                placeholder="e.g. Design, development, testing, and deployment of responsive application."
                                value={serviceForm.description}
                                onChange={(e) =>
                                  setServiceForm({ ...serviceForm, description: e.target.value })
                                }
                              />
                            </div>

                            <div className="cs-field-group">
                              <label>Default Hosting &amp; Domain Policy</label>
                              <input
                                type="text"
                                placeholder="e.g. 1 Year Free VPS Hosting & .COM Domain"
                                value={serviceForm.hosting_domain}
                                onChange={(e) =>
                                  setServiceForm({
                                    ...serviceForm,
                                    hosting_domain: e.target.value,
                                  })
                                }
                              />
                            </div>

                            <div className="cs-field-group">
                              <label>Maintenance &amp; Support Term</label>
                              <input
                                type="text"
                                placeholder="e.g. 6 Months Free SLA Support"
                                value={serviceForm.maintenance_support}
                                onChange={(e) =>
                                  setServiceForm({
                                    ...serviceForm,
                                    maintenance_support: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                        </section>

                        <div className="cs-action-bar">
                          <button
                            type="button"
                            className="cs-btn-secondary"
                            onClick={() => {
                              setIsEditingService(false);
                              setEditingServiceId(null);
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="cs-btn-save"
                            disabled={saving}
                          >
                            <Save size={16} />
                            <span>{saving ? "Saving..." : "Save Service Option"}</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Invoice Settings (Module in Development) */}
            {activeTab === "invoice" && (
              <div className="cs-invoice-settings-container">
                <section className="cs-section-card cs-invoice-placeholder-card">
                  <div className="cs-section-header">
                    <div className="cs-section-icon cs-invoice-icon">
                      <Receipt size={20} />
                    </div>
                    <div className="cs-section-header-text">
                      <div className="cs-title-badge-row">
                        <h3>Invoice Settings &amp; Preferences</h3>
                        <span className="cs-badge-coming-soon">Module In Development</span>
                      </div>
                      <p>
                        Configure default billing sequences, payment terms, and automated invoice settings.
                      </p>
                    </div>
                  </div>

                  <div className="cs-invoice-banner">
                    <div className="cs-invoice-banner-icon">
                      <Sparkles size={20} color="#2563eb" />
                    </div>
                    <div className="cs-invoice-banner-text">
                      <strong>Invoicing &amp; Billing Module Under Active Development</strong>
                      <p>
                        Client billing, automatic invoice generation from accepted quotations, payment tracking, and receipt issuance are coming in the next release. Company branding and bank remittance details configured under <strong>Company Profile</strong> will automatically be inherited.
                      </p>
                    </div>
                  </div>

                  <div className="cs-fields-grid cs-invoice-preview-grid">
                    <div className="cs-field-group">
                      <label htmlFor="inv_prefix">Invoice Number Prefix</label>
                      <div className="cs-input-icon-wrap">
                        <FileText size={16} />
                        <input
                          id="inv_prefix"
                          type="text"
                          disabled
                          value="INV-2026-"
                          className="cs-input-disabled"
                        />
                      </div>
                      <small className="cs-field-hint">e.g. INV-2026-0001 (Sequential generation)</small>
                    </div>

                    <div className="cs-field-group">
                      <label htmlFor="inv_due_days">Default Payment Due Period</label>
                      <div className="cs-input-icon-wrap">
                        <CreditCard size={16} />
                        <input
                          id="inv_due_days"
                          type="text"
                          disabled
                          value="14 Days from Issue Date"
                          className="cs-input-disabled"
                        />
                      </div>
                      <small className="cs-field-hint">Standard client payment window</small>
                    </div>

                    <div className="cs-field-group">
                      <label htmlFor="inv_currency">Default Billing Currency</label>
                      <div className="cs-input-icon-wrap">
                        <Landmark size={16} />
                        <input
                          id="inv_currency"
                          type="text"
                          disabled
                          value="LKR (Sri Lankan Rupee)"
                          className="cs-input-disabled"
                        />
                      </div>
                      <small className="cs-field-hint">Aligned with quotation currency</small>
                    </div>

                    <div className="cs-field-group">
                      <label htmlFor="inv_tax_display">Tax &amp; VAT Display Option</label>
                      <div className="cs-input-icon-wrap">
                        <Sliders size={16} />
                        <input
                          id="inv_tax_display"
                          type="text"
                          disabled
                          value="Itemized Tax &amp; Discount Lines"
                          className="cs-input-disabled"
                        />
                      </div>
                      <small className="cs-field-hint">Complies with tax invoice regulations</small>
                    </div>

                    <div className="cs-field-group cs-full-width">
                      <label htmlFor="inv_notes">Default Client Remittance Notice</label>
                      <div className="cs-input-icon-wrap textarea-wrap">
                        <textarea
                          id="inv_notes"
                          rows={3}
                          disabled
                          value={formData.bank_name ? `Please remit payment via bank transfer to ${formData.bank_name} (A/C: ${formData.bank_account_number || "—"}, Beneficiary: ${formData.bank_account_name || formData.company_name || "—"}). Reference the invoice number on your payment slip.` : "Please remit payment via direct bank transfer referencing the invoice number on your deposit slip."}
                          className="cs-input-disabled"
                        />
                      </div>
                      <small className="cs-field-hint">Pulls bank details configured in your Company Profile.</small>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
      )}
    </main>
  );
}
