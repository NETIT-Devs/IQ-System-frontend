import "./InvoiceTemplate.css";
import API_BASE_URL from "../services/api";

const formatDate = (value) => {
  if (!value) return "—";
  const str = String(value).trim();
  const clean = str.includes("T") ? str : `${str}T00:00:00`;
  const date = new Date(clean);
  if (Number.isNaN(date.getTime())) return str;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatMoney = (value, currency = "LKR") => {
  const amount = Number(value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;

  return `${currency} ${safe.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const displayValue = (value) =>
  value !== undefined && value !== null && value !== "" ? value : "—";

export default function InvoiceTemplate({
  invoice = {},
  company = {},
  signature = null,
}) {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const currency = invoice.currency || "LKR";

  const subtotal =
    invoice.subtotal !== undefined && invoice.subtotal !== null
      ? Number(invoice.subtotal) || 0
      : items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

  const taxAmount =
    invoice.tax_amount !== undefined && invoice.tax_amount !== null
      ? Number(invoice.tax_amount) || 0
      : items.reduce(
          (sum, item) =>
            sum + ((Number(item.price) || 0) * (Number(item.tax_rate) || 0)) / 100,
          0
        );

  const grandTotal = Number(
    invoice.total_amount ?? Math.max(0, subtotal + taxAmount)
  );
  const amountPaid = Math.max(0, Number(invoice.amount_paid ?? 0));
  const balanceDue = Math.max(
    0,
    Number(invoice.balance_due ?? grandTotal - amountPaid)
  );

  const rawStatus = String(invoice.status || "").trim();
  const statusLabel =
    rawStatus ||
    (grandTotal > 0 && balanceDue <= 0
      ? "Full Paid"
      : amountPaid > 0
      ? "Partial"
      : "Unpaid");
  const statusSlug = statusLabel.toLowerCase().replace(/\s+/g, "-");

  const resolveUrl = (url) => {
    if (!url || typeof url !== "string") return "";
    if (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("data:") ||
      url === "/logo.jpg"
    ) {
      return url;
    }
    const clean = url.startsWith("/") ? url : `/${url}`;
    return `${API_BASE_URL}${clean}`;
  };

  const companyLogo = resolveUrl(
    company.logo_url || company.logo || company.company_logo || ""
  );

  const signatureImage = resolveUrl(
    signature ||
      company.signature_url ||
      company.signature ||
      company.company_signature ||
      ""
  );

  const companyName = company.name || company.company_name || "Company Name";
  const companyAddress = company.address || company.company_address || "";
  const companyPhone = company.phone || company.contact_number || "";
  const companyEmail = company.email || company.email_address || "";
  const companyWebsite = company.website || "";

  const clientName =
    invoice.customer_name ||
    invoice.client_name ||
    invoice.customer?.name ||
    invoice.client?.name;
  const clientCompany = invoice.company_name || invoice.customer_company || "";
  const clientAddress =
    invoice.address || invoice.customer_address || invoice.customer?.address || "";
  const clientEmail =
    invoice.email || invoice.customer_email || invoice.customer?.email || "";
  const clientPhone =
    invoice.phone || invoice.customer_phone || invoice.customer?.phone || "";

  return (
    <article className="invoice-document">
      {/* Company & Invoice Header */}
      <header className="invoice-doc-header">
        <div className="invoice-doc-header-main">
          <div className="invoice-doc-brand">
            {companyLogo && (
              <img
                className="invoice-doc-logo"
                src={companyLogo}
                alt={`${companyName} logo`}
                onError={(e) => {
                  if (!e.currentTarget.dataset.fallback) {
                    e.currentTarget.dataset.fallback = "1";
                    e.currentTarget.src = "/logo.jpg";
                  } else {
                    e.currentTarget.style.display = "none";
                  }
                }}
              />
            )}

            <div className="invoice-doc-company">
              <h2>{displayValue(companyName)}</h2>
              {companyAddress && <p>{companyAddress}</p>}
              {companyPhone && <p>Phone: {companyPhone}</p>}
              {companyEmail && <p>Email: {companyEmail}</p>}
              {companyWebsite && <p>{companyWebsite}</p>}
            </div>
          </div>

          <div className="invoice-doc-heading">
            <span className="invoice-doc-eyebrow">OFFICIAL BILLING DOCUMENT</span>
            <h1>INVOICE</h1>
            <span className={`invoice-doc-status ${statusSlug}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="invoice-doc-divider" />
      </header>

      {/* Invoice Reference Strip */}
      <section className="invoice-doc-ref-grid">
        <div className="invoice-doc-ref-item">
          <span>INVOICE NUMBER</span>
          <strong>
            {displayValue(invoice.invoice_number || invoice.invoiceNumber)}
          </strong>
        </div>

        <div className="invoice-doc-ref-item">
          <span>INVOICE DATE</span>
          <strong>{formatDate(invoice.invoice_date)}</strong>
        </div>

        <div className="invoice-doc-ref-item">
          <span>DUE DATE</span>
          <strong>{formatDate(invoice.due_date)}</strong>
        </div>

        <div className="invoice-doc-ref-item">
          <span>{invoice.quotation_number ? "QUOTATION REF" : "CURRENCY"}</span>
          <strong>{invoice.quotation_number || currency}</strong>
        </div>
      </section>

      {/* Bill To & Payment Overview */}
      <section className="invoice-doc-details-grid">
        <div className="invoice-doc-section">
          <h3 className="invoice-doc-section-title">BILL TO</h3>
          <div className="invoice-doc-client-name">{displayValue(clientName)}</div>
          {clientCompany && (
            <p className="invoice-doc-client-company">{clientCompany}</p>
          )}
          {clientAddress && <p>{clientAddress}</p>}
          {clientEmail && <p>{clientEmail}</p>}
          {clientPhone && <p>{clientPhone}</p>}
        </div>

        <div className="invoice-doc-section invoice-doc-overview">
          <h3 className="invoice-doc-section-title">BILLING OVERVIEW</h3>
          <div className="invoice-doc-overview-row">
            <span>Currency</span>
            <strong>{currency}</strong>
          </div>
          <div className="invoice-doc-overview-row">
            <span>Payment Status</span>
            <strong>{statusLabel}</strong>
          </div>
          {amountPaid > 0 && invoice.payment_method && (
            <div className="invoice-doc-overview-row">
              <span>Payment Method</span>
              <strong>{invoice.payment_method}</strong>
            </div>
          )}
          <div className="invoice-doc-overview-row">
            <span>Amount Paid</span>
            <strong className="paid">{formatMoney(amountPaid, currency)}</strong>
          </div>
        </div>
      </section>

      {/* Items & Services Table */}
      <section className="invoice-doc-items-section">
        <div className="invoice-doc-items-head">
          <div>
            <span className="invoice-doc-items-eyebrow">LINE ITEMS</span>
            <h2>Items &amp; Services</h2>
          </div>
          <span className="invoice-doc-item-count">
            {items.length} {items.length === 1 ? "ITEM" : "ITEMS"}
          </span>
        </div>

        <table className="invoice-doc-table">
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th className="col-desc">ITEM / SERVICE DETAILS</th>
              <th className="col-money">PRICE</th>
              <th className="col-tax">TAX</th>
              <th className="col-money">LINE TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item, idx) => {
                const price = Number(item.unit_price ?? item.price ?? 0) || 0;
                const taxRate = Number(item.tax_rate ?? item.taxRate ?? 0) || 0;
                const lineTotal =
                  item.line_total !== undefined && item.line_total !== null
                    ? Number(item.line_total) || 0
                    : price * (1 + taxRate / 100);

                return (
                  <tr key={item.id || item.invoice_item_id || idx}>
                    <td className="col-num">{idx + 1}</td>
                    <td>
                      <div className="invoice-doc-item-name">
                        {displayValue(item.item_name || item.name)}
                      </div>
                      {item.description && (
                        <p className="invoice-doc-item-desc">{item.description}</p>
                      )}
                    </td>
                    <td className="col-money">{formatMoney(price, currency)}</td>
                    <td className="col-tax">{taxRate}%</td>
                    <td className="col-money total">
                      {formatMoney(lineTotal, currency)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="invoice-doc-empty">
                  No invoice items specified.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Left: Thank You + Notes + Terms | Right: Financial Summary + Signature */}
      <section className="invoice-doc-bottom-grid">
        <div className="invoice-doc-notes-col">
          <h3 className="invoice-doc-thanks-heading">
            Thank you for business with us
          </h3>

          {invoice.notes && (
            <div className="invoice-doc-text-block">
              <h3>Notes</h3>
              <p>{invoice.notes}</p>
            </div>
          )}

          {(invoice.terms_and_conditions || invoice.terms) && (
            <div className="invoice-doc-text-block">
              <h3>Terms &amp; Conditions</h3>
              <p>{invoice.terms_and_conditions || invoice.terms}</p>
            </div>
          )}
        </div>

        <div className="invoice-doc-right-col">
          <div className="invoice-doc-summary">
            <h3>Financial Summary</h3>

            <div className="invoice-doc-summary-row">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal, currency)}</span>
            </div>

            <div className="invoice-doc-summary-row">
              <span>Tax</span>
              <span>{formatMoney(taxAmount, currency)}</span>
            </div>

            <div className="invoice-doc-grand-total">
              <span>GRAND TOTAL</span>
              <strong>{formatMoney(grandTotal, currency)}</strong>
            </div>

            <div className="invoice-doc-summary-row paid">
              <span>Paid Amount</span>
              <span>- {formatMoney(amountPaid, currency)}</span>
            </div>

            <div
              className={`invoice-doc-balance-row ${
                balanceDue <= 0 && grandTotal > 0 ? "settled" : "due"
              }`}
            >
              <span>Balance Due</span>
              <strong>{formatMoney(balanceDue, currency)}</strong>
            </div>
          </div>

          {(signatureImage || company.authorized_person || companyName) && (
            <div className="invoice-doc-signature">
              {signatureImage && (
                <img src={signatureImage} alt="Authorized signature" />
              )}
              <div className="invoice-doc-sig-line" />
              <strong>
                {company.authorized_person ||
                  company.contact_person ||
                  "Authorized Signature"}
              </strong>
              <span>{company.designation || companyName}</span>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="invoice-doc-footer">
        <div className="invoice-doc-footer-bar">
          <span>{companyName}</span>
          <span>
            Invoice · {displayValue(invoice.invoice_number || invoice.invoiceNumber)}
          </span>
        </div>
      </footer>
    </article>
  );
}

