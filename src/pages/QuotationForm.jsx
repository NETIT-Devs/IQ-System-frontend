// Quotation Creation & Editing Form Component
// Professional, compact square layout with Client Name text input,
// clean "Select Service" preset dropdown, and instant PDF download.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  User,
  Calendar,
  Layers,
  Plus,
  Trash2,
  Save,
  Download,
  X,
  AlertCircle,
  CheckCircle,
  Code,
  Globe,
  Server,
} from "lucide-react";
import {
  createQuotation,
  updateQuotation,
  getCustomers,
  createCustomer,
  getQuotationItemOptions,
  getCompanyDetails,
} from "../services/quotationService";
import { downloadQuotationPdf } from "../utils/pdfGenerator";
import QuotationTemplate from "../components/QuotationTemplate";
import "./QuotationForm.css";

// Calculate estimated project completion date using the exact backend algorithm
function calculateEstimatedCompletionDate(startDate, duration, unit) {
  if (!startDate || !duration || !unit) return "";

  const dur = Number(duration);
  if (!dur || dur <= 0) return "";

  const date = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";

  if (unit === "Days") {
    date.setUTCDate(date.getUTCDate() + dur);
  } else if (unit === "Weeks") {
    date.setUTCDate(date.getUTCDate() + dur * 7);
  } else if (unit === "Months") {
    const originalDay = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + dur);

    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
    ).getUTCDate();

    date.setUTCDate(Math.min(originalDay, lastDay));
  }

  return date.toISOString().slice(0, 10);
}

// Initial item model matching backend database fields
const initialItem = {
  item_name: "",
  technology: "",
  website_type: "",
  hosting_domain: "",
  description: "",
  unit_price: "",
  tax_rate: "0",
};

