// Professional Quotation PDF Template Component
// Styled in deep navy blue, professional blue, and pure white.
// Designed for software and web development company quotations.

import { forwardRef } from "react";
import "./QuotationTemplate.css";

// Format date into human-readable string (e.g. 24 Oct 2026)
function formatDate(dateString) {
  if (!dateString) return "—";
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

// Format money with 2 decimals
function formatMoney(amount, currency = "LKR") {
  const num = Number(amount) || 0;
  return `${currency} ${num.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const QuotationTemplate = forwardRef(function QuotationTemplate(
  {
    quotation = {},
    customer = {},
    company = {},
  },
  ref
) {
  const currency = quotation.currency || "LKR";

  // Customer display details
  const customerName =
    customer.customer_name ||
    customer.name ||
    quotation.customer_name ||
    "Customer";

  const customerCompany = customer.company_name || quotation.company_name || "";
  const customerEmail = customer.email || quotation.customer_email || "";
  const customerPhone = customer.phone || quotation.customer_phone || "";
  const customerAddress =
    customer.address ||
    [customer.city, customer.country].filter(Boolean).join(", ") ||
    "";

  // Company display details from backend database
  const companyName = company.company_name || "";
  const companyLogo = company.company_logo || company.logo_url || "/logo.jpg";
  const companyAddress = company.company_address || company.address || "";
  const companyPhone = company.contact_number || company.phone || "";
  const companyEmail = company.email_address || company.email || "";
  const companySignature = company.company_signature || "";
  const companyTax = company.tax_number || "";

  // Project details
  const hasProjectDetails =
    quotation.project_start_date ||
    quotation.estimated_duration ||
    quotation.estimated_completion_date;

  const items = Array.isArray(quotation.items) ? quotation.items : [];

  return (
    <div ref={ref} className="quotation-template-container" id="quotation-print-document">
      {/* Company & Document Header */}
      <header className="qt-header pdf-no-break">
        <div className="qt-brand">
          {companyLogo && (
            <img
              src={companyLogo}
              alt={companyName}
              className="qt-logo"
              crossOrigin="anonymous"
              onError={(e) => {
                if (e.currentTarget.src !== window.location.origin + "/logo.jpg") {
                  e.currentTarget.src = "/logo.jpg";
                }
              }}
            />
          )}
          <div>
            <h1 className="qt-company-name">{companyName}</h1>
            {companyAddress && <p className="qt-company-info">{companyAddress}</p>}
            {(companyPhone || companyEmail) && (
              <p className="qt-company-info">
                {[companyPhone && `Tel: ${companyPhone}`, companyEmail && `Email: ${companyEmail}`]
                  .filter(Boolean)
                  .join(" | ")}
              </p>
            )}
            {companyTax && (
              <p className="qt-company-info">Tax/Reg No: {companyTax}</p>
            )}
          </div>
        </div>

        <div className="qt-doc-title-block">
          <div className="qt-doc-title">QUOTATION</div>
          <table className="qt-meta-table">
            <tbody>
              <tr>
                <td className="qt-meta-label">Quotation No:</td>
                <td className="qt-meta-value">
                  {quotation.quotation_number || "Draft"}
                </td>
              </tr>
              <tr>
                <td className="qt-meta-label">Date:</td>
                <td className="qt-meta-value">
                  {formatDate(quotation.quotation_date)}
                </td>
              </tr>
              <tr>
                <td className="qt-meta-label">Valid Until:</td>
                <td className="qt-meta-value">
                  {formatDate(quotation.valid_until)}
                </td>
              </tr>
              <tr>
                <td className="qt-meta-label">Prepared By:</td>
                <td className="qt-meta-value">
                  {company.prepared_by || "Admin"}
                </td>
              </tr>
              <tr>
                <td className="qt-meta-label">Status:</td>
                <td>
                  <span
                    className={`qt-status-badge qt-status-${(
                      quotation.status || "Draft"
                    ).toLowerCase()}`}
                  >
                    {quotation.status || "Draft"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </header>

      {/* Bill To and Project Scope Details */}
      <section className="qt-info-grid pdf-no-break">
        <div className="qt-card">
          <div className="qt-card-title">Bill To (Client Information)</div>
          <div className="qt-customer-name">{customerName}</div>
          {customerCompany && (
            <div className="qt-customer-company">{customerCompany}</div>
          )}
          {customerAddress && (
            <div className="qt-detail-line">{customerAddress}</div>
          )}
          {customerPhone && (
            <div className="qt-detail-line">Phone: {customerPhone}</div>
          )}
          {customerEmail && (
            <div className="qt-detail-line">Email: {customerEmail}</div>
          )}
        </div>

        <div className="qt-card">
          <div className="qt-card-title">Project & Timeline Details</div>
          {hasProjectDetails ? (
            <div className="qt-project-grid">
              {quotation.project_start_date && (
                <>
                  <span className="qt-project-label">Start Date:</span>
                  <span className="qt-project-value">
                    {formatDate(quotation.project_start_date)}
                  </span>
                </>
              )}

              {quotation.estimated_duration && (
                <>
                  <span className="qt-project-label">Estimated Duration:</span>
                  <span className="qt-project-value">
                    {quotation.estimated_duration}{" "}
                    {quotation.duration_unit || "Days"}
                  </span>
                </>
              )}

              {quotation.estimated_completion_date && (
                <>
                  <span className="qt-project-label">Estimated Completion:</span>
                  <span className="qt-project-value">
                    {formatDate(quotation.estimated_completion_date)}
                  </span>
                </>
              )}

              <span className="qt-project-label">Billing Currency:</span>
              <span className="qt-project-value">{currency}</span>
            </div>
          ) : (
            <div className="qt-detail-line">
              Custom web & software development services as specified in the
              deliverables below.
            </div>
          )}
        </div>
      </section>

      {/* Items & Services Table */}
      <section className="qt-table-section">
        <table className="qt-table">
          <thead>
            <tr>
              <th style={{ width: "4%" }}>#</th>
              <th style={{ width: "46%" }}>Description / Deliverables</th>
              <th style={{ width: "16%" }} className="text-right">
                Unit Price
              </th>
              <th style={{ width: "12%" }} className="text-right">
                Tax Rate
              </th>
              <th style={{ width: "22%" }} className="text-right">
                Line Total
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const unitPrice = Number(item.unit_price ?? item.Price ?? 0);
              const taxRate = Number(item.tax_rate ?? 0);
              const lineTotal =
                item.line_total != null
                  ? Number(item.line_total)
                  : unitPrice + (unitPrice * taxRate) / 100;

              return (
                <tr key={item.quotation_item_id || index} className="qt-table-row pdf-table-row">
                  <td className="text-center">{index + 1}</td>
                  <td>
                    <div className="qt-item-title">{item.item_name}</div>

                    {/* Software tags: Technology, Website Type, Hosting & Domain */}
                    {(item.technology ||
                      item.website_type ||
                      item.hosting_domain) && (
                      <div className="qt-item-tags">
                        {item.technology && (
                          <span className="qt-item-tag">
                            Tech: {item.technology}
                          </span>
                        )}
                        {item.website_type && (
                          <span className="qt-item-tag">
                            Type: {item.website_type}
                          </span>
                        )}
                        {item.hosting_domain && (
                          <span className="qt-item-tag">
                            Hosting: {item.hosting_domain}
                          </span>
                        )}
                      </div>
                    )}

                    {item.description && (
                      <p className="qt-item-desc">{item.description}</p>
                    )}
                  </td>
                  <td className="text-right">{formatMoney(unitPrice, currency)}</td>
                  <td className="text-right">{taxRate}%</td>
                  <td className="text-right" style={{ fontWeight: 700 }}>
                    {formatMoney(lineTotal, currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Notes / Terms & Financial Summary */}
      <section className="qt-bottom-grid pdf-no-break">
        <div className="qt-notes-card">
          <div className="qt-notes-title">Terms &amp; Conditions</div>
          <div className="qt-notes-content">
            {quotation.terms_and_conditions ||
              company.default_terms_and_conditions ||
              "1. Payment terms as agreed.\n2. This quotation is valid until the stated expiry date."}
          </div>

          {/* Bank & Payment Details from Database */}
          {(company.bank_name || company.bank_account_number) && (
            <div className="qt-bank-card">
              <div className="qt-notes-title" style={{ color: "#0f172a", marginBottom: "6px" }}>
                Bank &amp; Payment Details
              </div>
              <div className="qt-bank-grid">
                {company.bank_name && (
                  <div><span className="qt-bank-label">Bank:</span> {company.bank_name}</div>
                )}
                {company.bank_branch && (
                  <div><span className="qt-bank-label">Branch:</span> {company.bank_branch}</div>
                )}
                {company.bank_account_name && (
                  <div><span className="qt-bank-label">Account Name:</span> {company.bank_account_name}</div>
                )}
                {company.bank_account_number && (
                  <div><span className="qt-bank-label">Account No:</span> {company.bank_account_number}</div>
                )}
                {company.bank_swift_code && (
                  <div><span className="qt-bank-label">SWIFT Code:</span> {company.bank_swift_code}</div>
                )}
              </div>
            </div>
          )}

          {quotation.notes && (
            <>
              <div className="qt-notes-title" style={{ marginTop: "10px" }}>
                Special Notes
              </div>
              <div className="qt-notes-content">{quotation.notes}</div>
            </>
          )}
        </div>

        <div className="qt-summary-card pdf-summary-box">
          <table className="qt-summary-table">
            <tbody>
              <tr>
                <td className="qt-summary-label">Subtotal:</td>
                <td className="qt-summary-value">
                  {formatMoney(quotation.subtotal, currency)}
                </td>
              </tr>
              <tr>
                <td className="qt-summary-label">Discount:</td>
                <td className="qt-summary-value" style={{ color: "#dc2626" }}>
                  - {formatMoney(quotation.discount_amount, currency)}
                </td>
              </tr>
              <tr>
                <td className="qt-summary-label">Tax / VAT:</td>
                <td className="qt-summary-value">
                  + {formatMoney(quotation.tax_amount, currency)}
                </td>
              </tr>
              <tr className="qt-summary-total-row">
                <td className="qt-summary-total-label">Grand Total:</td>
                <td className="qt-summary-total-value">
                  {formatMoney(quotation.total_amount, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Signatures */}
      <section className="qt-signatures pdf-no-break pdf-signature-section">
        <div className="qt-sig-box">
          <div className="qt-sig-space" />
          <div className="qt-sig-line" />
          <p className="qt-sig-title">Client Acceptance Signature</p>
          <p className="qt-sig-subtitle">Date: ________________________</p>
        </div>

        <div className="qt-sig-box">
          <div className="qt-sig-space">
            {companySignature && (
              <img
                src={companySignature}
                alt="Authorized Signature"
                className="qt-signature-img"
                crossOrigin="anonymous"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
          </div>
          <div className="qt-sig-line" />
          <p className="qt-sig-title">Authorized Company Representative</p>
          <p className="qt-sig-subtitle">{companyName}</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="qt-footer pdf-no-break">
        <p className="qt-footer-text">Thank you for your business.</p>
        <p style={{ margin: 0 }}>
          This quotation is valid until {formatDate(quotation.valid_until)}. If you have any questions, contact us at {companyEmail || "our office"}.
        </p>
      </footer>
    </div>
  );
});

export default QuotationTemplate;
