import { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Plus,
  Trash2,
  FileText,
  User,
  Building2,
  Receipt,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ArrowLeft,
  CreditCard,
  Upload,
  Paperclip,
  Download,
  Save,
  Send,
  Search,
} from "lucide-react";
import {
  getAllRegisteredCustomers,
  getQuotations,
  getInvoices,
  createInvoice,
  updateInvoice,
} from "../services/invoiceService";
import { createPayment } from "../services/paymentService";
import {
  addNotification,
  getCompanyDetails,
} from "../services/quotationService";
import { getAuthenticatedUser } from "../utils/authStorage";
import {
  getNextInvoiceNumber,
  toInvoiceNumberFromQuotation,
} from "../utils/formatters";
import { downloadInvoicePdf } from "../utils/pdfGenerator";
import "./InvoiceForm.css";

function toDisplayMmDdYyyy(isoStr) {
  if (!isoStr) return "";
  const clean = String(isoStr).slice(0, 10);
  const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return clean;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

function formatDueDateInput(rawValue, prevValue = "") {
  const raw = String(rawValue || "");
  if (
    raw.length < prevValue.length &&
    prevValue.endsWith("/") &&
    raw === prevValue.slice(0, -1)
  ) {
    return raw.slice(0, -1);
  }

  // Handle manual slash after a single digit month or day (e.g. "1/" -> "01/", "01/5/" -> "01/05/")
  if (raw.endsWith("/")) {
    const parts = raw.slice(0, -1).split("/");
    if (parts.length === 1 && /^\d$/.test(parts[0])) {
      const m = Math.max(1, Number(parts[0]));
      return `${String(m).padStart(2, "0")}/`;
    }
    if (parts.length === 2 && /^\d{2}$/.test(parts[0]) && /^\d$/.test(parts[1])) {
      const d = Math.max(1, Number(parts[1]));
      return `${parts[0]}/${String(d).padStart(2, "0")}/`;
    }
  }

  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (!digits) return "";

  if (digits.length === 1) {
    return Number(digits[0]) > 1 ? `0${digits[0]}/` : digits;
  }

  if (digits.length === 2) {
    const mm = Math.min(12, Math.max(1, Number(digits)));
    return `${String(mm).padStart(2, "0")}/`;
  }

  const mm = String(Math.min(12, Math.max(1, Number(digits.slice(0, 2))))).padStart(2, "0");
  const ddPart = digits.slice(2, 4);

  if (digits.length === 3) {
    return Number(ddPart[0]) > 3 ? `${mm}/0${ddPart[0]}/` : `${mm}/${ddPart}`;
  }

  const dd = String(Math.min(31, Math.max(1, Number(ddPart)))).padStart(2, "0");
  if (digits.length === 4) {
    return `${mm}/${dd}/`;
  }

  const yyyy = digits.slice(4, 8);
  return `${mm}/${dd}/${yyyy}`;
}

function parseDueDateToIso(val) {
  const s = String(val || "").trim();
  if (!s) return "";
  let year;
  let month;
  let day;
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const dashMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (slashMatch) {
    month = Number(slashMatch[1]);
    day = Number(slashMatch[2]);
    year = Number(slashMatch[3]);
  } else if (dashMatch) {
    year = Number(dashMatch[1]);
    month = Number(dashMatch[2]);
    day = Number(dashMatch[3]);
  } else {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(
    2,
    "0"
  )}-${String(day).padStart(2, "0")}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) {
    return null;
  }
  return iso;
}

