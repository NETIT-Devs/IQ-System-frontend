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

function normalizePhoneNumber(phone) {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "");
}

function isPhoneMatch(phone1, phone2) {
  const p1 = String(phone1 || "").trim();
  const p2 = String(phone2 || "").trim();
  if (!p1 || !p2) return false;
  if (p1.toLowerCase() === p2.toLowerCase()) return true;

  const d1 = normalizePhoneNumber(p1);
  const d2 = normalizePhoneNumber(p2);
  if (!d1 || !d2) return false;
  if (d1 === d2) return true;

  if (d1.endsWith(d2) || d2.endsWith(d1)) return true;

  const minLen = Math.min(d1.length, d2.length);
  if (minLen >= 3 && (d1.startsWith(d2) || d2.startsWith(d1))) {
    return true;
  }

  if (minLen >= 4) {
    if (minLen >= 9 && d1.slice(-9) === d2.slice(-9)) return true;
    if (minLen >= 7 && d1.slice(-7) === d2.slice(-7)) return true;
  }

  return false;
}

function extractQuotationAdvancePrice(q) {
  if (!q) return 0;
  // 1. Direct advance fields on quotation object
  const direct = Number(
    q.advance_price ??
    q.advance_amount ??
    q.advancePrice ??
    q.advanceAmount ??
    0
  );
  if (Number.isFinite(direct) && direct > 0) return direct;

  // 2. Check local storage records (iq_quotation_advances or iq_quotations)
  try {
    const rawAdvances = localStorage.getItem("iq_quotation_advances");
    if (rawAdvances) {
      const advMap = JSON.parse(rawAdvances);
      const val = Number(
        advMap[String(q.quotation_id)] ??
        advMap[String(q.quotation_number)] ??
        0
      );
      if (Number.isFinite(val) && val > 0) return val;
    }
    const rawQuotations = localStorage.getItem("iq_quotations");
    if (rawQuotations) {
      const qList = JSON.parse(rawQuotations);
      const found = qList.find(
        (item) =>
          String(item.quotation_id) === String(q.quotation_id) ||
          String(item.quotation_number) === String(q.quotation_number)
      );
      if (found) {
        const foundVal = Number(found.advance_price ?? found.advance_amount ?? 0);
        if (Number.isFinite(foundVal) && foundVal > 0) return foundVal;
      }
    }
  } catch {
    // ignore
  }

  // 3. Check payments associated with quotation
  if (Array.isArray(q.payments) && q.payments.length > 0) {
    const pSum = q.payments
      .filter((p) => String(p.status || "").toLowerCase() !== "rejected")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    if (pSum > 0) return pSum;
  }

  // 4. Check notes / terms / description for advance payment
  const texts = [q.notes, q.terms_and_conditions].filter(Boolean).join(" ");
  const match = texts.match(/advance(?:\s+payment)?(?:\s*price)?(?:\s*[:=-])?\s*(?:[A-Z]{3}\s*)?([0-9,]+(?:\.[0-9]{1,2})?)/i);
  if (match && match[1]) {
    const v = Number(match[1].replace(/,/g, ""));
    if (Number.isFinite(v) && v > 0) return v;
  }

  return 0;
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
      ? toInvoiceNumberFromQuotation(data.quotation_number, defaultPrefix)
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
      const phone = (c.phone || "").toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        company.includes(q) ||
        phone.includes(q) ||
        isPhoneMatch(c.phone, q)
      );
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
  const [paymentMethod, setPaymentMethod] = useState(data?.payment_method || "Bank Transfer");

  // Notes & terms
  const [notes, setNotes] = useState(() => {
    if (data?.notes) {
      const trimmed = String(data.notes).trim();
      if (
        !trimmed.toLowerCase().includes("please deposit payments into our registered commercial") &&
        !trimmed.toLowerCase().includes("accounts@company.lk")
      ) {
        return trimmed;
      }
    }
    if (savedInvSettings?.default_notes) {
      return savedInvSettings.default_notes;
    }
    try {
      const rawBrand = localStorage.getItem("company_branding");
      if (rawBrand) {
        const brand = JSON.parse(rawBrand);
        if (brand?.bank_name) {
          return `Please remit payment via bank transfer to ${brand.bank_name} (A/C: ${brand.bank_account_number || "—"}, Beneficiary: ${brand.bank_account_name || brand.company_name || "—"}). Reference the invoice number on your payment slip.`;
        }
      }
    } catch {}
    return "";
  });
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

  function scrollToTop() {
    setTimeout(() => {
      const errorEl = document.querySelector(".inv-alert-error");
      if (errorEl) {
        errorEl.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      const modalBody = document.querySelector(".inv-modal-body");
      if (modalBody) {
        modalBody.scrollTo({ top: 0, behavior: "smooth" });
      }
      const modalOverlay = document.querySelector(".inv-modal-overlay");
      if (modalOverlay) {
        modalOverlay.scrollTo({ top: 0, behavior: "smooth" });
      }
      const pageContainer = document.querySelector(".inv-form-page-container");
      if (pageContainer) {
        pageContainer.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  }

  useEffect(() => {
    if (errorMessage) {
      scrollToTop();
    }
  }, [errorMessage]);

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
        let normalizedQuotations = Array.isArray(qList) ? [...qList] : [];
        try {
          const localRaw = localStorage.getItem("iq_quotations");
          if (localRaw) {
            const localQ = JSON.parse(localRaw);
            if (Array.isArray(localQ)) {
              const existingIds = new Set(
                normalizedQuotations.map((q) => String(q.quotation_id || q.id))
              );
              localQ.forEach((lq) => {
                if (
                  lq &&
                  (lq.quotation_id || lq.id) &&
                  !existingIds.has(String(lq.quotation_id || lq.id))
                ) {
                  normalizedQuotations.push(lq);
                }
              });
            }
          }
        } catch {
          // ignore
        }
        setQuotationsList(normalizedQuotations);
        if (compDetails) {
          setCompanyDetails(compDetails);
          setNotes((prevNotes) => {
            const trimmed = String(prevNotes || "").trim();
            if (
              !trimmed ||
              trimmed.toLowerCase().includes("please deposit payments into our registered commercial") ||
              trimmed.toLowerCase().includes("accounts@company.lk")
            ) {
              if (compDetails.bank_name) {
                return `Please remit payment via bank transfer to ${compDetails.bank_name} (A/C: ${compDetails.bank_account_number || "—"}, Beneficiary: ${compDetails.bank_account_name || compDetails.company_name || "—"}). Reference the invoice number on your payment slip.`;
              }
            }
            return prevNotes;
          });
        }

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
        setPaymentAmount("");
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

      // Auto-populate items from quotation according to Quotation structure
      if (Array.isArray(foundQ.items) && foundQ.items.length > 0) {
        setItems(
          foundQ.items.map((it) => {
            const unitPrice = Number(it.Price ?? it.unit_price ?? it.price ?? 0);
            return {
              id: Math.random(),
              item_name: it.item_name || it.service_name || it.name || "",
              description: it.description || "",
              price: unitPrice > 0 ? unitPrice : "",
              tax_rate: Number(it.tax_rate ?? 0),
            };
          })
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
  const totalPaidPreview = Number(
    Math.min(existingPaid, totalAmount).toFixed(2)
  );
  const remainingBalance = Math.max(
    0,
    Number((totalAmount - totalPaidPreview).toFixed(2))
  );

  const paymentPreviewStatus =
    totalAmount > 0 && remainingBalance <= 0
      ? "Paid"
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
    const trimmedPhone = (phone || "").trim();
    const isoDueDate = parseDueDateToIso(dueDate);

    if (!trimmedPhone) {
      errors.phone = true;
      if (!firstErrorMsg) firstErrorMsg = "Phone number is required.";
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
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
    } else if (Array.isArray(invoicesList)) {
      const currentId = data?.invoice_id || data?.id;
      const isDuplicate = invoicesList.some((inv) => {
        const invId = inv.invoice_id || inv.id;
        if (currentId && String(invId) === String(currentId)) return false;
        return (
          String(inv.invoice_number || "").trim().toLowerCase() ===
          trimmedNumber.toLowerCase()
        );
      });
      if (isDuplicate) {
        errors.invoiceNumber = true;
        if (!firstErrorMsg) {
          firstErrorMsg = `Invoice number "${trimmedNumber}" already exists. Please choose a different invoice number.`;
        }
      }
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



    setFieldErrors(errors);

    if (firstErrorMsg) {
      setErrorMessage(firstErrorMsg);
      scrollToTop();
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

    const hasQuotation = Boolean(selectedQuotationId);
    const trimmedNumber = invoiceNumber.trim();
    const trimmedCust = customerName.trim();
    const isoDueDate = parseDueDateToIso(dueDate);
    const validItems = items.filter((it) => it.item_name.trim());

    try {
      setSaving(true);

      const resolvedStatus =
        saveStatus === "Draft"
          ? "Draft"
          : saveStatus === "Pending Approval"
            ? "Pending Approval"
            : data?.status || (isSuperAdmin ? "Unpaid" : "Pending Approval");

      const resolvedApprovalStatus =
        resolvedStatus === "Pending Approval"
          ? "Pending"
          : resolvedStatus === "Draft"
            ? "Not Required"
            : resolvedStatus === "Rejected"
              ? "Rejected"
              : "Approved";

      let effectiveCustId = selectedCustomerId ? Number(selectedCustomerId) : null;
      const emailTrim = (email || "").trim().toLowerCase();
      const phoneTrim = (phone || "").trim();
      const valTrim = trimmedCust.toLowerCase();

      // Auto-identify customer by email, phone, or name if not explicitly selected
      if (!effectiveCustId) {
        let found = null;
        if (emailTrim) {
          found = customersList.find((c) => (c.email || "").trim().toLowerCase() === emailTrim);
        }
        if (!found && phoneTrim) {
          found = customersList.find((c) => isPhoneMatch(c.phone, phoneTrim));
        }
        if (!found && valTrim) {
          found = customersList.find((c) => (c.customer_name || "").trim().toLowerCase() === valTrim);
        }
        if (found && found.customer_id) {
          effectiveCustId = Number(found.customer_id);
        }
      }

      // Update customer row details in local storage so Customers page reflects changes immediately
      if (effectiveCustId) {
        try {
          const rawEdits = localStorage.getItem("iq_customer_edits_v1");
          const curEdits = rawEdits ? JSON.parse(rawEdits) : {};
          const prevCust = customersList.find((c) => Number(c.customer_id) === Number(effectiveCustId)) || {};
          const prevEdit = curEdits[effectiveCustId] || {};
          const updatedRecord = {
            customer_name: trimmedCust || prevEdit.customer_name || prevCust.customer_name || phoneTrim || emailTrim || "Customer",
            company_name: companyName.trim() || prevEdit.company_name || prevCust.company_name || "",
            email: email.trim() || prevEdit.email || prevCust.email || "",
            phone: phoneTrim || prevEdit.phone || prevCust.phone || "",
            address: address.trim() || prevEdit.address || prevCust.address || "",
            city: prevEdit.city || prevCust.city || "",
            notes: prevEdit.notes || prevCust.notes || "",
            status: prevEdit.status || prevCust.status || "Active",
          };
          curEdits[effectiveCustId] = updatedRecord;
          localStorage.setItem("iq_customer_edits_v1", JSON.stringify(curEdits));
        } catch {
          // ignore
        }
      }

      const resolvedCustName =
        trimmedCust ||
        (effectiveCustId ? customersList.find((c) => Number(c.customer_id) === Number(effectiveCustId))?.customer_name : "") ||
        phoneTrim ||
        email.trim() ||
        "Client";

      const payload = {
        invoice_number: trimmedNumber,
        quotation_id: selectedQuotationId ? Number(selectedQuotationId) : null,
        customer_id: effectiveCustId,
        customer_name: resolvedCustName,
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
        advance_price: 0,
        advance_amount: 0,
        amount_paid: totalPaidPreview,
        balance_due: remainingBalance,
        notes: notes.trim(),
        terms_and_conditions: terms.trim(),
        items: validItems.map((it) => ({
          item_name: it.item_name.trim(),
          description: it.description?.trim() || "",
          price: Number(it.price) || 0,
          unit_price: Number(it.price) || 0,
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
      scrollToTop();
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
      try {
        const freshCompany = await getCompanyDetails().catch(() => null);
        if (freshCompany) {
          activeCompany = freshCompany;
          setCompanyDetails(freshCompany);
        }
      } catch {}

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
        customer_name: trimmedCust || phone.trim() || email.trim() || "Client",
        company_name: companyName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        items: validItems.map((it) => ({
          item_name: it.item_name.trim(),
          description: it.description?.trim() || "",
          price: Number(it.price) || 0,
          unit_price: Number(it.price) || 0,
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
        advance_price: 0,
        advance_amount: 0,
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
      scrollToTop();
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
            <span>1. Client Information</span>
          </div>

          <div className="inv-grid-2">
            <div className="inv-form-field">
              <label>Client Name</label>
              <input
                type="text"
                autoComplete="off"
                className={fieldErrors.customerName ? "inv-input-error" : ""}
                placeholder="e.g. Acme Corporation or John Doe"
                value={customerName}
                onChange={(e) => {
                  const newName = e.target.value;
                  setCustomerName(newName);
                  if (fieldErrors.customerName) {
                    setFieldErrors((prev) => ({ ...prev, customerName: false }));
                  }
                }}
              />
            </div>

            <div className="inv-form-field">
              <label>Company Name (Optional)</label>
              <input
                type="text"
                autoComplete="off"
                placeholder="e.g. Acme Lanka Pvt Ltd"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            <div className="inv-form-field">
              <label>Email Address</label>
              <input
                type="email"
                autoComplete="off"
                className={fieldErrors.email ? "inv-input-error" : ""}
                placeholder="billing@example.com"
                value={email}
                onChange={(e) => {
                  const newEmail = e.target.value;
                  setEmail(newEmail);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: false }));
                  }
                }}
              />
            </div>

            <div className="inv-form-field">
              <label>
                Contact Number <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                autoComplete="off"
                className={fieldErrors.phone ? "inv-input-error" : ""}
                placeholder="+94 77 123 4567"
                value={phone}
                onChange={(e) => {
                  const newPhone = e.target.value;
                  setPhone(newPhone);
                  if (fieldErrors.phone) {
                    setFieldErrors((prev) => ({ ...prev, phone: false }));
                  }
                }}
                required
              />
            </div>

            <div className="inv-form-field inv-col-span-2">
              <label>Billing Address</label>
              <input
                type="text"
                autoComplete="off"
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
                  const custStatus = String(q.customer_status || "").trim().toLowerCase();

                  // Keep already linked quotation selectable on edit mode
                  if (selectedQuotationId && String(q.quotation_id) === String(selectedQuotationId)) {
                    return true;
                  }

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

                  // 1. Super Admin Approved: must be approved by Super Admin (or created by Super Admin)
                  const isSuperAdminApproved =
                    approval === "approved" ||
                    status === "approved" ||
                    role.includes("super");

                  if (!isSuperAdminApproved) {
                    return false;
                  }

                  // 2. Customer Accepted: customer must have accepted the quotation
                  const isCustomerAccepted =
                    custStatus === "customer accepted" ||
                    custStatus === "accepted";

                  if (!isCustomerAccepted) {
                    return false;
                  }

                  // Match ONLY quotations that belong to the client details entered
                  const typedPhone = (phone || "").trim();
                  const typedEmail = (email || "").trim().toLowerCase();
                  const typedName = (customerName || "").trim().toLowerCase();

                  const qCustId = q.customer_id != null ? String(q.customer_id) : "";
                  const linkedCust = qCustId
                    ? customersList.find((c) => String(c.customer_id) === qCustId)
                    : null;

                  // 1. If contact number is typed, identify client and match their quotation(s)
                  if (typedPhone) {
                    const candidatePhones = [
                      q.phone,
                      q.customer_phone,
                      q.client_phone,
                      q.customer?.phone,
                      q.customer?.customer_phone,
                      linkedCust?.phone,
                      linkedCust?.customer_phone,
                    ].filter(Boolean);

                    const hasDirectPhoneMatch = candidatePhones.some((cp) =>
                      isPhoneMatch(typedPhone, cp)
                    );
                    if (hasDirectPhoneMatch) return true;

                    // Match via registered/known customers with this contact number
                    const matchingCusts = customersList.filter((c) =>
                      isPhoneMatch(typedPhone, c.phone || c.customer_phone)
                    );
                    if (matchingCusts.length > 0) {
                      const matchesCustId =
                        qCustId &&
                        matchingCusts.some((c) => String(c.customer_id) === qCustId);
                      if (matchesCustId) return true;

                      const matchesCustName = matchingCusts.some((c) => {
                        const cName = (c.customer_name || "").trim().toLowerCase();
                        const qName = (
                          q.customer_name ||
                          q.clientName ||
                          q.client_name ||
                          ""
                        )
                          .trim()
                          .toLowerCase();
                        return cName && qName && cName === qName;
                      });
                      if (matchesCustName) return true;

                      const matchesCustEmail = matchingCusts.some((c) => {
                        const cEmail = (c.email || "").trim().toLowerCase();
                        const qEmail = (
                          q.email ||
                          q.customer_email ||
                          q.client_email ||
                          ""
                        )
                          .trim()
                          .toLowerCase();
                        return cEmail && qEmail && cEmail === qEmail;
                      });
                      if (matchesCustEmail) return true;
                    }

                    return false;
                  }

                  // 2. If phone is not entered, but email is entered, match ONLY by exact email
                  if (typedEmail) {
                    const candidateEmails = [
                      q.email,
                      q.customer_email,
                      q.client_email,
                      q.customer?.email,
                      linkedCust?.email,
                    ].filter(Boolean);

                    return candidateEmails.some(
                      (ce) => String(ce).trim().toLowerCase() === typedEmail
                    );
                  }

                  // 3. If phone and email are not entered, but name is entered, match ONLY by exact name
                  if (typedName) {
                    const candidateNames = [
                      q.customer_name,
                      q.clientName,
                      q.client_name,
                      q.customer?.customer_name,
                      linkedCust?.customer_name,
                    ].filter(Boolean);

                    return candidateNames.some(
                      (cn) => String(cn).trim().toLowerCase() === typedName
                    );
                  }

                  // 4. If only selectedCustomerId is set
                  if (selectedCustomerId && qCustId && qCustId === String(selectedCustomerId)) {
                    return true;
                  }

                  // If no client details are entered or none match: show NO other quotations!
                  return false;
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
                  <th style={{ width: "4%", textAlign: "center" }}>#</th>
                  <th style={{ width: "48%" }}>Service / Item *</th>
                  <th style={{ width: "18%" }}>Unit Price ({currency}) *</th>
                  <th style={{ width: "12%" }}>Tax %</th>
                  <th style={{ width: "14%", textAlign: "right" }}>Line Total ({currency})</th>
                  <th style={{ width: "4%" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id}>
                    <td style={{ textAlign: "center", fontWeight: "600", color: "#64748b" }}>
                      {idx + 1}
                    </td>
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
              {/* Services & Scope Overview */}
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
              <div className="inv-calc-row">
                <span>Tax:</span>
                <strong>{currency} {taxAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</strong>
              </div>
              <div className="inv-calc-row" style={{ color: discountAmount > 0 ? "#15803d" : "inherit" }}>
                <span>Discount:</span>
                <strong>
                  {discountAmount > 0 ? `- ` : ""}{currency} {discountAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="inv-calc-total">
                <span>GRAND TOTAL:</span>
                <strong>{currency} {totalAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</strong>
              </div>
              <div className="inv-calc-row inv-calc-paid">
                <span>Paid Amount:</span>
                <strong>
                  - {currency}{" "}
                  {existingPaid.toLocaleString("en-LK", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
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
                    maximumFractionDigits: 2,
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
              <textarea
                rows={2}
                placeholder="e.g. Please remit payment via bank transfer to..."
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

