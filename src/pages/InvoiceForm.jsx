import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { getCustomers } from "../services/quotationService";
import { getQuotations } from "../services/quotationService";
import { createInvoice, updateInvoice } from "../services/invoiceService";
import "./InvoiceForm.css";

function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INV-${year}-${random}`;
}

export default function InvoiceForm({ initialData, invoiceToEdit, isOpen, onClose, onSuccess }) {
  if (!isOpen) return null;

  const data = initialData || invoiceToEdit;
  const isEditing = Boolean(data?.invoice_id || data?.id);

  // Registered customers & quotations for dropdown selection
  const [customersList, setCustomersList] = useState([]);
  const [quotationsList, setQuotationsList] = useState([]);
  const [loadingLookups, setLoadingLookLookups] = useState(false);

  // Form states
  const [invoiceNumber, setInvoiceNumber] = useState(
    data?.invoice_number || generateInvoiceNumber()
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
    data?.due_date ||
      new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  );
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

  // Discounts
  const [discountType, setDiscountType] = useState(
    data?.discount_type || "fixed"
  );
  const [discountValue, setDiscountValue] = useState(
    data?.discount_value ?? (data?.discount_amount || 0)
  );

  // Notes & terms
  const [notes, setNotes] = useState(
    data?.notes ||
      "Please deposit payments into our registered commercial account and email payment slips to accounts@company.lk."
  );
  const [terms, setTerms] = useState(
    data?.terms_and_conditions ||
      "Payment is strictly due within 14 calendar days of issuance. Overdue accounts may be subject to interest."
  );

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Load registered customers and quotations
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingLookLookups(true);
        const [cList, qList] = await Promise.all([
          getCustomers().catch(() => []),
          getQuotations().catch(() => []),
        ]);
        setCustomersList(Array.isArray(cList) ? cList : []);
        setQuotationsList(Array.isArray(qList) ? qList : []);
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

    if (!qVal) return;
    const foundQ = quotationsList.find(
      (q) =>
        String(q.quotation_id) === String(qVal) ||
        String(q.quotation_number) === String(qVal)
    );

    if (foundQ) {
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

  // Financial calculations
  const { subtotal, discountAmount, taxAmount, totalAmount } = useMemo(() => {
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

    let disc = 0;
    const dv = Number(discountValue) || 0;
    if (discountType === "percentage") {
      disc = (sub * Math.min(100, Math.max(0, dv))) / 100;
    } else {
      disc = Math.min(sub, Math.max(0, dv));
    }

    const tot = Math.max(0, sub - disc + tax);

    return {
      subtotal: sub,
      discountAmount: Number(disc.toFixed(2)),
      taxAmount: Number(tax.toFixed(2)),
      totalAmount: Number(tot.toFixed(2)),
    };
  }, [items, discountType, discountValue]);

  // Submit Invoice (Draft or Unpaid/Issued)
  async function handleSubmit(saveStatus) {
    setErrorMessage("");

    const trimmedNumber = invoiceNumber.trim();
    if (!trimmedNumber) {
      setErrorMessage("Invoice number is required.");
      return;
    }

    const trimmedCust = customerName.trim();
    if (!trimmedCust) {
      setErrorMessage("Customer name is required.");
      return;
    }

    const validItems = items.filter((it) => it.item_name.trim());
    if (validItems.length === 0) {
      setErrorMessage("Please enter at least one invoice item with a name and price.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        invoice_number: trimmedNumber,
        quotation_id: selectedQuotationId || null,
        customer_id: selectedCustomerId ? Number(selectedCustomerId) : null,
        customer_name: trimmedCust,
        company_name: companyName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        invoice_date: invoiceDate,
        due_date: dueDate,
        currency: currency,
        status: saveStatus || data?.status || "Draft",
        subtotal: subtotal,
        discount_type: discountType,
        discount_value: Number(discountValue) || 0,
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

      if (isEditing) {
        const id = data.invoice_id || data.id;
        await updateInvoice(id, payload);
      } else {
        await createInvoice(payload);
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setErrorMessage(err?.message || "Failed to save invoice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inv-modal-overlay" onClick={onClose}>
      <div
        className="inv-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
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
                {quotationsList.map((q) => (
                  <option
                    key={q.quotation_id || q.id}
                    value={q.quotation_number || q.quotation_id}
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

            {/* Total & Discount Calculation */}
            <div className="inv-calc-container">
              <div className="inv-calc-left">
                <div className="inv-discount-box">
                  <label>Apply Discount</label>
                  <div className="inv-discount-row">
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                      className="inv-select"
                      style={{ width: "130px" }}
                    >
                      <option value="fixed">Fixed ({currency})</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="inv-input"
                    />
                  </div>
                </div>
              </div>

              <div className="inv-calc-summary">
                <div className="inv-calc-row">
                  <span>Subtotal:</span>
                  <strong>{currency} {subtotal.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</strong>
                </div>
                {discountAmount > 0 && (
                  <div className="inv-calc-row" style={{ color: "#16a34a" }}>
                    <span>Discount ({discountType === "percentage" ? `${discountValue}%` : "Fixed"}):</span>
                    <strong>-{currency} {discountAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</strong>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="inv-calc-row">
                    <span>Tax:</span>
                    <strong>+{currency} {taxAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</strong>
                  </div>
                )}
                <div className="inv-calc-total">
                  <span>Grand Total:</span>
                  <strong>{currency} {totalAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</strong>
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
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  required
                />
              </div>

              <div className="inv-form-field">
                <label>Invoice Date *</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                />
              </div>

              <div className="inv-form-field">
                <label>Due Date *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
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

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="inv-btn-outline"
              disabled={saving}
              onClick={() => handleSubmit("Draft")}
            >
              {saving ? "Saving..." : "Save as Draft"}
            </button>

            <button
              type="button"
              className="inv-btn-primary"
              disabled={saving}
              onClick={() => handleSubmit("Unpaid")}
            >
              {saving ? "Creating..." : isEditing ? "Update Invoice" : "Create & Issue Invoice"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