export default function InvoiceForm({
  initialData,
  invoiceToEdit,
  isOpen,
  onClose,
  onSuccess,
  asPage = false,
}) {
  if (!isOpen) return null;

  const authUser = getAuthenticatedUser();
  const isSuperAdmin =
    String(authUser?.role || "").trim().toLowerCase() === "super admin" ||
    authUser?.role === "super_admin";

  const data = initialData || invoiceToEdit;
  const isEditing = Boolean(data?.invoice_id || data?.id);

  const canDownloadPdf = useMemo(() => {
    if (isSuperAdmin) return true;
    if (!isEditing) return false;
    const s = String(data?.status || "").trim().toLowerCase();
    const a = String(data?.approval_status || "").trim().toLowerCase();
    if (a === "approved") return true;
    if (["draft", "pending approval", "pending", "rejected", "cancelled"].includes(s)) {
      return false;
    }
    if (["draft", "pending", "rejected"].includes(a)) {
      return false;
    }
    return Boolean(data?.invoice_id || data?.id);
  }, [isSuperAdmin, isEditing, data]);

  // Registered customers, quotations & invoices for dropdown / sequence calculation
  const [customersList, setCustomersList] = useState([]);
  const [quotationsList, setQuotationsList] = useState([]);
  const [invoicesList, setInvoicesList] = useState([]);
  const [loadingLookups, setLoadingLookLookups] = useState(false);
  const isManualInvoiceNumber = useRef(Boolean(data?.invoice_number));

  const defaultInvoiceDate =
    initialData?.invoice_date || new Date().toISOString().slice(0, 10);

  // Read saved invoice billing settings from company preferences
  const savedInvSettings = useMemo(() => {
    try {
      const raw = localStorage.getItem("iq_invoice_settings");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const defaultPrefix = savedInvSettings?.invoice_prefix || "INV";

  // Form states
  const [invoiceNumber, setInvoiceNumber] = useState(
    data?.invoice_number ||
    (data?.quotation_number
      ? toInvoiceNumberFromQuotation(data.quotation_number)
      : "") ||
    getNextInvoiceNumber([], defaultInvoiceDate, defaultPrefix)
  );
  const [selectedCustomerMode, setSelectedCustomerMode] = useState("existing"); // "existing" | "new"
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    data?.customer_id ? String(data.customer_id) : ""
  );
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const customerSearchRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target)) {
        setCustomerSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (selectedCustomerId && customersList.length > 0) {
      const found = customersList.find((c) => String(c.customer_id) === String(selectedCustomerId));
      if (found && !customerSearchQuery) {
        setCustomerSearchQuery(found.customer_name || "");
      }
    }
  }, [selectedCustomerId, customersList]);

  const filteredRegisteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customersList;
    const q = customerSearchQuery.toLowerCase().trim();
    const isExactSelected =
      selectedCustomerId &&
      customersList.some(
        (c) =>
          String(c.customer_id) === String(selectedCustomerId) &&
          (c.customer_name || "").toLowerCase() === q
      );

    if (isExactSelected) {
      return customersList;
    }

    return customersList.filter((c) => {
      const name = (c.customer_name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const company = (c.company_name || "").toLowerCase();
      return name.includes(q) || email.includes(q) || company.includes(q);
    });
  }, [customersList, customerSearchQuery, selectedCustomerId]);

  // Customer fields
  const [customerName, setCustomerName] = useState(
    data?.customer_name || data?.client_name || ""
  );
  const [companyName, setCompanyName] = useState(data?.company_name || "");
  const [email, setEmail] = useState(data?.email || "");
  const [phone, setPhone] = useState(data?.phone || "");
  const [address, setAddress] = useState(data?.address || "");

  // Linked quotation
  const [selectedQuotationId, setSelectedQuotationId] = useState(
    data?.quotation_id || ""
  );

  // Dates & currency
  const [invoiceDate, setInvoiceDate] = useState(
    initialData?.invoice_date || new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState(() => {
    if (data?.due_date) return toDisplayMmDdYyyy(data.due_date);
    const days = parseInt(savedInvSettings?.default_due_days, 10);
    if (!Number.isNaN(days) && days > 0) {
      const d = new Date();
      d.setDate(d.getDate() + days);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${mm}/${dd}/${yyyy}`;
    }
    return "";
  });
  const dueDatePickerRef = useRef(null);
  const [currency, setCurrency] = useState(
    data?.currency || savedInvSettings?.default_currency || "LKR"
  );

  // Items
  const [items, setItems] = useState(() => {
    if (Array.isArray(data?.items) && data.items.length > 0) {
      return data.items.map((it) => ({
        id: it.invoice_item_id || Math.random(),
        item_name: it.item_name || "",
        description: it.description || "",
        price: Number(it.price) || 0,
        tax_rate: Number(it.tax_rate) || 0,
      }));
    }
    return [
      {
        id: Math.random(),
        item_name: "",
        description: "",
        price: "",
        tax_rate: 0,
      },
    ];
  });

  // Payment details
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentSlipFile, setPaymentSlipFile] = useState(null);
  const paymentSlipInputRef = useRef(null);

  // Notes & terms
  const [notes, setNotes] = useState(
    data?.notes ||
    savedInvSettings?.default_notes ||
    "Please deposit payments into our registered commercial account and email payment slips to accounts@company.lk."
  );
  const [terms, setTerms] = useState(
    data?.terms_and_conditions ||
    savedInvSettings?.default_terms ||
    "Payment is strictly due within 14 calendar days of issuance.\nOverdue accounts may be subject to interest."
  );

  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [companyDetails, setCompanyDetails] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // Load registered customers, quotations, existing invoices, and company branding
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingLookLookups(true);
        const [cList, qList, invList, compDetails] = await Promise.all([
          getAllRegisteredCustomers().catch(() => []),
          getQuotations({ for_invoice: true }).catch(() => []),
          getInvoices().catch(() => []),
          getCompanyDetails().catch(() => null),
        ]);
        const normalizedInvoices = Array.isArray(invList) ? invList : [];
        setInvoicesList(normalizedInvoices);
        setQuotationsList(Array.isArray(qList) ? qList : []);
        if (compDetails) setCompanyDetails(compDetails);

        // Build combined customers list so all customers with quotations or invoices in the system appear
        const customerMap = new Map();
        (Array.isArray(cList) ? cList : []).forEach((c) => {
          if (c && c.customer_id) customerMap.set(String(c.customer_id), c);
        });
        (Array.isArray(qList) ? qList : []).forEach((q) => {
          if (q && q.customer_id && !customerMap.has(String(q.customer_id))) {
            customerMap.set(String(q.customer_id), {
              customer_id: q.customer_id,
              customer_name: q.customer_name || q.clientName || "",
              company_name: q.company_name || "",
              email: q.email || q.customer_email || "",
              phone: q.phone || q.customer_phone || "",
              address: q.address || q.customer_address || "",
            });
          }
        });
        (Array.isArray(normalizedInvoices) ? normalizedInvoices : []).forEach((inv) => {
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
        setCustomersList(Array.from(customerMap.values()));
        if (!isEditing && !selectedQuotationId && !isManualInvoiceNumber.current) {
          setInvoiceNumber(
            getNextInvoiceNumber(normalizedInvoices, invoiceDate, defaultPrefix)
          );
        }
      } finally {
        setLoadingLookLookups(false);
      }
    }
    loadData();
  }, []);

  // When selecting an existing customer, auto-fill contact fields
  function selectCustomerById(custId) {
    setSelectedCustomerId(custId);

    if (!custId) return;
    setFieldErrors((prev) => ({ ...prev, customerName: false, email: false }));
    const found = customersList.find((c) => String(c.customer_id) === String(custId));
    if (found) {
      setCustomerName(found.customer_name || "");
      setCompanyName(found.company_name || "");
      setEmail(found.email || "");
      setPhone(found.phone || "");
      setAddress(found.address || "");
    }
  }

  function handleCustomerSelect(e) {
    const custId = e.target.value;
    selectCustomerById(custId);
    const found = customersList.find((c) => String(c.customer_id) === String(custId));
    if (found) {
      setCustomerSearchQuery(found.customer_name || "");
    } else {
      setCustomerSearchQuery("");
    }
    setCustomerSearchOpen(false);
  }

  // When selecting a quotation, auto-populate customer, items, and details
  function handleQuotationSelect(e) {
    const qVal = e.target.value;
    setSelectedQuotationId(qVal);

    if (!qVal) {
      if (!isEditing) {
        isManualInvoiceNumber.current = false;
        setInvoiceNumber(getNextInvoiceNumber(invoicesList, invoiceDate, defaultPrefix));
      }
      return;
    }
    const foundQ = quotationsList.find(
      (q) =>
        String(q.quotation_id) === String(qVal) ||
        String(q.quotation_number) === String(qVal)
    );

    if (foundQ) {
      if (foundQ.quotation_number) {
        isManualInvoiceNumber.current = false;
        setInvoiceNumber(toInvoiceNumberFromQuotation(foundQ.quotation_number));
      }
      if (foundQ.customer_id) {
        setSelectedCustomerId(String(foundQ.customer_id));
      }
      if (foundQ.customer_name || foundQ.clientName) {
        setCustomerName(foundQ.customer_name || foundQ.clientName || "");
        setCustomerSearchQuery(foundQ.customer_name || foundQ.clientName || "");
      }
      if (foundQ.company_name) setCompanyName(foundQ.company_name);
      if (foundQ.email) setEmail(foundQ.email);
      if (foundQ.phone) setPhone(foundQ.phone);
      if (foundQ.currency) setCurrency(foundQ.currency);
      if (foundQ.notes) setNotes(foundQ.notes);
      if (foundQ.terms_and_conditions) setTerms(foundQ.terms_and_conditions);

      // Auto-populate items from quotation
      if (Array.isArray(foundQ.items) && foundQ.items.length > 0) {
        setItems(
          foundQ.items.map((it) => ({
            id: Math.random(),
            item_name: it.item_name || "",
            description: it.description || "",
            price: Number(it.Price ?? it.unit_price ?? it.price ?? 0),
            tax_rate: Number(it.tax_rate ?? 0),
          }))
        );
      }
    }
  }

  // Add / remove items
  function handleAddItem() {
    setItems((prev) => [
      ...prev,
      {
        id: Math.random(),
        item_name: "",
        description: "",
        price: "",
        tax_rate: 0,
      },
    ]);
  }

  function handleRemoveItem(index) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
    setFieldErrors((prev) => {
      const next = {};
      Object.keys(prev).forEach((key) => {
        if (!key.startsWith("item_name_") && !key.startsWith("price_")) {
          next[key] = prev[key];
        }
      });
      return next;
    });
  }

  function handleItemChange(index, field, value) {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  function handlePaymentSlipChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExts = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"];
    const dotIdx = file.name.lastIndexOf(".");
    const ext = dotIdx >= 0 ? file.name.slice(dotIdx).toLowerCase() : "";
    if (!allowedExts.includes(ext)) {
      setErrorMessage(
        "Unsupported slip format. Upload PNG, JPG, WEBP, GIF, or PDF."
      );
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Payment slip file size must be 5 MB or less.");
      e.target.value = "";
      return;
    }

    setErrorMessage("");
    setPaymentSlipFile(file);
  }

  function handleClearPaymentSlip() {
    setPaymentSlipFile(null);
    if (paymentSlipInputRef.current) {
      paymentSlipInputRef.current.value = "";
    }
  }

  const selectedQuotationObj = useMemo(() => {
    if (!selectedQuotationId) return null;
    return quotationsList.find(
      (q) =>
        String(q.quotation_id) === String(selectedQuotationId) ||
        String(q.quotation_number) === String(selectedQuotationId)
    );
  }, [selectedQuotationId, quotationsList]);

  // Financial calculations
  const { subtotal, taxAmount, discountAmount, totalAmount } = useMemo(() => {
    let sub = 0;
    let tax = 0;

    items.forEach((item) => {
      const p = Number(item.price) || 0;
      const tr = Number(item.tax_rate) || 0;
      sub += p;
      if (tr > 0) {
        tax += (p * tr) / 100;
      }
    });

    const qDiscAmt = Number(
      selectedQuotationObj?.discount_amount ?? data?.discount_amount ?? 0
    );
    const qDiscPct = Number(
      selectedQuotationObj?.discount_percentage ?? data?.discount_percentage ?? 0
    );
    const disc =
      qDiscAmt > 0
        ? qDiscAmt
        : qDiscPct > 0
          ? Number(((sub * qDiscPct) / 100).toFixed(2))
          : 0;

    const tot = Math.max(0, sub + tax - disc);

    return {
      subtotal: sub,
      taxAmount: Number(tax.toFixed(2)),
      discountAmount: Number(disc.toFixed(2)),
      totalAmount: Number(tot.toFixed(2)),
    };
  }, [items, selectedQuotationObj, data]);

  const existingPaid = Number(data?.amount_paid) || 0;
  const rawPaymentNum = Number(paymentAmount);
  const validPaymentAmount =
    Number.isFinite(rawPaymentNum) && rawPaymentNum > 0
      ? Number(rawPaymentNum.toFixed(2))
      : 0;
  const maxPayableAmount = Math.max(
    0,
    Number((totalAmount - existingPaid).toFixed(2))
  );
  const paymentExceedsBalance = validPaymentAmount > maxPayableAmount + 0.0001;
  const totalPaidPreview = Number(
    (existingPaid + Math.min(validPaymentAmount, maxPayableAmount)).toFixed(2)
  );
  const remainingBalance = Math.max(
    0,
    Number((totalAmount - totalPaidPreview).toFixed(2))
  );
  const paymentPreviewStatus =
    totalAmount > 0 && remainingBalance <= 0
      ? "Full Paid"
      : totalPaidPreview > 0
        ? "Partial"
        : "Unpaid";

  function validateRequiredFields(isDownload = false) {
    const errors = {};
    let firstErrorMsg = "";

    const hasQuotation = Boolean(selectedQuotationId);
    const trimmedNumber = invoiceNumber.trim();
    const trimmedCust = customerName.trim();
    const trimmedEmail = (email || "").trim();
    const isoDueDate = parseDueDateToIso(dueDate);

    if (!trimmedCust) {
      errors.customerName = true;
      if (!firstErrorMsg) firstErrorMsg = "Customer name is required.";
    }

    if (!trimmedEmail) {
      errors.email = true;
      if (!firstErrorMsg) firstErrorMsg = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = true;
      if (!firstErrorMsg) firstErrorMsg = "Please enter a valid email address.";
    }

    if (!hasQuotation) {
      let hasValidItem = false;
      items.forEach((it, idx) => {
        const hasName = Boolean(it.item_name && it.item_name.trim());
        const hasPrice = it.price !== "" && Number(it.price) > 0;
        if (!hasName) errors[`item_name_${idx}`] = true;
        if (!hasPrice) errors[`price_${idx}`] = true;
        if (hasName && hasPrice) hasValidItem = true;
      });
      if (!hasValidItem && !firstErrorMsg) {
        firstErrorMsg = "Please enter at least one invoice item with a name and price.";
      }
    }

    if (!trimmedNumber) {
      errors.invoiceNumber = true;
      if (!firstErrorMsg) firstErrorMsg = "Invoice number is required.";
    }

    if (!invoiceDate) {
      errors.invoiceDate = true;
      if (!firstErrorMsg) firstErrorMsg = "Invoice date is required.";
    }

    if (!dueDate.trim() || !isoDueDate) {
      errors.dueDate = true;
      if (!firstErrorMsg) {
        firstErrorMsg = !dueDate.trim()
          ? "Due date is required."
          : "Please enter a valid Due Date in mm/dd/yyyy format.";
      }
    } else if (invoiceDate && isoDueDate <= invoiceDate) {
      errors.dueDate = true;
      if (!firstErrorMsg) {
        firstErrorMsg = "Due date must be after the invoice date.";
      }
    }

    if (!isDownload) {
      if (
        paymentAmount !== "" &&
        (!Number.isFinite(Number(paymentAmount)) || Number(paymentAmount) < 0)
      ) {
        if (!firstErrorMsg) firstErrorMsg = "Please enter a valid payment amount.";
      } else if (paymentExceedsBalance) {
        if (!firstErrorMsg) {
          firstErrorMsg = `Payment amount cannot exceed remaining balance (${currency} ${maxPayableAmount.toLocaleString(
            "en-LK",
            { minimumFractionDigits: 2 }
          )}).`;
        }
      }
    }

    setFieldErrors(errors);

    if (firstErrorMsg) {
      setErrorMessage(firstErrorMsg);
      window.scrollTo({ top: 0, behavior: "smooth" });
      const modalBody = document.querySelector(".inv-modal-body");
      if (modalBody) {
        modalBody.scrollTo({ top: 0, behavior: "smooth" });
      }
      return false;
    }

    setErrorMessage("");
    return true;
  }

  // Submit Invoice (Draft or Unpaid/Issued)
  async function handleSubmit(saveStatus) {
    if (!validateRequiredFields(false)) {
      return;
    }

    if (validPaymentAmount > 0 && saveStatus === "Draft") {
      setErrorMessage(
        "Immediate payment cannot be saved with a Draft invoice. Clear the payment amount to save as Draft."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      const modalBody = document.querySelector(".inv-modal-body");
      if (modalBody) {
        modalBody.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    const hasQuotation = Boolean(selectedQuotationId);
    const trimmedNumber = invoiceNumber.trim();
    const trimmedCust = customerName.trim();
    const isoDueDate = parseDueDateToIso(dueDate);
    const validItems = items.filter((it) => it.item_name.trim());

    try {
      setSaving(true);

      const resolvedStatus =
        saveStatus ||
        data?.status ||
        (isSuperAdmin ? "Unpaid" : "Pending Approval");

      const resolvedApprovalStatus =
        resolvedStatus === "Pending Approval"
          ? "Pending"
          : resolvedStatus === "Draft"
            ? "Not Required"
            : resolvedStatus === "Rejected"
              ? "Rejected"
              : "Approved";

      let effectiveCustId = selectedCustomerId ? Number(selectedCustomerId) : null;
      if (!effectiveCustId) {
        const valTrim = trimmedCust.toLowerCase();
        const emailTrim = email.trim().toLowerCase();
        const found = customersList.find((c) => {
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
        if (found && found.customer_id) {
          effectiveCustId = Number(found.customer_id);
        }
      }

      const payload = {
        invoice_number: trimmedNumber,
        quotation_id: selectedQuotationId ? Number(selectedQuotationId) : null,
        customer_id: effectiveCustId,
        customer_name: trimmedCust,
        company_name: companyName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        invoice_date: invoiceDate,
        due_date: isoDueDate,
        currency: currency,
        status: resolvedStatus,
        approval_status: resolvedApprovalStatus,
        subtotal: subtotal,
        discount_type: "fixed",
        discount_value: discountAmount,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        amount_paid: Number(data?.amount_paid) || 0,
        balance_due: Math.max(0, totalAmount - (Number(data?.amount_paid) || 0)),
        notes: notes.trim(),
        terms_and_conditions: terms.trim(),
        items: validItems.map((it) => ({
          item_name: it.item_name.trim(),
          description: it.description?.trim() || "",
          price: Number(it.price) || 0,
          tax_rate: Number(it.tax_rate) || 0,
          line_total: Number(
            (
              (Number(it.price) || 0) *
              (1 + (Number(it.tax_rate) || 0) / 100)
            ).toFixed(2)
          ),
        })),
        payments: data?.payments || [],
      };

      let savedInvoice = null;
      if (isEditing) {
        const id = data.invoice_id || data.id;
        savedInvoice = await updateInvoice(id, payload);
      } else {
        savedInvoice = await createInvoice(payload);
      }

      const finalStatus =
        savedInvoice?.status ||
        saveStatus ||
        data?.status ||
        (isSuperAdmin ? "Unpaid" : "Pending Approval");

      if (
        validPaymentAmount > 0 &&
        savedInvoice?.invoice_id &&
        !["Draft", "Pending Approval", "Rejected", "Cancelled"].includes(
          finalStatus
        )
      ) {
        const fd = new FormData();
        fd.append("invoice_id", String(savedInvoice.invoice_id));
        fd.append(
          "payment_date",
          invoiceDate || new Date().toISOString().slice(0, 10)
        );
        fd.append("amount", String(validPaymentAmount));
        fd.append("payment_method", paymentMethod);
        if (paymentSlipFile) {
          fd.append("payment_slip", paymentSlipFile);
        }
        await createPayment(fd);
      }

      if (finalStatus === "Pending Approval") {
        const invNum =
          savedInvoice?.invoice_number ||
          data?.invoice_number ||
          invoiceNumber ||
          "New Invoice";
        const clientName =
          savedInvoice?.customer_name || trimmedCust || "Client";
        const creatorName =
          authUser?.name || authUser?.username || "Admin";

        try {
          await addNotification({
            title: `Invoice Pending Approval: ${invNum}`,
            message: `${creatorName} submitted invoice ${invNum} for ${clientName} awaiting your review.`,
            type: "warning",
            reference_type: "invoice",
            reference_id:
              savedInvoice?.invoice_id ||
              data?.invoice_id ||
              data?.id ||
              null,
            target_role: "super_admin",
            created_by: authUser?.user_id || authUser?.id,
            created_by_name: creatorName,
          });
        } catch (err) {
          console.warn("Could not dispatch pending invoice notification:", err);
        }
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setErrorMessage(err?.message || "Failed to save invoice.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    if (!canDownloadPdf) return;
    if (!validateRequiredFields(true)) {
      return;
    }

    const trimmedNumber = invoiceNumber.trim() || "Invoice";
    const trimmedCust = customerName.trim();
    const validItems = items.filter((it) => it.item_name.trim());

    try {
      setDownloadingPdf(true);
      let activeCompany = companyDetails;
      if (!activeCompany) {
        activeCompany = await getCompanyDetails().catch(() => ({}));
        if (activeCompany) setCompanyDetails(activeCompany);
      }

      const matchedQuotation = selectedQuotationId
        ? quotationsList.find(
          (q) =>
            String(q.quotation_id) === String(selectedQuotationId) ||
            String(q.quotation_number) === String(selectedQuotationId)
        )
        : null;

      const parsedIsoDue = parseDueDateToIso(dueDate);
      const liveInvoiceData = {
        invoice_number: trimmedNumber,
        invoice_date: invoiceDate,
        due_date: parsedIsoDue || dueDate || "",
        currency,
        quotation_number:
          matchedQuotation?.quotation_number || data?.quotation_number || "",
        customer_name: trimmedCust,
        company_name: companyName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        items: validItems.map((it) => ({
          item_name: it.item_name.trim(),
          description: it.description?.trim() || "",
          price: Number(it.price) || 0,
          tax_rate: Number(it.tax_rate) || 0,
          line_total: Number(
            (
              (Number(it.price) || 0) *
              (1 + (Number(it.tax_rate) || 0) / 100)
            ).toFixed(2)
          ),
        })),
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        amount_paid: totalPaidPreview,
        balance_due: remainingBalance,
        status: paymentPreviewStatus,
        payment_method: paymentMethod,
        notes: notes.trim(),
        terms_and_conditions: terms.trim(),
      };

      await downloadInvoicePdf(
        liveInvoiceData,
        activeCompany || {},
        `${trimmedNumber}.pdf`
      );
    } catch (err) {
      console.error("Invoice PDF generation failed:", err);
      setErrorMessage(err?.message || "Could not generate the invoice PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  const formContent = (
    <div
      className={asPage ? "inv-form-page-container" : "inv-modal-container"}
      onClick={asPage ? undefined : (e) => e.stopPropagation()}
      role={asPage ? undefined : "dialog"}
      aria-modal={asPage ? undefined : "true"}
    >
      {/* Header */}
      <div className="inv-modal-header">
        <div className="inv-header-title">
          <div className="inv-header-badge">
            <Receipt size={18} />
          </div>
          <div>
            <h3>{isEditing ? "Edit Invoice" : "Create New Invoice"}</h3>
            <p>Step-by-step business billing &amp; payment tracking</p>
          </div>
        </div>
        <button
          type="button"
          className="inv-modal-close"
          onClick={onClose}
          aria-label="Close"
          title="Close Form"
        >
          <X size={20} />
        </button>
      </div>

      {/* Modal Form Body */}
      <div className="inv-modal-body">
        {errorMessage && (
          <div className="inv-alert-error" role="alert">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Section 1: Customer Selection */}
        <div className="inv-form-section">
          <div className="inv-section-title">
            <User size={15} />
            <span>1. Select Customer</span>
          </div>

          <div
            className="inv-form-field"
            ref={customerSearchRef}
            style={{ position: "relative", marginBottom: "14px" }}
          >
            <label>Select Customer</label>
            <div className="inv-customer-search-wrap">
              <Search size={15} className="inv-customer-search-icon" />
              <input
                type="text"
                className={`inv-input inv-customer-search-input ${fieldErrors.customerName ? "inv-input-error" : ""
                  }`}
                placeholder="Search customer by name or email..."
                value={customerSearchQuery}
                onFocus={() => setCustomerSearchOpen(true)}
                onClick={() => setCustomerSearchOpen(true)}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomerSearchQuery(val);
                  setCustomerSearchOpen(true);
                  if (fieldErrors.customerName) {
                    setFieldErrors((prev) => ({ ...prev, customerName: false }));
                  }
                  const match = customersList.find(
                    (c) =>
                      c.customer_name?.toLowerCase() === val.trim().toLowerCase() ||
                      (c.email && c.email.toLowerCase() === val.trim().toLowerCase())
                  );
                  if (match) {
                    selectCustomerById(match.customer_id);
                  } else if (!val.trim()) {
                    selectCustomerById("");
                  }
                }}
                autoComplete="off"
              />
              <div className="inv-customer-search-actions">
                {customerSearchQuery && (
                  <button
                    type="button"
                    className="inv-customer-search-clear"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCustomerSearchQuery("");
                      selectCustomerById("");
                      setCustomerSearchOpen(true);
                    }}
                    title="Clear customer selection"
                  >
                    <X size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className="inv-search-toggle-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomerSearchOpen((prev) => !prev);
                  }}
                  title="Toggle customer list"
                >
                  <ChevronDown size={15} className={customerSearchOpen ? "open" : ""} />
                </button>
              </div>

              {customerSearchOpen && (
                <div className="inv-customer-dropdown-menu">
                  {filteredRegisteredCustomers.length > 0 ? (
                    filteredRegisteredCustomers.map((c) => {
                      const isSelected = String(selectedCustomerId) === String(c.customer_id);
                      return (
                        <div
                          key={c.customer_id}
                          className={`inv-customer-dropdown-item ${isSelected ? "selected" : ""}`}
                          onClick={() => {
                            selectCustomerById(c.customer_id);
                            setCustomerSearchQuery(c.customer_name || "");
                            setCustomerSearchOpen(false);
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div className="inv-customer-dropdown-name">
                              {c.customer_name} {c.company_name ? `(${c.company_name})` : ""}
                            </div>
                            {isSelected && (
                              <span style={{ color: "#3b82f6", fontSize: "12px", fontWeight: 700 }}>
                                ✓
                              </span>
                            )}
                          </div>
                          {c.email && (
                            <div className="inv-customer-dropdown-meta">
                              <span>{c.email}</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="inv-customer-dropdown-empty">
                      No customers match your search
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="inv-grid-2">
            <div className="inv-form-field">
              <label>Customer / Contact Name *</label>
              <input
                type="text"
                className={fieldErrors.customerName ? "inv-input-error" : ""}
                placeholder="e.g. Acme Corporation or John Doe"
                value={customerName}
                onChange={(e) => {
                  const newName = e.target.value;
                  setCustomerName(newName);
                  if (fieldErrors.customerName) {
                    setFieldErrors((prev) => ({ ...prev, customerName: false }));
                  }
                  const valTrim = newName.trim().toLowerCase();
                  const emailTrim = (email || "").trim().toLowerCase();
                  const match = customersList.find((c) => {
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
                    setSelectedCustomerId(String(match.customer_id));
                    if (!customerSearchQuery) setCustomerSearchQuery(match.customer_name || "");
                  } else if (selectedCustomerId) {
                    const cur = customersList.find((c) => String(c.customer_id) === String(selectedCustomerId));
                    if (cur && cur.customer_name?.trim().toLowerCase() !== newName.trim().toLowerCase()) {
                      setSelectedCustomerId("");
                    }
                  }
                }}
                required
              />
            </div>

            <div className="inv-form-field">
              <label>Company Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Acme Lanka Pvt Ltd"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            <div className="inv-form-field">
              <label>Email Address *</label>
              <input
                type="email"
                className={fieldErrors.email ? "inv-input-error" : ""}
                placeholder="billing@example.com"
                value={email}
                onChange={(e) => {
                  const newEmail = e.target.value;
                  setEmail(newEmail);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: false }));
                  }
                  const valTrim = (customerName || "").trim().toLowerCase();
                  const emailTrim = newEmail.trim().toLowerCase();
                  const match = customersList.find((c) => {
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
                    setSelectedCustomerId(String(match.customer_id));
                    if (!customerSearchQuery) setCustomerSearchQuery(match.customer_name || "");
                  } else if (selectedCustomerId) {
                    const cur = customersList.find((c) => String(c.customer_id) === String(selectedCustomerId));
                    if (cur && (cur.email || "").trim().toLowerCase() !== emailTrim) {
                      setSelectedCustomerId("");
                    }
                  }
                }}
                required
              />
            </div>

            <div className="inv-form-field">
              <label>Phone Number</label>
              <input
                type="text"
                placeholder="+94 77 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="inv-form-field inv-col-span-2">
              <label>Billing Address</label>
              <input
                type="text"
                placeholder="e.g. No. 45, Galle Road, Colombo 03"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Quotation Reference (Optional) */}
        <div className="inv-form-section">
          <div className="inv-section-title">
            <FileText size={15} />
            <span>2. Select Quotation (Optional)</span>
          </div>

          <div className="inv-form-field">
            <label>Link Approved Quotation</label>
            <select
              value={selectedQuotationId}
              onChange={handleQuotationSelect}
              className="inv-select"
            >
              <option value="">
                -- None (Direct Invoice without Linked Quotation) --
              </option>
              {quotationsList
                .filter((q) => {
                  const role = String(q.created_by_role || "").toLowerCase();
                  const status = String(q.status || "").toLowerCase();
                  const approval = String(q.approval_status || "").toLowerCase();

                  // Must not be draft, rejected, cancelled, expired, or pending approval
                  if (
                    status === "draft" ||
                    status === "rejected" ||
                    status === "cancelled" ||
                    status === "expired" ||
                    approval === "rejected" ||
                    approval === "pending"
                  ) {
                    return false;
                  }

                  // Approved check: must be approved / accepted or created by Super Admin
                  const isApproved =
                    approval === "approved" ||
                    status === "approved" ||
                    status === "accepted" ||
                    role.includes("super");

                  if (!isApproved) {
                    return false;
                  }

                  // If a customer is selected (by ID, Name, or Email), show all approved quotations for this customer
                  const hasSelectedCustomer = Boolean(
                    selectedCustomerId ||
                    customerName?.trim() ||
                    email?.trim()
                  );

                  if (hasSelectedCustomer) {
                    const selectedCust = selectedCustomerId
                      ? customersList.find(
                        (c) =>
                          String(c.customer_id) ===
                          String(selectedCustomerId)
                      )
                      : customersList.find((c) => {
                        const valTrim = (customerName || "").trim().toLowerCase();
                        const emailTrim = (email || "").trim().toLowerCase();
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

                    const targetId = selectedCust
                      ? String(selectedCust.customer_id)
                      : String(selectedCustomerId || "");
                    const targetName = (
                      selectedCust?.customer_name ||
                      customerName ||
                      ""
                    )
                      .trim()
                      .toLowerCase();
                    const targetEmail = (
                      selectedCust?.email ||
                      email ||
                      ""
                    )
                      .trim()
                      .toLowerCase();

                    const qCustId =
                      q.customer_id != null ? String(q.customer_id) : "";
                    const qCustName = (
                      q.customer_name ||
                      q.clientName ||
                      ""
                    )
                      .trim()
                      .toLowerCase();
                    const qCustEmail = (
                      q.email ||
                      q.customer_email ||
                      customersList.find(
                        (c) => String(c.customer_id) === String(q.customer_id)
                      )?.email ||
                      ""
                    )
                      .trim()
                      .toLowerCase();

                    const matchesId = Boolean(
                      targetId && qCustId && qCustId === targetId
                    );
                    const matchesName = Boolean(
                      targetName && qCustName && qCustName === targetName
                    );
                    const matchesEmail = Boolean(
                      targetEmail && qCustEmail && qCustEmail === targetEmail
                    );

                    return matchesId || matchesName || matchesEmail;
                  }

                  return true;
                })
                .map((q) => (
                  <option
                    key={q.quotation_id || q.id}
                    value={q.quotation_id}
                  >
                    {q.quotation_number || `#${q.quotation_id}`} — {q.customer_name || q.clientName} (Total: {currency} {Number(q.total_amount || 0).toLocaleString()})
                  </option>
                ))}
            </select>
            <span className="inv-field-tip">
              Tip: Selecting a quotation automatically imports customer details, service items, and agreed pricing.
            </span>
          </div>
        </div>

        {/* Section 3: Add Items */}
        <div className="inv-form-section">
          <div className="inv-section-title-between">
            <div className="inv-section-title" style={{ margin: 0 }}>
              <Receipt size={15} />
              <span>3. Invoice Items &amp; Services</span>
            </div>
            <button
              type="button"
              className="inv-btn-secondary-sm"
              onClick={handleAddItem}
            >
              <Plus size={14} />
              <span>Add Item</span>
            </button>
          </div>

          <div className="inv-items-table-wrap">
            <table className="inv-items-table">
              <thead>
                <tr>
                  <th style={{ width: "30%" }}>Item / Service *</th>
                  <th style={{ width: "27%" }}>Description / Scope</th>
                  <th style={{ width: "16%" }}>Price ({currency}) *</th>
                  <th style={{ width: "8%" }}>Tax %</th>
                  <th style={{ width: "14%", textAlign: "right" }}>Total ({currency})</th>
                  <th style={{ width: "5%" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        type="text"
                        className={`inv-table-input ${fieldErrors[`item_name_${idx}`] ? "inv-input-error" : ""
                          }`}
                        placeholder="e.g. Web Development"
                        value={item.item_name}
                        onChange={(e) => {
                          handleItemChange(idx, "item_name", e.target.value);
                          if (fieldErrors[`item_name_${idx}`]) {
                            setFieldErrors((prev) => ({
                              ...prev,
                              [`item_name_${idx}`]: false,
                            }));
                          }
                        }}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="inv-table-input"
                        placeholder="Brief description..."
                        value={item.description}
                        onChange={(e) =>
                          handleItemChange(idx, "description", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className={`inv-table-input ${fieldErrors[`price_${idx}`] ? "inv-input-error" : ""
                          }`}
                        placeholder="0.00"
                        value={item.price}
                        onChange={(e) => {
                          handleItemChange(idx, "price", e.target.value);
                          if (fieldErrors[`price_${idx}`]) {
                            setFieldErrors((prev) => ({
                              ...prev,
                              [`price_${idx}`]: false,
                            }));
                          }
                        }}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className="inv-table-input"
                        placeholder="0"
                        value={item.tax_rate}
                        onChange={(e) =>
                          handleItemChange(idx, "tax_rate", e.target.value)
                        }
                      />
                    </td>
                    <td className="inv-table-cell-total">
                      {currency}{" "}
                      {(
                        (Number(item.price) || 0) *
                        (1 + (Number(item.tax_rate) || 0) / 100)
                      ).toLocaleString("en-LK", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        className="inv-btn-icon-danger"
                        title="Remove item"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length === 1}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total & Payment Calculation */}
          <div className="inv-calc-container">
            <div className="inv-calc-left">
              <div className="inv-overview-card">
                <div className="inv-overview-card-head">
                  <Receipt size={14} />
                  <span>Services &amp; Scope Overview</span>
                </div>
                <div className="inv-overview-stats">
                  <div className="inv-overview-stat-pill">
                    <span className="inv-stat-k">Services:</span>
                    <span className="inv-stat-v">
                      {items.length} {items.length === 1 ? "Line Item" : "Line Items"}
                    </span>
                  </div>
                  <div className="inv-overview-stat-pill">
                    <span className="inv-stat-k">Currency:</span>
                    <span className="inv-stat-v">{currency}</span>
                  </div>
                  {selectedQuotationObj && (
                    <div className="inv-overview-stat-pill">
                      <span className="inv-stat-k">Quotation:</span>
                      <span className="inv-stat-v">
                        {selectedQuotationObj.quotation_number || `#${selectedQuotationObj.quotation_id}`}
                      </span>
                    </div>
                  )}
                </div>
                <div className="inv-overview-info-text">
                  {selectedQuotationObj ? (
                    <>
                      <strong>Linked Quotation:</strong> Items and rates are synced with{" "}
                      <strong>{selectedQuotationObj.quotation_number || `#${selectedQuotationObj.quotation_id}`}</strong>.
                      {discountAmount > 0 && (
                        <span className="inv-overview-discount-badge">
                          Includes {currency} {discountAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 })} quotation discount.
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <strong>Direct Invoice Scope:</strong> Line item amounts and tax rates are calculated dynamically into the payment summary.
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="inv-calc-summary">
              <div className="inv-summary-box-head">
                <FileText size={14} />
                <span>Payment &amp; Balance Summary</span>
              </div>
              <div className="inv-calc-row">
                <span>Subtotal:</span>
                <strong>{currency} {subtotal.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</strong>
              </div>
              {taxAmount > 0 && (
                <div className="inv-calc-row">
                  <span>Tax:</span>
                  <strong>+{currency} {taxAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</strong>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="inv-calc-row" style={{ color: "#15803d" }}>
                  <span>Discount:</span>
                  <strong>-{currency} {discountAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</strong>
                </div>
              )}
              <div className="inv-calc-total">
                <span>Grand Total:</span>
                <strong>{currency} {totalAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</strong>
              </div>
              <div className="inv-calc-row inv-calc-paid">
                <span>Paid Amount:</span>
                <strong>
                  -{currency}{" "}
                  {totalPaidPreview.toLocaleString("en-LK", {
                    minimumFractionDigits: 2,
                  })}
                </strong>
              </div>
              <div className="inv-calc-balance">
                <span>Balance Due:</span>
                <strong
                  className={
                    remainingBalance <= 0 && totalAmount > 0
                      ? "settled"
                      : "due"
                  }
                >
                  {currency}{" "}
                  {remainingBalance.toLocaleString("en-LK", {
                    minimumFractionDigits: 2,
                  })}
                </strong>
              </div>
              <div className="inv-calc-status-row">
                <span>Payment Status:</span>
                <span
                  className={`inv-calc-status-pill ${paymentPreviewStatus
                    .toLowerCase()
                    .replace(/\s+/g, "-")}`}
                >
                  {paymentPreviewStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Invoice Details (Dates, Currency, Notes, Terms) */}
        <div className="inv-form-section">
          <div className="inv-section-title">
            <Calendar size={15} />
            <span>4. Set Invoice Details &amp; Notes</span>
          </div>

          <div className="inv-grid-3">
            <div className="inv-form-field">
              <label>Invoice Number *</label>
              <input
                type="text"
                className={fieldErrors.invoiceNumber ? "inv-input-error" : ""}
                value={invoiceNumber}
                onChange={(e) => {
                  isManualInvoiceNumber.current = true;
                  setInvoiceNumber(e.target.value);
                  if (fieldErrors.invoiceNumber) {
                    setFieldErrors((prev) => ({ ...prev, invoiceNumber: false }));
                  }
                }}
                required
              />
            </div>

            <div className="inv-form-field">
              <label>Invoice Date *</label>
              <input
                type="date"
                className={fieldErrors.invoiceDate ? "inv-input-error" : ""}
                value={invoiceDate}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setInvoiceDate(nextDate);
                  if (fieldErrors.dueDate) {
                    setFieldErrors((prev) => ({ ...prev, invoiceDate: false, dueDate: false }));
                  } else if (fieldErrors.invoiceDate) {
                    setFieldErrors((prev) => ({ ...prev, invoiceDate: false }));
                  }
                  if (
                    !isEditing &&
                    !selectedQuotationId &&
                    !isManualInvoiceNumber.current
                  ) {
                    setInvoiceNumber(
                      getNextInvoiceNumber(invoicesList, nextDate, defaultPrefix)
                    );
                  }
                }}
                required
              />
            </div>

            <div className="inv-form-field">
              <label htmlFor="inv-due-date-input">Due Date *</label>
              <div className="inv-date-input-wrap">
                <input
                  id="inv-due-date-input"
                  type="text"
                  className={fieldErrors.dueDate ? "inv-input-error" : ""}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="mm/dd/yyyy"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate((prev) => formatDueDateInput(e.target.value, prev));
                    if (fieldErrors.dueDate) {
                      setFieldErrors((prev) => ({ ...prev, dueDate: false }));
                    }
                  }}
                  required
                />
                <input
                  ref={dueDatePickerRef}
                  type="date"
                  className="inv-date-picker-hidden"
                  value={parseDueDateToIso(dueDate) || ""}
                  min={invoiceDate ? (() => {
                    const [y, m, d] = invoiceDate.split("-").map(Number);
                    const dt = new Date(Date.UTC(y, m - 1, d + 1));
                    return dt.toISOString().slice(0, 10);
                  })() : undefined}
                  onChange={(e) =>
                    setDueDate(toDisplayMmDdYyyy(e.target.value))
                  }
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className="inv-date-picker-btn"
                  onClick={() => {
                    if (dueDatePickerRef.current?.showPicker) {
                      dueDatePickerRef.current.showPicker();
                    } else {
                      dueDatePickerRef.current?.click();
                    }
                  }}
                  title="Pick date from calendar"
                  aria-label="Pick due date from calendar"
                >
                  <Calendar size={14} />
                </button>
              </div>
            </div>

            <div className="inv-form-field">
              <label>Billing Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="inv-select"
              >
                <option value="LKR">LKR (Sri Lankan Rupee)</option>
                <option value="USD">USD (US Dollar)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="GBP">GBP (British Pound)</option>
              </select>
            </div>

            <div className="inv-form-field inv-col-span-2">
              <label>Payment / Bank Notes</label>
              <input
                type="text"
                placeholder="e.g. Bank: Commercial Bank, Acc: 12345678, Branch: Kollupitiya"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="inv-form-field inv-col-span-3">
              <label>Terms &amp; Conditions</label>
              <textarea
                rows={2}
                placeholder="e.g. Invoices are payable within 14 calendar days..."
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal Footer Actions */}
      <div className="inv-modal-footer">
        <button
          type="button"
          className="inv-btn-secondary"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>

        <div className="inv-footer-right-actions">
          <button
            type="button"
            className="inv-btn-pdf"
            onClick={handleDownloadPdf}
            disabled={saving || downloadingPdf || !canDownloadPdf}
            title={
              !canDownloadPdf
                ? "Available after Super Admin approval"
                : "Download Invoice PDF"
            }
            style={
              !canDownloadPdf
                ? { opacity: 0.5, cursor: "not-allowed" }
                : undefined
            }
          >
            <Download size={15} />
            <span>
              {downloadingPdf ? "Generating PDF..." : "Download PDF"}
            </span>
          </button>

          <button
            type="button"
            className="inv-btn-outline"
            disabled={saving}
            onClick={() => handleSubmit("Draft")}
          >
            <Save size={15} />
            <span>{saving ? "Saving..." : "Save as Draft"}</span>
          </button>

          {isSuperAdmin ? (
            <button
              type="button"
              className="inv-btn-primary"
              disabled={saving}
              onClick={() => handleSubmit("Unpaid")}
            >
              <CheckCircle2 size={15} />
              <span>{saving ? "Finalizing..." : "Finalize Invoice"}</span>
            </button>
          ) : (
            <button
              type="button"
              className="inv-btn-primary"
              disabled={saving}
              onClick={() => handleSubmit("Pending Approval")}
            >
              <Send size={15} />
              <span>
                {saving
                  ? "Submitting..."
                  : data?.status === "Rejected"
                    ? "Resubmit for Approval"
                    : "Submit for Approval"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (asPage) {
    return (
      <div className="inv-form-page">
        <div className="inv-form-page-layout">
          <div className="inv-form-page-side-left">
            <button
              type="button"
              className="inv-screen-back-btn"
              onClick={onClose}
              aria-label="Back to Invoices"
              title="Back to Invoices"
            >
              <ArrowLeft size={20} />
            </button>
          </div>
          {formContent}
          <div className="inv-form-page-side-right" aria-hidden="true" />
        </div>
      </div>
    );
  }

  return (
    <div className="inv-modal-overlay" onClick={onClose}>
      {formContent}
    </div>
  );
}

