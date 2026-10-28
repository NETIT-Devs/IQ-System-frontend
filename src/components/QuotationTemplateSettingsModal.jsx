import { useState, useEffect } from "react";
import {
  X,
  FileText,
  Check,
  AlertCircle,
  Save,
  Eye,
  Plus,
  Trash2,
} from "lucide-react";
import {
  getCompanyDetails,
  updateCompanyTemplateSettings,
} from "../services/quotationService";
import "./QuotationSettings.css";

export default function QuotationTemplateSettingsModal({
  isOpen,
  onClose,
  onTemplateUpdated,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    company_name: "",
    pdf_heading: "QUOTATION",
    pdf_subheading: "PROFESSIONAL SERVICES PROPOSAL",
    pdf_custom_lines: "",
    pdf_footer_note: "",
    default_terms_and_conditions: "",
  });

  const [sections, setSections] = useState([]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError("");
      const company = await getCompanyDetails();
      if (company) {
        setForm({
          company_name: company.company_name || "",
          pdf_heading: company.pdf_heading || "QUOTATION",
          pdf_subheading:
            company.pdf_subheading || "PROFESSIONAL SERVICES PROPOSAL",
          pdf_custom_lines: company.pdf_custom_lines || "",
          pdf_footer_note: company.pdf_footer_note || "",
          default_terms_and_conditions:
            company.default_terms_and_conditions || "",
        });

        let loadedSections = [];
        if (company.pdf_custom_sections) {
          try {
            loadedSections =
              typeof company.pdf_custom_sections === "string"
                ? JSON.parse(company.pdf_custom_sections)
                : company.pdf_custom_sections;
          } catch (e) {
            console.warn("Could not parse pdf_custom_sections:", e);
            loadedSections = [];
          }
        }
        setSections(Array.isArray(loadedSections) ? loadedSections : []);
      }
    } catch (err) {
      setError(err?.message || "Failed to load current quotation template settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      setError("");
      setSuccess("");
    }
  }, [isOpen]);

  const handleAddSection = () => {
    setSections((prev) => [
      ...prev,
      {
        id: Date.now(),
        heading: "",
        sub_text: "",
      },
    ]);
  };

  const handleUpdateSection = (index, field, value) => {
    setSections((prev) =>
      prev.map((sec, idx) => (idx === index ? { ...sec, [field]: value } : sec))
    );
  };

  const handleDeleteSection = (index) => {
    setSections((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.pdf_heading.trim()) {
      setError("PDF Main Heading is required (e.g. QUOTATION).");
      return;
    }

    const cleanedSections = sections
      .map((s) => ({
        heading: String(s.heading || "").trim(),
        sub_text: String(s.sub_text || "").trim(),
      }))
      .filter((s) => s.heading || s.sub_text);

    try {
      setSaving(true);
      await updateCompanyTemplateSettings({
        pdf_heading: form.pdf_heading.trim(),
        pdf_subheading: form.pdf_subheading.trim(),
        pdf_custom_lines: form.pdf_custom_lines.trim(),
        pdf_footer_note: form.pdf_footer_note.trim(),
        default_terms_and_conditions: form.default_terms_and_conditions.trim(),
        pdf_custom_sections: cleanedSections,
      });

      setSuccess(
        "Quotation PDF template settings saved! All generated and downloaded quotation PDFs will now reflect these headings and sections."
      );
      if (onTemplateUpdated) onTemplateUpdated();
    } catch (err) {
      setError(err?.message || "Failed to save template settings.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="qs-modal-overlay" onClick={onClose}>
      <div
        className="qs-modal-box qs-modal-large"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="qs-modal-header">
          <div className="qs-header-icon-box template">
            <FileText size={20} />
          </div>
          <div>
            <h3>Quotation Template Settings (PDF Layout)</h3>
            <p>
              Customize the PDF quotation header title, sub-heading, custom lines,
              additional service scope headings, and footer notices.
            </p>
          </div>
          <button
            type="button"
            className="qs-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
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

          {loading ? (
            <div className="qs-loading-box">
              Loading template configuration...
            </div>
          ) : (
            <form className="qs-form" onSubmit={handleSubmit}>
              {/* Live Preview Box */}
              <div className="qs-preview-card">
                <div className="qs-preview-header">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Eye size={14} color="#2563eb" />
                    <strong>Live PDF Layout Preview</strong>
                  </div>
                  <span className="qs-preview-badge">
                    Reflected in generated PDFs
                  </span>
                </div>

                <div className="qs-pdf-preview-sheet">
                  {/* Top Bar Preview */}
                  <div className="qs-pdf-header-row">
                    <div>
                      <div className="qs-pdf-company-name">
                        {form.company_name || "NetIT Technology"}
                      </div>
                      <div className="qs-pdf-meta">
                        Ampitiya, Kandy, Sri Lanka | info@netittechnology.com
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="qs-pdf-title">
                        {form.pdf_heading || "QUOTATION"}
                      </div>
                      <div className="qs-pdf-subtitle">
                        {form.pdf_subheading ||
                          "PROFESSIONAL SERVICES PROPOSAL"}
                      </div>
                    </div>
                  </div>

                  {/* Decorative Line Preview */}
                  <div className="qs-pdf-divider" />

                  {/* Custom Extra Line Preview */}
                  {form.pdf_custom_lines && (
                    <div className="qs-pdf-custom-line">
                      <span>{form.pdf_custom_lines}</span>
                    </div>
                  )}

                  {/* Sample Table Preview Mockup */}
                  <div className="qs-pdf-mock-table">
                    <div className="qs-mock-th">
                      <span>#</span>
                      <span>SERVICE SCOPE</span>
                      <span>UNIT PRICE</span>
                      <span>TOTAL</span>
                    </div>
                    <div className="qs-mock-tr">
                      <span>1</span>
                      <span>Web &amp; Software Development (Sample Item)</span>
                      <span>LKR 75,000.00</span>
                      <span>LKR 75,000.00</span>
                    </div>
                  </div>

                  {/* Custom Template Sections Live Preview */}
                  {sections.length > 0 && (
                    <div style={{ marginTop: "10px" }}>
                      {sections.map((sec, idx) => {
                        if (!sec.heading && !sec.sub_text) return null;
                        return (
                          <div key={idx} className="qs-pdf-preview-section">
                            {sec.heading && (
                              <div className="qs-pdf-section-banner">
                                {sec.heading.toUpperCase()}
                              </div>
                            )}
                            {sec.sub_text && (
                              <div className="qs-pdf-section-body">
                                {sec.sub_text}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Footer Notice Preview */}
                  {form.pdf_footer_note && (
                    <div className="qs-pdf-footer-box">
                      <strong>Important Notice / Declaration:</strong>
                      <p>{form.pdf_footer_note}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              <div className="qs-form-grid">
                <div className="qs-form-group">
                  <label>
                    Quotation PDF Main Heading{" "}
                    <span className="qs-required">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. QUOTATION, PROJECT ESTIMATE, PROFORMA INVOICE"
                    value={form.pdf_heading}
                    onChange={(e) =>
                      setForm({ ...form, pdf_heading: e.target.value })
                    }
                  />
                  <small>
                    Displayed prominently on the top right of the generated PDF
                    document.
                  </small>
                </div>

                <div className="qs-form-group">
                  <label>Quotation PDF Sub-Heading</label>
                  <input
                    type="text"
                    placeholder="e.g. PROFESSIONAL SERVICES PROPOSAL, OFFICIAL BID"
                    value={form.pdf_subheading}
                    onChange={(e) =>
                      setForm({ ...form, pdf_subheading: e.target.value })
                    }
                  />
                  <small>
                    Small blue subtitle line directly underneath the main
                    heading.
                  </small>
                </div>

                <div className="qs-form-group full-width">
                  <label>Header Custom Line / Announcement Text</label>
                  <input
                    type="text"
                    placeholder="e.g. ISO 9001:2015 Certified IT Solutions Provider | Reg: PV-002498"
                    value={form.pdf_custom_lines}
                    onChange={(e) =>
                      setForm({ ...form, pdf_custom_lines: e.target.value })
                    }
                  />
                  <small>
                    Appears as a clean subtitle bar right below the header
                    divider line.
                  </small>
                </div>

                {/* Additional Headings & Sub-Sections (e.g. Service Scope, Project Scope) */}
                <div className="qs-sections-box">
                  <div className="qs-sections-top">
                    <div className="qs-sections-top-info">
                      <h4>Custom PDF Headings &amp; Sub-Sections (e.g. SERVICE SCOPE)</h4>
                      <p>
                        Add custom headings enclosed in navy blue lines/bars on the
                        quotation PDF, with matching sub-text underneath.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="qs-add-section-btn"
                      onClick={handleAddSection}
                    >
                      <Plus size={14} />
                      <span>Add Heading / Section</span>
                    </button>
                  </div>

                  {sections.length === 0 ? (
                    <div className="qs-empty-sections-note">
                      No custom headings added yet. Click &quot;Add Heading /
                      Section&quot; to add a new section (e.g. SERVICE SCOPE,
                      DELIVERABLES, PROJECT SCOPE).
                    </div>
                  ) : (
                    <div className="qs-sections-list">
                      {sections.map((sec, index) => (
                        <div key={sec.id || index} className="qs-section-card">
                          <div className="qs-section-card-head">
                            <span>
                              <FileText size={13} color="#2563eb" />
                              Section #{index + 1}:{" "}
                              {sec.heading
                                ? sec.heading.toUpperCase()
                                : "Untitled Heading"}
                            </span>
                            <button
                              type="button"
                              className="qs-section-delete-btn"
                              onClick={() => handleDeleteSection(index)}
                              title="Delete this heading section"
                            >
                              <Trash2 size={12} />
                              <span>Delete</span>
                            </button>
                          </div>

                          <div className="qs-section-fields">
                            <div className="qs-section-field">
                              <label>
                                Section Heading (e.g. SERVICE SCOPE, PROJECT
                                DELIVERABLES, WARRANTY)
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. SERVICE SCOPE"
                                value={sec.heading}
                                onChange={(e) =>
                                  handleUpdateSection(
                                    index,
                                    "heading",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div className="qs-section-field">
                              <label>Section Sub-Text / Description</label>
                              <textarea
                                rows={2}
                                placeholder="Enter the scope details, descriptions, or sub-text that will appear below this navy blue heading..."
                                value={sec.sub_text}
                                onChange={(e) =>
                                  handleUpdateSection(
                                    index,
                                    "sub_text",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="qs-form-group full-width">
                  <label>Footer Additional Notice / Terms Line</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. All quotations valid for 30 calendar days. Cheques payable to NetIT Technology."
                    value={form.pdf_footer_note}
                    onChange={(e) =>
                      setForm({ ...form, pdf_footer_note: e.target.value })
                    }
                  />
                  <small>
                    Appears at the bottom of the quotation as an authoritative
                    notice / declaration.
                  </small>
                </div>

                <div className="qs-form-group full-width">
                  <label>
                    Default Terms &amp; Conditions (Auto-filled on new
                    quotations)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="1. Payment terms as agreed upon...\n2. Quotation validity period..."
                    value={form.default_terms_and_conditions}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        default_terms_and_conditions: e.target.value,
                      })
                    }
                  />
                  <small>
                    Whenever Admin or Super Admin creates a quotation, these
                    terms are loaded by default.
                  </small>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="qs-modal-footer">
                <button
                  type="button"
                  className="qs-btn-secondary"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="qs-btn-primary"
                  disabled={saving}
                >
                  <Save size={15} />
                  {saving ? "Saving Template..." : "Save Template Settings"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
