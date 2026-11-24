import "./QuotationTemplate.css";
import API_BASE_URL from "../services/api";
import {
  parseDeliverableSections,
  categorizeQuotationItems,
  getAdditionalItemCustomText,
} from "../utils/deliverablesFormatter";

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

// Format numeric amount only for clean column alignment
const formatAmountOnly = (value) => {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
  const discount = Number(quotation.discount ?? quotation.discount_amount ?? 0);

  const grandTotal = Number(
    quotation.grand_total ??
    quotation.grandTotal ??
    subtotal + taxAmount - discount
  );

  const advancePrice = Number(
    quotation.advance_price ??
    quotation.advance_amount ??
    quotation.advancePrice ??
    quotation.advanceAmount ??
    0
  );

  const remainingBalance = Math.max(0, grandTotal - advancePrice);

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

      {/* Quotation reference information (4 columns) */}
      <section className="quotation-reference-grid quotation-reference-grid-4">
        <div className="quotation-reference-item">
          <span>PREPARED FOR</span>
          {(quotation.customer_name ||
            quotation.client_name ||
            quotation.customer?.name ||
            quotation.client?.name) && (
            <strong>
              {quotation.customer_name ||
                quotation.client_name ||
                quotation.customer?.name ||
                quotation.client?.name}
            </strong>
          )}
          {(quotation.customer?.phone ||
            quotation.client?.phone ||
            quotation.customer_phone ||
            quotation.phone) && (
            <span className="quotation-client-phone-sub">
              {quotation.customer?.phone ||
                quotation.client?.phone ||
                quotation.customer_phone ||
                quotation.phone}
            </span>
          )}
        </div>

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

      {/* Project details on the left side */}
      <section className="quotation-project-section-left">
        <div className="quotation-section quotation-project-details-card">
          <h3 className="quotation-section-title">PROJECT DETAILS</h3>

          <div className="quotation-detail-row">
            <span>Project</span>
            <strong>
              {(() => {
                const sName = items[0]?.item_name || items[0]?.service_name || items[0]?.name || quotation.service_name || "";
                const wType = quotation.website_type || quotation.project_type || items.find((it) => it.website_type)?.website_type || items[0]?.website_type || "";
                if (sName && wType) return `${sName} (${wType})`;
                if (sName) return sName;
                if (wType) return wType;
                return "Not specified";
              })()}
            </strong>
          </div>

          <div className="quotation-detail-row">
            <span>Technology Stack</span>
            <strong>
              {quotation.technology || quotation.technology_stack || items.find((it) => it.technology)?.technology || items[0]?.technology || "Not specified"}
            </strong>
          </div>

          <div className="quotation-detail-row">
            <span>Start Date</span>
            <strong style={{ color: "#2563eb" }}>Initial Advance Payment Date</strong>
          </div>

          <div className="quotation-detail-row">
            <span>Duration</span>
            <strong>
              {quotation.estimated_duration || quotation.project_duration
                ? `${quotation.estimated_duration || quotation.project_duration} ${quotation.duration_unit || quotation.project_duration_unit || ""
                  }`.trim()
                : "Not specified"}
            </strong>
          </div>
        </div>
      </section>

      <hr className="quotation-item-divider" style={{ margin: "20px 0 22px" }} />

      {/* Services and scope of work (No table) */}
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

        {(() => {
          const { mainServices, additionalItems } = categorizeQuotationItems(items);

          return (
            <div className="quotation-deliverables-container">
              {mainServices.map((item, index) => {
                const sections = parseDeliverableSections(item.description, {
                  hostingDomain: item.hosting_domain,
                  deliverables: item.deliverables,
                });

                return (
                  <div
                    key={item.id || item.quotation_item_id || index}
                    className="quotation-deliverable-item"
                  >
                    {index > 0 && <hr className="quotation-item-divider" />}

                    {/* Services & Deliverables label */}
                    <h4 className="quotation-service-scope-label">
                      Services &amp; Deliverables:
                    </h4>

                    <div className="quotation-service-sections-content">
                      {sections.map((sec, sIdx) => (
                        <div key={sIdx} className="quotation-deliverable-section-block">
                          {sIdx > 0 && <hr className="quotation-section-divider" />}
                          {sec.title && (
                            <h4 className="quotation-deliverable-heading">
                              {sec.title}:
                            </h4>
                          )}
                          <ul className="quotation-deliverable-list">
                            {sec.points.map((pt, pIdx) => (
                              <li key={pIdx}>{pt}</li>
                            ))}
                          </ul>
                        </div>
                      ))}

                      {/* Additional Development section for additional items */}
                      {index === mainServices.length - 1 && additionalItems.length > 0 && (
                        <div className="quotation-deliverable-section-block">
                          <hr className="quotation-section-divider" />
                          <h4 className="quotation-deliverable-heading">
                            Additional Development:
                          </h4>
                          <ul className="quotation-deliverable-list">
                            {additionalItems.map((addItem, aIdx) => {
                              const aName =
                                displayValue(
                                  addItem.item_name || addItem.service_name || addItem.name
                                ) || "Additional Item";
                              const aDesc = displayValue(addItem.description);
                              const text = aDesc ? `${aName} - ${aDesc}` : aName;
                              return <li key={aIdx}>{text}</li>;
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Special Notes right after deliverables */}
        {quotation.notes && (
          <div className="quotation-special-notes-block">
            <h4 className="quotation-deliverable-heading">Special Notes:</h4>
            <p className="quotation-notes-text">{quotation.notes}</p>
          </div>
        )}
      </section>

      {/* Pricing / Cost Summary Table */}
      <section className="quotation-pricing-table-section">
        <h4 className="quotation-pricing-table-title">DEVELOPMENT COST</h4>
        <table className="quotation-services-table">
          <thead>
            <tr>
              <th className="quotation-col-number">#</th>
              <th className="quotation-col-service">SERVICE / ITEM</th>
              <th className="quotation-col-price">UNIT PRICE</th>
              <th className="quotation-col-tax">TAX</th>
              <th className="quotation-col-total">LINE TOTAL</th>
            </tr>
          </thead>

          <tbody>
            {items.length > 0 ? (
              items.map((item, index) => {
                const customText = getAdditionalItemCustomText(item, index);
                if (customText) {
                  return (
                    <tr key={item.id || item.quotation_item_id || index}>
                      <td className="quotation-col-center">{index + 1}</td>

                      <td>
                        <div className="quotation-service-name">
                          {displayValue(item.item_name || item.service_name || item.name)}
                        </div>
                      </td>

                      <td className="quotation-money-cell"></td>

                      <td className="quotation-money-cell"></td>

                      <td className="quotation-money-cell quotation-line-total" style={{ textAlign: "right", fontWeight: 700, color: "var(--q-navy, #0f2240)" }}>
                        {customText}
                      </td>
                    </tr>
                  );
                }

                const price = Number(item.unit_price ?? item.Price ?? item.price ?? 0);
                const taxRate = Number(item.tax_rate ?? item.taxRate ?? 0);
                const lineTotal = Number(
                  item.line_total ??
                  item.total ??
                  price + (price * taxRate) / 100
                );

                return (
                  <tr key={item.id || item.quotation_item_id || index}>
                    <td className="quotation-col-center">{index + 1}</td>

                    <td>
                      <div className="quotation-service-name">
                        {displayValue(item.item_name || item.service_name || item.name)}
                      </div>
                    </td>

                    <td className="quotation-money-cell">
                      <div className="quotation-cell-currency-amount">
                        <span className="quotation-cell-currency">{currency}</span>
                        <span className="quotation-cell-amount">{formatAmountOnly(price)}</span>
                      </div>
                    </td>

                    <td className="quotation-money-cell">
                      {taxRate}%
                    </td>

                    <td className="quotation-money-cell quotation-line-total">
                      <div className="quotation-cell-currency-amount">
                        <span className="quotation-cell-currency">{currency}</span>
                        <span className="quotation-cell-amount">{formatAmountOnly(lineTotal)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="quotation-empty-items">
                  No service items available.
                </td>
              </tr>
            )}

            {/* In-table Discount row */}
            <tr className="quotation-table-discount-row">
              <td colSpan={4} className="quotation-table-summary-label">
                Discount (-)
              </td>
              <td className="quotation-money-cell quotation-table-summary-val">
                <div className="quotation-cell-currency-amount">
                  <span className="quotation-cell-currency">{currency}</span>
                  <span className="quotation-cell-amount">{discount > 0 ? `-${formatAmountOnly(discount)}` : formatAmountOnly(0)}</span>
                </div>
              </td>
            </tr>

            {/* In-table Total Project Cost row */}
            <tr className="quotation-table-total-row">
              <td colSpan={4} className="quotation-table-summary-label">
                Total Project Cost
              </td>
              <td className="quotation-money-cell quotation-table-total-val">
                <div className="quotation-cell-currency-amount">
                  <span className="quotation-cell-currency">{currency}</span>
                  <span className="quotation-cell-amount">{formatAmountOnly(grandTotal)}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Terms and payment terms */}
      <section className="quotation-bottom-grid">
        <div className="quotation-notes-column">
          <div className="quotation-payment-terms-wrap">
            <h4 className="quotation-payment-terms-title">PAYMENT TERMS</h4>
            <div className="quotation-payment-terms-card">
              <div className="quotation-pt-header-row">
                <span>Payment Stage</span>
                <span>Amount</span>
              </div>
              <div className="quotation-pt-divider" />
              <div className="quotation-pt-data-row">
                <span className="quotation-pt-stage">Advance Payment</span>
                <strong className="quotation-pt-amount">{formatMoney(advancePrice, currency)}</strong>
              </div>
              <div className="quotation-pt-data-row">
                <span className="quotation-pt-stage">Balance Payment</span>
                <strong className="quotation-pt-amount">{formatMoney(remainingBalance, currency)}</strong>
              </div>
            </div>
          </div>

          {quotation.terms_and_conditions && (
            <div className="quotation-text-section" style={{ marginTop: "22px" }}>
              <h3>Terms & Conditions</h3>
              <p>{quotation.terms_and_conditions}</p>
            </div>
          )}

          {quotation.terms && !quotation.terms_and_conditions && (
            <div className="quotation-text-section" style={{ marginTop: "22px" }}>
              <h3>Terms & Conditions</h3>
              <p>{quotation.terms}</p>
            </div>
          )}
        </div>

        <div className="quotation-summary">
          {/* Right column */}
        </div>
      </section>

      {/* Signature and closing footer */}
      <footer className="quotation-footer">
        <div className="quotation-footer-message">
          <h3>{company.quotation_thank_you_title || "Thank You"}</h3>
          <p>
            {company.quotation_thank_you_message ||
              "We appreciate the opportunity to work with your business. NetIT Technology is committed to delivering a modern, scalable, and professional real estate platform that connects property buyers, sellers, landlords, and real estate agents through an advanced online property marketplace."}
          </p>

          <div className="quotation-prepared-by-block">
            <div className="quotation-prepared-by-label">Prepared by:</div>
            <div className="quotation-prepared-by-name">
              {company.quotation_prepared_by || "NetIT Technology"}
            </div>
            <div className="quotation-prepared-by-services">
              {company.quotation_prepared_by_services ||
                "Web Development • Software Solutions • Digital Marketing"}
            </div>
          </div>
        </div>

        <div className="quotation-signature">
          {signatureImage && (
            <img src={signatureImage} alt="Authorized signature" />
          )}
          <div className="quotation-signature-line" />
          <strong>
            {company.quotation_ceo_name ||
              company.authorized_person ||
              company.contact_person ||
              "D M N K DISSANAYAKA"}
          </strong>
          <span>
            {company.quotation_ceo_designation ||
              company.designation ||
              "CEO (NetIT Technology)"}
          </span>
        </div>

        <div className="quotation-footer-bottom">
          <span>{company.name || company.company_name || "Quotation Document"}</span>
          <span>Quotation · {displayValue(quotation.quotation_number)}</span>
        </div>
      </footer>
    </article>
  );
}