import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import API_BASE_URL from "../services/api";

const COLORS = {
  navy: [15, 34, 64],          // Executive Deep Navy (#0F2240)
  navyDark: [10, 24, 46],      // Ultra Navy (#0A182E)
  blue: [28, 86, 219],         // Professional Accent Blue (#1C56DB)
  text: [30, 41, 59],          // Deep Slate Text (#1E293B)
  muted: [100, 116, 139],      // Secondary/Label Slate (#64748B)
  border: [214, 224, 237],     // Clean Border (#D6E0ED)
  light: [248, 250, 253],      // Soft Background Fill (#F8FAFD)
  white: [255, 255, 255],
};

const PAGE_MARGIN = 14;
const FOOTER_SPACE = 14;

const valueOrEmpty = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const numericValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function formatDate(value) {
  if (!value) return "Not specified";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value, currency) {
  return `${currency} ${numericValue(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function resolveImageSource(company, keys) {
  for (const key of keys) {
    const val = company?.[key];
    if (val && typeof val === "string") {
      if (
        val.startsWith("http://") ||
        val.startsWith("https://") ||
        val.startsWith("data:")
      ) {
        return val;
      }
      const cleanPath = val.startsWith("/") ? val : `/${val}`;
      return `${API_BASE_URL}${cleanPath}`;
    }
  }
  return "";
}

// Convert a loaded image to a PDF-safe data URL; inaccessible images are skipped.
async function loadImageData(source, description) {
  if (!source) return null;
  const str = String(source).trim();
  if (!str) return null;
  if (str.startsWith("data:")) return str;

  // Try fetching directly as a blob first (fast, reliable base64 conversion)
  try {
    const res = await fetch(str, { mode: "cors" });
    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 0) {
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
        if (dataUrl) return dataUrl;
      }
    }
  } catch {
    // Fall back to Image + Canvas if fetch fails
  }

  if (typeof Image === "undefined") return null;

  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image canvas is not available.");

        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        console.warn(`Could not include the quotation ${description}.`, error);
        resolve(null);
      }
    };

    image.onerror = (error) => {
      console.warn(`Could not load the quotation ${description}.`, error);
      resolve(null);
    };

    image.src = str;
  });
}

function containImage(doc, imageData, x, y, maxWidth, maxHeight) {
  if (!imageData) return;

  try {
    const dimensions = doc.getImageProperties(imageData);
    const ratio = Math.min(
      maxWidth / dimensions.width,
      maxHeight / dimensions.height
    );
    const width = dimensions.width * ratio;
    const height = dimensions.height * ratio;
    doc.addImage(
      imageData,
      dimensions.fileType || "PNG",
      x + (maxWidth - width) / 2,
      y + (maxHeight - height) / 2,
      width,
      height
    );
  } catch (error) {
    console.warn("Could not add an image to the quotation PDF.", error);
  }
}

function itemValues(item, index, currency) {
  const price = numericValue(item.unit_price ?? item.Price ?? item.price);
  const taxRate = numericValue(item.tax_rate ?? item.taxRate);
  const lineTotal =
    item.line_total ?? item.total ?? price * (1 + taxRate / 100);
  const details = [
    valueOrEmpty(item.item_name || item.service_name || item.name) ||
      `Service ${index + 1}`,
    item.technology ? `Technology: ${item.technology}` : "",
    item.website_type ? `Type: ${item.website_type}` : "",
    item.hosting_domain ? `Hosting & Domain: ${item.hosting_domain}` : "",
    item.description ? `Scope: ${item.description}` : "",
    item.deliverables ? `Deliverables: ${item.deliverables}` : "",
  ].filter(Boolean);

  return [
    String(index + 1),
    details.join("\n"),
    formatMoney(price, currency),
    `${taxRate}%`,
    formatMoney(lineTotal, currency),
  ];
}

// Add wrapped section with clean white background (no box)
function addWrappedSection(doc, title, content, y, margin, pageBottom, maxWidth) {
  if (!content) return y;

  const targetWidth = maxWidth || (doc.internal.pageSize.getWidth() - margin * 2);
  const lines = doc.splitTextToSize(content, targetWidth);
  const lineHeight = 4.2;
  let currentY = y;

  if (currentY + 10 > pageBottom) {
    doc.addPage();
    currentY = margin;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.navy);
  doc.text(title, margin, currentY);
  currentY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.text);

  lines.forEach((line) => {
    if (currentY + lineHeight > pageBottom) {
      doc.addPage();
      currentY = margin;
    }
    doc.text(line, margin, currentY);
    currentY += lineHeight;
  });

  return currentY + 3.5;
}

// Draw custom template sections (configured via Template Settings)
function drawCustomTemplateSections(doc, customSections, startY, margin, contentWidth, pageBottom) {
  let currentY = startY;

  const sections = Array.isArray(customSections)
    ? customSections
    : typeof customSections === "string"
      ? (() => {
          try {
            const p = JSON.parse(customSections);
            return Array.isArray(p) ? p : [];
          } catch {
            return [];
          }
        })()
      : [];

  sections.forEach((section) => {
    const heading = valueOrEmpty(section.heading || section.title);
    const subText = valueOrEmpty(section.sub_text || section.subText || section.content || section.text);

    if (!heading && !subText) return;

    if (currentY + 14 > pageBottom) {
      doc.addPage();
      currentY = margin;
    }

    if (heading) {
      doc.setFillColor(...COLORS.navy);
      doc.rect(margin, currentY, contentWidth, 5.5, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.white);
      doc.text(heading.toUpperCase(), margin + 3.5, currentY + 3.8);

      currentY += 8;
    }

    if (subText) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.text);
      const lines = doc.splitTextToSize(subText, contentWidth - 4);

      lines.forEach((line) => {
        if (currentY + 4.0 > pageBottom) {
          doc.addPage();
          currentY = margin;
        }
        doc.text(line, margin + 2, currentY);
        currentY += 4.0;
      });

      currentY += 4.5;
    }
  });

  return currentY;
}

function drawFooter(doc, quotationNumber) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.25);
    doc.line(
      PAGE_MARGIN,
      pageHeight - 11,
      pageWidth - PAGE_MARGIN,
      pageHeight - 11
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Quotation ${quotationNumber}`, PAGE_MARGIN, pageHeight - 6);
    doc.text(
      `Page ${page} of ${pageCount}`,
      pageWidth - PAGE_MARGIN,
      pageHeight - 6,
      { align: "right" }
    );
  }
}