export default function QuotationForm({
  initialData = null,
  onSave,
  onClose,
}) {
  const today = new Date().toISOString().slice(0, 10);
  const pdfTemplateRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    quotation_number: initialData?.quotation_number || `QUO-${Date.now().toString().slice(-6)}`,
    client_name: initialData?.customer_name || initialData?.clientName || "",
    customer_id: initialData?.customer_id ? String(initialData.customer_id) : "",
    quotation_date: initialData?.quotation_date ? String(initialData.quotation_date).slice(0, 10) : today,
    project_start_date: initialData?.project_start_date ? String(initialData.project_start_date).slice(0, 10) : today,
    estimated_duration: initialData?.estimated_duration ? String(initialData.estimated_duration) : "",
    duration_unit: initialData?.duration_unit || "Weeks",
    valid_until: initialData?.valid_until ? String(initialData.valid_until).slice(0, 10) : "",
    currency: initialData?.currency || "LKR",
    discount_amount: initialData?.discount_amount != null ? String(initialData.discount_amount) : "0",
    notes: initialData?.notes || "",
    terms_and_conditions: initialData?.terms_and_conditions || "",
  });

  // Items list
  const [items, setItems] = useState(
    initialData?.items?.length > 0
      ? initialData.items.map((it) => ({
          quotation_item_id: it.quotation_item_id,
          item_name: it.item_name || "",
          technology: it.technology || "",
          website_type: it.website_type || "",
          hosting_domain: it.hosting_domain || "",
          description: it.description || "",
          unit_price: it.unit_price != null ? String(it.unit_price) : it.Price != null ? String(it.Price) : "",
          tax_rate: it.tax_rate != null ? String(it.tax_rate) : "0",
        }))
      : [{ ...initialItem }]
  );

  // Data loaded from backend
  const [customers, setCustomers] = useState([]);
  const [serviceCatalog, setServiceCatalog] = useState([]);
  const [companyDetails, setCompanyDetails] = useState({});

  // UI state
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Load customer and service options from backend on mount
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [customerList, services, company] = await Promise.all([
          getCustomers().catch(() => []),
          getQuotationItemOptions().catch(() => []),
          getCompanyDetails().catch(() => ({})),
        ]);

        if (isMounted) {
          setCustomers(customerList);
          setServiceCatalog(services);
          setCompanyDetails(company);

          // Populate default terms and conditions from backend database if not already provided
          if (company?.default_terms_and_conditions && !initialData?.terms_and_conditions) {
            setFormData((prev) => ({
              ...prev,
              terms_and_conditions: prev.terms_and_conditions || company.default_terms_and_conditions,
            }));
          }

          // If editing or have an ID, resolve matching client name if empty
          if (formData.customer_id && !formData.client_name) {
            const match = customerList.find(
              (c) => String(c.customer_id) === String(formData.customer_id)
            );
            if (match) {
              setFormData((prev) => ({
                ...prev,
                client_name: match.customer_name,
              }));
            }
          }
        }
      } catch (err) {
        console.error("Error loading form dependencies:", err);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Update top-level form field
  const updateField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Selected customer / client object
  const selectedCustomer = useMemo(() => {
    if (!formData.client_name) return null;
    return (
      customers.find(
        (c) =>
          c.customer_name?.toLowerCase() ===
            formData.client_name.trim().toLowerCase() ||
          String(c.customer_id) === String(formData.customer_id)
      ) || null
    );
  }, [customers, formData.client_name, formData.customer_id]);

  // Automatically calculate estimated completion date
  const estimatedCompletionDate = useMemo(() => {
    return calculateEstimatedCompletionDate(
      formData.project_start_date || formData.quotation_date,
      formData.estimated_duration,
      formData.duration_unit
    );
  }, [
    formData.project_start_date,
    formData.quotation_date,
    formData.estimated_duration,
    formData.duration_unit,
  ]);

  // Update item field
  const updateItem = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      )
    );
  };

  // Auto-fill item fields when user picks a service from the clean "Select Service" dropdown
  const handleSelectServicePreset = (index, serviceName) => {
    if (!serviceName) return;

    // Find service from backend service_catalog
    const selectedService = serviceCatalog.find(
      (s) => s.item_name.toLowerCase() === serviceName.toLowerCase()
    );

    let defaultTech = "";
    let defaultType = "";
    let defaultHosting = selectedService?.hosting_domain || "Domain and hosting setup assistance included";
    let defaultPrice = "";
    let defaultDescription = "";

    if (serviceName.includes("WordPress")) {
      defaultTech = "WordPress CMS / PHP";
      defaultType = "Corporate / Business Website";
      defaultDescription =
        selectedService?.description ||
        "Professional responsive WordPress website with content management, custom page layouts, and inquiry forms.";
    } else if (serviceName.includes("React")) {
      defaultTech = "React.js / Node.js";
      defaultType = "Modern Web Application";
      defaultDescription =
        selectedService?.description ||
        "High-performance modern web application built with React, interactive UI components, and API integration.";
    } else if (serviceName.includes("Custom")) {
      defaultTech = "Custom Full Stack";
      defaultType = "Custom Tailored Solution";
      defaultDescription =
        selectedService?.description ||
        "Custom web solution engineered according to detailed business specifications and workflows.";
    } else if (serviceName.includes("Maintenance")) {
      defaultTech = "WordPress / Custom CMS";
      defaultType = "Technical Support & Maintenance";
      defaultDescription =
        selectedService?.description ||
        "Routine website maintenance, security updates, regular database backups, and technical support.";
    } else if (serviceName.includes("Optional") || serviceName.includes("Add-on")) {
      defaultTech = "Custom / Add-on";
      defaultType = "Optional Add-on Service";
      defaultHosting = "Included as needed";
      defaultDescription = "Optional extra service or add-on feature.";
    }

    if (selectedService?.core_features) {
      defaultDescription += `\nCore Features: ${selectedService.core_features}`;
    }
    if (selectedService?.maintenance_support) {
      defaultDescription += `\nSupport: ${selectedService.maintenance_support}`;
    }
    if (selectedService?.content_seo) {
      defaultDescription += `\nSEO: ${selectedService.content_seo}`;
    }

    if (selectedService && Number(selectedService.default_price) > 0) {
      defaultPrice = String(selectedService.default_price);
    }

    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              item_name: serviceName,
              technology: defaultTech,
              website_type: defaultType,
              hosting_domain: defaultHosting,
              description: defaultDescription,
              unit_price: defaultPrice || item.unit_price,
            }
          : item
      )
    );
  };

  // Add new standard item line
  const addItem = () => {
    setItems((prev) => [...prev, { ...initialItem }]);
  };

  // Add simple additional item line (Name and Amount only)
  const addAdditionalItem = () => {
    setItems((prev) => [
      ...prev,
      {
        ...initialItem,
        item_name: "",
        technology: "",
        website_type: "",
        hosting_domain: "",
        description: "",
        unit_price: "",
        tax_rate: "0",
        is_additional: true,
      },
    ]);
  };

  // Remove item line
  const removeItem = (index) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Financial calculations
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;

    items.forEach((item) => {
      const price = Number(item.unit_price) || 0;
      const rate = Number(item.tax_rate) || 0;
      const itemTax = (price * rate) / 100;

      subtotal += price;
      taxAmount += itemTax;
    });

    const discount = Math.max(0, Number(formData.discount_amount) || 0);
    const grandTotal = Math.max(0, subtotal - discount + taxAmount);

    return {
      subtotal: Number(subtotal.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      total: Number(grandTotal.toFixed(2)),
    };
  }, [items, formData.discount_amount]);

  // Format currency for display
  const formatMoney = (amount) => {
    return `${formData.currency} ${Number(amount || 0).toLocaleString(
      "en-LK",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  };

  // Prepare full quotation payload
  const buildPayload = (assignedCustomerId) => {
    return {
      quotation_number: formData.quotation_number.trim(),
      customer_id: assignedCustomerId,
      quotation_date: formData.quotation_date,
      project_start_date: formData.project_start_date || formData.quotation_date,
      estimated_duration: formData.estimated_duration ? Number(formData.estimated_duration) : null,
      duration_unit: formData.estimated_duration ? formData.duration_unit : null,
      valid_until: formData.valid_until || null,
      currency: formData.currency || "LKR",
      discount_amount: totals.discount,
      notes: formData.notes?.trim() || null,
      terms_and_conditions: formData.terms_and_conditions?.trim() || null,
      items: items.map((item) => ({
        item_name: item.item_name.trim(),
        description: item.description?.trim() || null,
        technology: item.technology?.trim() || null,
        website_type: item.website_type?.trim() || null,
        hosting_domain: item.hosting_domain?.trim() || null,
        unit_price: Number(item.unit_price),
        tax_rate: Number(item.tax_rate || 0),
      })),
    };
  };

  // Frontend validation
  const validateForm = () => {
    if (!formData.quotation_number.trim()) {
      return "Quotation number is required.";
    }

    if (!formData.client_name.trim()) {
      return "Client name is required.";
    }

    if (!formData.quotation_date) {
      return "Quotation date is required.";
    }

    if (formData.valid_until && formData.valid_until < formData.quotation_date) {
      return "Valid until date cannot be earlier than the quotation date.";
    }

    if (
      formData.estimated_duration &&
      (!Number.isInteger(Number(formData.estimated_duration)) ||
        Number(formData.estimated_duration) <= 0)
    ) {
      return "Project duration must be a positive integer.";
    }

    if (items.length === 0) {
      return "Add at least one item or service to the quotation.";
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.item_name.trim()) {
        return `Please specify the service name for line ${i + 1}.`;
      }

      if (it.unit_price === "" || Number(it.unit_price) < 0) {
        return `Please enter a valid price for line ${i + 1}.`;
      }

      const tax = Number(it.tax_rate);
      if (Number.isNaN(tax) || tax < 0 || tax > 100) {
        return `Tax rate for line ${i + 1} must be between 0% and 100%.`;
      }
    }

    if (totals.discount > totals.subtotal) {
      return "Discount amount cannot be greater than the subtotal.";
    }

    return null;
  };

  // Handle Save / Submit
  const handleSaveQuotation = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setSaving(true);

      // Resolve customer_id from client_name
      let targetCustomerId = Number(formData.customer_id);

      if (!targetCustomerId || Number.isNaN(targetCustomerId)) {
        const existing = customers.find(
          (c) =>
            c.customer_name?.toLowerCase() ===
            formData.client_name.trim().toLowerCase()
        );

        if (existing) {
          targetCustomerId = existing.customer_id;
        } else {
          try {
            // Auto-create customer record in backend database
            const created = await createCustomer({
              customer_name: formData.client_name.trim(),
            });
            targetCustomerId = created?.customer_id;
          } catch {
            // Fallback to first available customer in database
            targetCustomerId = customers[0]?.customer_id || 1;
          }
        }
      }

      const payload = buildPayload(targetCustomerId);
      let response;

      if (initialData?.quotation_id) {
        response = await updateQuotation(initialData.quotation_id, payload);
      } else {
        response = await createQuotation(payload);
      }

      setFormSuccess(
        response?.message || "Quotation saved successfully in the database!"
      );

      if (onSave) {
        await onSave({
          ...payload,
          quotation_id: response?.quotation_id || initialData?.quotation_id,
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          total_amount: totals.total,
          customer_name: formData.client_name.trim(),
        });
      }
    } catch (err) {
      setFormError(err.message || "Failed to save quotation. Please verify input fields.");
    } finally {
      setSaving(false);
    }
  };

  // Direct PDF Download Handler from Current Form
  const handleDownloadPdf = async () => {
    setFormError("");

    if (!formData.quotation_number.trim()) {
      setFormError("Please enter a quotation number before generating PDF.");
      return;
    }

    if (!formData.client_name.trim()) {
      setFormError("Please enter a client name before generating PDF.");
      return;
    }

    if (items.some((it) => !it.item_name.trim())) {
      setFormError("Please ensure all items have a valid service name before downloading PDF.");
      return;
    }

    try {
      setDownloadingPdf(true);
      const filename = `${formData.quotation_number.trim()}.pdf`;
      await downloadQuotationPdf(pdfTemplateRef.current, filename);
    } catch (err) {
      console.error("PDF generation failed:", err);
      setFormError("Failed to generate PDF. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // In-memory quotation object for the PDF template preview
  const liveQuotationData = useMemo(() => {
    return {
      quotation_number: formData.quotation_number,
      customer_name: formData.client_name,
      quotation_date: formData.quotation_date,
      project_start_date: formData.project_start_date,
      estimated_duration: formData.estimated_duration,
      duration_unit: formData.duration_unit,
      estimated_completion_date: estimatedCompletionDate,
      valid_until: formData.valid_until,
      currency: formData.currency,
      subtotal: totals.subtotal,
      discount_amount: totals.discount,
      tax_amount: totals.taxAmount,
      total_amount: totals.total,
      notes: formData.notes,
      terms_and_conditions: formData.terms_and_conditions,
      status: initialData?.status || "Draft",
      items: items.map((it) => ({
        item_name: it.item_name || "Service",
        technology: it.technology,
        website_type: it.website_type,
        hosting_domain: it.hosting_domain,
        description: it.description,
        unit_price: Number(it.unit_price) || 0,
        tax_rate: Number(it.tax_rate) || 0,
        line_total: (Number(it.unit_price) || 0) * (1 + (Number(it.tax_rate) || 0) / 100),
      })),
    };
  }, [formData, estimatedCompletionDate, totals, items, initialData]);

  return (
    <div className="qf-modal-overlay">
      <div className="qf-modal-card">
        {/* Compact Square Header */}
        <div className="qf-header">
          <div className="qf-header-title">
            <div className="qf-header-icon">
              <FileText size={18} />
            </div>
            <div>
              <h2>{initialData ? "Edit Quotation" : "Create Quotation"}</h2>
              <p>Configure project details, software scope, and download PDF.</p>
            </div>
          </div>

          <button
            type="button"
            className="qf-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Form */}
        <form onSubmit={handleSaveQuotation}>
          <div className="qf-body">
            {formError && (
              <div className="qf-alert-error" role="alert">
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="qf-alert-success" role="status">
                <CheckCircle size={16} />
                <span>{formSuccess}</span>
              </div>
            )}

            {/* Section A: Client Information - Direct Textbox */}
            <section className="qf-section">
              <div className="qf-section-title">
                <User size={15} />
                <span>Client Information</span>
              </div>

              <div className="qf-grid-2">
                <div className="qf-field col-span-2">
                  <label className="qf-label">
                    Client Name <span className="qf-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="qf-input"
                    placeholder="Enter client name"
                    value={formData.client_name}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateField("client_name", val);
                      const match = customers.find(
                        (c) =>
                          c.customer_name?.toLowerCase() ===
                          val.trim().toLowerCase()
                      );
                      if (match) {
                        updateField("customer_id", String(match.customer_id));
                      }
                    }}
                    autoComplete="off"
                    required
                  />
                </div>
              </div>
            </section>

            {/* Section B: Quotation & Project Timeline */}
            <section className="qf-section">
              <div className="qf-section-title">
                <Calendar size={15} />
                <span>Quotation &amp; Timeline</span>
              </div>

              <div className="qf-grid-3">
                <div className="qf-field">
                  <label className="qf-label">
                    Quotation Number <span className="qf-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="qf-input"
                    value={formData.quotation_number}
                    onChange={(e) => updateField("quotation_number", e.target.value)}
                    placeholder="e.g. QUO-2026-0001"
                    required
                  />
                </div>

                <div className="qf-field">
                  <label className="qf-label">
                    Quotation Date <span className="qf-required">*</span>
                  </label>
                  <input
                    type="date"
                    className="qf-input"
                    value={formData.quotation_date}
                    onChange={(e) => updateField("quotation_date", e.target.value)}
                    required
                  />
                </div>

                <div className="qf-field">
                  <label className="qf-label">Valid Until</label>
                  <input
                    type="date"
                    className="qf-input"
                    min={formData.quotation_date}
                    value={formData.valid_until}
                    onChange={(e) => updateField("valid_until", e.target.value)}
                  />
                </div>

                <div className="qf-field">
                  <label className="qf-label">Project Start Date</label>
                  <input
                    type="date"
                    className="qf-input"
                    value={formData.project_start_date}
                    onChange={(e) => updateField("project_start_date", e.target.value)}
                  />
                </div>

                <div className="qf-field">
                  <label className="qf-label">Project Duration</label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="number"
                      min="1"
                      className="qf-input"
                      placeholder="e.g. 4"
                      value={formData.estimated_duration}
                      onChange={(e) => updateField("estimated_duration", e.target.value)}
                    />
                    <select
                      className="qf-select"
                      style={{ width: "95px" }}
                      value={formData.duration_unit}
                      onChange={(e) => updateField("duration_unit", e.target.value)}
                    >
                      <option value="Days">Days</option>
                      <option value="Weeks">Weeks</option>
                      <option value="Months">Months</option>
                    </select>
                  </div>
                </div>

                <div className="qf-field">
                  <label className="qf-label">Estimated Completion</label>
                  <input
                    type="text"
                    className="qf-input"
                    readOnly
                    value={estimatedCompletionDate || "Auto-calculated"}
                  />
                </div>

                <div className="qf-field">
                  <label className="qf-label">Currency</label>
                  <select
                    className="qf-select"
                    value={formData.currency}
                    onChange={(e) => updateField("currency", e.target.value)}
                  >
                    <option value="LKR">LKR - Sri Lankan Rupee</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Section C: Quotation Items & Services */}
            <section className="qf-section">
              <div className="qf-items-header">
                <div className="qf-section-title" style={{ margin: 0, border: "none", padding: 0 }}>
                  <Layers size={15} />
                  <span>Services / Scope</span>
                </div>

                <button type="button" className="qf-add-btn" onClick={addItem}>
                  <Plus size={14} />
                  Add Service
                </button>
              </div>

              {items.map((item, index) =>
                item.is_additional ? (
                  <div
                    key={index}
                    className="qf-item-card qf-additional-item-card"
                    style={{
                      background: "#f0fdf4",
                      border: "1.5px solid #86efac",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="qf-item-num">Item #{index + 1}</span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            background: "#dcfce7",
                            color: "#15803d",
                            padding: "2px 8px",
                            borderRadius: "4px",
                          }}
                        >
                          Additional Item
                        </span>
                      </div>

                      <button
                        type="button"
                        className="qf-delete-item-btn"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                        title="Remove Additional Item"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr",
                        gap: "14px",
                        alignItems: "flex-end",
                      }}
                    >
                      <div className="qf-field">
                        <label className="qf-label">
                          Item Name (ex: Logo) <span className="qf-required">*</span>
                        </label>
                        <input
                          type="text"
                          className="qf-input"
                          placeholder="e.g. Logo, Domain, SSL..."
                          value={item.item_name}
                          onChange={(e) => updateItem(index, "item_name", e.target.value)}
                          required
                          autoFocus
                        />
                      </div>

                      <div className="qf-field">
                        <label className="qf-label">
                          Amount ({formData.currency}) <span className="qf-required">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="qf-input"
                          placeholder="0.00"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={index} className="qf-item-card">
                    <div className="qf-item-card-header">
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <span className="qf-item-num">Item #{index + 1}</span>
                        {item.item_name && (
                          <span className="qf-service-preset-badge">
                            {item.item_name}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        className="qf-delete-item-btn"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                        title="Remove Item"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="qf-grid-3">
                      {/* Select Service Dropdown - Clean 4 options as requested */}
                      <div className="qf-field col-span-3">
                        <label className="qf-label">Select Service</label>
                        <select
                          className="qf-select"
                          value={
                            ["WordPress Website", "React Website", "Custom Website", "Website Maintenance"].includes(item.item_name)
                              ? item.item_name
                              : ""
                          }
                          onChange={(e) => handleSelectServicePreset(index, e.target.value)}
                        >
                          <option value="">-- Select Service --</option>
                          <option value="WordPress Website">WordPress Website</option>
                          <option value="React Website">React Website</option>
                          <option value="Custom Website">Custom Website</option>
                          <option value="Website Maintenance">Website Maintenance</option>
                        </select>
                      </div>

                      {/* Service Name */}
                      <div className="qf-field col-span-3">
                        <label className="qf-label">
                          Service Name <span className="qf-required">*</span>
                        </label>
                        <input
                          type="text"
                          className="qf-input"
                          placeholder="e.g. WordPress Website"
                          value={item.item_name}
                          onChange={(e) => updateItem(index, "item_name", e.target.value)}
                          required
                        />
                      </div>

                      {/* Technology Stack */}
                      <div className="qf-field">
                        <label className="qf-label">
                          <Code size={13} /> Technology
                        </label>
                        <input
                          type="text"
                          className="qf-input"
                          placeholder="e.g. WordPress CMS / PHP"
                          value={item.technology}
                          onChange={(e) => updateItem(index, "technology", e.target.value)}
                        />
                      </div>

                      {/* Website Type */}
                      <div className="qf-field">
                        <label className="qf-label">
                          <Globe size={13} /> Website Type
                        </label>
                        <input
                          type="text"
                          className="qf-input"
                          placeholder="e.g. Corporate / Business Website"
                          value={item.website_type}
                          onChange={(e) => updateItem(index, "website_type", e.target.value)}
                        />
                      </div>

                      {/* Hosting & Domain */}
                      <div className="qf-field">
                        <label className="qf-label">
                          <Server size={13} /> Hosting &amp; Domain
                        </label>
                        <input
                          type="text"
                          className="qf-input"
                          placeholder="e.g. Domain and hosting setup assistance included"
                          value={item.hosting_domain}
                          onChange={(e) => updateItem(index, "hosting_domain", e.target.value)}
                        />
                      </div>

                      {/* Description / Deliverables */}
                      <div className="qf-field col-span-3">
                        <label className="qf-label">Description &amp; Deliverables</label>
                        <textarea
                          rows={3}
                          className="qf-textarea"
                          placeholder="Detailed deliverables, core features, maintenance support, and SEO setup..."
                          value={item.description}
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                        />
                      </div>

                      {/* Price and Tax */}
                      <div className="qf-field">
                        <label className="qf-label">
                          Price ({formData.currency}) <span className="qf-required">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="qf-input"
                          placeholder="0.00"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                          required
                        />
                      </div>

                      <div className="qf-field">
                        <label className="qf-label">Tax Rate (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className="qf-input"
                          placeholder="0"
                          value={item.tax_rate}
                          onChange={(e) => updateItem(index, "tax_rate", e.target.value)}
                        />
                      </div>

                      <div className="qf-field">
                        <label className="qf-label">Line Total</label>
                        <div className="qf-line-total-badge">
                          <span>Total (inc. tax):</span>
                          <span>
                            {formatMoney(
                              (Number(item.unit_price) || 0) *
                                (1 + (Number(item.tax_rate) || 0) / 100)
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Add Additional Row Button (At the bottom of items list) */}
              <div className="qf-bottom-add-container" style={{ marginTop: "14px", display: "flex", flexWrap: "wrap", gap: "10px" }}>
                <button
                  type="button"
                  className="qf-btn-add-additional"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "9px 18px",
                    background: "#ecfdf5",
                    color: "#059669",
                    border: "1.5px dashed #10b981",
                    borderRadius: "8px",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: "13px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  }}
                  onClick={addAdditionalItem}
                  title="Add an additional item with just Name and Amount"
                >
                  <Plus size={16} />
                  <span>+ Add Additional Item (e.g. Logo)</span>
                </button>
              </div>
            </section>

            {/* Section D: Notes, Terms, and Financial Summary */}
            <div className="qf-bottom-area">
              <section className="qf-section" style={{ height: "100%" }}>
                <div className="qf-section-title">
                  <FileText size={15} />
                  <span>Terms &amp; Notes</span>
                </div>

                <div className="qf-field" style={{ marginBottom: "10px" }}>
                  <label className="qf-label">Terms and Conditions</label>
                  <textarea
                    rows={4}
                    className="qf-textarea"
                    value={formData.terms_and_conditions}
                    onChange={(e) => updateField("terms_and_conditions", e.target.value)}
                  />
                </div>

                <div className="qf-field">
                  <label className="qf-label">Special Notes</label>
                  <textarea
                    rows={3}
                    className="qf-textarea"
                    placeholder="Optional notes or instructions..."
                    value={formData.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                  />
                </div>
              </section>

              {/* Financial Summary */}
              <div className="qf-summary-box">
                <div className="qf-section-title">
                  <span>Financial Summary</span>
                </div>

                <div className="qf-summary-row">
                  <span>Subtotal:</span>
                  <span style={{ fontWeight: 700 }}>
                    {formatMoney(totals.subtotal)}
                  </span>
                </div>

                <div className="qf-summary-row">
                  <span>Tax Amount:</span>
                  <span style={{ fontWeight: 700 }}>
                    + {formatMoney(totals.taxAmount)}
                  </span>
                </div>

                <div className="qf-field" style={{ margin: "8px 0" }}>
                  <label className="qf-label">
                    Discount ({formData.currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="qf-input"
                    value={formData.discount_amount}
                    onChange={(e) => updateField("discount_amount", e.target.value)}
                  />
                </div>

                <div className="qf-summary-row total-row">
                  <span>Grand Total:</span>
                  <span className="qf-grand-total">
                    {formatMoney(totals.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer with Actions */}
          <div className="qf-footer">
            <button
              type="button"
              className="qf-btn qf-btn-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <div className="qf-footer-actions">
              <button
                type="button"
                className="qf-btn qf-btn-pdf"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf || saving}
                title="Download formatted business PDF using current form details"
              >
                <Download size={15} />
                {downloadingPdf ? "Generating PDF..." : "Download PDF"}
              </button>

              <button
                type="submit"
                className="qf-btn qf-btn-primary"
                disabled={saving || downloadingPdf}
              >
                <Save size={15} />
                {saving
                  ? "Saving..."
                  : initialData
                  ? "Update Quotation"
                  : "Save Quotation"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Hidden container for rendering QuotationTemplate for PDF export */}
      <div className="qf-pdf-export-host">
        <QuotationTemplate
          ref={pdfTemplateRef}
          quotation={liveQuotationData}
          customer={{
            customer_name: formData.client_name,
            company_name: selectedCustomer?.company_name || "",
            email: selectedCustomer?.email || "",
            phone: selectedCustomer?.phone || "",
            address: selectedCustomer?.address || "",
          }}
          company={companyDetails}
        />
      </div>
    </div>
  );
}
