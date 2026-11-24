import { useState, useEffect, useRef, useMemo } from "react";
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
  HeartHandshake,
  UserCheck,
  PenLine,
  ChevronDown,
  Package,
  Server,
  Headphones,
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
import ThemeToggle from "../components/ThemeToggle";

// Helper to format numbered terms on separate rows (e.g. 1. on row 1, 2. on row 2)
function formatTermsAndConditionsLines(terms) {
  if (!terms) return "";
  let text = String(terms);
  // Unescape literal \r\n, \n, \r if stored escaped in DB or JSON
  text = text.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\n");
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Separate numbered items (e.g. 1. Payment... 2. Quotation...) into individual rows
  text = text.replace(/([^\n])\s*(\b\d+[\.\)]\s*)/g, "$1\n$2");
  return text.trim();
}

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
    default_terms_and_conditions:
      "1. Payment terms as agreed.\n2. This quotation is valid until the stated expiry date.",
    pdf_heading: "QUOTATION",
    pdf_subheading: "PROFESSIONAL SERVICES PROPOSAL",
    pdf_custom_lines: "",
    pdf_footer_note: "",
    quotation_thank_you_title: "Thank You",
    quotation_thank_you_message: "",
    quotation_prepared_by: "NetIT Technology",
    quotation_prepared_by_services: "Web Development • Software Solutions • Digital Marketing",
    quotation_ceo_name: "D M N K DISSANAYAKA",
    quotation_ceo_designation: "CEO (NetIT Technology)",
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

  // Invoice settings & billing preferences (persisted in localStorage: iq_invoice_settings)
  const [invoiceSettings, setInvoiceSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("iq_invoice_settings");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return {
      invoice_prefix: "INV",
      default_due_days: "14",
      default_currency: "LKR",
      tax_display_option: "itemized",
      pdf_heading: "INVOICE",
      pdf_subheading: "OFFICIAL BILLING DOCUMENT",
      default_notes: "",
      default_terms:
        "Payment is strictly due within 14 calendar days of issuance.\nOverdue accounts may be subject to interest.",
      thank_you_title: "Thank You",
      thank_you_message:
        "We appreciate the opportunity to work with your business.",
      prepared_by: "NetIT Technology",
      prepared_by_services:
        "Web Development • Software Solutions • Digital Marketing",
      ceo_name: "D M N K DISSANAYAKA",
      ceo_designation: "CEO (NetIT Technology)",
    };
  });
  const [savingInvoice, setSavingInvoice] = useState(false);

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

      let localTemplate = {};
      try {
        const rawTpl = localStorage.getItem("iq_quotation_template_settings");
        if (rawTpl) localTemplate = JSON.parse(rawTpl);
      } catch {
        // ignore
      }

      let localBranding = {};
      try {
        const rawBrand = localStorage.getItem("company_branding");
        if (rawBrand) localBranding = JSON.parse(rawBrand);
      } catch {
        // ignore
      }

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
          default_terms_and_conditions: formatTermsAndConditionsLines(
            data.default_terms_and_conditions ||
            localTemplate.default_terms_and_conditions ||
            "1. Payment terms as agreed.\n2. This quotation is valid until the stated expiry date."
          ),
          pdf_heading: data.pdf_heading || localTemplate.pdf_heading || "QUOTATION",
          pdf_subheading:
            data.pdf_subheading || localTemplate.pdf_subheading || "PROFESSIONAL SERVICES PROPOSAL",
          pdf_custom_lines: data.pdf_custom_lines || localTemplate.pdf_custom_lines || "",
          pdf_footer_note: data.pdf_footer_note || localTemplate.pdf_footer_note || "",
          quotation_thank_you_title:
            data.quotation_thank_you_title !== undefined && data.quotation_thank_you_title !== null
              ? data.quotation_thank_you_title
              : (localTemplate.quotation_thank_you_title || "Thank You"),
          quotation_thank_you_message:
            data.quotation_thank_you_message !== undefined && data.quotation_thank_you_message !== null
              ? data.quotation_thank_you_message
              : (localTemplate.quotation_thank_you_message || ""),
          quotation_prepared_by:
            data.quotation_prepared_by !== undefined && data.quotation_prepared_by !== null
              ? data.quotation_prepared_by
              : (localTemplate.quotation_prepared_by || "NetIT Technology"),
          quotation_prepared_by_services:
            data.quotation_prepared_by_services !== undefined && data.quotation_prepared_by_services !== null
              ? data.quotation_prepared_by_services
              : (localTemplate.quotation_prepared_by_services || "Web Development • Software Solutions • Digital Marketing"),
          quotation_ceo_name:
            data.quotation_ceo_name || data.authorized_person || data.contact_person || localTemplate.quotation_ceo_name || "D M N K DISSANAYAKA",
          quotation_ceo_designation:
            data.quotation_ceo_designation || data.designation || localTemplate.quotation_ceo_designation || "CEO (NetIT Technology)",
        });

        const activeLogo = data.logo_url || data.company_logo || localBranding.logo_url || localBranding.company_logo || "";
        const activeSig = data.signature_url || data.company_signature || localBranding.signature_url || localBranding.company_signature || "";
        if (activeLogo) setLogoUrl(activeLogo);
        if (activeSig) setSignatureUrl(activeSig);

        // Parse custom headings / sections if available
        let loadedSections = [];
        const rawSections = data.pdf_custom_sections || localTemplate.pdf_custom_sections;
        if (rawSections) {
          try {
            loadedSections =
              typeof rawSections === "string"
                ? JSON.parse(rawSections)
                : rawSections;
          } catch {
            loadedSections = [];
          }
        }
        setCustomSections(Array.isArray(loadedSections) ? loadedSections : []);

        // Sync invoice default notes & settings from company info if not customized
        try {
          const rawInv = localStorage.getItem("iq_invoice_settings");
          if (rawInv) {
            const parsed = JSON.parse(rawInv);
            setInvoiceSettings((prev) => ({
              ...prev,
              ...parsed,
              thank_you_title:
                parsed.thank_you_title !== undefined && parsed.thank_you_title !== null
                  ? parsed.thank_you_title
                  : (data?.quotation_thank_you_title || prev.thank_you_title),
              thank_you_message:
                parsed.thank_you_message !== undefined && parsed.thank_you_message !== null
                  ? parsed.thank_you_message
                  : (data?.quotation_thank_you_message || prev.thank_you_message),
              prepared_by:
                parsed.prepared_by !== undefined && parsed.prepared_by !== null
                  ? parsed.prepared_by
                  : (data?.quotation_prepared_by || prev.prepared_by),
              prepared_by_services:
                parsed.prepared_by_services !== undefined && parsed.prepared_by_services !== null
                  ? parsed.prepared_by_services
                  : (data?.quotation_prepared_by_services || prev.prepared_by_services),
              ceo_name:
                parsed.ceo_name !== undefined && parsed.ceo_name !== null
                  ? parsed.ceo_name
                  : (data?.quotation_ceo_name || prev.ceo_name),
              ceo_designation:
                parsed.ceo_designation !== undefined && parsed.ceo_designation !== null
                  ? parsed.ceo_designation
                  : (data?.quotation_ceo_designation || prev.ceo_designation),
              default_notes:
                parsed.default_notes ||
                (data?.bank_name
                  ? `Please remit payment via bank transfer to ${data.bank_name} (A/C: ${data.bank_account_number || "—"}, Beneficiary: ${data.bank_account_name || data.company_name || "—"}). Reference the invoice number on your payment slip.`
                  : prev.default_notes),
            }));
          } else {
            setInvoiceSettings((prev) => ({
              ...prev,
              thank_you_title: data?.quotation_thank_you_title || prev.thank_you_title,
              thank_you_message: data?.quotation_thank_you_message || prev.thank_you_message,
              prepared_by: data?.quotation_prepared_by || prev.prepared_by,
              prepared_by_services: data?.quotation_prepared_by_services || prev.prepared_by_services,
              ceo_name: data?.quotation_ceo_name || prev.ceo_name,
              ceo_designation: data?.quotation_ceo_designation || prev.ceo_designation,
              default_notes: data?.bank_name
                ? `Please remit payment via bank transfer to ${data.bank_name} (A/C: ${data.bank_account_number || "—"}, Beneficiary: ${data.bank_account_name || data.company_name || "—"}). Reference the invoice number on your payment slip.`
                : prev.default_notes,
            }));
          }
        } catch {
          // fallback
        }
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

  // Auto-format terms & conditions so numbered bullet points (1. and 2.) are rendered on separate rows in UI
  useEffect(() => {
    if (
      formData.default_terms_and_conditions &&
      formData.default_terms_and_conditions.includes("2.") &&
      !formData.default_terms_and_conditions.includes("\n")
    ) {
      setFormData((prev) => ({
        ...prev,
        default_terms_and_conditions: formatTermsAndConditionsLines(
          prev.default_terms_and_conditions
        ),
      }));
    }
  }, [formData.default_terms_and_conditions]);

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
   * Invoice Settings Handlers & Persistence
   */
  const handleInvoiceSettingsChange = (field, value) => {
    setInvoiceSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFillBankIntoInvoiceNotes = () => {
    if (!formData.bank_name) {
      setError("Please configure your Bank Details under Company Profile first.");
      return;
    }
    const bankNote = `Please remit payment via bank transfer to ${formData.bank_name} (A/C: ${formData.bank_account_number || "—"}, Beneficiary: ${formData.bank_account_name || formData.company_name || "—"}). Reference the invoice number on your payment slip.`;
    handleInvoiceSettingsChange("default_notes", bankNote);
    setSuccess("Bank remittance instructions imported into Invoice Notes!");
  };

  const handleSaveInvoiceSettings = (e) => {
    if (e) e.preventDefault();
    setSavingInvoice(true);
    setError("");
    setSuccess("");
    try {
      const cleaned = {
        invoice_prefix:
          String(invoiceSettings.invoice_prefix || "INV").trim().toUpperCase() ||
          "INV",
        default_due_days:
          String(invoiceSettings.default_due_days || "14").trim() || "14",
        default_currency:
          String(invoiceSettings.default_currency || "LKR").trim() || "LKR",
        tax_display_option: invoiceSettings.tax_display_option || "itemized",
        pdf_heading:
          String(invoiceSettings.pdf_heading || "INVOICE").trim() || "INVOICE",
        pdf_subheading: String(invoiceSettings.pdf_subheading || "").trim(),
        default_notes: String(invoiceSettings.default_notes || "").trim(),
        default_terms: String(invoiceSettings.default_terms || "").trim(),
        thank_you_title: String(invoiceSettings.thank_you_title || "Thank You").trim(),
        thank_you_message: String(invoiceSettings.thank_you_message || "").trim(),
        prepared_by: String(invoiceSettings.prepared_by || "").trim(),
        prepared_by_services: String(invoiceSettings.prepared_by_services || "").trim(),
        ceo_name: String(invoiceSettings.ceo_name || "").trim(),
        ceo_designation: String(invoiceSettings.ceo_designation || "").trim(),
      };
      setInvoiceSettings(cleaned);
      localStorage.setItem("iq_invoice_settings", JSON.stringify(cleaned));
      window.dispatchEvent(
        new CustomEvent("invoice-settings-updated", { detail: cleaned })
      );
      setSuccess(
        "Invoice billing preferences & template layout saved successfully! New invoices will now inherit these defaults."
      );
    } catch (err) {
      console.error("Failed to save invoice settings:", err);
      setError("Failed to save invoice settings to local storage.");
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleResetInvoiceSettings = () => {
    try {
      const saved = localStorage.getItem("iq_invoice_settings");
      if (saved) {
        setInvoiceSettings(JSON.parse(saved));
        setSuccess("Invoice settings reset to last saved values.");
      } else {
        setInvoiceSettings({
          invoice_prefix: "INV",
          default_due_days: "14",
          default_currency: "LKR",
          tax_display_option: "itemized",
          pdf_heading: "INVOICE",
          pdf_subheading: "OFFICIAL BILLING DOCUMENT",
          default_notes: formData.bank_name
            ? `Please remit payment via bank transfer to ${formData.bank_name} (A/C: ${formData.bank_account_number || "—"}, Beneficiary: ${formData.bank_account_name || formData.company_name || "—"}). Reference the invoice number on your payment slip.`
            : "",
          default_terms:
            "Payment is strictly due within 14 calendar days of issuance.\nOverdue accounts may be subject to interest.",
          thank_you_title: formData.quotation_thank_you_title || "Thank You",
          thank_you_message: formData.quotation_thank_you_message || "",
          prepared_by: formData.quotation_prepared_by || "NetIT Technology",
          prepared_by_services: formData.quotation_prepared_by_services || "Web Development • Software Solutions • Digital Marketing",
          ceo_name: formData.quotation_ceo_name || "D M N K DISSANAYAKA",
          ceo_designation: formData.quotation_ceo_designation || "CEO (NetIT Technology)",
        });
        setSuccess("Invoice settings restored to system defaults.");
      }
    } catch {
      // fallback
    }
  };

  // Live preview calculations for Invoice Settings preview
  const previewDueDays = parseInt(invoiceSettings.default_due_days, 10);
  const previewDueDateStr = useMemo(() => {
    const d = new Date();
    d.setDate(
      d.getDate() +
      (Number.isNaN(previewDueDays) || previewDueDays <= 0
        ? 14
        : previewDueDays)
    );
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }, [previewDueDays]);

  const previewTodayStr = useMemo(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }, []);

  const previewInvoiceNumber = `${(
    invoiceSettings.invoice_prefix || "INV"
  ).toUpperCase()}-2611-001`;

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
        try {
          const raw = localStorage.getItem("company_branding");
          const brandObj = raw ? JSON.parse(raw) : {};
          brandObj.company_logo = newLogoPath;
          brandObj.logo_url = newLogoPath;
          localStorage.setItem("company_branding", JSON.stringify(brandObj));
        } catch {
          // ignore
        }
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
        try {
          const raw = localStorage.getItem("company_branding");
          const brandObj = raw ? JSON.parse(raw) : {};
          brandObj.company_signature = newSignaturePath;
          brandObj.signature_url = newSignaturePath;
          localStorage.setItem("company_branding", JSON.stringify(brandObj));
        } catch {
          // ignore
        }
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
      try {
        const raw = localStorage.getItem("company_branding");
        const brandObj = raw ? JSON.parse(raw) : {};
        brandObj.company_logo = "";
        brandObj.logo_url = "";
        localStorage.setItem("company_branding", JSON.stringify(brandObj));
      } catch {
        // ignore
      }
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
      try {
        const raw = localStorage.getItem("company_branding");
        const brandObj = raw ? JSON.parse(raw) : {};
        brandObj.company_signature = "";
        brandObj.signature_url = "";
        localStorage.setItem("company_branding", JSON.stringify(brandObj));
      } catch {
        // ignore
      }
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

      // Persist quotation template settings locally so headings, sections & notes are immediately saved and never lost
      const cleanedQuotationTemplate = {
        pdf_heading: formData.pdf_heading.trim(),
        pdf_subheading: formData.pdf_subheading.trim(),
        pdf_custom_lines: formData.pdf_custom_lines.trim(),
        pdf_footer_note: formData.pdf_footer_note.trim(),
        default_terms_and_conditions: formatTermsAndConditionsLines(
          formData.default_terms_and_conditions
        ),
        quotation_thank_you_title: (formData.quotation_thank_you_title || "").trim(),
        quotation_thank_you_message: (formData.quotation_thank_you_message || "").trim(),
        quotation_prepared_by: (formData.quotation_prepared_by || "").trim(),
        quotation_prepared_by_services: (formData.quotation_prepared_by_services || "").trim(),
        quotation_ceo_name: (formData.quotation_ceo_name || "").trim(),
        quotation_ceo_designation: (formData.quotation_ceo_designation || "").trim(),
        pdf_custom_sections: cleanedSections.length > 0 ? cleanedSections : null,
      };
      localStorage.setItem("iq_quotation_template_settings", JSON.stringify(cleanedQuotationTemplate));

      // Persist company profile branding locally for instant access across both PDFs
      const cleanedBranding = {
        company_name: formData.company_name.trim(),
        email_address: formData.email_address.trim(),
        contact_number: formData.contact_number.trim(),
        company_address: formData.company_address.trim(),
        bank_name: formData.bank_name.trim(),
        bank_account_name: formData.bank_account_name.trim(),
        bank_account_number: formData.bank_account_number.trim(),
        bank_branch: formData.bank_branch.trim(),
        bank_swift_code: formData.bank_swift_code.trim(),
        company_logo: logoUrl,
        logo_url: logoUrl,
        company_signature: signatureUrl,
        signature_url: signatureUrl,
      };
      localStorage.setItem("company_branding", JSON.stringify(cleanedBranding));

      // Persist invoice settings to local storage whenever settings are saved
      try {
        const cleanedInv = {
          invoice_prefix:
            String(invoiceSettings.invoice_prefix || "INV").trim().toUpperCase() ||
            "INV",
          default_due_days:
            String(invoiceSettings.default_due_days || "14").trim() || "14",
          default_currency:
            String(invoiceSettings.default_currency || "LKR").trim() || "LKR",
          tax_display_option: invoiceSettings.tax_display_option || "itemized",
          pdf_heading:
            String(invoiceSettings.pdf_heading || "INVOICE").trim() || "INVOICE",
          pdf_subheading: String(invoiceSettings.pdf_subheading || "").trim(),
          default_notes: String(invoiceSettings.default_notes || "").trim(),
          default_terms: String(invoiceSettings.default_terms || "").trim(),
          thank_you_title: String(invoiceSettings.thank_you_title || "Thank You").trim(),
          thank_you_message: String(invoiceSettings.thank_you_message || "").trim(),
          prepared_by: String(invoiceSettings.prepared_by || "").trim(),
          prepared_by_services: String(invoiceSettings.prepared_by_services || "").trim(),
          ceo_name: String(invoiceSettings.ceo_name || "").trim(),
          ceo_designation: String(invoiceSettings.ceo_designation || "").trim(),
        };
        setInvoiceSettings(cleanedInv);
        localStorage.setItem("iq_invoice_settings", JSON.stringify(cleanedInv));
        window.dispatchEvent(
          new CustomEvent("invoice-settings-updated", { detail: cleanedInv })
        );
      } catch (err) {
        console.warn("Could not sync invoice settings to localStorage:", err);
      }

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
        default_terms_and_conditions: formatTermsAndConditionsLines(
          formData.default_terms_and_conditions
        ),
        pdf_heading: formData.pdf_heading.trim(),
        pdf_subheading: formData.pdf_subheading.trim(),
        pdf_custom_lines: formData.pdf_custom_lines.trim(),
        pdf_footer_note: formData.pdf_footer_note.trim(),
        quotation_thank_you_title: (formData.quotation_thank_you_title || "").trim(),
        quotation_thank_you_message: (formData.quotation_thank_you_message || "").trim(),
        quotation_prepared_by: (formData.quotation_prepared_by || "").trim(),
        quotation_prepared_by_services: (formData.quotation_prepared_by_services || "").trim(),
        quotation_ceo_name: (formData.quotation_ceo_name || "").trim(),
        quotation_ceo_designation: (formData.quotation_ceo_designation || "").trim(),
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
          <ThemeToggle />
          <button
            type="button"
            className="cs-refresh-btn"
            onClick={loadSettings}
            disabled={loading || saving}
            title="Refresh settings from server"
            aria-label="Refresh settings"
          >
            <RefreshCw size={15} className={loading ? "cs-spin" : ""} />
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
                <form onSubmit={handleSubmit} className="cs-template-form-wrap">
                  <div className="cs-template-layout-grid">
                    {/* Left Column: Separated Settings Cards */}
                    <div className="cs-template-cards-col">
                      {/* CARD 1: Document Headings & Banner Titles */}
                      <section className="cs-section-card cs-template-card">
                        <div className="cs-section-header">
                          <div className="cs-section-icon">
                            <FileText size={18} />
                          </div>
                          <div>
                            <h3>PDF Document Headings &amp; Titles</h3>
                            <p>
                              Primary document title, proposal subtitle, and decorative announcement text.
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
                        </div>
                      </section>

                      {/* CARD 2: Terms, Policies & Footer Notices */}
                      <section className="cs-section-card cs-template-card">
                        <div className="cs-section-header">
                          <div className="cs-section-icon secondary">
                            <ShieldCheck size={18} />
                          </div>
                          <div>
                            <h3>Quotation Terms &amp; Footer Notices</h3>
                            <p>
                              Set default terms auto-loaded into new quotations and official footer declarations.
                            </p>
                          </div>
                        </div>

                        <div className="cs-fields-grid">
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
                              className="cs-default-terms-textarea"
                              rows={4}
                              placeholder={"1. Payment terms as agreed.\n2. This quotation is valid until the stated expiry date."}
                              value={formData.default_terms_and_conditions}
                              onChange={handleInputChange}
                              onBlur={(e) => {
                                setFormData((prev) => ({
                                  ...prev,
                                  default_terms_and_conditions: formatTermsAndConditionsLines(e.target.value),
                                }));
                              }}
                            />
                            <small>Whenever Admin or Super Admin creates a quotation, these terms are loaded by default.</small>
                          </div>
                        </div>
                      </section>

                      {/* CARD 3: Quotation Closing & Thank You Message */}
                      <section className="cs-section-card cs-template-card">
                        <div className="cs-section-header">
                          <div className="cs-section-icon accent">
                            <HeartHandshake size={18} />
                          </div>
                          <div>
                            <h3>Quotation Closing &amp; Thank You Note</h3>
                            <p>
                              Title and appreciative closing paragraph printed right after Terms &amp; Conditions on quotation PDFs.
                            </p>
                          </div>
                        </div>

                        <div className="cs-fields-grid">
                          <div className="cs-field-group cs-full-width">
                            <label htmlFor="quotation_thank_you_title">Thank You Heading Title</label>
                            <input
                              id="quotation_thank_you_title"
                              name="quotation_thank_you_title"
                              type="text"
                              placeholder="e.g. Thank You"
                              value={formData.quotation_thank_you_title}
                              onChange={handleInputChange}
                            />
                            <small>Bold title rendered directly under the Terms &amp; Conditions list.</small>
                          </div>

                          <div className="cs-field-group cs-full-width">
                            <label htmlFor="quotation_thank_you_message">Thank You Message / Appreciation Paragraph</label>
                            <textarea
                              id="quotation_thank_you_message"
                              name="quotation_thank_you_message"
                              rows={4}
                              placeholder="e.g. We appreciate the opportunity to work with your business. NetIT Technology is committed to delivering modern, scalable, and professional platforms..."
                              value={formData.quotation_thank_you_message}
                              onChange={handleInputChange}
                            />
                            <small>Comprehensive closing note conveying gratitude, service vision, and business commitment.</small>
                          </div>
                        </div>
                      </section>

                      {/* CARD 4: Prepared By & Company Services */}
                      <section className="cs-section-card cs-template-card">
                        <div className="cs-section-header">
                          <div className="cs-section-icon secondary">
                            <FileCheck size={18} />
                          </div>
                          <div>
                            <h3>Prepared By &amp; Services Description</h3>
                            <p>
                              Agency / company name and service lines printed below the Thank You section in bold text.
                            </p>
                          </div>
                        </div>

                        <div className="cs-fields-grid">
                          <div className="cs-field-group">
                            <label htmlFor="quotation_prepared_by">Prepared By (Entity / Company)</label>
                            <input
                              id="quotation_prepared_by"
                              name="quotation_prepared_by"
                              type="text"
                              placeholder="e.g. NetIT Technology"
                              value={formData.quotation_prepared_by}
                              onChange={handleInputChange}
                            />
                            <small>Displayed on row 2 of the Prepared by block in bold black font.</small>
                          </div>

                          <div className="cs-field-group">
                            <label htmlFor="quotation_prepared_by_services">Services &amp; Specializations Line</label>
                            <input
                              id="quotation_prepared_by_services"
                              name="quotation_prepared_by_services"
                              type="text"
                              placeholder="e.g. Web Development • Software Solutions • Digital Marketing"
                              value={formData.quotation_prepared_by_services}
                              onChange={handleInputChange}
                            />
                            <small>Displayed on row 3 directly underneath the company name.</small>
                          </div>
                        </div>
                      </section>

                      {/* CARD 5: Authorized Signatory (CEO Signature & Designation) */}
                      <section className="cs-section-card cs-template-card">
                        <div className="cs-section-header">
                          <div className="cs-section-icon">
                            <UserCheck size={18} />
                          </div>
                          <div>
                            <h3>Authorized Signatory (Executive Signature)</h3>
                            <p>
                              Executive name and designation rendered centered directly beneath the left-aligned signature.
                            </p>
                          </div>
                        </div>

                        <div className="cs-fields-grid">
                          <div className="cs-field-group">
                            <label htmlFor="quotation_ceo_name">Signatory / CEO Full Name</label>
                            <input
                              id="quotation_ceo_name"
                              name="quotation_ceo_name"
                              type="text"
                              placeholder="e.g. D M N K DISSANAYAKA"
                              value={formData.quotation_ceo_name}
                              onChange={handleInputChange}
                            />
                            <small>Centered bold signatory name below the signature line.</small>
                          </div>

                          <div className="cs-field-group">
                            <label htmlFor="quotation_ceo_designation">Official Designation / Title</label>
                            <input
                              id="quotation_ceo_designation"
                              name="quotation_ceo_designation"
                              type="text"
                              placeholder="e.g. CEO (NetIT Technology)"
                              value={formData.quotation_ceo_designation}
                              onChange={handleInputChange}
                            />
                            <small>Centered official title underneath the signatory&apos;s name.</small>
                          </div>
                        </div>
                      </section>

                      {/* Bottom Action Bar */}
                      <div className="cs-action-bar cs-template-action-bar">
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
                    </div>

                    {/* Right Column: Sticky Live PDF Layout Preview */}
                    <aside className="cs-template-preview-col">
                      <div className="cs-template-preview-sticky">
                        <div className="cs-preview-card-box">
                          <div className="cs-preview-header">
                            <div className="cs-preview-title-left">
                              <span className="cs-live-indicator-dot" />
                              <Eye size={15} color="#2563eb" />
                              <strong>Live PDF Layout Preview</strong>
                            </div>
                            <span className="cs-preview-badge">Live Sync</span>
                          </div>

                          <div className="cs-pdf-preview-sheet">
                            {/* Top Bar Preview */}
                            <div className="cs-pdf-header-row">
                              <div className="cs-pdf-header-left">
                                <div className="cs-pdf-company-name">
                                  {formData.company_name || "NetIT Technology"}
                                </div>
                                <div className="cs-pdf-meta">
                                  {formData.company_address || "Ampitiya, Kandy, Sri Lanka"} | {formData.email_address || "info@netittechnology.com"}
                                </div>
                              </div>
                              <div className="cs-pdf-header-right">
                                <div className="cs-pdf-title">
                                  {formData.pdf_heading || "QUOTATION"}
                                </div>
                                <div className="cs-pdf-subtitle">
                                  {formData.pdf_subheading || "PROFESSIONAL SERVICES PROPOSAL"}
                                </div>
                              </div>
                            </div>

                            {/* Decorative Line Preview */}
                            <div className="cs-pdf-divider" />

                            {/* Custom Extra Line Preview */}
                            {formData.pdf_custom_lines && (
                              <div className="cs-pdf-custom-line">
                                <span>{formData.pdf_custom_lines}</span>
                              </div>
                            )}

                            {/* Reference Information Mockup */}
                            <div className="cs-pdf-mock-ref-grid">
                              <div><strong>Quotation No:</strong> QTN-2026-0001</div>
                              <div><strong>Date:</strong> 19 Nov 2026</div>
                              <div><strong>Prepared For:</strong> Sampath Bandara</div>
                              <div><strong>Valid Until:</strong> 19 Dec 2026</div>
                            </div>

                            {/* Sample Table Preview Mockup */}
                            <div className="cs-pdf-mock-table">
                              <div className="cs-mock-th">
                                <span>#</span>
                                <span>SERVICE SCOPE / DELIVERABLES</span>
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

                            {/* Payment terms & Total summary */}
                            <div className="cs-pdf-mock-summary-row">
                              <div className="cs-pdf-mock-bank-info">
                                <strong>Payment &amp; Bank Details:</strong>
                                <span>{formData.bank_name || "Commercial Bank"} - Acc: {formData.bank_account_number || "1000123456"}</span>
                              </div>
                              <div className="cs-pdf-mock-total-box">
                                <span>Total Amount:</span>
                                <strong>LKR 75,000.00</strong>
                              </div>
                            </div>

                            {/* Default Terms Preview snippet */}
                            {formData.default_terms_and_conditions && (
                              <div className="cs-pdf-terms-preview-box">
                                <strong>Terms &amp; Conditions:</strong>
                                <p>{formData.default_terms_and_conditions}</p>
                              </div>
                            )}

                            {/* Thank You Section Live Preview */}
                            {(formData.quotation_thank_you_title || formData.quotation_thank_you_message) && (
                              <div className="cs-pdf-thank-you-box">
                                {formData.quotation_thank_you_title && (
                                  <div className="cs-pdf-thank-you-title">
                                    {formData.quotation_thank_you_title}
                                  </div>
                                )}
                                {formData.quotation_thank_you_message && (
                                  <div className="cs-pdf-thank-you-msg">
                                    {formData.quotation_thank_you_message}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Prepared By Section Live Preview */}
                            {(formData.quotation_prepared_by || formData.quotation_prepared_by_services) && (
                              <div className="cs-pdf-prepared-by-box">
                                <div className="cs-pdf-prepared-label">Prepared by:</div>
                                {formData.quotation_prepared_by && (
                                  <div className="cs-pdf-prepared-company">
                                    {formData.quotation_prepared_by}
                                  </div>
                                )}
                                {formData.quotation_prepared_by_services && (
                                  <div className="cs-pdf-prepared-services">
                                    {formData.quotation_prepared_by_services}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Left-Aligned Signature Block with CEO Name & Designation Live Preview */}
                            <div className="cs-pdf-signature-preview">
                              <div className="cs-pdf-sig-label">Authorized Signature</div>
                              {signatureUrl ? (
                                <img src={signatureUrl} alt="Signature" className="cs-pdf-sig-img" />
                              ) : (
                                <div className="cs-pdf-sig-line" />
                              )}
                              <div className="cs-pdf-sig-name">
                                {formData.quotation_ceo_name || "D M N K DISSANAYAKA"}
                              </div>
                              <div className="cs-pdf-sig-desig">
                                {formData.quotation_ceo_designation || "CEO (NetIT Technology)"}
                              </div>
                            </div>

                            {/* Footer Notice Preview */}
                            {formData.pdf_footer_note && (
                              <div className="cs-pdf-footer-box">
                                <strong>Important Notice / Declaration:</strong>
                                <p>{formData.pdf_footer_note}</p>
                              </div>
                            )}
                          </div>

                          <div className="cs-preview-footnote">
                            <Eye size={12} color="#2563eb" />
                            <span>Updates dynamically as you edit headings and notes</span>
                          </div>
                        </div>
                      </div>
                    </aside>
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
                            aria-label="Refresh list"
                          >
                            <RefreshCw size={15} className={loadingServices ? "cs-spin" : ""} />
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
                    <form onSubmit={handleSaveService} className="cs-form-body cs-service-edit-form">
                      <section className="cs-section-card cs-modern-service-card">
                        <div className="cs-section-header cs-modern-card-header">
                          <div className="cs-section-icon accent">
                            <Layers size={20} />
                          </div>
                          <div className="cs-header-content">
                            <div className="cs-header-top-row">
                              <h3>
                                {editingServiceId === "new"
                                  ? "Add New Service Option"
                                  : `Edit Service: ${serviceForm.item_name || "Catalog Item"}`}
                              </h3>
                              <span className={`cs-modern-status-badge ${serviceForm.is_active ? "active" : "inactive"}`}>
                                <span className="cs-status-indicator-dot" />
                                {serviceForm.is_active ? "Active in Catalog" : "Inactive / Hidden"}
                              </span>
                            </div>
                            <p>
                              Configure service specifications, baseline pricing, and rich scope templates for quotations.
                            </p>
                          </div>
                        </div>

                        <div className="cs-modern-form-content">
                          {/* Row 1: Service / Item Name & Default Price */}
                          <div className="cs-form-row-grid cs-grid-2-col">
                            {/* Service / Item Name */}
                            <div className="cs-modern-field-group">
                              <label className="cs-modern-label">
                                <span>Service / Item Name</span>
                                <span className="cs-required">*</span>
                              </label>
                              <div className="cs-modern-input-wrap">
                                <Package size={16} className="cs-input-leading-icon" />
                                <input
                                  type="text"
                                  required
                                  className="cs-modern-input cs-with-icon"
                                  placeholder="e.g. Real Estate Portal, E-Commerce Platform, Cloud Infrastructure"
                                  value={serviceForm.item_name}
                                  onChange={(e) =>
                                    setServiceForm({ ...serviceForm, item_name: e.target.value })
                                  }
                                />
                              </div>
                              <small className="cs-modern-hint">
                                Appears in the quotation service selection dropdown for quick selection.
                              </small>
                            </div>

                            {/* Default Price */}
                            <div className="cs-modern-field-group">
                              <label className="cs-modern-label">
                                <span>Default Price (LKR)</span>
                              </label>
                              <div className="cs-modern-input-wrap cs-currency-wrap">
                                <span className="cs-currency-prefix">LKR</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="cs-modern-input cs-currency-input"
                                  placeholder="0.00"
                                  value={serviceForm.default_price}
                                  onChange={(e) =>
                                    setServiceForm({ ...serviceForm, default_price: e.target.value })
                                  }
                                />
                              </div>
                              <small className="cs-modern-hint">
                                Optional baseline unit price auto-filled in the quotation item row (0.00 for custom).
                              </small>
                            </div>
                          </div>

                          {/* Row 2: Modern Status Dropdown & Quick Selector */}
                          <div className="cs-modern-field-group cs-status-control-section">
                            <label className="cs-modern-label">
                              <span>Service Availability Status</span>
                              <span className="cs-label-subnote">Controls visibility on quotation creation forms</span>
                            </label>

                            <div className="cs-status-dual-control">
                              {/* Modern Styled Dropdown */}
                              <div className="cs-modern-dropdown-box">
                                <div className={`cs-dropdown-dot-indicator ${serviceForm.is_active ? "active" : "inactive"}`} />
                                <select
                                  id="service_is_active"
                                  className="cs-modern-dropdown-select"
                                  value={serviceForm.is_active}
                                  onChange={(e) =>
                                    setServiceForm({
                                      ...serviceForm,
                                      is_active: Number(e.target.value),
                                    })
                                  }
                                >
                                  <option value={1}>Active (Available on quotation form)</option>
                                  <option value={0}>Inactive (Hidden from creation dropdown)</option>
                                </select>
                                <ChevronDown size={17} className="cs-dropdown-arrow-icon" />
                              </div>

                              {/* Modern Segmented Quick-Toggle Pills */}
                              <div className="cs-status-segmented-pills">
                                <button
                                  type="button"
                                  className={`cs-status-pill-toggle ${serviceForm.is_active === 1 ? "selected active" : ""}`}
                                  onClick={() => setServiceForm({ ...serviceForm, is_active: 1 })}
                                >
                                  <span className="cs-pill-dot active" />
                                  <span>Active</span>
                                </button>
                                <button
                                  type="button"
                                  className={`cs-status-pill-toggle ${serviceForm.is_active === 0 ? "selected inactive" : ""}`}
                                  onClick={() => setServiceForm({ ...serviceForm, is_active: 0 })}
                                >
                                  <span className="cs-pill-dot inactive" />
                                  <span>Inactive</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Large Box 1: Default Description / Scope */}
                          <div className="cs-modern-field-group cs-full-width">
                            <div className="cs-label-with-meta">
                              <label className="cs-modern-label">
                                <span>Default Description / Project Scope</span>
                              </label>
                              <span className="cs-textarea-badge">Large Text Area</span>
                            </div>
                            <textarea
                              rows={5}
                              className="cs-modern-textarea cs-large-textbox"
                              placeholder={"e.g.\n• Complete UI/UX design matching modern brand guidelines\n• Responsive web platform compatible with Mobile, Tablet & Desktop\n• Secure administrative dashboard with role-based permissions\n• High performance API integration and database optimization"}
                              value={serviceForm.description}
                              onChange={(e) =>
                                setServiceForm({ ...serviceForm, description: e.target.value })
                              }
                            />
                            <small className="cs-modern-hint">
                              This rich scope automatically populates the description area when creating a quotation.
                            </small>
                          </div>

                          {/* Two Large Boxes: Hosting & Domain Policy and Maintenance & Support Term */}
                          <div className="cs-form-row-grid cs-grid-2-col">
                            {/* Large Box 2: Hosting & Domain Policy */}
                            <div className="cs-modern-field-group">
                              <div className="cs-label-with-meta">
                                <label className="cs-modern-label">
                                  <Server size={14} className="cs-label-icon" />
                                  <span>Default Hosting &amp; Domain Policy</span>
                                </label>
                                <span className="cs-textarea-badge">Large Text Box</span>
                              </div>
                              <textarea
                                rows={4}
                                className="cs-modern-textarea cs-large-textbox"
                                placeholder={"e.g.\n• 1 Year Free NVMe High-Speed Cloud VPS Hosting\n• 1 Free .COM or .LK Domain Name Registration\n• Free Lifetime SSL Certificate with Auto-Renewal\n• Business Email Accounts Setup (info@domain.com)"}
                                value={serviceForm.hosting_domain}
                                onChange={(e) =>
                                  setServiceForm({
                                    ...serviceForm,
                                    hosting_domain: e.target.value,
                                  })
                                }
                              />
                              <small className="cs-modern-hint">
                                Hosting and domain inclusions auto-filled in quotation items.
                              </small>
                            </div>

                            {/* Large Box 3: Maintenance & Support Term */}
                            <div className="cs-modern-field-group">
                              <div className="cs-label-with-meta">
                                <label className="cs-modern-label">
                                  <Headphones size={14} className="cs-label-icon" />
                                  <span>Maintenance &amp; Support Term</span>
                                </label>
                                <span className="cs-textarea-badge">Large Text Box</span>
                              </div>
                              <textarea
                                rows={4}
                                className="cs-modern-textarea cs-large-textbox"
                                placeholder={"e.g.\n• 6 Months Comprehensive SLA Technical Support\n• 24/7 Security Health & Performance Monitoring\n• Regular Database Backups & Critical Security Patches\n• Priority Bug Fixes & Technical Consultation"}
                                value={serviceForm.maintenance_support}
                                onChange={(e) =>
                                  setServiceForm({
                                    ...serviceForm,
                                    maintenance_support: e.target.value,
                                  })
                                }
                              />
                              <small className="cs-modern-hint">
                                Service Level Agreement (SLA) and maintenance terms printed in quotation specs.
                              </small>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Action Bar */}
                      <div className="cs-action-bar cs-modern-action-bar">
                        <button
                          type="button"
                          className="cs-modern-btn-cancel"
                          onClick={() => {
                            setIsEditingService(false);
                            setEditingServiceId(null);
                          }}
                        >
                          <X size={15} />
                          <span>Cancel</span>
                        </button>
                        <button
                          type="submit"
                          className="cs-btn-save cs-btn-save-primary"
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <RefreshCw size={15} className="cs-spin" />
                              <span>Saving Service...</span>
                            </>
                          ) : (
                            <>
                              <Save size={15} />
                              <span>Save Service Option</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Invoice Settings & Preferences */}
          {activeTab === "invoice" && (
            <div className="cs-template-form-wrap">
              <div className="cs-template-layout-grid">
                {/* Left Column: 3 Modern Curved Settings Cards */}
                <div className="cs-template-cards-col">
                  {/* CARD 1: Numbering Defaults */}
                  <section className="cs-section-card cs-template-card">
                    <div className="cs-section-header">
                      <div className="cs-section-icon secondary">
                        <Receipt size={18} />
                      </div>
                      <div className="cs-section-header-text">
                        <h3>Invoice Numbering Defaults</h3>
                        <p>
                          Configure auto-numbering prefix for newly generated invoice documents.
                        </p>
                      </div>
                      <span className="cs-badge-active">Active</span>
                    </div>

                    <div className="cs-fields-grid">
                      <div className="cs-field-group cs-full-width">
                        <label htmlFor="inv_prefix_input">
                          Invoice Number Prefix <span className="cs-required">*</span>
                        </label>
                        <input
                          id="inv_prefix_input"
                          type="text"
                          required
                          placeholder="e.g. INV"
                          value={invoiceSettings.invoice_prefix}
                          onChange={(e) =>
                            handleInvoiceSettingsChange(
                              "invoice_prefix",
                              e.target.value.toUpperCase()
                            )
                          }
                        />
                        <small>e.g. {previewInvoiceNumber} (Sequential numbering format)</small>
                      </div>
                    </div>
                  </section>

                  {/* CARD 2: Document Titles & Layout */}
                  <section className="cs-section-card cs-template-card">
                    <div className="cs-section-header">
                      <div className="cs-section-icon">
                        <FileText size={18} />
                      </div>
                      <div className="cs-section-header-text">
                        <h3>Invoice Document Titles &amp; Layout</h3>
                        <p>
                          Main invoice heading title, proposal subtitle, and bottom acknowledgement line.
                        </p>
                      </div>
                    </div>

                    <div className="cs-fields-grid">
                      <div className="cs-field-group">
                        <label htmlFor="inv_heading_input">
                          PDF Main Document Heading <span className="cs-required">*</span>
                        </label>
                        <input
                          id="inv_heading_input"
                          type="text"
                          required
                          placeholder="e.g. INVOICE or TAX INVOICE"
                          value={invoiceSettings.pdf_heading}
                          onChange={(e) =>
                            handleInvoiceSettingsChange("pdf_heading", e.target.value)
                          }
                        />
                        <small>Displayed prominently on top right of invoice PDF.</small>
                      </div>

                      <div className="cs-field-group">
                        <label htmlFor="inv_subheading_input">PDF Sub-Heading</label>
                        <input
                          id="inv_subheading_input"
                          type="text"
                          placeholder="e.g. OFFICIAL BILLING DOCUMENT"
                          value={invoiceSettings.pdf_subheading}
                          onChange={(e) =>
                            handleInvoiceSettingsChange("pdf_subheading", e.target.value)
                          }
                        />
                        <small>Sub-title line directly beneath the main document heading.</small>
                      </div>
                    </div>
                  </section>

                  {/* CARD 3: Default Payment Terms */}
                  <section className="cs-section-card cs-template-card">
                    <div className="cs-section-header">
                      <div className="cs-section-icon accent">
                        <FileCheck size={18} />
                      </div>
                      <div className="cs-section-header-text">
                        <h3>Default Payment Terms &amp; Conditions</h3>
                        <p>
                          Default legal and billing terms loaded automatically on new invoices.
                        </p>
                      </div>
                    </div>

                    <div className="cs-fields-grid">
                      <div className="cs-field-group cs-full-width">
                        <label htmlFor="inv_default_terms_input">
                          Default Payment Terms &amp; Conditions
                        </label>
                        <textarea
                          id="inv_default_terms_input"
                          rows={4}
                          placeholder="Payment is strictly due within 14 calendar days of issuance..."
                          value={invoiceSettings.default_terms}
                          onChange={(e) =>
                            handleInvoiceSettingsChange("default_terms", e.target.value)
                          }
                        />
                        <small>
                          Default legal and billing policies automatically applied to invoices.
                        </small>
                      </div>
                    </div>
                  </section>

                  {/* CARD 4: Thank You Heading & Appreciation Note */}
                  <section className="cs-section-card cs-template-card">
                    <div className="cs-section-header">
                      <div className="cs-section-icon secondary">
                        <HeartHandshake size={18} />
                      </div>
                      <div>
                        <h3>Thank You Heading &amp; Appreciation Note</h3>
                        <p>
                          Closing appreciation statement printed on the bottom left of the invoice PDF.
                        </p>
                      </div>
                    </div>

                    <div className="cs-fields-grid">
                      <div className="cs-field-group cs-full-width">
                        <label htmlFor="inv_thank_you_title">Thank You Heading Title</label>
                        <input
                          id="inv_thank_you_title"
                          type="text"
                          placeholder="e.g. Thank You"
                          value={invoiceSettings.thank_you_title}
                          onChange={(e) =>
                            handleInvoiceSettingsChange("thank_you_title", e.target.value)
                          }
                        />
                        <small>Bold title rendered directly under the Terms &amp; Conditions list.</small>
                      </div>

                      <div className="cs-field-group cs-full-width">
                        <label htmlFor="inv_thank_you_message">Thank You Message / Appreciation Paragraph</label>
                        <textarea
                          id="inv_thank_you_message"
                          rows={4}
                          placeholder="e.g. We appreciate the opportunity to work with your business. NetIT Technology is committed to delivering modern, scalable, and professional platforms..."
                          value={invoiceSettings.thank_you_message}
                          onChange={(e) =>
                            handleInvoiceSettingsChange("thank_you_message", e.target.value)
                          }
                        />
                        <small>Comprehensive closing note conveying gratitude, service vision, and business commitment.</small>
                      </div>
                    </div>
                  </section>

                  {/* CARD 5: Prepared By & Company Services */}
                  <section className="cs-section-card cs-template-card">
                    <div className="cs-section-header">
                      <div className="cs-section-icon secondary">
                        <FileCheck size={18} />
                      </div>
                      <div>
                        <h3>Prepared By &amp; Services Description</h3>
                        <p>
                          Agency / company name and service lines printed below the Thank You section in bold text.
                        </p>
                      </div>
                    </div>

                    <div className="cs-fields-grid">
                      <div className="cs-field-group">
                        <label htmlFor="inv_prepared_by">Prepared By (Entity / Company)</label>
                        <input
                          id="inv_prepared_by"
                          type="text"
                          placeholder="e.g. NetIT Technology"
                          value={invoiceSettings.prepared_by}
                          onChange={(e) =>
                            handleInvoiceSettingsChange("prepared_by", e.target.value)
                          }
                        />
                        <small>Displayed on row 2 of the Prepared by block in bold black font.</small>
                      </div>

                      <div className="cs-field-group">
                        <label htmlFor="inv_prepared_by_services">Services &amp; Specializations Line</label>
                        <input
                          id="inv_prepared_by_services"
                          type="text"
                          placeholder="e.g. Web Development • Software Solutions • Digital Marketing"
                          value={invoiceSettings.prepared_by_services}
                          onChange={(e) =>
                            handleInvoiceSettingsChange("prepared_by_services", e.target.value)
                          }
                        />
                        <small>Displayed on row 3 directly underneath the company name.</small>
                      </div>
                    </div>
                  </section>

                  {/* CARD 6: Authorized Signatory (CEO Signature & Designation) */}
                  <section className="cs-section-card cs-template-card">
                    <div className="cs-section-header">
                      <div className="cs-section-icon">
                        <UserCheck size={18} />
                      </div>
                      <div>
                        <h3>Authorized Signatory (Executive Signature)</h3>
                        <p>
                          Executive name and designation rendered centered directly beneath the left-aligned signature.
                        </p>
                      </div>
                    </div>

                    <div className="cs-fields-grid">
                      <div className="cs-field-group">
                        <label htmlFor="inv_ceo_name">Signatory / CEO Full Name</label>
                        <input
                          id="inv_ceo_name"
                          type="text"
                          placeholder="e.g. D M N K DISSANAYAKA"
                          value={invoiceSettings.ceo_name}
                          onChange={(e) =>
                            handleInvoiceSettingsChange("ceo_name", e.target.value)
                          }
                        />
                        <small>Centered bold signatory name below the signature line.</small>
                      </div>

                      <div className="cs-field-group">
                        <label htmlFor="inv_ceo_designation">Official Designation / Title</label>
                        <input
                          id="inv_ceo_designation"
                          type="text"
                          placeholder="e.g. CEO (NetIT Technology)"
                          value={invoiceSettings.ceo_designation}
                          onChange={(e) =>
                            handleInvoiceSettingsChange("ceo_designation", e.target.value)
                          }
                        />
                        <small>Centered official title underneath the signatory&apos;s name.</small>
                      </div>
                    </div>
                  </section>

                  {/* Action Bar */}
                  <div className="cs-action-bar cs-template-action-bar">
                    <button
                      type="button"
                      className="cs-btn-secondary"
                      onClick={handleResetInvoiceSettings}
                      disabled={savingInvoice}
                    >
                      Discard Changes
                    </button>
                    <button
                      type="button"
                      className="cs-btn-save"
                      onClick={handleSaveInvoiceSettings}
                      disabled={savingInvoice}
                    >
                      <Save size={16} />
                      <span>{savingInvoice ? "Saving Invoice Settings..." : "Save Invoice Settings"}</span>
                    </button>
                  </div>
                </div>

                {/* Right Column: Sticky Live Invoice Layout Preview */}
                <aside className="cs-template-preview-col">
                  <div className="cs-template-preview-sticky">
                    <div className="cs-preview-card-box">
                      <div className="cs-preview-header">
                        <div className="cs-preview-title-left">
                          <span className="cs-live-indicator-dot" />
                          <Eye size={15} color="#2563eb" />
                          <strong>Live Invoice Layout Preview</strong>
                        </div>
                        <span className="cs-preview-badge">Live Sync</span>
                      </div>

                      <div className="cs-pdf-preview-sheet">
                        {/* Top Bar Preview */}
                        <div className="cs-pdf-header-row">
                          <div className="cs-pdf-header-left">
                            <div className="cs-pdf-company-name">
                              {formData.company_name || "NetIT Technology"}
                            </div>
                            <div className="cs-pdf-meta">
                              {formData.company_address || "Ampitiya, Kandy, Sri Lanka"} |{" "}
                              {formData.email_address || "info@netittechnology.com"}
                            </div>
                          </div>
                          <div className="cs-pdf-header-right">
                            <div className="cs-pdf-title">
                              {invoiceSettings.pdf_heading || "INVOICE"}
                            </div>
                            <div className="cs-pdf-subtitle">
                              {invoiceSettings.pdf_subheading || "OFFICIAL BILLING DOCUMENT"}
                            </div>
                          </div>
                        </div>

                        {/* Decorative Line Preview */}
                        <div className="cs-pdf-divider" />

                        {/* Invoice Meta Grid */}
                        <div className="cs-inv-meta-grid">
                          <div className="cs-inv-meta-col">
                            <label>Invoice No</label>
                            <strong>{previewInvoiceNumber}</strong>
                          </div>
                          <div className="cs-inv-meta-col">
                            <label>Issue Date</label>
                            <strong>{previewTodayStr}</strong>
                          </div>
                          <div className="cs-inv-meta-col">
                            <label>Due Date</label>
                            <strong>{previewDueDateStr}</strong>
                          </div>
                          <div className="cs-inv-meta-col">
                            <label>Status</label>
                            <span className="cs-inv-badge-unpaid">UNPAID</span>
                          </div>
                        </div>

                        {/* Bill To Preview */}
                        <div className="cs-inv-billto-box">
                          <div className="cs-inv-billto-title">Billed To</div>
                          <div className="cs-inv-billto-name">Acme Global Solutions (Pvt) Ltd</div>
                          <div className="cs-inv-billto-sub">
                            Attn: Finance &amp; Procurement | No 45, Galle Road, Colombo 03
                          </div>
                        </div>

                        {/* Mock Items Table */}
                        <table className="cs-inv-table">
                          <thead>
                            <tr>
                              <th style={{ width: "24px", textAlign: "center" }}>#</th>
                              <th>SERVICE / ITEM</th>
                              <th className="text-right">PRICE ({invoiceSettings.default_currency || "LKR"})</th>
                              <th style={{ width: "42px", textAlign: "center" }}>TAX</th>
                              <th className="text-right">LINE TOTAL ({invoiceSettings.default_currency || "LKR"})</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td style={{ textAlign: "center", color: "#64748b", fontWeight: 600 }}>1</td>
                              <td>
                                <strong>Enterprise Cloud Portal Deployment</strong>
                                <div style={{ fontSize: "8.5px", color: "#64748b" }}>
                                  Core infrastructure and authentication service
                                </div>
                              </td>
                              <td className="text-right">150,000.00</td>
                              <td style={{ textAlign: "center", color: "#64748b" }}>0%</td>
                              <td className="text-right" style={{ fontWeight: 600 }}>150,000.00</td>
                            </tr>
                            <tr>
                              <td style={{ textAlign: "center", color: "#64748b", fontWeight: 600 }}>2</td>
                              <td>
                                <strong>Annual SLA Maintenance &amp; 24/7 Monitoring</strong>
                                <div style={{ fontSize: "8.5px", color: "#64748b" }}>
                                  Guaranteed 99.9% uptime and security updates
                                </div>
                              </td>
                              <td className="text-right">45,000.00</td>
                              <td style={{ textAlign: "center", color: "#64748b" }}>0%</td>
                              <td className="text-right" style={{ fontWeight: 600 }}>45,000.00</td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Totals Summary */}
                        <div className="cs-inv-totals-box" style={{ padding: "6px 8px" }}>
                          <div className="cs-inv-total-row" style={{ width: "100%", padding: "0 4px" }}>
                            <span>Subtotal</span>
                            <span style={{ fontWeight: 600 }}>{invoiceSettings.default_currency || "LKR"} 195,000.00</span>
                          </div>
                          <div className="cs-inv-total-row" style={{ width: "100%", padding: "0 4px", color: "#16a34a" }}>
                            <span>Discount (-)</span>
                            <span style={{ fontWeight: 600 }}>- {invoiceSettings.default_currency || "LKR"} 10,000.00</span>
                          </div>
                          <div className="cs-inv-total-row grand" style={{ background: "#1e3a8a", color: "#ffffff", padding: "4px 8px", borderRadius: "4px", width: "100%", border: "none", marginTop: "3px" }}>
                            <span style={{ fontSize: "8.5px", color: "#bfdbfe" }}>GRAND TOTAL</span>
                            <span style={{ fontSize: "10.5px", fontWeight: 800 }}>{invoiceSettings.default_currency || "LKR"} 185,000.00</span>
                          </div>
                          <div className="cs-inv-total-row" style={{ marginTop: "4px", width: "100%", padding: "0 4px" }}>
                            <span style={{ color: "#15803d", fontWeight: 600 }}>Paid Amount</span>
                            <span style={{ color: "#15803d", fontWeight: 700 }}>- {invoiceSettings.default_currency || "LKR"} 50,000.00</span>
                          </div>
                          <div className="cs-inv-total-row" style={{ width: "100%", padding: "0 4px" }}>
                            <span style={{ color: "#1e3a8a", fontWeight: 700 }}>Balance Due</span>
                            <span style={{ color: "#b91c1c", fontWeight: 800 }}>{invoiceSettings.default_currency || "LKR"} 135,000.00</span>
                          </div>
                        </div>

                        {/* Terms Preview */}
                        {invoiceSettings.default_terms && (
                          <div className="cs-inv-terms-preview-box">
                            <div className="cs-inv-terms-preview-head">Terms &amp; Conditions</div>
                            <div className="cs-inv-terms-preview-text">
                              {invoiceSettings.default_terms}
                            </div>
                          </div>
                        )}

                        {/* Thank You Section Live Preview */}
                        {(invoiceSettings.thank_you_title || invoiceSettings.thank_you_message) && (
                          <div className="cs-pdf-thank-you-box">
                            {invoiceSettings.thank_you_title && (
                              <div className="cs-pdf-thank-you-title">
                                {invoiceSettings.thank_you_title}
                              </div>
                            )}
                            {invoiceSettings.thank_you_message && (
                              <div className="cs-pdf-thank-you-msg">
                                {invoiceSettings.thank_you_message}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Prepared By Section Live Preview */}
                        {(invoiceSettings.prepared_by || invoiceSettings.prepared_by_services) && (
                          <div className="cs-pdf-prepared-by-box">
                            <div className="cs-pdf-prepared-label">Prepared by:</div>
                            {invoiceSettings.prepared_by && (
                              <div className="cs-pdf-prepared-company">
                                {invoiceSettings.prepared_by}
                              </div>
                            )}
                            {invoiceSettings.prepared_by_services && (
                              <div className="cs-pdf-prepared-services">
                                {invoiceSettings.prepared_by_services}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Left-Aligned Signature Block with CEO Name & Designation Live Preview */}
                        <div className="cs-pdf-signature-preview" style={{ marginTop: "12px" }}>
                          <div className="cs-pdf-sig-label">Authorized Signature</div>
                          {signatureUrl ? (
                            <img src={signatureUrl} alt="Signature" className="cs-pdf-sig-img" />
                          ) : (
                            <div className="cs-pdf-sig-line" />
                          )}
                          <div className="cs-pdf-sig-name">
                            {invoiceSettings.ceo_name || "D M N K DISSANAYAKA"}
                          </div>
                          <div className="cs-pdf-sig-desig">
                            {invoiceSettings.ceo_designation || "CEO (NetIT Technology)"}
                          </div>
                        </div>
                      </div>

                      <div className="cs-preview-footnote">
                        <small>
                          Live preview reflects your saved billing prefix, document titles, payment terms, and closing signature block.
                        </small>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
