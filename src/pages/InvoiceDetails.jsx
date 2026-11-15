import { useState, useEffect } from "react";
import {
  X,
  Download,
  CreditCard,
  Pencil,
} from "lucide-react";
import { useCompanyBranding } from "../hooks/useCompanyBranding";
import { getInvoiceById } from "../services/invoiceService";
import { getCompanyDetails } from "../services/quotationService";
import { downloadInvoicePdf } from "../utils/pdfGenerator";
import { getAuthenticatedUser } from "../utils/authStorage";
import InvoiceTemplate from "../components/InvoiceTemplate";
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
  const { logoUrl, companyName, signatureUrl, email, phone, address } =
    useCompanyBranding();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [detailedInvoice, setDetailedInvoice] = useState(null);

  useEffect(() => {
    if (isOpen && invoice?.invoice_id && (!Array.isArray(invoice.items) || invoice.items.length === 0)) {
      getInvoiceById(invoice.invoice_id)
        .then((fresh) => {
          if (fresh) setDetailedInvoice(fresh);
        })
        .catch(() => {});
    } else {
      setDetailedInvoice(null);
    }
  }, [isOpen, invoice]);

  if (!isOpen || !invoice) return null;

  const currentInvoice = detailedInvoice || invoice;
  const invNum = currentInvoice.invoice_number || `INV-${currentInvoice.invoice_id}`;
  const status = currentInvoice.status || "Draft";
  const currency = currentInvoice.currency || "LKR";
  const payments = Array.isArray(currentInvoice.payments) ? currentInvoice.payments : [];

  const companyInfo = {
    company_name: companyName,
    company_logo: logoUrl,
    company_signature: signatureUrl,
    email_address: email,
    contact_number: phone,
    company_address: address,
  };

  const authUser = getAuthenticatedUser();
  const isSuperAdmin =
    String(authUser?.role || "").trim().toLowerCase() === "super admin" ||
    authUser?.role === "super_admin";
  const invStatus = String(currentInvoice?.status || "").trim().toLowerCase();
  const invApproval = String(currentInvoice?.approval_status || "").trim().toLowerCase();
  const isApproved =
    invApproval === "approved" ||
    (!["draft", "pending approval", "pending", "rejected", "cancelled"].includes(invStatus) &&
     !["draft", "pending", "rejected"].includes(invApproval));
  const canDownloadPdf = isSuperAdmin || isApproved;

  async function handleDownloadPdf() {
    if (!canDownloadPdf) return;
    try {
      setDownloadingPdf(true);
      const [freshInv, freshCompany] = await Promise.all([
        currentInvoice.invoice_id
          ? getInvoiceById(currentInvoice.invoice_id).catch(() => null)
          : Promise.resolve(null),
        getCompanyDetails().catch(() => null),
      ]);
      const targetInvoice = freshInv || currentInvoice;
      const activeCompany = freshCompany || companyInfo;
      const fileNum =
        targetInvoice.invoice_number || `INV-${targetInvoice.invoice_id}`;
      await downloadInvoicePdf(targetInvoice, activeCompany, `${fileNum}.pdf`);
    } catch (err) {
      alert("Failed to download invoice PDF: " + (err?.message || err));
    } finally {
      setDownloadingPdf(false);
    }
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
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || !canDownloadPdf}
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
              <span>{downloadingPdf ? "Downloading..." : "Download PDF"}</span>
            </button>

            {Boolean(onRecordPayment) && status !== "Paid" && status !== "Cancelled" && (
              <button
                type="button"
                className="inv-tb-btn primary"
                onClick={() => {
                  onRecordPayment?.(currentInvoice);
                }}
                title="Record payment"
              >
                <CreditCard size={15} />
                <span>Record Payment</span>
              </button>
            )}

            {Boolean(onEdit) && (
              <button
                type="button"
                className="inv-tb-btn"
                onClick={() => {
                  onEdit?.(currentInvoice);
                }}
                title="Edit Invoice"
              >
                <Pencil size={15} />
                <span>Edit</span>
              </button>
            )}

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
          <InvoiceTemplate
            invoice={currentInvoice}
            company={companyInfo}
            signature={signatureUrl}
          />

          {/* Payment History if available */}
          {payments.length > 0 && (
            <div className="inv-payments-section">
              <h4>Recorded Payment History ({payments.length})</h4>
              <table className="inv-payments-table">
                <thead>
                  <tr>
                    <th>Payment ID</th>
                    <th>Date</th>
                    <th>Payment Method</th>
                    <th>Reference #</th>
                    <th>Status</th>
                    <th>Description / Notes</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, pIdx) => {
                    const pStatus = p.status || "Approved";
                    const pColor =
                      pStatus === "Approved"
                        ? "#16a34a"
                        : pStatus === "Rejected"
                          ? "#dc2626"
                          : "#d97706";
                    return (
                      <tr key={p.payment_id || pIdx}>
                        <td style={{ fontWeight: 600 }}>
                          {p.payment_number || `PAY-${p.payment_id}`}
                        </td>
                        <td>{formatDate(p.payment_date)}</td>
                        <td>{p.payment_method || "Bank Transfer"}</td>
                        <td>{p.reference_number || p.reference || "—"}</td>
                        <td style={{ fontWeight: 700, color: pColor }}>
                          {pStatus}
                        </td>
                        <td>{p.description || p.notes || "—"}</td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: 700,
                            color: pColor,
                          }}
                        >
                          {formatCurrency(p.amount, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

