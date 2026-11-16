

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  Send,
  UserCheck,
  UserPlus,
  Mail,
  Phone,
  Building2,
  Search,
  ChevronDown,
  Check,
  ArrowLeft,
} from "lucide-react";
import {
  createQuotation,
  updateQuotation,
  getQuotations,
  getNextQuotationNumberApi,
  getCustomers,
  getAllRegisteredCustomers,
  createCustomer,
  getQuotationItemOptions,
  getCompanyDetails,
  getSuperAdminCustomers,
  checkDuplicateCustomer,
  checkDuplicateCustomerByNameAndEmail,
  addNotification,
} from "../services/quotationService";
import { getInvoices } from "../services/invoiceService";
import { downloadQuotationPdf } from "../utils/pdfGenerator";
import {
  formatServicePresetDescription,
  formatDescriptionPointByPoint,
} from "../utils/deliverablesFormatter";
import { getAuthenticatedUser } from "../utils/authStorage";
import { getNextQuotationNumber } from "../utils/formatters";
import "./QuotationForm.css";

// Initial item model matching backend database fields
const initialItem = {
  item_name: "",
  technology: "",
  website_type: "",
  hosting_domain: "",
  description: "",
  unit_price: "",
  tax_rate: "",
};

function getServiceOptionValue(serviceCatalog, itemName) {
  const service = serviceCatalog.find((item) => item.item_name === itemName);
  return service ? String(service.service_id ?? service.item_name) : "";
}

// Ensure terms and conditions numbered items appear on separate rows
function formatTermsAndConditions(terms) {
  if (!terms) return "";
  return String(terms).replace(/([^\n])\s+(\d+\.\s+)/g, "$1\n$2");
}

// Textarea that automatically grows vertically so all bullet points stay visible
function AutoGrowTextarea({ value, minHeight = 108, className = "", ...props }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [value, minHeight]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      className={className}
      {...props}
    />
  );
}

