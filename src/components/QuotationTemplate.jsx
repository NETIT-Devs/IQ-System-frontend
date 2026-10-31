import "./QuotationTemplate.css";
import API_BASE_URL from "../services/api";

// Format dates safely without changing the original data.
const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Format monetary values using the selected currency.
const formatMoney = (value, currency = "LKR") => {
  const amount = Number(value ?? 0);

  return `${currency} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Safely display optional values.
const displayValue = (value) =>
  value !== undefined && value !== null && value !== ""
    ? value
    : "—";

export default function QuotationTemplate({
  quotation = {},
  company = {},
  signature = null,
}) {
  const items = Array.isArray(quotation.items)
    ? quotation.items
    : Array.isArray(quotation.services)
      ? quotation.services
      : [];

  const currency = quotation.currency || "LKR";

  const subtotal =
    quotation.subtotal ??
    items.reduce(
      (total, item) =>
        total + Number(item.line_total ?? item.total ?? item.price ?? 0),
      0
    );

  const taxAmount = Number(quotation.tax_amount ?? quotation.taxAmount ?? 0);
  const discount = Number(quotation.discount ?? 0);

  const grandTotal = Number(
    quotation.grand_total ??
      quotation.grandTotal ??
      subtotal + taxAmount - discount
  );

  const resolveUrl = (url) => {
    if (!url || typeof url !== "string") return "";
    if (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("data:")
    ) {
      return url;
    }
    const clean = url.startsWith("/") ? url : `/${url}`;
    return `${API_BASE_URL}${clean}`;
  };

  const companyLogo = resolveUrl(
    company.logo_url ||
    company.logo ||
    company.company_logo ||
    ""
  );

  const signatureImage = resolveUrl(
    signature ||
    company.signature_url ||
    company.signature ||
    ""
  );

  return (
    <article className="quotation-document">
      {/* Company header */}
      <header className="quotation-header">
        <div className="quotation-header-main">
          <div className="quotation-company-brand">
            {companyLogo && (
              <img
                className="quotation-company-logo"
                src={companyLogo}
                alt={`${company.name || "Company"} logo`}
              />
            )}

            <div className="quotation-company-details">
              <h2>{displayValue(company.name || company.company_name)}</h2>

              {company.address && <p>{company.address}</p>}
              {company.phone && <p>Phone: {company.phone}</p>}
              {company.email && <p>Email: {company.email}</p>}
              {company.website && <p>{company.website}</p>}
            </div>
          </div>

          <div className="quotation-heading">
            <span className="quotation-heading-label">BUSINESS DOCUMENT</span>
            <h1>QUOTATION</h1>
            <p>Professional Services Proposal</p>
          </div>
        </div>

        <div className="quotation-header-line" />
      </header>

      {/* Quotation reference information */}
      <section className="quotation-reference-grid">
        <div className="quotation-reference-item">
          <span>QUOTATION NUMBER</span>
          <strong>
            {displayValue(
              quotation.quotation_number || quotation.quotationNumber
            )}
          </strong>
        </div>

        <div className="quotation-reference-item">
          <span>QUOTATION DATE</span>
          <strong>{formatDate(quotation.quotation_date || quotation.date)}</strong>
        </div>

        <div className="quotation-reference-item">
          <span>VALID UNTIL</span>
          <strong>{formatDate(quotation.valid_until)}</strong>
        </div>
      </section>

      {/* Client and project details */}
      <section className="quotation-details-grid">
        <div className="quotation-section">
          <h3 className="quotation-section-title">PREPARED FOR</h3>

          <div className="quotation-client-name">
            {displayValue(
              quotation.customer_name ||
                quotation.client_name ||
                quotation.customer?.name ||
                quotation.client?.name
            )}
          </div>

          {(quotation.customer?.address || quotation.client?.address) && (
            <p>
              {quotation.customer?.address || quotation.client?.address}
            </p>
          )}

          {(quotation.customer?.email || quotation.client?.email) && (
            <p>
              {quotation.customer?.email || quotation.client?.email}
            </p>
          )}

          {(quotation.customer?.phone || quotation.client?.phone) && (
            <p>
              {quotation.customer?.phone || quotation.client?.phone}
            </p>
          )}
        </div>

        <div className="quotation-section quotation-project-details">
          <h3 className="quotation-section-title">PROJECT DETAILS</h3>

          <div className="quotation-detail-row">
            <span>Start Date</span>
            <strong>{formatDate(quotation.project_start_date)}</strong>
          </div>

          <div className="quotation-detail-row">
            <span>Duration</span>
            <strong>
              {quotation.project_duration
                ? `${quotation.project_duration} ${
                    quotation.project_duration_unit || ""
                  }`
                : "—"}
            </strong>
          </div>

          <div className="quotation-detail-row">
            <span>Estimated Completion</span>
            <strong>{formatDate(quotation.estimated_completion)}</strong>
          </div>
        </div>
      </section>

      {/* Services and scope of work */}
      <section className="quotation-services-section">
        <div className="quotation-section-heading">
          <div>
            <span className="quotation-eyebrow">SCOPE OF WORK</span>
            <h2>Services & Deliverables</h2>
          </div>

          <span className="quotation-item-count">
            {items.length} {items.length === 1 ? "ITEM" : "ITEMS"}
          </span>
        </div>

        <table className="quotation-services-table">
          <thead>
            <tr>
              <th className="quotation-col-number">#</th>
              <th className="quotation-col-service">SERVICE DETAILS</th>
              <th className="quotation-col-price">PRICE</th>
              <th className="quotation-col-tax">TAX</th>
              <th className="quotation-col-total">LINE TOTAL</th>
            </tr>
          </thead>

          <tbody>
            {items.length > 0 ? (
              items.map((item, index) => (
                <tr key={item.id || item.quotation_item_id || index}>
                  <td>{index + 1}</td>

                  <td>
                    <div className="quotation-service-name">
                      {displayValue(item.service_name || item.name)}
                    </div>

                    {(item.technology || item.website_type) && (
                      <div className="quotation-service-meta">
                        {[item.technology, item.website_type]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}

                    {item.hosting_domain && (
                      <p className="quotation-service-description">
                        Hosting & Domain: {item.hosting_domain}
                      </p>
                    )}

                    {item.description && (
                      <p className="quotation-service-description">
                        {item.description}
                      </p>
                    )}

                    {item.deliverables && (
                      <p className="quotation-service-description">
                        <strong>Deliverables:</strong> {item.deliverables}
                      </p>
                    )}
                  </td>

                  <td className="quotation-money-cell">
                    {formatMoney(item.price, currency)}
                  </td>

                  <td className="quotation-money-cell">
                    {Number(item.tax_rate ?? item.taxRate ?? 0)}%
                  </td>

                  <td className="quotation-money-cell quotation-line-total">
                    {formatMoney(
                      item.line_total ?? item.total ?? item.price,
                      currency
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="quotation-empty-items">
                  No service items available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Notes and financial summary */}
      <section className="quotation-bottom-grid">
        <div className="quotation-notes-column">
          {quotation.notes && (
            <div className="quotation-text-section">
              <h3>Special Notes</h3>
              <p>{quotation.notes}</p>
            </div>
          )}

          {quotation.terms_and_conditions && (
            <div className="quotation-text-section">
              <h3>Terms & Conditions</h3>
              <p>{quotation.terms_and_conditions}</p>
            </div>
          )}

          {quotation.terms && !quotation.terms_and_conditions && (
            <div className="quotation-text-section">
              <h3>Terms & Conditions</h3>
              <p>{quotation.terms}</p>
            </div>
          )}
        </div>

        <div className="quotation-summary">
          <h3>Financial Summary</h3>

          <div className="quotation-summary-row">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal, currency)}</span>
          </div>

          <div className="quotation-summary-row">
            <span>Tax Amount</span>
            <span>{formatMoney(taxAmount, currency)}</span>
          </div>

          <div className="quotation-summary-row">
            <span>Discount</span>
            <span>{formatMoney(discount, currency)}</span>
          </div>

          <div className="quotation-grand-total">
            <span>GRAND TOTAL</span>
            <strong>{formatMoney(grandTotal, currency)}</strong>
          </div>
        </div>
      </section>

      {/* Signature and closing footer */}
      <footer className="quotation-footer">
        <div className="quotation-footer-message">
          <h3>Thank You for Your Consideration</h3>
          <p>
            We appreciate the opportunity to work with you. Please contact us
            if you have any questions regarding this quotation.
          </p>
        </div>

        {signatureImage && (
          <div className="quotation-signature">
            <img src={signatureImage} alt="Authorized signature" />
            <div className="quotation-signature-line" />
            <strong>{company.authorized_person || company.contact_person || "Authorized Representative"}</strong>
            <span>{company.designation || ""}</span>
          </div>
        )}

        <div className="quotation-footer-bottom">
          <span>{company.name || company.company_name || "Quotation Document"}</span>
          <span>Quotation · {displayValue(quotation.quotation_number)}</span>
        </div>
      </footer>
    </article>
  );
}