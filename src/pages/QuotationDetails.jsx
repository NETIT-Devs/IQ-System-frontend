// Quotation Details Component
// Displays comprehensive quotation information retrieved from backend database.
// Supports downloading real business PDF documents via QuotationTemplate.

import { useEffect, useState } from "react";
import {
  FileText,
  Calendar,
  User,
  Download,
  X,
  Layers,
  Edit,
  AlertCircle,
} from "lucide-react";
import {
  getQuotationById,
  getCompanyDetails,
  getCustomers,
  updateQuotationCustomerStatus,
} from "../services/quotationService";
import { downloadQuotationPdf } from "../utils/pdfGenerator";
import "./QuotationDetails.css";

// Format date into human-readable representation
function formatDate(dateString) {
  if (!dateString) return "Not specified";
  try {
    const date = new Date(dateString.includes("T") ? dateString : `${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

// Format financial values with currency
function formatMoney(amount, currency = "LKR") {
  return `${currency} ${Number(amount || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function QuotationDetails({
  quotation: propQuotation = null,
  quotationId = null,
  onClose,
  onEdit,
}) {
  const [quotation, setQuotation] = useState(propQuotation);
  const [companyDetails, setCompanyDetails] = useState({});
  const [customerDetails, setCustomerDetails] = useState({});
  const [loading, setLoading] = useState(!propQuotation && Boolean(quotationId));
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState("");

  const activeId = propQuotation?.quotation_id || quotationId;

  // Load fresh quotation and company details from backend
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setError("");

        if (activeId && (!propQuotation || !propQuotation.items)) {
          setLoading(true);
          const [quotationResult, companyResult, customersResult] =
            await Promise.allSettled([
              getQuotationById(activeId),
              getCompanyDetails(),
              getCustomers(),
            ]);

          if (quotationResult.status === "rejected") {
            throw quotationResult.reason;
          }

          if (isMounted) {
            if (quotationResult.value) {
              setQuotation(quotationResult.value);
            }
            if (companyResult.status === "fulfilled") {
              setCompanyDetails(companyResult.value);
            }
            const customers =
              customersResult.status === "fulfilled"
                ? customersResult.value
                : [];
            setCustomerDetails(
              customers.find(
                (customer) =>
                  String(customer.customer_id) ===
                  String(quotationResult.value?.customer_id)
              ) || {}
            );
            const warnings = [];
            if (companyResult.status === "rejected") {
              warnings.push(
                "Company details could not be loaded; the PDF may omit company branding."
              );
            }
            if (customersResult.status === "rejected") {
              warnings.push(
                "Customer contact details could not be loaded; only saved quotation details will be shown."
              );
            }
            setError(warnings.join(" "));
          }
        } else {
          const [companyResult, customersResult] = await Promise.allSettled([
            getCompanyDetails(),
            getCustomers(),
          ]);
          if (isMounted) {
            if (companyResult.status === "fulfilled") {
              setCompanyDetails(companyResult.value);
            }
            const customers =
              customersResult.status === "fulfilled"
                ? customersResult.value
                : [];
            setCustomerDetails(
              customers.find(
                (customer) =>
                  String(customer.customer_id) ===
                  String(propQuotation?.customer_id)
              ) || {}
            );
            const warnings = [];
            if (companyResult.status === "rejected") {
              warnings.push(
                "Company details could not be loaded; the PDF may omit company branding."
              );
            }
            if (customersResult.status === "rejected") {
              warnings.push(
                "Customer contact details could not be loaded; only saved quotation details will be shown."
              );
            }
            setError(warnings.join(" "));
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.message || "Failed to load quotation details.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [activeId, propQuotation]);

  // Handle direct PDF export
  const handleDownloadPdf = async () => {
    if (!quotation) return;

    try {
      setDownloadingPdf(true);
      let activeCompany = companyDetails;
      if (!activeCompany?.bank_name) {
        try {
          activeCompany = await getCompanyDetails();
          setCompanyDetails(activeCompany);
        } catch {
          // ignore error
        }
      }
      const filename = `${quotation.quotation_number || "Quotation"}.pdf`;
      await downloadQuotationPdf(
        quotation,
        activeCompany,
        {
          ...customerDetails,
          customer_name: quotation.customer_name || customerDetails.customer_name,
          company_name:
            quotation.customer_company ||
            quotation.company_name ||
            customerDetails.company_name ||
            "",
          email:
            quotation.customer_email ||
            quotation.email ||
            customerDetails.email ||
            "",
          phone:
            quotation.customer_phone ||
            quotation.phone ||
            customerDetails.phone ||
            "",
          address:
            quotation.customer_address ||
            quotation.address ||
            customerDetails.address ||
            "",
        },
        filename
      );
    } catch (err) {
      console.error("PDF download failed:", err);
      setError(
        "Could not generate the quotation PDF. Please check your connection and try again."
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Handle manual customer response status updates
  const handleUpdateStatus = async (newCustomerStatus) => {
    if (!activeId) return;
    try {
      setUpdatingStatus(true);
      await updateQuotationCustomerStatus(activeId, newCustomerStatus);
      setQuotation((prev) => ({ ...prev, customer_status: newCustomerStatus }));
    } catch (err) {
      setError(err?.message || "Failed to update quotation customer response.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (!quotation && !loading) return null;

  const currency = quotation?.currency || "LKR";
  const items = Array.isArray(quotation?.items) ? quotation.items : [];
  const currentCustStatus = quotation?.customer_status || "Not Sent";

  return (
    <div className="qd-overlay">
      <div className="qd-card">
        {/* Header */}
        <div className="qd-header">
          <div className="qd-header-left">
            <div className="qd-icon-badge">
              <FileText size={24} />
            </div>
            <div className="qd-header-title">
              <h2>{quotation?.quotation_number || "Quotation Details"}</h2>
              <p className="qd-header-subtitle">
                Created on {formatDate(quotation?.created_at || quotation?.quotation_date)} • System Status: <strong>{quotation?.status || "Draft"}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            className="qd-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        {/* Content Body */}
        <div className="qd-body">
          {error && (
            <div className="qf-alert-error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
              Loading quotation details from database...
            </div>
          ) : quotation ? (
            <>
              {/* Separate Customer Response Tracker Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                  padding: "12px 16px",
                  marginBottom: "16px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#334155" }}>
                    Customer Response:
                  </span>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "3px 9px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "700",
                      background:
                        currentCustStatus === "Customer Accepted"
                          ? "#dcfce7"
                          : currentCustStatus === "Sent to Customer"
                          ? "#e0f2fe"
                          : currentCustStatus === "Customer Rejected"
                          ? "#fee2e2"
                          : "#f1f5f9",
                      color:
                        currentCustStatus === "Customer Accepted"
                          ? "#15803d"
                          : currentCustStatus === "Sent to Customer"
                          ? "#0369a1"
                          : currentCustStatus === "Customer Rejected"
                          ? "#b91c1c"
                          : "#475569",
                      border: "1px solid currentColor",
                    }}
                  >
                    {currentCustStatus}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus("Sent to Customer")}
                    disabled={updatingStatus || currentCustStatus === "Sent to Customer"}
                    style={{
                      padding: "5px 12px",
                      fontSize: "12px",
                      fontWeight: "600",
                      borderRadius: "6px",
                      border: "1px solid #bae6fd",
                      background: currentCustStatus === "Sent to Customer" ? "#bae6fd" : "#e0f2fe",
                      color: "#0369a1",
                      cursor: currentCustStatus === "Sent to Customer" ? "default" : "pointer",
                      opacity: updatingStatus ? 0.6 : 1,
                    }}
                  >
                    📤 Sent to Customer
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateStatus("Customer Accepted")}
                    disabled={updatingStatus || currentCustStatus === "Customer Accepted"}
                    style={{
                      padding: "5px 12px",
                      fontSize: "12px",
                      fontWeight: "600",
                      borderRadius: "6px",
                      border: "1px solid #bbf7d0",
                      background: currentCustStatus === "Customer Accepted" ? "#bbf7d0" : "#dcfce7",
                      color: "#15803d",
                      cursor: currentCustStatus === "Customer Accepted" ? "default" : "pointer",
                      opacity: updatingStatus ? 0.6 : 1,
                    }}
                  >
                    ✅ Customer Accepted
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateStatus("Customer Rejected")}
                    disabled={updatingStatus || currentCustStatus === "Customer Rejected"}
                    style={{
                      padding: "5px 12px",
                      fontSize: "12px",
                      fontWeight: "600",
                      borderRadius: "6px",
                      border: "1px solid #fecaca",
                      background: currentCustStatus === "Customer Rejected" ? "#fecaca" : "#fee2e2",
                      color: "#b91c1c",
                      cursor: currentCustStatus === "Customer Rejected" ? "default" : "pointer",
                      opacity: updatingStatus ? 0.6 : 1,
                    }}
                  >
                    ❌ Customer Rejected
                  </button>
                </div>
              </div>

              {/* Overview Metrics Bar */}
              <div className="qd-overview-bar">
                <div className="qd-overview-card">
                  <div className="qd-overview-label">Quotation Date</div>
                  <div className="qd-overview-value">
                    {formatDate(quotation.quotation_date)}
                  </div>
                </div>

                <div className="qd-overview-card">
                  <div className="qd-overview-label">Valid Until</div>
                  <div className="qd-overview-value">
                    {formatDate(quotation.valid_until)}
                  </div>
                </div>

                <div className="qd-overview-card">
                  <div className="qd-overview-label">Project Duration</div>
                  <div className="qd-overview-value">
                    {quotation.estimated_duration
                      ? `${quotation.estimated_duration} ${quotation.duration_unit || "Days"}`
                      : "Not specified"}
                  </div>
                </div>

                <div className="qd-overview-card">
                  <div className="qd-overview-label">Grand Total</div>
                  <div className="qd-overview-value" style={{ color: "#1d4ed8" }}>
                    {formatMoney(quotation.total_amount, currency)}
                  </div>
                </div>
              </div>

              {/* Customer & Project Info Grid */}
              <div className="qd-info-columns">
                {/* Customer Information Card */}
                <div className="qd-info-card">
                  <div className="qd-card-title">
                    <User size={16} />
                    <span>Customer Information</span>
                  </div>

                  <table className="qd-data-table">
                    <tbody>
                      <tr>
                        <td className="qd-data-label">Customer Name:</td>
                        <td className="qd-data-val">
                          {quotation.customer_name || "—"}
                        </td>
                      </tr>
                      {(quotation.customer_company ||
                        quotation.company_name ||
                        customerDetails.company_name) && (
                        <tr>
                          <td className="qd-data-label">Company:</td>
                          <td className="qd-data-val">
                            {quotation.customer_company ||
                              quotation.company_name ||
                              customerDetails.company_name}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td className="qd-data-label">Customer ID:</td>
                        <td className="qd-data-val">{quotation.customer_id}</td>
                      </tr>
                      {(quotation.customer_email ||
                        quotation.email ||
                        customerDetails.email) && (
                        <tr>
                          <td className="qd-data-label">Email:</td>
                          <td className="qd-data-val">
                            {quotation.customer_email ||
                              quotation.email ||
                              customerDetails.email}
                          </td>
                        </tr>
                      )}
                      {(quotation.customer_phone ||
                        quotation.phone ||
                        customerDetails.phone) && (
                        <tr>
                          <td className="qd-data-label">Phone:</td>
                          <td className="qd-data-val">
                            {quotation.customer_phone ||
                              quotation.phone ||
                              customerDetails.phone}
                          </td>
                        </tr>
                      )}
                      {(quotation.customer_address ||
                        quotation.address ||
                        customerDetails.address) && (
                        <tr>
                          <td className="qd-data-label">Address:</td>
                          <td className="qd-data-val">
                            {quotation.customer_address ||
                              quotation.address ||
                              customerDetails.address}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Software Project Details */}
                <div className="qd-info-card">
                  <div className="qd-card-title">
                    <Calendar size={16} />
                    <span>Project &amp; Timeline Details</span>
                  </div>

                  <table className="qd-data-table">
                    <tbody>
                      <tr>
                        <td className="qd-data-label">Start Date:</td>
                        <td className="qd-data-val">
                          {formatDate(quotation.project_start_date)}
                        </td>
                      </tr>
                      <tr>
                        <td className="qd-data-label">Duration:</td>
                        <td className="qd-data-val">
                          {quotation.estimated_duration
                            ? `${quotation.estimated_duration} ${quotation.duration_unit || "Days"}`
                            : "Flexible / As agreed"}
                        </td>
                      </tr>
                      <tr>
                        <td className="qd-data-label">Estimated Completion:</td>
                        <td className="qd-data-val">
                          {formatDate(quotation.estimated_completion_date)}
                        </td>
                      </tr>
                      <tr>
                        <td className="qd-data-label">Currency:</td>
                        <td className="qd-data-val">{currency}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Items Table */}
              <div className="qd-items-section">
                <div className="qd-items-header-bar">
                  <Layers size={16} />
                  <span>Quotation Items &amp; Services ({items.length})</span>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table className="qd-table">
                    <thead>
                      <tr>
                        <th style={{ width: "4%" }}>#</th>
                        <th style={{ width: "48%" }}>Service / Scope</th>
                        <th style={{ width: "16%" }} className="text-right">
                          Price
                        </th>
                        <th style={{ width: "12%" }} className="text-right">
                          Tax Rate
                        </th>
                        <th style={{ width: "20%" }} className="text-right">
                          Line Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => {
                        const unitPrice = Number(item.unit_price ?? item.Price ?? 0);
                        const taxRate = Number(item.tax_rate ?? 0);
                        const lineTotal =
                          item.line_total != null
                            ? Number(item.line_total)
                            : unitPrice + (unitPrice * taxRate) / 100;

                        return (
                          <tr key={item.quotation_item_id || idx}>
                            <td>{idx + 1}</td>
                            <td>
                              <div className="qd-item-name">{item.item_name}</div>

                              {(item.technology ||
                                item.website_type ||
                                item.hosting_domain) && (
                                <div className="qd-tags-row">
                                  {item.technology && (
                                    <span className="qd-tag">
                                      Tech: {item.technology}
                                    </span>
                                  )}
                                  {item.website_type && (
                                    <span className="qd-tag">
                                      Type: {item.website_type}
                                    </span>
                                  )}
                                  {item.hosting_domain && (
                                    <span className="qd-tag">
                                      Hosting: {item.hosting_domain}
                                    </span>
                                  )}
                                </div>
                              )}

                              {item.description && (
                                <p className="qd-item-desc">{item.description}</p>
                              )}
                            </td>
                            <td className="text-right">
                              {formatMoney(unitPrice, currency)}
                            </td>
                            <td className="text-right">{taxRate}%</td>
                            <td className="text-right" style={{ fontWeight: 700 }}>
                              {formatMoney(lineTotal, currency)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Row: Terms & Financial Summary */}
              <div className="qd-bottom-row">
                <div className="qd-terms-card">
                  <div className="qd-terms-title">Terms &amp; Conditions</div>
                  <div className="qd-terms-text">
                    {quotation.terms_and_conditions ||
                      "Standard terms and conditions apply as per service agreement."}
                  </div>

                  {quotation.notes && (
                    <>
                      <div className="qd-terms-title" style={{ marginTop: "12px" }}>
                        Additional Notes
                      </div>
                      <div className="qd-terms-text">{quotation.notes}</div>
                    </>
                  )}
                </div>

                <div className="qd-totals-card">
                  <table className="qd-totals-table">
                    <tbody>
                      <tr>
                        <td className="qd-totals-label">Subtotal:</td>
                        <td className="qd-totals-value">
                          {formatMoney(quotation.subtotal, currency)}
                        </td>
                      </tr>
                      <tr>
                        <td className="qd-totals-label">Discount:</td>
                        <td className="qd-totals-value" style={{ color: "#dc2626" }}>
                          - {formatMoney(quotation.discount_amount, currency)}
                        </td>
                      </tr>
                      <tr>
                        <td className="qd-totals-label">Tax:</td>
                        <td className="qd-totals-value">
                          + {formatMoney(quotation.tax_amount, currency)}
                        </td>
                      </tr>
                      <tr className="qd-grand-total-row">
                        <td className="qd-grand-total-label">Grand Total:</td>
                        <td className="qd-grand-total-value">
                          {formatMoney(quotation.total_amount, currency)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="qd-footer">
          <button
            type="button"
            className="qd-btn qd-btn-close"
            onClick={onClose}
          >
            Close
          </button>

          <div className="qd-footer-right">
            {onEdit && quotation && (
              <button
                type="button"
                className="qd-btn qd-btn-close"
                onClick={() => onEdit(quotation)}
              >
                <Edit size={16} />
                Edit Quotation
              </button>
            )}

            <button
              type="button"
              className="qd-btn qd-btn-pdf"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || !quotation}
            >
              <Download size={16} />
              {downloadingPdf ? "Generating PDF..." : "Download PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}