// Amount input component with non-clickable .00 suffix
function AmountInput({
  value,
  onChange,
  suffix = ".00",
  placeholder = "0",
  required = false,
  autoFocus = false,
  className = "",
  hasError = false,
}) {
  const hasDecimals = String(value || "").includes(".");

  return (
    <div className={`qf-amount-wrap ${hasError ? "qf-input-error" : ""}`}>
      <input
        type="number"
        min="0"
        step="any"
        className={`qf-input qf-amount-input ${hasError ? "qf-input-error" : ""} ${className}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          if (e.target.value === "0" || e.target.value === "0.00") {
            onChange("");
          } else {
            e.target.select();
          }
        }}
        onClick={(e) => {
          if (e.target.value === "0" || e.target.value === "0.00") {
            onChange("");
          }
        }}
        onWheel={(e) => e.target.blur()}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
        }}
        required={required}
        autoFocus={autoFocus}
      />
      {suffix && !hasDecimals && (
        <span className="qf-amount-suffix" aria-hidden="true">
          {suffix}
        </span>
      )}
    </div>
  );
}

export default function QuotationForm({
  initialData = null,
  quotationNumber = "",
  onSave,
  onClose,
  isPage = false,
  openSidebar,
}) {
  const today = new Date().toISOString().slice(0, 10);
  const customerListId = useId();
  const hasInitialTerms = Boolean(initialData?.terms_and_conditions);

  // Authenticated user role detection
  const authUser = useMemo(() => {
    return getAuthenticatedUser();
  }, []);
  const isSuperAdmin = useMemo(() => {
    const role = String(authUser?.role || "").trim().toLowerCase();
    return role.includes("super");
  }, [authUser]);

  const canDownloadFormPdf = useMemo(() => {
    if (isSuperAdmin) return true;
    const status = String(initialData?.status || "").trim().toLowerCase();
    const approval = String(initialData?.approval_status || "").trim().toLowerCase();
    return Boolean(
      initialData?.quotation_id &&
      (status === "approved" || approval === "approved")
    );
  }, [isSuperAdmin, initialData]);

  // Form state
  const isManualQuotationNumber = useRef(Boolean(initialData?.quotation_number));
  const [existingQuotations, setExistingQuotations] = useState([]);
  const [formData, setFormData] = useState({
    quotation_number:
      initialData?.quotation_number ||
      quotationNumber ||
      getNextQuotationNumber([], today),
    client_name: initialData?.customer_name || initialData?.clientName || "",
    customer_id: initialData?.customer_id ? String(initialData.customer_id) : "",
    company_name: initialData?.company_name || "",
    email: initialData?.email || initialData?.customer_email || "",
    phone: initialData?.phone || initialData?.customer_phone || "",
    address: initialData?.address || initialData?.customer_address || "",
    quotation_date: initialData?.quotation_date ? String(initialData.quotation_date).slice(0, 10) : today,
    estimated_duration: initialData?.estimated_duration ? String(initialData.estimated_duration) : "",
    duration_unit: initialData?.duration_unit || "Weeks",
    valid_until: initialData?.valid_until ? String(initialData.valid_until).slice(0, 10) : "",
    currency: initialData?.currency || "LKR",
    discount_amount:
      initialData?.discount_amount != null &&
        Number(initialData.discount_amount) > 0
        ? String(initialData.discount_amount)
        : "",
    notes: initialData?.notes || "",
    terms_and_conditions: formatTermsAndConditions(
      initialData?.terms_and_conditions || ""
    ),
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
        description: formatDescriptionPointByPoint(it.description || ""),
        unit_price:
          it.unit_price != null && Number(it.unit_price) > 0
            ? String(it.unit_price)
            : it.Price != null && Number(it.Price) > 0
              ? String(it.Price)
              : "",
        tax_rate:
          it.tax_rate != null && Number(it.tax_rate) > 0
            ? String(it.tax_rate)
            : "",
      }))
      : [{ ...initialItem }]
  );

  // Data loaded from backend
  const [customers, setCustomers] = useState([]);
  const [serviceCatalog, setServiceCatalog] = useState([]);
  const [companyDetails, setCompanyDetails] = useState({});
  const [customerLoadError, setCustomerLoadError] = useState("");
  const [serviceLoadError, setServiceLoadError] = useState("");
  const [companyLoadError, setCompanyLoadError] = useState("");
  const [dependenciesLoading, setDependenciesLoading] = useState(true);

  // UI state
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // Customer search & dropdown
  const [customerSearchQuery, setCustomerSearchQuery] = useState(
    initialData?.customer_name || initialData?.clientName || ""
  );
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef(null);

  // Load customer and service options from backend on mount
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const [
        customerResult,
        servicesResult,
        companyResult,
        quotationsResult,
        nextNumberResult,
        invoicesResult,
      ] = await Promise.allSettled([
        getAllRegisteredCustomers(),
        getQuotationItemOptions(),
        getCompanyDetails(),
        getQuotations({ all: true }),
        !initialData?.quotation_id
          ? getNextQuotationNumberApi(formData.quotation_date)
          : Promise.resolve(""),
        getInvoices({ all: true }).catch(() => []),
      ]);

      if (!isMounted) return;

      const customerList =
        customerResult.status === "fulfilled" && Array.isArray(customerResult.value)
          ? customerResult.value
          : [];
      const services =
        servicesResult.status === "fulfilled" ? servicesResult.value : [];
      const company =
        companyResult.status === "fulfilled" ? companyResult.value : {};
      const quotationList =
        quotationsResult.status === "fulfilled" && Array.isArray(quotationsResult.value)
          ? quotationsResult.value
          : [];
      const invoiceList =
        invoicesResult.status === "fulfilled" && Array.isArray(invoicesResult.value)
          ? invoicesResult.value
          : [];
      const serverNextNumber =
        nextNumberResult.status === "fulfilled" ? nextNumberResult.value : "";

      setExistingQuotations(quotationList);
      if (!initialData?.quotation_id && !isManualQuotationNumber.current) {
        setFormData((prev) => ({
          ...prev,
          quotation_number:
            serverNextNumber ||
            getNextQuotationNumber(quotationList, prev.quotation_date),
        }));
      }

      // Build unified customer list across registered customers, quotations, and invoices
      const customerMap = new Map();
      customerList.forEach((c) => {
        if (c && c.customer_id) customerMap.set(String(c.customer_id), c);
      });
      quotationList.forEach((q) => {
        if (q && q.customer_id && !customerMap.has(String(q.customer_id))) {
          customerMap.set(String(q.customer_id), {
            customer_id: q.customer_id,
            customer_name: q.customer_name || q.client_name || q.clientName || "",
            company_name: q.company_name || "",
            email: q.email || q.customer_email || "",
            phone: q.phone || q.customer_phone || "",
            address: q.address || q.customer_address || "",
          });
        }
      });
      invoiceList.forEach((inv) => {
        if (inv && inv.customer_id && !customerMap.has(String(inv.customer_id))) {
          customerMap.set(String(inv.customer_id), {
            customer_id: inv.customer_id,
            customer_name: inv.customer_name || inv.client_name || "",
            company_name: inv.company_name || inv.customer_company || "",
            email: inv.email || inv.customer_email || "",
            phone: inv.phone || inv.customer_phone || "",
            address: inv.address || inv.customer_address || "",
          });
        }
      });

      setCustomers(Array.from(customerMap.values()));
      setServiceCatalog(services);
      setCompanyDetails(company);
      setCustomerLoadError(
        customerResult.status === "rejected"
          ? "Customer records could not be loaded. Please retry before saving to prevent duplicate customers."
          : ""
      );
      setServiceLoadError(
        servicesResult.status === "rejected"
          ? "Service options could not be loaded. You can still enter a service manually."
          : ""
      );
      setCompanyLoadError(
        companyResult.status === "rejected"
          ? "Company details could not be loaded. The PDF may not include company branding."
          : ""
      );
      setDependenciesLoading(false);

      if (company?.default_terms_and_conditions && !hasInitialTerms) {
        setFormData((prev) => ({
          ...prev,
          terms_and_conditions:
            prev.terms_and_conditions ||
            formatTermsAndConditions(company.default_terms_and_conditions),
        }));
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [hasInitialTerms]);

  async function retryCustomerLoad() {
    try {
      const customerList = await getAllRegisteredCustomers();
      setCustomers(customerList);
      setCustomerLoadError("");
    } catch (error) {
      setCustomerLoadError(
        error?.message || "Customer records could not be loaded."
      );
    }
  }

  async function retryServiceLoad() {
    try {
      setServiceCatalog(await getQuotationItemOptions());
      setServiceLoadError("");
    } catch (error) {
      setServiceLoadError(error?.message || "Service options could not be loaded.");
    }
  }

  async function retryCompanyLoad() {
    try {
      setCompanyDetails(await getCompanyDetails());
      setCompanyLoadError("");
    } catch (error) {
      setCompanyLoadError(error?.message || "Company details could not be loaded.");
    }
  }

  // Update top-level form field
  const updateField = (field, value) => {
    if (field === "quotation_number") {
      isManualQuotationNumber.current = true;
    }
    setFormData((prev) => {
      const next = {
        ...prev,
        [field]: value,
      };
      if (
        field === "quotation_date" &&
        !initialData?.quotation_id &&
        !isManualQuotationNumber.current
      ) {
        next.quotation_number = getNextQuotationNumber(existingQuotations, value);
      }
      return next;
    });
    if (
      field === "quotation_date" &&
      !initialData?.quotation_id &&
      !isManualQuotationNumber.current
    ) {
      getNextQuotationNumberApi(value)
        .then((serverNum) => {
          if (serverNum && !isManualQuotationNumber.current) {
            setFormData((prev) => ({ ...prev, quotation_number: serverNum }));
          }
        })
        .catch(() => { });
    }
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Sync customer details when customer_id is set
  useEffect(() => {
    if (formData.customer_id && customers.length > 0) {
      const found = customers.find(
        (c) => String(c.customer_id) === String(formData.customer_id)
      );
      if (found) {
        if (!customerSearchQuery) {
          setCustomerSearchQuery(found.customer_name || "");
        }
        setFormData((prev) => ({
          ...prev,
          company_name: prev.company_name || found.company_name || "",
          email: prev.email || found.email || "",
          phone: prev.phone || found.phone || "",
          address: prev.address || found.address || "",
        }));
      }
    }
  }, [formData.customer_id, customers]);

  // Handle selecting a customer from dropdown
  const handleSelectCustomer = (customer) => {
    setFormData((prev) => ({
      ...prev,
      client_name: customer.customer_name || "",
      customer_id: String(customer.customer_id),
      company_name: customer.company_name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
    }));
    setCustomerSearchQuery(customer.customer_name || "");
    setClientDropdownOpen(false);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.client_name;
      delete next.client_email;
      delete next.client_phone;
      return next;
    });
  };

  // Selected customer / client object
  const selectedCustomer = useMemo(() => {
    if (!formData.client_name) return null;
    return (
      customers.find(
        (c) =>
          String(c.customer_id) === String(formData.customer_id) ||
          c.customer_name?.toLowerCase() === formData.client_name.trim().toLowerCase() ||
          (formData.email && c.email?.toLowerCase() === formData.email.trim().toLowerCase())
      ) || {
        customer_name: formData.client_name.trim(),
        company_name: formData.company_name?.trim() || "",
        email: formData.email?.trim() || "",
        phone: formData.phone?.trim() || "",
        address: formData.address?.trim() || "",
      }
    );
  }, [
    customers,
    formData.client_name,
    formData.customer_id,
    formData.company_name,
    formData.email,
    formData.phone,
    formData.address,
  ]);

  // Close in-form client dropdown when clicked outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target)) {
        setClientDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Lock outer page scrolling while Quotation Form is open as a modal dialog
  useEffect(() => {
    if (isPage) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isPage]);

  // Filtered registered customers list for in-form search dropdown
  const filteredCustomers = useMemo(() => {
    const term = (customerSearchQuery || "").trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) => {
      const name = (c.customer_name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const company = (c.company_name || "").toLowerCase();
      return name.includes(term) || email.includes(term) || company.includes(term);
    });
  }, [customers, customerSearchQuery]);

  // Update item field
  const updateItem = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      )
    );
    const errKey = `${field}_${index}`;
    if (fieldErrors[errKey]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[errKey];
        return next;
      });
    }
  };

  // Populate only fields returned by the backend service catalogue.
  const handleSelectServicePreset = (index, serviceKey) => {
    const selectedService = serviceCatalog.find(
      (service) =>
        String(service.service_id ?? service.item_name) === String(serviceKey)
    );
    if (!selectedService) return;

    let defaultTech = "";
    const serviceName = selectedService.item_name || "";
    if (serviceName.includes("WordPress")) {
      defaultTech = "WordPress CMS / PHP";
    } else if (serviceName.includes("React")) {
      defaultTech = "React.js / Node.js";
    } else if (serviceName.includes("Custom")) {
      defaultTech = "Custom Full Stack";
    } else if (serviceName.includes("Maintenance")) {
      defaultTech = "WordPress / Custom CMS";
    }

    const description = formatServicePresetDescription(selectedService);

    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
            ...item,
            item_name: selectedService.item_name,
            technology: defaultTech || item.technology || "",
            // Website type is intentionally NOT auto-filled; user types it manually
            website_type: item.website_type || "",
            description,
            hosting_domain: selectedService.hosting_domain || item.hosting_domain || "",
            unit_price:
              selectedService.default_price !== null &&
                selectedService.default_price !== undefined &&
                Number(selectedService.default_price) > 0
                ? String(selectedService.default_price)
                : item.unit_price || "",
            tax_rate: item.tax_rate || "",
          }
          : item
      )
    );

    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`item_name_${index}`];
      delete next[`unit_price_${index}`];
      return next;
    });
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
        tax_rate: "",
        is_additional: true,
      },
    ]);
  };

  // Remove item line
  const removeItem = (index) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    setFieldErrors((prev) => {
      const next = {};
      Object.entries(prev).forEach(([key, val]) => {
        const match = key.match(/^(item_name|unit_price|tax_rate)_(\d+)$/);
        if (match) {
          const fieldType = match[1];
          const itemIdx = Number(match[2]);
          if (itemIdx < index) {
            next[key] = val;
          } else if (itemIdx > index) {
            next[`${fieldType}_${itemIdx - 1}`] = val;
          }
        } else {
          next[key] = val;
        }
      });
      return next;
    });
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
  const buildPayload = (assignedCustomerId, statusToSave) => {
    const resolvedClientName = formData.client_name ? formData.client_name.trim() : "";
    const isPending =
      statusToSave === "Pending Approval" ||
      statusToSave === "Pending" ||
      statusToSave === "Sent";

    const effectiveStatus = isSuperAdmin
      ? (statusToSave === "Draft" ? "Draft" : "Approved")
      : (statusToSave === "Draft"
        ? "Draft"
        : isPending
          ? "Sent"
          : (statusToSave || initialData?.status || "Draft"));

    const effectiveApprovalStatus = isSuperAdmin
      ? (statusToSave === "Draft" ? "Not Required" : "Approved")
      : (isPending
        ? "Pending"
        : statusToSave === "Approved"
          ? "Approved"
          : statusToSave === "Rejected"
            ? "Rejected"
            : statusToSave === "Draft"
              ? "Not Required"
              : initialData?.approval_status || "Pending");

    return {
      quotation_number: formData.quotation_number.trim(),
      customer_id: assignedCustomerId,
      customer_name: resolvedClientName,
      client_name: resolvedClientName,
      company_name: formData.company_name?.trim() || null,
      email: formData.email?.trim() || null,
      phone: formData.phone?.trim() || null,
      address: formData.address?.trim() || null,
      quotation_date: formData.quotation_date,
      project_start_date: initialData?.project_start_date ? String(initialData.project_start_date).slice(0, 10) : null,
      estimated_duration: formData.estimated_duration ? Number(formData.estimated_duration) : null,
      duration_unit: formData.estimated_duration ? formData.duration_unit : null,
      valid_until: formData.valid_until || null,
      currency: formData.currency || "LKR",
      discount_amount: totals.discount,
      notes: formData.notes?.trim() || null,
      terms_and_conditions: formData.terms_and_conditions?.trim() || null,
      status: effectiveStatus,
      approval_status: effectiveApprovalStatus,
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
    const errors = {};
    let firstError = null;

    if (!formData.quotation_number.trim()) {
      errors.quotation_number = "Quotation number is required.";
      if (!firstError) firstError = errors.quotation_number;
    }

    if (!formData.client_name.trim()) {
      errors.client_name = "Client name is required.";
      if (!firstError) firstError = errors.client_name;
    }

    if (!formData.email.trim()) {
      errors.client_email = "Email address is required.";
      if (!firstError) firstError = errors.client_email;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.client_email = "Please enter a valid email address.";
      if (!firstError) firstError = errors.client_email;
    }

    if (!formData.quotation_date) {
      errors.quotation_date = "Quotation date is required.";
      if (!firstError) firstError = errors.quotation_date;
    }

    if (formData.valid_until && formData.valid_until < formData.quotation_date) {
      errors.valid_until = "Valid until date cannot be earlier than the quotation date.";
      if (!firstError) firstError = errors.valid_until;
    }

    if (
      formData.estimated_duration &&
      (!Number.isFinite(Number(formData.estimated_duration)) ||
        Number(formData.estimated_duration) < 0)
    ) {
      errors.estimated_duration = "Project duration must be a non-negative number.";
      if (!firstError) firstError = errors.estimated_duration;
    }

    if (items.length === 0) {
      if (!firstError) firstError = "Add at least one item or service to the quotation.";
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.item_name.trim()) {
        errors[`item_name_${i}`] = `Please specify the service name for line ${i + 1}.`;
        if (!firstError) firstError = errors[`item_name_${i}`];
      }

      if (it.unit_price === "" || Number(it.unit_price) < 0) {
        errors[`unit_price_${i}`] = `Please enter a valid price for line ${i + 1}.`;
        if (!firstError) firstError = errors[`unit_price_${i}`];
      }

      const tax = Number(it.tax_rate || 0);
      if (Number.isNaN(tax) || tax < 0 || tax > 100) {
        errors[`tax_rate_${i}`] = `Tax rate for line ${i + 1} must be between 0% and 100%.`;
        if (!firstError) firstError = errors[`tax_rate_${i}`];
      }
    }

    if (totals.discount > totals.subtotal) {
      errors.discount_amount = "Discount amount cannot be greater than the subtotal.";
      if (!firstError) firstError = errors.discount_amount;
    }

    return {
      isValid: !firstError,
      firstError,
      errors,
    };
  };

  // Handle Save / Submit
  const handleSaveQuotation = async (e, desiredStatus) => {
    if (e && e.preventDefault) e.preventDefault();
    setFormError("");
    setFormSuccess("");

    const validation = validateForm();
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setFormError(validation.firstError);
      setTimeout(() => {
        const firstErrorEl = document.querySelector(".qf-input-error");
        if (firstErrorEl) {
          firstErrorEl.scrollIntoView({ behavior: "smooth", block: "center" });
          if (typeof firstErrorEl.focus === "function") {
            firstErrorEl.focus();
          }
        }
      }, 50);
      return;
    }

    setFieldErrors({});

    const statusToSave =
      desiredStatus ||
      (isSuperAdmin ? "Approved" : "Pending Approval");

    try {
      setSaving(true);

      // Resolve customer_id from client_name
      let targetCustomerId = formData.customer_id ? Number(formData.customer_id) : null;

      if (!targetCustomerId || Number.isNaN(targetCustomerId)) {
        const valTrim = (formData.client_name || "").trim().toLowerCase();
        const emailTrim = (formData.email || "").trim().toLowerCase();
        const existing = customers.find((c) => {
          const cName = (c.customer_name || "").trim().toLowerCase();
          const cEmail = (c.email || "").trim().toLowerCase();
          if (valTrim && emailTrim) {
            return cName === valTrim && cEmail === emailTrim;
          }
          if (valTrim && !emailTrim) {
            return cName === valTrim && !cEmail;
          }
          return false;
        });

        if (existing && existing.customer_id) {
          targetCustomerId = Number(existing.customer_id);
        } else {
          try {
            const created = await createCustomer({
              customer_name: formData.client_name.trim(),
              company_name: formData.company_name?.trim() || null,
              email: formData.email?.trim() || null,
              phone: formData.phone?.trim() || null,
              address: formData.address?.trim() || null,
              identify_by_name_and_email: true,
            });
            if (created?.customer_id) {
              targetCustomerId = Number(created.customer_id);
              try {
                const freshCustomers = await getAllRegisteredCustomers();
                setCustomers(freshCustomers);
              } catch {
                // ignore
              }
            }
          } catch (createErr) {
            console.warn("Could not pre-create customer in frontend:", createErr);
          }
        }
      }

      const payload = buildPayload(targetCustomerId, statusToSave);
      let response;

      if (initialData?.quotation_id) {
        response = await updateQuotation(initialData.quotation_id, payload);
      } else {
        response = await createQuotation(payload);
      }

      const successMsg =
        statusToSave === "Draft"
          ? "Quotation saved as Draft."
          : statusToSave === "Pending Approval"
            ? "Quotation submitted for Super Admin approval!"
            : isSuperAdmin
              ? "Quotation finalized and approved!"
              : "Quotation saved successfully!";

      setFormSuccess(
        response?.message || successMsg
      );

      // Notify Super Admin if submitted for approval
      if (statusToSave === "Pending Approval") {
        const qNum =
          response?.quotation?.quotation_number ||
          response?.quotation_number ||
          initialData?.quotation_number ||
          "New Quotation";
        const clientName =
          formData.client_name?.trim() || "Client";
        const authUser = getAuthenticatedUser();
        const creatorName =
          authUser?.name || authUser?.username || "Admin";

        try {
          await addNotification({
            title: `Quotation Pending Approval: ${qNum}`,
            message: `${creatorName} submitted quotation ${qNum} for ${clientName} awaiting your review.`,
            type: "warning",
            reference_type: "quotation",
            reference_id:
              response?.quotation_id ||
              response?.quotation?.quotation_id ||
              initialData?.quotation_id,
            target_role: "super_admin",
            created_by: authUser?.user_id || authUser?.id,
            created_by_name: creatorName,
          });
        } catch (err) {
          console.warn("Could not dispatch pending quotation notification:", err);
        }
      }

      if (onSave) {
        await onSave({
          ...payload,
          quotation_id: response?.quotation_id || initialData?.quotation_id,
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          total_amount: totals.total,
          customer_name: formData.client_name.trim(),
          status: statusToSave,
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
    if (!canDownloadFormPdf) return;
    setFormError("");

    const activeClientName = formData.client_name.trim();

    const errs = {};
    if (!formData.quotation_number.trim()) {
      errs.quotation_number = "Quotation number is required.";
      setFormError("Please enter a quotation number before generating PDF.");
    } else if (!activeClientName) {
      errs.client_name = "Client name is required.";
      setFormError("Please enter a client name before generating PDF.");
    } else if (!formData.email.trim()) {
      errs.client_email = "Email address is required.";
      setFormError("Please enter a client email address before generating PDF.");
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())
    ) {
      errs.client_email = "Please enter a valid email address.";
      setFormError("Please enter a valid client email address before generating PDF.");
    } else {
      items.forEach((it, idx) => {
        if (!it.item_name.trim()) {
          errs[`item_name_${idx}`] = `Please specify the service name for line ${idx + 1}.`;
        }
      });
      if (Object.keys(errs).length > 0) {
        setFormError("Please ensure all items have a valid service name before downloading PDF.");
      }
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      setTimeout(() => {
        const firstErrorEl = document.querySelector(".qf-input-error");
        if (firstErrorEl) {
          firstErrorEl.scrollIntoView({ behavior: "smooth", block: "center" });
          if (typeof firstErrorEl.focus === "function") {
            firstErrorEl.focus();
          }
        }
      }, 50);
      return;
    }

    try {
      setDownloadingPdf(true);
      let activeCompany = companyDetails;
      if (!activeCompany?.bank_name) {
        try {
          activeCompany = await getCompanyDetails();
          setCompanyDetails(activeCompany);
        } catch (fetchErr) {
          console.warn("Could not refetch company details:", fetchErr);
        }
      }
      const filename = `${formData.quotation_number.trim()}.pdf`;
      await downloadQuotationPdf(
        liveQuotationData,
        activeCompany,
        {
          ...selectedCustomer,
          customer_name: formData.client_name,
          address: selectedCustomer?.address || "",
          email: selectedCustomer?.email || "",
          phone: selectedCustomer?.phone || "",
        },
        filename
      );
    } catch (err) {
      console.error("PDF generation failed:", err);
      setFormError(
        "Could not generate the quotation PDF. Please check your connection and try again."
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  // In-memory quotation object for the PDF template preview
  const liveQuotationData = {
    quotation_number: formData.quotation_number,
    customer_name: formData.client_name,
    quotation_date: formData.quotation_date,
    project_start_date: initialData?.project_start_date || formData.quotation_date,
    estimated_duration: formData.estimated_duration,
    duration_unit: formData.duration_unit,
    estimated_completion_date: initialData?.estimated_completion_date || null,
    valid_until: formData.valid_until,
    currency: formData.currency,
    subtotal: totals.subtotal,
    discount_amount: totals.discount,
    tax_amount: totals.taxAmount,
    total_amount: totals.total,
    grand_total: totals.total,
    total_balance: totals.total,
    notes: formData.notes,
    terms_and_conditions: formData.terms_and_conditions,
    status: initialData?.status || "Draft",
    bank_name: companyDetails?.bank_name || "",
    bank_account_name: companyDetails?.bank_account_name || "",
    bank_account_number: companyDetails?.bank_account_number || "",
    bank_branch: companyDetails?.bank_branch || "",
    bank_swift_code: companyDetails?.bank_swift_code || "",
    items: items.map((it) => ({
      item_name: it.item_name,
      technology: it.technology,
      website_type: it.website_type,
      hosting_domain: it.hosting_domain,
      description: it.description,
      unit_price: Number(it.unit_price) || 0,
      tax_rate: Number(it.tax_rate) || 0,
      line_total: (Number(it.unit_price) || 0) * (1 + (Number(it.tax_rate) || 0) / 100),
    })),
  };

  const formElement = (
    <form onSubmit={handleSaveQuotation} noValidate>
      <div className={`qf-body ${isPage ? "qf-page-body" : ""}`}>
        <div className={isPage ? "qf-page-group-card" : ""}>
          {isPage && (
            <div className="qf-page-header">
              <div className="qf-page-header-left">
                <div className="qf-header-title">
                  <div className="qf-header-icon">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h2>
                      {initialData?.quotation_id
                        ? "Edit Quotation"
                        : "Create New Quotation"}
                    </h2>
                    <p>
                      Configure client details, project scope, services, and
                      download PDF.
                    </p>
                  </div>
                </div>
              </div>

              <div className="qf-page-header-right">
                <span className="qf-page-quote-pill">
                  {formData.quotation_number || "New Quotation"}
                </span>
              </div>
            </div>
          )}

          {initialData?.status === "Rejected" && (
            <div className="qf-rejection-banner" role="alert">
              <div className="qf-rejection-title">
                <AlertCircle size={15} />
                <span>Quotation Rejected by Super Admin</span>
              </div>
              <div>
                <strong>Feedback / Reason:</strong>{" "}
                {initialData.rejection_reason ||
                  "Please review the feedback, update the quotation, and resubmit for approval."}
              </div>
            </div>
          )}

          {formError && (
            <div className="qf-alert-error" role="alert">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          {customerLoadError && (
            <div className="qf-alert-error" role="status">
              <AlertCircle size={16} />
              <span>{customerLoadError}</span>
              <button
                type="button"
                className="qf-retry-button"
                onClick={retryCustomerLoad}
              >
                Retry
              </button>
            </div>
          )}

          {companyLoadError && (
            <div className="qf-alert-error" role="status">
              <AlertCircle size={16} />
              <span>{companyLoadError}</span>
              <button
                type="button"
                className="qf-retry-button"
                onClick={retryCompanyLoad}
              >
                Retry
              </button>
            </div>
          )}

          {formSuccess && (
            <div className="qf-alert-success" role="status">
              <CheckCircle size={16} />
              <span>{formSuccess}</span>
            </div>
          )}

          {/* Section A: Client Information */}
          <section className="qf-section qf-section-highlight">
            <div className="qf-section-title">
              <User size={15} />
              <span>Client Information</span>
            </div>

            <div className="qf-grid-2">
              <div className="qf-field col-span-2 qf-client-search-field">
                <label className="qf-label">
                  Select Customer
                </label>
                <div className="qf-search-input-wrap" ref={clientDropdownRef}>
                  <Search size={15} className="qf-search-input-icon" />
                  <input
                    type="text"
                    className="qf-input qf-input-search"
                    placeholder="Search customer by name or email..."
                    value={customerSearchQuery}
                    onFocus={() => setClientDropdownOpen(true)}
                    onClick={() => setClientDropdownOpen(true)}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setClientDropdownOpen(true);
                    }}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="qf-search-toggle-btn"
                    onClick={() => setClientDropdownOpen((prev) => !prev)}
                    title="Toggle customer list"
                  >
                    <ChevronDown size={14} className={clientDropdownOpen ? "open" : ""} />
                  </button>

                  {/* In-form Dropdown Menu */}
                  {clientDropdownOpen && (
                    <div className="qf-client-dropdown">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer) => {
                          const isSelected =
                            String(formData.customer_id) === String(customer.customer_id) ||
                            (formData.client_name &&
                              customer.customer_name?.toLowerCase() === formData.client_name.trim().toLowerCase());
                          return (
                            <div
                              key={customer.customer_id}
                              className={`qf-client-dropdown-item ${isSelected ? "selected" : ""}`}
                              onClick={() => handleSelectCustomer(customer)}
                            >
                              <div className="qf-cd-left">
                                <div className="qf-cd-name">
                                  <span>{customer.customer_name}</span>
                                  {customer.company_name && (
                                    <span className="qf-cd-company">{customer.company_name}</span>
                                  )}
                                </div>
                                {customer.email && (
                                  <div className="qf-cd-email">
                                    <Mail size={11} />
                                    <span>{customer.email}</span>
                                  </div>
                                )}
                              </div>
                              {isSelected && <Check size={14} className="qf-cd-check" />}
                            </div>
                          );
                        })
                      ) : (
                        <div className="qf-client-dropdown-empty">
                          No customers match your search
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="qf-field">
                <label className="qf-label">
                  <User size={13} />
                  Client Name <span className="qf-required">*</span>
                </label>
                <input
                  type="text"
                  className={`qf-input ${fieldErrors.client_name ? "qf-input-error" : ""}`}
                  placeholder="Enter client full name"
                  value={formData.client_name}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateField("client_name", val);
                    if (fieldErrors.client_name) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.client_name;
                        return next;
                      });
                    }
                    const valTrim = val.trim().toLowerCase();
                    const emailTrim = (formData.email || "").trim().toLowerCase();
                    const match = customers.find((c) => {
                      const cName = (c.customer_name || "").trim().toLowerCase();
                      const cEmail = (c.email || "").trim().toLowerCase();
                      if (valTrim && emailTrim) {
                        return cName === valTrim && cEmail === emailTrim;
                      }
                      if (valTrim && !emailTrim) {
                        return cName === valTrim && !cEmail;
                      }
                      return false;
                    });
                    if (match) {
                      updateField("customer_id", String(match.customer_id));
                      if (!customerSearchQuery) setCustomerSearchQuery(match.customer_name || "");
                    } else if (formData.customer_id) {
                      const cur = customers.find((c) => String(c.customer_id) === String(formData.customer_id));
                      if (cur && cur.customer_name?.trim().toLowerCase() !== val.trim().toLowerCase()) {
                        updateField("customer_id", "");
                      }
                    }
                  }}
                  aria-required="true"
                  required
                />
                {fieldErrors.client_name && (
                  <span className="qf-error-text">{fieldErrors.client_name}</span>
                )}
              </div>

              <div className="qf-field">
                <label className="qf-label">
                  <Building2 size={13} />
                  Company Name (Optional)
                </label>
                <input
                  type="text"
                  className="qf-input"
                  placeholder="e.g. Acme Corporation"
                  value={formData.company_name}
                  onChange={(e) => updateField("company_name", e.target.value)}
                />
              </div>

              <div className="qf-field">
                <label className="qf-label">
                  <Mail size={13} />
                  Email Address <span className="qf-required">*</span>
                </label>
                <input
                  type="email"
                  className={`qf-input ${fieldErrors.client_email ? "qf-input-error" : ""}`}
                  placeholder="e.g. client@example.com"
                  value={formData.email}
                  aria-required="true"
                  required
                  onChange={(e) => {
                    const newEmail = e.target.value;
                    updateField("email", newEmail);
                    if (fieldErrors.client_email) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.client_email;
                        return next;
                      });
                    }
                    const valTrim = (formData.client_name || "").trim().toLowerCase();
                    const emailTrim = newEmail.trim().toLowerCase();
                    const match = customers.find((c) => {
                      const cName = (c.customer_name || "").trim().toLowerCase();
                      const cEmail = (c.email || "").trim().toLowerCase();
                      if (valTrim && emailTrim) {
                        return cName === valTrim && cEmail === emailTrim;
                      }
                      if (!valTrim && emailTrim) {
                        return cEmail === emailTrim;
                      }
                      return false;
                    });
                    if (match) {
                      updateField("customer_id", String(match.customer_id));
                      if (!customerSearchQuery) setCustomerSearchQuery(match.customer_name || "");
                    } else if (formData.customer_id) {
                      const cur = customers.find((c) => String(c.customer_id) === String(formData.customer_id));
                      if (cur && (cur.email || "").trim().toLowerCase() !== emailTrim) {
                        updateField("customer_id", "");
                      }
                    }
                  }}
                />
                {fieldErrors.client_email && (
                  <span className="qf-error-text">{fieldErrors.client_email}</span>
                )}
              </div>

              <div className="qf-field">
                <label className="qf-label">
                  <Phone size={13} />
                  Contact Number
                </label>
                <input
                  type="text"
                  className={`qf-input ${fieldErrors.client_phone ? "qf-input-error" : ""}`}
                  placeholder="e.g. +94 77 123 4567"
                  value={formData.phone}
                  onChange={(e) => {
                    updateField("phone", e.target.value);
                    if (fieldErrors.client_phone) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.client_phone;
                        return next;
                      });
                    }
                  }}
                />
                {fieldErrors.client_phone && (
                  <span className="qf-error-text">{fieldErrors.client_phone}</span>
                )}
              </div>

              <div className="qf-field col-span-2">
                <label className="qf-label">Billing Address</label>
                <input
                  type="text"
                  className="qf-input"
                  placeholder="e.g. No. 45, Galle Road, Colombo 03"
                  value={formData.address}
                  onChange={(e) => updateField("address", e.target.value)}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Section B: Quotation & Project Timeline */}
        <section className="qf-section qf-section-highlight">
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
                className={`qf-input ${fieldErrors.quotation_number ? "qf-input-error" : ""}`}
                value={formData.quotation_number}
                onChange={(e) => updateField("quotation_number", e.target.value)}
                placeholder="e.g. QUO-2611-001"
                required
              />
              {fieldErrors.quotation_number && (
                <span className="qf-error-text">{fieldErrors.quotation_number}</span>
              )}
            </div>

            <div className="qf-field">
              <label className="qf-label">
                Quotation Date <span className="qf-required">*</span>
              </label>
              <input
                type="date"
                className={`qf-input ${fieldErrors.quotation_date ? "qf-input-error" : ""}`}
                value={formData.quotation_date}
                onChange={(e) => updateField("quotation_date", e.target.value)}
                required
              />
              {fieldErrors.quotation_date && (
                <span className="qf-error-text">{fieldErrors.quotation_date}</span>
              )}
            </div>

            <div className="qf-field">
              <label className="qf-label">Valid Until</label>
              <input
                type="date"
                className={`qf-input ${fieldErrors.valid_until ? "qf-input-error" : ""}`}
                min={formData.quotation_date}
                value={formData.valid_until}
                onChange={(e) => updateField("valid_until", e.target.value)}
              />
              {fieldErrors.valid_until && (
                <span className="qf-error-text">{fieldErrors.valid_until}</span>
              )}
            </div>

            <div className="qf-field">
              <label className="qf-label">Project Start Date</label>
              <div
                className="qf-highlight-box"
                aria-label="Project Start Date: Initial Advance Payment Date"
              >
                <span className="qf-highlight-dot" aria-hidden="true" />
                <span>Initial Advance Payment Date</span>
              </div>
            </div>

            <div className="qf-field">
              <label className="qf-label">Project Duration</label>
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={`qf-input ${fieldErrors.estimated_duration ? "qf-input-error" : ""}`}
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
              {fieldErrors.estimated_duration && (
                <span className="qf-error-text">{fieldErrors.estimated_duration}</span>
              )}
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
              >
                <div className="qf-item-card-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="qf-item-num">Item #{index + 1}</span>
                    <span className="qf-additional-badge">
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

                <div className="qf-additional-item-fields">
                  <div className="qf-field">
                    <label className="qf-label">
                      Item Name (ex: Logo) <span className="qf-required">*</span>
                    </label>
                    <input
                      type="text"
                      className={`qf-input ${fieldErrors[`item_name_${index}`] ? "qf-input-error" : ""}`}
                      placeholder="e.g. Logo, Domain, SSL..."
                      value={item.item_name}
                      onChange={(e) => updateItem(index, "item_name", e.target.value)}
                      required
                      autoFocus
                    />
                    {fieldErrors[`item_name_${index}`] && (
                      <span className="qf-error-text">{fieldErrors[`item_name_${index}`]}</span>
                    )}
                  </div>

                  <div className="qf-field">
                    <label className="qf-label">
                      Amount ({formData.currency}) <span className="qf-required">*</span>
                    </label>
                    <AmountInput
                      value={item.unit_price}
                      onChange={(val) => updateItem(index, "unit_price", val)}
                      suffix=".00"
                      placeholder="0"
                      required
                      hasError={Boolean(fieldErrors[`unit_price_${index}`])}
                    />
                    {fieldErrors[`unit_price_${index}`] && (
                      <span className="qf-error-text">{fieldErrors[`unit_price_${index}`]}</span>
                    )}
                  </div>

                  <div className="qf-field">
                    <label className="qf-label">Tax Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      className={`qf-input ${fieldErrors[`tax_rate_${index}`] ? "qf-input-error" : ""}`}
                      placeholder="0"
                      value={item.tax_rate}
                      onChange={(e) => updateItem(index, "tax_rate", e.target.value)}
                      onFocus={(e) => {
                        if (e.target.value === "0" || e.target.value === "0.00") {
                          updateItem(index, "tax_rate", "");
                        } else {
                          e.target.select();
                        }
                      }}
                      onClick={(e) => {
                        if (e.target.value === "0" || e.target.value === "0.00") {
                          updateItem(index, "tax_rate", "");
                        }
                      }}
                      onWheel={(e) => e.target.blur()}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
                      }}
                    />
                    {fieldErrors[`tax_rate_${index}`] && (
                      <span className="qf-error-text">{fieldErrors[`tax_rate_${index}`]}</span>
                    )}
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
                  {/* Service options are populated from the backend catalogue. */}
                  <div className="qf-field col-span-3">
                    <label className="qf-label">Select Service</label>
                    <select
                      className="qf-select"
                      value={getServiceOptionValue(serviceCatalog, item.item_name)}
                      onChange={(e) => handleSelectServicePreset(index, e.target.value)}
                      disabled={serviceCatalog.length === 0}
                    >
                      <option value="">-- Select Service --</option>
                      {serviceCatalog.map((service) => (
                        <option
                          key={service.service_id || service.item_name}
                          value={String(service.service_id ?? service.item_name)}
                        >
                          {service.item_name}
                        </option>
                      ))}
                    </select>
                    {serviceLoadError && (
                      <div className="qf-field-help" role="status">
                        <span>{serviceLoadError}</span>
                        <button
                          type="button"
                          className="qf-retry-button"
                          onClick={retryServiceLoad}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Service Name */}
                  <div className="qf-field col-span-3">
                    <label className="qf-label">
                      Service Name <span className="qf-required">*</span>
                    </label>
                    <input
                      type="text"
                      className={`qf-input ${fieldErrors[`item_name_${index}`] ? "qf-input-error" : ""}`}
                      placeholder="e.g. WordPress Website"
                      value={item.item_name}
                      onChange={(e) => updateItem(index, "item_name", e.target.value)}
                      required
                    />
                    {fieldErrors[`item_name_${index}`] && (
                      <span className="qf-error-text">{fieldErrors[`item_name_${index}`]}</span>
                    )}
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
                    <AutoGrowTextarea
                      rows={5}
                      className="qf-textarea qf-textarea-deliverables"
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
                    <AmountInput
                      value={item.unit_price}
                      onChange={(val) => updateItem(index, "unit_price", val)}
                      suffix=".00"
                      placeholder="0"
                      required
                      hasError={Boolean(fieldErrors[`unit_price_${index}`])}
                    />
                    {fieldErrors[`unit_price_${index}`] && (
                      <span className="qf-error-text">{fieldErrors[`unit_price_${index}`]}</span>
                    )}
                  </div>

                  <div className="qf-field">
                    <label className="qf-label">Tax Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      className={`qf-input ${fieldErrors[`tax_rate_${index}`] ? "qf-input-error" : ""}`}
                      placeholder="0"
                      value={item.tax_rate}
                      onChange={(e) => updateItem(index, "tax_rate", e.target.value)}
                      onFocus={(e) => {
                        if (e.target.value === "0" || e.target.value === "0.00") {
                          updateItem(index, "tax_rate", "");
                        } else {
                          e.target.select();
                        }
                      }}
                      onClick={(e) => {
                        if (e.target.value === "0" || e.target.value === "0.00") {
                          updateItem(index, "tax_rate", "");
                        }
                      }}
                      onWheel={(e) => e.target.blur()}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
                      }}
                    />
                    {fieldErrors[`tax_rate_${index}`] && (
                      <span className="qf-error-text">{fieldErrors[`tax_rate_${index}`]}</span>
                    )}
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
              onClick={addAdditionalItem}
              title="Add an additional item with just Name and Amount"
            >
              <Plus size={15} />
              <span>Add Additional Item</span>
            </button>
          </div>
        </section>

        {/* Section D: Notes, Terms, Financial Summary, and Actions */}
        <div className={isPage ? "qf-page-group-card qf-page-bottom-group" : ""}>
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
                  step="any"
                  className={`qf-input ${fieldErrors.discount_amount ? "qf-input-error" : ""}`}
                  placeholder="0"
                  value={formData.discount_amount}
                  onChange={(e) => updateField("discount_amount", e.target.value)}
                  onFocus={(e) => {
                    if (e.target.value === "0" || e.target.value === "0.00") {
                      updateField("discount_amount", "");
                    } else {
                      e.target.select();
                    }
                  }}
                  onClick={(e) => {
                    if (e.target.value === "0" || e.target.value === "0.00") {
                      updateField("discount_amount", "");
                    }
                  }}
                  onWheel={(e) => e.target.blur()}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
                  }}
                />
                {fieldErrors.discount_amount && (
                  <span className="qf-error-text">{fieldErrors.discount_amount}</span>
                )}
              </div>

              <div className="qf-summary-row total-row">
                <span>Grand Total:</span>
                <span className="qf-grand-total">
                  {formatMoney(totals.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer with Actions */}
          <div className={`qf-footer ${isPage ? "qf-page-footer" : ""}`}>
            <div className="qf-footer-actions">
              <button
                type="button"
                className="qf-btn qf-btn-cancel"
                onClick={onClose}
                disabled={saving}
              >
                <span>Cancel</span>
              </button>

              <button
                type="button"
                className="qf-btn qf-btn-pdf"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf || saving || dependenciesLoading || !canDownloadFormPdf}
                title={
                  !canDownloadFormPdf
                    ? "Available after Super Admin approval"
                    : "Download formatted business PDF using current form details"
                }
                style={
                  !canDownloadFormPdf
                    ? { opacity: 0.5, cursor: "not-allowed" }
                    : undefined
                }
              >
                <Download size={15} />
                <span>{downloadingPdf ? "Generating PDF..." : "Download PDF"}</span>
              </button>

              <button
                type="button"
                className="qf-btn qf-btn-draft"
                onClick={(e) => handleSaveQuotation(e, "Draft")}
                disabled={saving || downloadingPdf || dependenciesLoading}
                title="Save quotation as draft without requesting approval"
              >
                <Save size={15} />
                <span>{saving ? "Saving..." : "Save as Draft"}</span>
              </button>

              {isSuperAdmin ? (
                <button
                  type="button"
                  className="qf-btn qf-btn-primary"
                  onClick={(e) => handleSaveQuotation(e, "Approved")}
                  disabled={saving || downloadingPdf || dependenciesLoading}
                  title="Finalize quotation as approved"
                >
                  <CheckCircle size={15} />
                  <span>
                    {dependenciesLoading
                      ? "Loading..."
                      : saving
                        ? "Finalizing..."
                        : "Finalize Quotation"}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className={`qf-btn qf-btn-primary ${initialData?.status === "Rejected" ? "qf-btn-resubmit" : ""
                    }`}
                  onClick={(e) => handleSaveQuotation(e, "Pending Approval")}
                  disabled={saving || downloadingPdf || dependenciesLoading}
                  title={
                    initialData?.status === "Rejected"
                      ? "Resubmit revised quotation for Super Admin review and approval"
                      : "Submit quotation for Super Admin review and approval"
                  }
                >
                  <Send size={15} />
                  <span>
                    {dependenciesLoading
                      ? "Loading..."
                      : saving
                        ? "Submitting..."
                        : initialData?.status === "Rejected"
                          ? "Resubmit for Approval"
                          : "Submit for Approval"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );

  if (isPage) {
    return (
      <div className="qf-page-screen">
        <div className="qf-page-layout">
          {onClose && (
            <div className="qf-page-side-left">
              <button
                type="button"
                className="qf-back-btn"
                onClick={onClose}
                disabled={saving}
                title="Back to Quotations"
                aria-label="Back to Quotations"
              >
                <ArrowLeft size={17} />
              </button>
            </div>
          )}

          <div className="qf-page-shell">
            <div className="qf-page-sheet">
              {formElement}
            </div>
          </div>

          {onClose && <div className="qf-page-side-right" aria-hidden="true" />}
        </div>
      </div>
    );
  }

  return (
    <div
      className="qf-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div className="qf-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Compact Square Header */}
        <div className="qf-header">
          <div className="qf-header-title">
            <div className="qf-header-icon">
              <FileText size={18} />
            </div>
            <div>
              <h2>Quotation Form</h2>
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

        {formElement}
      </div>
    </div>
  );
}
