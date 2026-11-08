import { useState } from "react";
import {
  X,
  Printer,
  CreditCard,
  Pencil,
  FileText,
  Calendar,
  Building2,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  Receipt,
  Download,
} from "lucide-react";
import { useCompanyBranding } from "../hooks/useCompanyBranding";
import "./InvoiceDetails.css";

function formatCurrency(amount, currency = "LKR") {
  return `${currency} ${(Number(amount) || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(str) {
  if (!str) return "—";
  try {
    const d = new Date(str.includes("T") ? str : `${str}T00:00:00`);
    if (Number.isNaN(d.getTime())) return str;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return str;
  }
}

export default function InvoiceDetails({
  invoice,
  isOpen,
  onClose,
  onEdit,
  onRecordPayment,
}) {
  if (!isOpen || !invoice) return null;

  const { logoUrl, companyName } = useCompanyBranding();

  const invNum = invoice.invoice_number || `INV-${invoice.invoice_id}`;
  const status = invoice.status || "Draft";
  const currency = invoice.currency || "LKR";

  const subtotal = Number(invoice.subtotal) || 0;
  const discountAmount = Number(invoice.discount_amount) || 0;
  const taxAmount = Number(invoice.tax_amount) || 0;
  const totalAmount = Number(invoice.total_amount) || 0;
  const amountPaid = Number(invoice.amount_paid) || 0;
  const balanceDue = Number(invoice.balance_due ?? (totalAmount - amountPaid));

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const payments = Array.isArray(invoice.payments) ? invoice.payments : [];

  function handlePrint() {
    window.print();
  }

  return (
    <div className="inv-view-overlay" onClick={onClose}>
      <div
        className="inv-view-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        {/* Top Action Bar */}
        <div className="inv-view-toolbar no-print">
          <div className="inv-toolbar-left">
            <span className="inv-view-id">{invNum}</span>
            <span className={`inv-status-tag ${status.toLowerCase()}`}>
              {status}
            </span>
          </div>

          <div className="inv-toolbar-right">
            <button
              type="button"
              className="inv-tb-btn"
              onClick={handlePrint}
              title="Print / Save PDF"
            >
              <Printer size={15} />
              <span>Print / PDF</span>
            </button>

            {status !== "Paid" && status !== "Cancelled" && (
              <button
                type="button"
                className="inv-tb-btn primary"
                onClick={() => {
                  onRecordPayment?.(invoice);
                }}
                title="Record payment"
              >
                <CreditCard size={15} />
                <span>Record Payment</span>
              </button>
            )}

            <button
              type="button"
              className="inv-tb-btn"
              onClick={() => {
                onEdit?.(invoice);
              }}
              title="Edit Invoice"
            >
              <Pencil size={15} />
              <span>Edit</span>
            </button>

            <button
              type="button"
              className="inv-tb-close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet */}
        <div className="inv-sheet-body">
          {/* Header */}
          <div className="inv-sheet-header">
            <div className="inv-brand-info">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={companyName || "Logo"}
                  className="inv-sheet-logo"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="inv-sheet-logo-fallback">
                  <Receipt size={24} />
                </div>
              )}
              <div>
                <h2>{companyName || "Invoice & Quotation System"}</h2>
                <p>Official Business Invoice</p>
              </div>
            </div>

            <div className="inv-doc-meta">
              <h1>INVOICE</h1>
              <div className="inv-meta-row">
                <span>Invoice No:</span>
                <strong>{invNum}</strong>
              </div>
              <div className="inv-meta-row">
                <span>Date Issued:</span>
                <strong>{formatDate(invoice.invoice_date)}</strong>
              </div>
              <div className="inv-meta-row">
                <span>Payment Due:</span>
                <strong style={{ color: balanceDue > 0 ? "#dc2626" : "#16a34a" }}>
                  {formatDate(invoice.due_date)}
                </strong>
              </div>
              {invoice.quotation_id && (
                <div className="inv-meta-row">
                  <span>Quotation Ref:</span>
                  <strong>{invoice.quotation_id}</strong>
                </div>
              )}
            </div>
          </div>

          <div className="inv-sheet-divider" />

          {/* Customer & Billing Info */}
          <div className="inv-parties-grid">
            <div className="inv-party-col">
              <h4>BILLED TO:</h4>
              <p className="inv-party-name">{invoice.customer_name || "—"}</p>
              {invoice.company_name && (
                <p className="inv-party-line">
                  <Building2 size={13} /> {invoice.company_name}
                </p>
              )}
              {invoice.email && (
                <p className="inv-party-line">
                  <Mail size={13} /> {invoice.email}
                </p>
              )}
              {invoice.phone && (
                <p className="inv-party-line">
                  <Phone size={13} /> {invoice.phone}
                </p>
              )}
              {invoice.address && (
                <p className="inv-party-line">
                  <MapPin size={13} /> {invoice.address}
                </p>
              )}
            </div>

            <div className="inv-party-col inv-status-box">
              <h4>PAYMENT SUMMARY</h4>
              <div className="inv-sum-box-row">
                <span>Total Amount:</span>
                <strong>{formatCurrency(totalAmount, currency)}</strong>
              </div>
              <div className="inv-sum-box-row" style={{ color: "#16a34a" }}>
                <span>Amount Paid:</span>
                <strong>{formatCurrency(amountPaid, currency)}</strong>
              </div>
              <div className="inv-sum-box-row total">
                <span>Balance Due:</span>
                <strong style={{ color: balanceDue > 0 ? "#dc2626" : "#16a34a" }}>
                  {formatCurrency(balanceDue, currency)}
                </strong>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="inv-sheet-table-wrap">
            <table className="inv-sheet-table">
              <thead>
                <tr>
                  <th style={{ width: "5%" }}>#</th>
                  <th style={{ width: "45%" }}>Item Description &amp; Scope</th>
                  <th style={{ width: "15%", textAlign: "right" }}>Unit Price</th>
                  <th style={{ width: "15%", textAlign: "center" }}>Tax</th>
                  <th style={{ width: "20%", textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "20px" }}>
                      No items listed on this invoice.
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => {
                    const price = Number(it.price) || 0;
                    const taxRate = Number(it.tax_rate) || 0;
                    const lineTot = Number(it.line_total) || price * (1 + taxRate / 100);
                    return (
                      <tr key={it.invoice_item_id || idx}>
                        <td style={{ color: "#94a3b8" }}>{idx + 1}</td>
                        <td>
                          <strong>{it.item_name}</strong>
                          {it.description && <p className="inv-it-desc">{it.description}</p>}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {formatCurrency(price, currency)}
                        </td>
                        <td style={{ textAlign: "center", color: "#64748b" }}>
                          {taxRate > 0 ? `${taxRate}%` : "—"}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {formatCurrency(lineTot, currency)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Calculations Footer */}
          <div className="inv-sheet-bottom">
            <div className="inv-sheet-notes">
              {invoice.notes && (
                <div className="inv-note-block">
                  <strong>Notes &amp; Payment Instructions:</strong>
                  <p>{invoice.notes}</p>
                </div>
              )}
              {invoice.terms_and_conditions && (
                <div className="inv-note-block">
                  <strong>Terms &amp; Conditions:</strong>
                  <p>{invoice.terms_and_conditions}</p>
                </div>
              )}
            </div>

            <div className="inv-sheet-totals">
              <div className="inv-total-line">
                <span>Subtotal:</span>
                <strong>{formatCurrency(subtotal, currency)}</strong>
              </div>
              {discountAmount > 0 && (
                <div className="inv-total-line" style={{ color: "#16a34a" }}>
                  <span>Discount:</span>
                  <strong>-{formatCurrency(discountAmount, currency)}</strong>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="inv-total-line">
                  <span>Tax:</span>
                  <strong>+{formatCurrency(taxAmount, currency)}</strong>
                </div>
              )}
              <div className="inv-total-line grand">
                <span>Grand Total:</span>
                <strong>{formatCurrency(totalAmount, currency)}</strong>
              </div>
              <div className="inv-total-line paid">
                <span>Amount Paid:</span>
                <strong>{formatCurrency(amountPaid, currency)}</strong>
              </div>
              <div className="inv-total-line balance">
                <span>Balance Due:</span>
                <strong style={{ color: balanceDue > 0 ? "#dc2626" : "#16a34a" }}>
                  {formatCurrency(balanceDue, currency)}
                </strong>
              </div>
            </div>
          </div>

          {/* Payment History if available */}
          {payments.length > 0 && (
            <div className="inv-payments-section">
              <h4>Recorded Payment History ({payments.length})</h4>
              <table className="inv-payments-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Payment Method</th>
                    <th>Reference #</th>
                    <th>Notes</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, pIdx) => (
                    <tr key={p.payment_id || pIdx}>
                      <td>{formatDate(p.payment_date)}</td>
                      <td>{p.payment_method || "Bank Transfer"}</td>
                      <td>{p.reference || "—"}</td>
                      <td>{p.notes || "—"}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#16a34a" }}>
                        {formatCurrency(p.amount, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