/**
 * Generate and download a valid A4 quotation PDF from application data.
 */
export async function downloadQuotationPdf(
  quotation,
  company = {},
  customer = {},
  filename = "Quotation.pdf"
) {
  if (!quotation || typeof quotation !== "object") {
    throw new Error("Quotation data is required to generate the PDF.");
  }

  const currency = quotation.currency || "LKR";
  const items = Array.isArray(quotation.items)
    ? quotation.items
    : Array.isArray(quotation.services)
      ? quotation.services
      : [];
  const logoSource = resolveImageSource(company, [
    "logo_url",
    "logo",
    "company_logo",
  ]);
  const signatureSource = resolveImageSource(company, [
    "signature_url",
    "signature",
    "company_signature",
  ]);

  const [logoData, signatureData] = await Promise.all([
    loadImageData(logoSource, "company logo"),
    loadImageData(signatureSource, "authorized signature"),
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const companyName = valueOrEmpty(company.name || company.company_name);
  const companyLines = [
    company.address || company.company_address,
    company.phone || company.contact_number,
    company.email || company.email_address,
    company.website,
  ]
    .map(valueOrEmpty)
    .filter(Boolean);

  // 1. HEADER SECTION
  // Logo placement
  const logoY = 14;
  const logoH = 22;
  const logoW = 22;
  containImage(doc, logoData, PAGE_MARGIN, logoY, logoW, logoH);

  const companyTextX = logoData ? PAGE_MARGIN + logoW + 6 : PAGE_MARGIN;
  const companyTextWidth = logoData ? 95 : 120;

  // Calculate total height of company text block to vertically center it with the logo
  const nameLineHeight = 5.0;
  const addressLineHeight = 3.6;
  const totalCompanyTextHeight =
    (companyName ? nameLineHeight : 0) + companyLines.length * addressLineHeight;

  // Vertically align company details text to the middle of the logo
  let headerY = logoY + Math.max(0, (logoH - totalCompanyTextHeight) / 2) + 1.2;

  if (companyName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.navy);
    const nameLines = doc.splitTextToSize(companyName, companyTextWidth);
    doc.text(nameLines, companyTextX, headerY);
    headerY += nameLines.length * nameLineHeight;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...COLORS.muted);
  companyLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, companyTextWidth);
    doc.text(wrapped, companyTextX, headerY);
    headerY += wrapped.length * addressLineHeight;
  });

  // Right Side Header: Document Title & Subheading
  const headingText = valueOrEmpty(company.pdf_heading) || "QUOTATION";
  const subheadingText =
    valueOrEmpty(company.pdf_subheading) || "PROFESSIONAL SERVICES PROPOSAL";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.navy);
  doc.text(headingText, pageWidth - PAGE_MARGIN, 22, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.blue);
  doc.text(subheadingText, pageWidth - PAGE_MARGIN, 28, { align: "right" });

  // 2. NAVY BLUE ONLY DIVIDER BAR
  let y = Math.max(logoY + logoH + 4, headerY + 3);
  doc.setFillColor(...COLORS.navy);
  doc.rect(PAGE_MARGIN, y, contentWidth, 1.2, "F");
  y += 5;

  const customHeaderNotice = valueOrEmpty(company.pdf_custom_lines);
  if (customHeaderNotice) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(...COLORS.muted);
    const splitCustom = doc.splitTextToSize(customHeaderNotice, contentWidth);
    doc.text(splitCustom, PAGE_MARGIN, y);
    y += splitCustom.length * 3.6 + 4;
  } else {
    y += 2;
  }

  // 3. QUOTATION NUMBER, DATE, VALID UNTIL (Clean layout, NO boxes, white background)
  const quotationNum =
    valueOrEmpty(quotation.quotation_number || quotation.quotationNumber) ||
    "Not specified";
  const quotationDate = formatDate(quotation.quotation_date || quotation.date);
  const validUntil = formatDate(quotation.valid_until);

  const colWidth = contentWidth / 3;

  // Column 1: Quotation Number (Reduced font size as requested)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.navy);
  doc.text("QUOTATION NUMBER", PAGE_MARGIN, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2); // Reduced font size
  doc.text(quotationNum, PAGE_MARGIN, y + 4.8);

  // Column 2: Quotation Date
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.navy);
  doc.text("QUOTATION DATE", PAGE_MARGIN + colWidth, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...COLORS.text);
  doc.text(quotationDate, PAGE_MARGIN + colWidth, y + 4.8);

  // Column 3: Valid Until
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.navy);
  doc.text("VALID UNTIL", PAGE_MARGIN + colWidth * 2, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...COLORS.text);
  doc.text(validUntil, PAGE_MARGIN + colWidth * 2, y + 4.8);

  // Space before PREPARED FOR & PROJECT DETAILS (moved down with proper breathing space)
  y += 18;

  // 4. PREPARED FOR & PROJECT DETAILS (Normal layout, NO boxes, topics bold)
  const clientName =
    customer.customer_name ||
    customer.name ||
    quotation.customer_name ||
    quotation.client_name ||
    quotation.customer?.name ||
    quotation.client?.name;
  const clientCompany =
    customer.company_name ||
    customer.customer_company ||
    quotation.customer_company ||
    quotation.company_name;

  const clientEntries = [
    ["Client", valueOrEmpty(clientName)],
    ["Company", valueOrEmpty(clientCompany)],
    [
      "Address",
      valueOrEmpty(
        customer.address ||
          customer.customer_address ||
          quotation.customer_address ||
          quotation.customer?.address ||
          quotation.client?.address
      ),
    ],
    [
      "Email",
      valueOrEmpty(
        customer.email ||
          customer.customer_email ||
          quotation.customer_email ||
          quotation.email ||
          quotation.customer?.email ||
          quotation.client?.email
      ),
    ],
    [
      "Phone",
      valueOrEmpty(
        customer.phone ||
          customer.customer_phone ||
          quotation.customer_phone ||
          quotation.phone ||
          quotation.customer?.phone ||
          quotation.client?.phone
      ),
    ],
  ].filter(([, value]) => value);

  const projectEntries = [
    ["Start Date", formatDate(quotation.project_start_date)],
    [
      "Duration",
      quotation.estimated_duration || quotation.project_duration
        ? `${quotation.estimated_duration || quotation.project_duration} ${
            quotation.duration_unit || quotation.project_duration_unit || ""
          }`.trim()
        : "Not specified",
    ],
    [
      "Estimated Completion",
      formatDate(
        quotation.estimated_completion_date || quotation.estimated_completion
      ),
    ],
  ];

  const colXLeft = PAGE_MARGIN;
  const colXRight = PAGE_MARGIN + contentWidth / 2 + 5;
  const subColWidth = contentWidth / 2 - 8;

  // Left Column Header: PREPARED FOR
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.setTextColor(...COLORS.navy);
  doc.text("PREPARED FOR", colXLeft, y);

  // Right Column Header: PROJECT DETAILS
  doc.text("PROJECT DETAILS", colXRight, y);

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(colXLeft, y + 2.5, colXLeft + subColWidth, y + 2.5);
  doc.line(colXRight, y + 2.5, colXRight + subColWidth, y + 2.5);

  let leftY = y + 8;
  clientEntries.forEach(([label, value], idx) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    doc.setTextColor(...COLORS.muted);
    const labelStr = `${label}:`;
    const labelWidth = doc.getTextWidth(labelStr);
    doc.text(labelStr, colXLeft, leftY);

    if (label.toLowerCase() === "client" || idx === 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.navy);
    } else if (label.toLowerCase() === "company") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.text);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.text);
    }
    const spaceWidth = 1.6;
    const valueX = colXLeft + labelWidth + spaceWidth;
    const valText = doc.splitTextToSize(value, subColWidth - (labelWidth + spaceWidth));
    doc.text(valText, valueX, leftY);
    leftY += Math.max(valText.length * 4.4, 4.8);
  });

  let rightY = y + 8;
  projectEntries.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    doc.setTextColor(...COLORS.muted);
    doc.text(`${label}:`, colXRight, rightY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.text);
    const valText = doc.splitTextToSize(value, subColWidth - 36);
    doc.text(valText, colXRight + 34, rightY);
    rightY += Math.max(valText.length * 4.4, 4.8);
  });

  y = Math.max(leftY, rightY) + 9;

  // 5. SERVICES & DELIVERABLES (Generous cell padding, larger fonts, fills page)
  if (y + 16 > pageHeight - FOOTER_SPACE) {
    doc.addPage();
    y = PAGE_MARGIN;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.navy);
  doc.text("Services & Deliverables", PAGE_MARGIN, y + 2);

  const tableRows = items.map((item, index) =>
    itemValues(item, index, currency)
  );

  autoTable(doc, {
    startY: y + 6,
    head: [["#", "SERVICE / DELIVERABLE DETAILS", "UNIT PRICE", "TAX", "LINE TOTAL"]],
    body:
      tableRows.length > 0
        ? tableRows
        : [["", "No service items available.", "", "", ""]],
    margin: {
      left: PAGE_MARGIN,
      right: PAGE_MARGIN,
      top: PAGE_MARGIN,
      bottom: FOOTER_SPACE,
    },
    theme: "grid",
    headStyles: {
      fillColor: COLORS.navy,
      textColor: COLORS.white,
      font: "helvetica",
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: 3.2,
      halign: "left",
    },
    bodyStyles: {
      textColor: COLORS.text,
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 4,
      overflow: "linebreak",
      valign: "top",
      lineColor: COLORS.border,
      lineWidth: 0.15,
    },
    alternateRowStyles: { fillColor: [250, 252, 255] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", fontStyle: "bold", textColor: COLORS.muted },
      1: { cellWidth: contentWidth - 10 - 30 - 18 - 34 },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 18, halign: "right", textColor: COLORS.muted },
      4: { cellWidth: 34, halign: "right", fontStyle: "bold", textColor: COLORS.navy },
    },
    didParseCell: function (data) {
      if (data.section === "head") {
        if (data.column.index === 0) data.cell.styles.halign = "center";
        if (data.column.index >= 2) data.cell.styles.halign = "right";
      }
      if (data.section === "body" && data.column.index === 4) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = COLORS.navy;
      }
    },
    showHead: "everyPage",
    rowPageBreak: "auto",
  });
  y = doc.lastAutoTable.finalY + 10;

  // 6. FINANCIAL SUMMARY & BANK PAYMENT DETAILS
  const subtotal =
    quotation.subtotal ??
    items.reduce(
      (total, item) =>
        total + numericValue(item.unit_price ?? item.Price ?? item.price),
      0
    );
  const taxAmount =
    quotation.tax_amount ??
    quotation.taxAmount ??
    items.reduce((total, item) => {
      const price = numericValue(item.unit_price ?? item.Price ?? item.price);
      const rate = numericValue(item.tax_rate ?? item.taxRate);
      return total + (price * rate) / 100;
    }, 0);
  const discount = quotation.discount_amount ?? quotation.discount ?? 0;
  const grandTotal =
    quotation.grand_total ??
    quotation.grandTotal ??
    quotation.total_amount ??
    numericValue(subtotal) + numericValue(taxAmount) - numericValue(discount);

  const summaryRows = [
    ["Subtotal", formatMoney(subtotal, currency)],
    ["Tax", formatMoney(taxAmount, currency)],
    ["Discount", `- ${formatMoney(discount, currency)}`],
  ];

  const summaryWidth = 82;
  const summaryX = pageWidth - PAGE_MARGIN - summaryWidth;

  if (y + 36 > pageHeight - FOOTER_SPACE) {
    doc.addPage();
    y = PAGE_MARGIN;
  }

  // Draw Bank & Payment Details Card on the left (if available)
  const bankName = valueOrEmpty(company.bank_name || quotation.bank_name);
  const accountName = valueOrEmpty(
    company.bank_account_name || quotation.bank_account_name
  );
  const accountNumber = valueOrEmpty(
    company.bank_account_number || quotation.bank_account_number
  );
  const branch = valueOrEmpty(company.bank_branch || quotation.bank_branch);
  const swiftCode = valueOrEmpty(
    company.bank_swift_code || quotation.bank_swift_code
  );

  let bankEndY = y;
  const hasBankDetails = Boolean(bankName || accountNumber || accountName);

  if (hasBankDetails) {
    const bankBoxX = PAGE_MARGIN;
    const bankBoxWidth = summaryX - PAGE_MARGIN - 6;
    const bankEntries = [
      ["Bank Name", bankName, false],
      ["Account Name", accountName, false],
      ["Account Number", accountNumber, true],
      ["Branch", branch, false],
      ["SWIFT / BIC", swiftCode, false],
    ].filter(([, val]) => Boolean(val));

    if (bankEntries.length > 0) {
      const boxHeight = 9 + bankEntries.length * 4.6;
      doc.setFillColor(...COLORS.light);
      doc.setDrawColor(...COLORS.border);
      doc.roundedRect(bankBoxX, y, bankBoxWidth, boxHeight, 1.5, 1.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.8);
      doc.setTextColor(...COLORS.navy);
      doc.text("BANK & PAYMENT DETAILS", bankBoxX + 4.5, y + 4.5);

      doc.setDrawColor(...COLORS.blue);
      doc.setLineWidth(0.4);
      doc.line(bankBoxX + 4.5, y + 6.2, bankBoxX + 40, y + 6.2);
      doc.setLineWidth(0.2);

      let bY = y + 10.2;
      bankEntries.forEach(([label, value, isHighlighted]) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.2);
        doc.setTextColor(...COLORS.muted);
        doc.text(`${label}:`, bankBoxX + 4.5, bY);

        if (isHighlighted) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(...COLORS.navy);
        } else {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...COLORS.text);
        }
        doc.text(value, bankBoxX + 30, bY);
        bY += 4.6;
      });

      bankEndY = y + boxHeight;
    }
  }

  summaryRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, summaryX + 2, y + 2.5);
    doc.setTextColor(...COLORS.text);
    doc.setFont("helvetica", "bold");
    doc.text(value, pageWidth - PAGE_MARGIN, y + 2.5, { align: "right" });
    y += 5.8;
  });

  // GRAND TOTAL Card
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(summaryX, y, summaryWidth, 13, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(191, 219, 254);
  doc.text("GRAND TOTAL", summaryX + 4.5, y + 5.2);
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.white);
  doc.text(formatMoney(grandTotal, currency), pageWidth - PAGE_MARGIN - 4.5, y + 5.2, {
    align: "right",
  });
  const summaryEndY = y + 13;
  y = Math.max(bankEndY, summaryEndY) + 12;

  const pageBottom = pageHeight - FOOTER_SPACE;

  // 7. CUSTOM TEMPLATE SECTIONS (Configured in Template Settings)
  y = drawCustomTemplateSections(
    doc,
    company?.pdf_custom_sections,
    y,
    PAGE_MARGIN,
    contentWidth,
    pageBottom
  );

  // 8. BOTTOM SECTION: TERMS, SPECIAL NOTES & AUTHORIZED SIGNATURE
  // (NO boxes, clean white background, topics bold, signature normal, full page span)
  const termsText = valueOrEmpty(
    quotation.terms_and_conditions || quotation.terms
  );
  const notesText = valueOrEmpty(quotation.notes);
  const templateFooterNote = valueOrEmpty(company.pdf_footer_note);
  const hasExtraText = Boolean(termsText || notesText || templateFooterNote);
  const authorizedName = valueOrEmpty(
    company.authorized_person || company.contact_person
  );
  const designation = valueOrEmpty(company.designation);
  const hasSignatureBlock = Boolean(signatureData || authorizedName);

  if (hasSignatureBlock) {
    const sigW = 56;
    const sigX = pageWidth - PAGE_MARGIN - sigW;
    const sigH = 30;
    const leftW = hasExtraText ? contentWidth - sigW - 8 : contentWidth;

    const countLines = (text, w) => (text ? doc.splitTextToSize(text, w).length : 0);
    const estLeftHeight =
      (termsText ? 5 + countLines(termsText, leftW) * 4.2 + 3 : 0) +
      (notesText ? 5 + countLines(notesText, leftW) * 4.2 + 3 : 0) +
      (templateFooterNote ? 5 + countLines(templateFooterNote, leftW) * 4.2 + 3 : 0);

    const neededHeight = Math.max(sigH, estLeftHeight);

    // If both cannot fit on current page, move to next page
    if (y + neededHeight > pageBottom) {
      doc.addPage();
      y = PAGE_MARGIN;
    }

    const startBottomY = y;
    let leftY = startBottomY;

    // Terms & Conditions (NO box, clean white background, proper line height)
    if (hasExtraText) {
      let curTextY = startBottomY;
      if (termsText) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.navy);
        doc.text("Terms & Conditions", PAGE_MARGIN, curTextY);
        curTextY += 5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.text);
        const tLines = doc.splitTextToSize(termsText, leftW);
        tLines.forEach((l) => {
          doc.text(l, PAGE_MARGIN, curTextY);
          curTextY += 4.2;
        });
        curTextY += 3.5;
      }

      if (notesText) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.navy);
        doc.text("Special Notes", PAGE_MARGIN, curTextY);
        curTextY += 5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.text);
        const nLines = doc.splitTextToSize(notesText, leftW);
        nLines.forEach((l) => {
          doc.text(l, PAGE_MARGIN, curTextY);
          curTextY += 4.2;
        });
        curTextY += 3.5;
      }

      if (templateFooterNote) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.navy);
        doc.text("Important Notice", PAGE_MARGIN, curTextY);
        curTextY += 5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.text);
        const fLines = doc.splitTextToSize(templateFooterNote, leftW);
        fLines.forEach((l) => {
          doc.text(l, PAGE_MARGIN, curTextY);
          curTextY += 4.2;
        });
      }

      leftY = curTextY;
    }

    // Authorized Signature (NO box, clean white background, normal look)
    const sigY = startBottomY;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.muted);
    doc.text("Authorized Signature", sigX, sigY + 2.5);

    if (signatureData) {
      containImage(doc, signatureData, sigX, sigY + 4.5, sigW, 15);
    }

    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(sigX, sigY + 21, sigX + sigW, sigY + 21);

    if (authorizedName) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.navy);
      doc.text(authorizedName, sigX, sigY + 25.5);
    }
    if (designation) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.muted);
      doc.text(designation, sigX, sigY + 29.5);
    }

    y = Math.max(leftY, sigY + sigH) + 2;
  } else if (hasExtraText) {
    if (termsText) {
      y = addWrappedSection(
        doc,
        "Terms & Conditions",
        termsText,
        y,
        PAGE_MARGIN,
        pageBottom,
        contentWidth
      );
    }
    if (notesText) {
      y = addWrappedSection(
        doc,
        "Special Notes",
        notesText,
        y,
        PAGE_MARGIN,
        pageBottom,
        contentWidth
      );
    }
    if (templateFooterNote) {
      y = addWrappedSection(
        doc,
        "Important Notice",
        templateFooterNote,
        y,
        PAGE_MARGIN,
        pageBottom,
        contentWidth
      );
    }
  }

  // 9. FOOTER
  drawFooter(
    doc,
    valueOrEmpty(quotation.quotation_number || quotation.quotationNumber) ||
      "Not specified"
  );

  const safeFilename = String(filename || "Quotation.pdf")
    .trim()
    .replace(/[<>:"/\\|?*]/g, "_");
  const pdfFilename = /\.pdf$/i.test(safeFilename)
    ? safeFilename
    : `${safeFilename}.pdf`;
  doc.save(pdfFilename);
}
