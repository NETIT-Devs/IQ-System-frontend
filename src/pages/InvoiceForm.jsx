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

  // Registered customers, quotations & invoices for dropdown / sequence calculation
  const [customersList, setCustomersList] = useState([]);
  const [quotationsList, setQuotationsList] = useState([]);
  const [invoicesList, setInvoicesList] = useState([]);
  const [loadingLookups, setLoadingLookLookups] = useState(false);
  const isManualInvoiceNumber = useRef(Boolean(data?.invoice_number));

  const defaultInvoiceDate =
    initialData?.invoice_date || new Date().toISOString().slice(0, 10);

  // Form states
  const [invoiceNumber, setInvoiceNumber] = useState(
    data?.invoice_number ||
      (data?.quotation_number
        ? toInvoiceNumberFromQuotation(data.quotation_number)
        : "") ||
      getNextInvoiceNumber([], defaultInvoiceDate)
  );
  const [selectedCustomerMode, setSelectedCustomerMode] = useState("existing"); // "existing" | "new"
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    data?.customer_id ? String(data.customer_id) : ""
  );

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
  const [dueDate, setDueDate] = useState(
    data?.due_date ? toDisplayMmDdYyyy(data.due_date) : ""
  );
  const dueDatePickerRef = useRef(null);
  const [currency, setCurrency] = useState(data?.currency || "LKR");

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
      "Please deposit payments into our registered commercial account and email payment slips to accounts@company.lk."
  );
  const [terms, setTerms] = useState(
    data?.terms_and_conditions ||
      "Payment is strictly due within 14 calendar days of issuance.\nOverdue accounts may be subject to interest."
  );

  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [companyDetails, setCompanyDetails] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Load registered customers, quotations, existing invoices, and company branding
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingLookLookups(true);
        const [cList, qList, invList, compDetails] = await Promise.all([
          getAllRegisteredCustomers().catch(() => []),
          getQuotations().catch(() => []),
          getInvoices().catch(() => []),
          getCompanyDetails().catch(() => null),
        ]);
        const normalizedInvoices = Array.isArray(invList) ? invList : [];
        setCustomersList(Array.isArray(cList) ? cList : []);
        setQuotationsList(Array.isArray(qList) ? qList : []);
        setInvoicesList(normalizedInvoices);
        if (compDetails) setCompanyDetails(compDetails);
        if (!isEditing && !selectedQuotationId && !isManualInvoiceNumber.current) {
          setInvoiceNumber(
            getNextInvoiceNumber(normalizedInvoices, invoiceDate)
          );
        }
      } finally {
        setLoadingLookLookups(false);
      }
    }
    loadData();
  }, []);

  // When selecting an existing customer, auto-fill contact fields
  function handleCustomerSelect(e) {
    const custId = e.target.value;
    setSelectedCustomerId(custId);

    if (!custId) return;
    const found = customersList.find((c) => String(c.customer_id) === String(custId));
    if (found) {
      setCustomerName(found.customer_name || "");
      setCompanyName(found.company_name || "");
      setEmail(found.email || "");
      setPhone(found.phone || "");
      setAddress(found.address || "");
    }
  }

  // When selecting a quotation, auto-populate customer, items, and details
  function handleQuotationSelect(e) {
    const qVal = e.target.value;
    setSelectedQuotationId(qVal);

    if (!qVal) {
      if (!isEditing) {
        isManualInvoiceNumber.current = false;
        setInvoiceNumber(getNextInvoiceNumber(invoicesList, invoiceDate));
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

  // Submit Invoice (Draft or Unpaid/Issued)
  async function handleSubmit(saveStatus) {
    setErrorMessage("");

    if (
      paymentAmount !== "" &&
      (!Number.isFinite(Number(paymentAmount)) || Number(paymentAmount) < 0)
    ) {
      setErrorMessage("Please enter a valid payment amount.");
      return;
    }

    if (paymentExceedsBalance) {
      setErrorMessage(
        `Payment amount cannot exceed remaining balance (${currency} ${maxPayableAmount.toLocaleString(
          "en-LK",
          { minimumFractionDigits: 2 }
        )}).`
      );
      return;
    }

    if (validPaymentAmount > 0 && saveStatus === "Draft") {
      setErrorMessage(
        "Immediate payment cannot be saved with a Draft invoice. Clear the payment amount to save as Draft."
      );
      return;
    }

    const hasQuotation = Boolean(selectedQuotationId);
    const trimmedNumber = invoiceNumber.trim();
    const trimmedCust = customerName.trim();
    const isoDueDate = parseDueDateToIso(dueDate);
    const validItems = items.filter((it) => it.item_name.trim());

    if (!trimmedNumber) {
      setErrorMessage("Invoice number is required.");
      return;
    }

    if (!invoiceDate) {
      setErrorMessage("Invoice date is required.");
      return;
    }

    if (!isoDueDate) {
      setErrorMessage("Please enter a valid Due Date in mm/dd/yyyy format.");
      return;
    }

    if (!trimmedCust && !hasQuotation) {
      setErrorMessage("Customer name is required.");
      return;
    }

    if (validItems.length === 0 && !hasQuotation) {
      setErrorMessage("Please enter at least one invoice item with a name and price.");
      return;
    }

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

      const payload = {
        invoice_number: trimmedNumber,
        quotation_id: selectedQuotationId ? Number(selectedQuotationId) : null,
        customer_id: selectedCustomerId ? Number(selectedCustomerId) : null,
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
    setErrorMessage("");

    const trimmedNumber = invoiceNumber.trim() || "Invoice";
    const trimmedCust = customerName.trim();
    const validItems = items.filter((it) => it.item_name.trim());

    if (!trimmedCust && !selectedQuotationId) {
      setErrorMessage("Please enter a customer name before downloading PDF.");
      return;
    }

    if (validItems.length === 0 && !selectedQuotationId) {
      setErrorMessage("Please enter at least one invoice item before downloading PDF.");
      return;
    }

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
        {!asPage && (
          <button
            type="button"
            className="inv-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        )}
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

            <div className="inv-radio-group">
              <label className="inv-radio-label">
                <input
                  type="radio"
                  name="custMode"
                  value="existing"
                  checked={selectedCustomerMode === "existing"}
                  onChange={() => setSelectedCustomerMode("existing")}
                />
                <span>Select Registered Customer</span>
              </label>

              <label className="inv-radio-label">
                <input
                  type="radio"
                  name="custMode"
                  value="new"
                  checked={selectedCustomerMode === "new"}
                  onChange={() => {
                    setSelectedCustomerMode("new");
                    setSelectedCustomerId("");
                  }}
                />
                <span>Enter New Client Details</span>
              </label>
            </div>

            {selectedCustomerMode === "existing" && (
              <div className="inv-form-field" style={{ marginBottom: "14px" }}>
                <label>Registered Customer *</label>
                <select
                  value={selectedCustomerId}
                  onChange={handleCustomerSelect}
                  className="inv-select"
                >
                  <option value="">-- Choose a registered customer --</option>
                  {customersList.map((c) => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.customer_name} {c.company_name ? `(${c.company_name})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="inv-grid-2">
              <div className="inv-form-field">
                <label>Customer / Contact Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corporation or John Doe"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
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
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="billing@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                    if (role.includes("super") || q.created_by === 2) {
                      return status !== "draft" && status !== "rejected" && status !== "cancelled" && approval !== "rejected";
                    }
                    return approval === "approved" || status === "approved" || status === "accepted";
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
                    <th style={{ width: "35%" }}>Item / Service *</th>
                    <th style={{ width: "32%" }}>Description / Scope</th>
                    <th style={{ width: "18%" }}>Price ({currency}) *</th>
                    <th style={{ width: "10%" }}>Tax %</th>
                    <th style={{ width: "5%" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="text"
                          className="inv-table-input"
                          placeholder="e.g. Web Development"
                          value={item.item_name}
                          onChange={(e) =>
                            handleItemChange(idx, "item_name", e.target.value)
                          }
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
                          className="inv-table-input"
                          placeholder="0.00"
                          value={item.price}
                          onChange={(e) =>
                            handleItemChange(idx, "price", e.target.value)
                          }
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
                <div className="inv-payment-box">
                  <div className="inv-payment-box-head">
                    <CreditCard size={14} />
                    <span>Payment Details (Optional)</span>
                  </div>

                  <div className="inv-discount-row">
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="inv-select inv-discount-select"
                      aria-label="Payment method"
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Card">Card</option>
                      <option value="Cash">Cash</option>
                      <option value="Online">Online</option>
                      <option value="Other">Other</option>
                    </select>

                    <div className="inv-discount-input-wrap">
                      <input
                        id="inv-payment-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="inv-input inv-discount-input"
                        aria-label="Payment amount"
                      />
                      <span className="inv-discount-unit" aria-hidden="true">
                        {currency}
                      </span>
                    </div>
                  </div>

                  <div className="inv-slip-upload-row">
                    <input
                      ref={paymentSlipInputRef}
                      id="inv-form-slip-input"
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.gif,.pdf"
                      onChange={handlePaymentSlipChange}
                      className="inv-slip-file-hidden"
                    />
                    <label
                      htmlFor="inv-form-slip-input"
                      className="inv-slip-upload-btn"
                    >
                      <Upload size={13} />
                      <span>
                        {paymentSlipFile
                          ? "Change Slip"
                          : "Attach Slip (Optional)"}
                      </span>
                    </label>

                    {paymentSlipFile && (
                      <div className="inv-slip-chip">
                        <Paperclip size={12} />
                        <span title={paymentSlipFile.name}>
                          {paymentSlipFile.name}
                        </span>
                        <button
                          type="button"
                          className="inv-slip-clear-btn"
                          onClick={handleClearPaymentSlip}
                          title="Remove slip"
                          aria-label="Remove payment slip"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="inv-calc-summary">
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
                  value={invoiceNumber}
                  onChange={(e) => {
                    isManualInvoiceNumber.current = true;
                    setInvoiceNumber(e.target.value);
                  }}
                  required
                />
              </div>

              <div className="inv-form-field">
                <label>Invoice Date *</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setInvoiceDate(nextDate);
                    if (
                      !isEditing &&
                      !selectedQuotationId &&
                      !isManualInvoiceNumber.current
                    ) {
                      setInvoiceNumber(
                        getNextInvoiceNumber(invoicesList, nextDate)
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
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="mm/dd/yyyy"
                    value={dueDate}
                    onChange={(e) =>
                      setDueDate((prev) => formatDueDateInput(e.target.value, prev))
                    }
                    required
                  />
                  <input
                    ref={dueDatePickerRef}
                    type="date"
                    className="inv-date-picker-hidden"
                    value={parseDueDateToIso(dueDate) || ""}
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
              disabled={saving || downloadingPdf}
              title="Download Invoice PDF"
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
        <button
          type="button"
          className="inv-screen-back-btn"
          onClick={onClose}
          aria-label="Back to Invoices"
          title="Back to Invoices"
        >
          <ArrowLeft size={20} />
        </button>
        {formContent}
      </div>
    );
  }

  return (
    <div className="inv-modal-overlay" onClick={onClose}>
      {formContent}
    </div>
  );
}

