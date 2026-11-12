import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import API_BASE_URL from "../services/api";
import { formatDescriptionPointByPoint } from "./deliverablesFormatter";

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
  const lineTax = (price * taxRate) / 100;
  const lineTotal =
    item.line_total != null &&
      Number(item.line_total) > 0 &&
      Math.abs(Number(item.line_total) - (price + lineTax)) < 0.01
      ? numericValue(item.line_total)
      : price + lineTax;
  const metaLines = [
    valueOrEmpty(item.item_name || item.service_name || item.name) ||
    `Service ${index + 1}`,
    item.technology ? `Technology: ${item.technology}` : "",
    item.website_type ? `Type: ${item.website_type}` : "",
    item.hosting_domain ? `Hosting & Domain: ${item.hosting_domain}` : "",
  ].filter(Boolean);

  const detailBlocks = [metaLines.join("\n")];

  const formattedDesc = item.description
    ? formatDescriptionPointByPoint(item.description, {
      indent: "  ",
      ensureBullets: true,
    })
    : "";
  if (formattedDesc) {
    const hasSectionHeader =
      /^(Description|Core\s*features?|Maintenance\s*(?:&|and)?\s*support|Content\s*(?:&|and)?\s*SEO|Deliverables?|Scope)\s*:/im.test(
        formattedDesc
      );
    detailBlocks.push(
      hasSectionHeader ? formattedDesc : `Scope:\n${formattedDesc}`
    );
  }

  const formattedDeliverables = item.deliverables
    ? formatDescriptionPointByPoint(item.deliverables, {
      indent: "  ",
      ensureBullets: true,
    })
    : "";
  if (formattedDeliverables) {
    const hasDelivHeader = /^(Deliverables?)\s*:/im.test(formattedDeliverables);
    detailBlocks.push(
      hasDelivHeader
        ? formattedDeliverables
        : `Deliverables:\n${formattedDeliverables}`
    );
  }

  return [
    String(index + 1),
    detailBlocks.join("\n\n"),
    formatMoney(price, currency),
    `${taxRate}%`,
    formatMoney(lineTotal, currency),
  ];
}

// Add wrapped section 
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
 * Internal helper to generate a valid A4 jsPDF quotation document.
 */
export async function createQuotationPdfDoc(
  quotation,
  company = {},
  customer = {}
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
  const companyTextWidth = logoData ? 82 : 105;

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
  const colMaxW = colWidth - 4;

  // Column 1: Quotation Number (Reduced font size as requested)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.navy);
  doc.text("QUOTATION NUMBER", PAGE_MARGIN, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2); // Reduced font size
  const qNumLines = doc.splitTextToSize(quotationNum, colMaxW);
  doc.text(qNumLines, PAGE_MARGIN, y + 4.8);

  // Column 2: Quotation Date
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.navy);
  doc.text("QUOTATION DATE", PAGE_MARGIN + colWidth, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...COLORS.text);
  const qDateLines = doc.splitTextToSize(quotationDate, colMaxW);
  doc.text(qDateLines, PAGE_MARGIN + colWidth, y + 4.8);

  // Column 3: Valid Until
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.navy);
  doc.text("VALID UNTIL", PAGE_MARGIN + colWidth * 2, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...COLORS.text);
  const qValidLines = doc.splitTextToSize(validUntil, colMaxW);
  doc.text(qValidLines, PAGE_MARGIN + colWidth * 2, y + 4.8);

  const maxRefLines = Math.max(qNumLines.length, qDateLines.length, qValidLines.length, 1);
  // Space before PREPARED FOR & PROJECT DETAILS (moved down with proper breathing space)
  y += 14 + maxRefLines * 4;

  // 4. PREPARED FOR & PROJECT DETAILS (Normal layout, NO boxes, topics bold)
  const clientName =
    customer.customer_name ||
    customer.name ||
    quotation.customer_name ||
    quotation.client_name ||
    quotation.customer?.name ||
    quotation.client?.name;
  const clientEntries = [
    ["Client", valueOrEmpty(clientName)],
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
  ].filter(([, value]) => value);

  const projectEntries = [
    ["Start Date", "Initial Advance Payment Date"],
    [
      "Duration",
      quotation.estimated_duration || quotation.project_duration
        ? `${quotation.estimated_duration || quotation.project_duration} ${quotation.duration_unit || quotation.project_duration_unit || ""
          }`.trim()
        : "Not specified",
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
    const labelStr = `${label}:`;
    const labelWidth = doc.getTextWidth(labelStr);
    doc.text(labelStr, colXRight, rightY);

    if (label === "Start Date") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.blue);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.text);
    }
    const spaceWidth = 1.6;
    const valueX = colXRight + labelWidth + spaceWidth;
    const valText = doc.splitTextToSize(value, Math.max(20, subColWidth - (labelWidth + spaceWidth)));
    doc.text(valText, valueX, rightY);
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
  let calcSubtotal = 0;
  let calcTaxAmount = 0;

  items.forEach((item) => {
    const price = numericValue(item.unit_price ?? item.Price ?? item.price);
    const rate = numericValue(item.tax_rate ?? item.taxRate);
    calcSubtotal += price;
    calcTaxAmount += (price * rate) / 100;
  });

  const subtotal =
    quotation.subtotal !== undefined &&
      quotation.subtotal !== null &&
      Number(quotation.subtotal) > 0
      ? numericValue(quotation.subtotal)
      : calcSubtotal;

  const taxAmount =
    quotation.tax_amount !== undefined &&
      quotation.tax_amount !== null &&
      Number(quotation.tax_amount) > 0
      ? numericValue(quotation.tax_amount)
      : quotation.taxAmount !== undefined &&
        quotation.taxAmount !== null &&
        Number(quotation.taxAmount) > 0
        ? numericValue(quotation.taxAmount)
        : calcTaxAmount;

  const discount = numericValue(
    quotation.discount_amount ?? quotation.discount ?? 0
  );

  const numSubtotal = numericValue(subtotal);
  const numTax = numericValue(taxAmount);
  const numDiscount = numericValue(discount);

  // Total balance calculates from Subtotal + Tax - Discount
  const grandTotal = Math.max(0, numSubtotal + numTax - numDiscount);

  const summaryRows = [
    ["Subtotal", formatMoney(numSubtotal, currency)],
    [
      "Tax Amount (+)",
      numTax > 0
        ? `+ ${formatMoney(numTax, currency)}`
        : formatMoney(0, currency),
    ],
    [
      "Discount (-)",
      numDiscount > 0
        ? `- ${formatMoney(numDiscount, currency)}`
        : formatMoney(0, currency),
    ],
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
      const valMaxW = Math.max(25, bankBoxWidth - 33);
      const wrappedBankEntries = bankEntries.map(([label, value, isHighlighted]) => {
        doc.setFont("helvetica", isHighlighted ? "bold" : "normal");
        doc.setFontSize(isHighlighted ? 8.5 : 8);
        const lines = doc.splitTextToSize(String(value), valMaxW);
        return [label, lines, isHighlighted];
      });
      const totalBankLines = wrappedBankEntries.reduce(
        (sum, [, lines]) => sum + Math.max(1, lines.length),
        0
      );
      const boxHeight = 9.5 + totalBankLines * 4.5;
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
      wrappedBankEntries.forEach(([label, lines, isHighlighted]) => {
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
        doc.text(lines, bankBoxX + 30, bY);
        bY += Math.max(1, lines.length) * 4.5;
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

  // GRAND TOTAL / TOTAL BALANCE Card
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(summaryX, y, summaryWidth, 13, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(191, 219, 254);
  doc.text("TOTAL BALANCE", summaryX + 4.5, y + 5.2);
  doc.setFontSize(6.5);
  doc.setTextColor(147, 197, 253);
  doc.text("(Grand Total)", summaryX + 4.5, y + 9.2);
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.white);
  doc.text(formatMoney(grandTotal, currency), pageWidth - PAGE_MARGIN - 4.5, y + 6.8, {
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
    doc.text("Authorized Signature", sigX + sigW / 2, sigY + 2.5, {
      align: "center",
    });

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

  return doc;
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
  const doc = await createQuotationPdfDoc(quotation, company, customer);
  const safeFilename = String(filename || "Quotation.pdf")
    .trim()
    .replace(/[<>:"/\\|?*]/g, "_");
  const pdfFilename = /\.pdf$/i.test(safeFilename)
    ? safeFilename
    : `${safeFilename}.pdf`;

  try {
    const blob = doc.output("blob");
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = pdfFilename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch {
    doc.save(pdfFilename);
  }
}

/**
 * Generate and return an object URL for viewing the quotation PDF.
 */
export async function openQuotationPdf(
  quotation,
  company = {},
  customer = {}
) {
  const doc = await createQuotationPdfDoc(quotation, company, customer);
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}

function formatInvoiceDate(value) {
  if (!value) return "Not specified";
  const str = String(value).trim();
  const normalized = str.includes("T") ? str : `${str}T00:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return str;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function drawInvoiceFooter(doc, invoiceNumber, companyName) {
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
    const leftText = companyName
      ? `${companyName}  ·  Invoice ${invoiceNumber}`
      : `Invoice ${invoiceNumber}`;
    doc.text(leftText, PAGE_MARGIN, pageHeight - 6);
    doc.text(
      `Page ${page} of ${pageCount}`,
      pageWidth - PAGE_MARGIN,
      pageHeight - 6,
      { align: "right" }
    );
  }
}

/**
 * Generate a modern, clean A4 jsPDF Invoice document (Navy Blue, Professional Blue & White).
 * Excludes bank details; includes company logo, name, contact details, authorized signature,
 * customer details, line items, financial summary, and invoice notes/terms.
 */
export async function createInvoicePdfDoc(invoice, company = {}) {
  if (!invoice || typeof invoice !== "object") {
    throw new Error("Invoice data is required to generate the PDF.");
  }

  const currency = valueOrEmpty(invoice.currency) || "LKR";
  const items = Array.isArray(invoice.items) ? invoice.items : [];

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
  const pageBottom = pageHeight - FOOTER_SPACE;

  const companyName = valueOrEmpty(company.name || company.company_name);
  const companyLines = [
    company.address || company.company_address,
    company.phone || company.contact_number
      ? `Phone: ${company.phone || company.contact_number}`
      : "",
    company.email || company.email_address
      ? `Email: ${company.email || company.email_address}`
      : "",
    company.website,
  ]
    .map(valueOrEmpty)
    .filter(Boolean);

  // 1. HEADER: Company Logo, Name, Contact Details (left) & INVOICE Title (right)
  const logoY = 14;
  const logoH = 21;
  const logoW = 21;
  containImage(doc, logoData, PAGE_MARGIN, logoY, logoW, logoH);

  const companyTextX = logoData ? PAGE_MARGIN + logoW + 6 : PAGE_MARGIN;
  const companyTextWidth = logoData ? 82 : 106;
  const nameLineHeight = 5.0;
  const infoLineHeight = 3.7;
  const totalCompanyHeight =
    (companyName ? nameLineHeight : 0) + companyLines.length * infoLineHeight;

  let headerY = logoY + Math.max(0, (logoH - totalCompanyHeight) / 2) + 1.2;

  if (companyName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
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
    headerY += wrapped.length * infoLineHeight;
  });

  // Right-side Title & Status Pill
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.blue);
  doc.text("OFFICIAL BILLING DOCUMENT", pageWidth - PAGE_MARGIN, 17, {
    align: "right",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(23);
  doc.setTextColor(...COLORS.navy);
  doc.text("INVOICE", pageWidth - PAGE_MARGIN, 25, { align: "right" });

  const subtotalVal =
    invoice.subtotal !== undefined && invoice.subtotal !== null
      ? numericValue(invoice.subtotal)
      : items.reduce((s, it) => s + numericValue(it.unit_price ?? it.price), 0);
  const taxVal =
    invoice.tax_amount !== undefined && invoice.tax_amount !== null
      ? numericValue(invoice.tax_amount)
      : items.reduce(
          (s, it) =>
            s +
            (numericValue(it.unit_price ?? it.price) *
              numericValue(it.tax_rate)) /
              100,
          0
        );
  const discountVal = Math.max(
    0,
    numericValue(invoice.discount_amount ?? invoice.discount ?? 0) ||
      (numericValue(invoice.discount_percentage) > 0
        ? (subtotalVal * numericValue(invoice.discount_percentage)) / 100
        : 0)
  );
  const grandTotalVal = Math.max(
    0,
    numericValue(
      invoice.total_amount ?? Math.max(0, subtotalVal + taxVal - discountVal)
    )
  );
  const paidVal = Math.max(0, numericValue(invoice.amount_paid ?? 0));
  const balanceVal = Math.max(
    0,
    numericValue(invoice.balance_due ?? grandTotalVal - paidVal)
  );

  const statusText =
    valueOrEmpty(invoice.status) ||
    (grandTotalVal > 0 && balanceVal <= 0
      ? "Full Paid"
      : paidVal > 0
      ? "Partial"
      : "Unpaid");

  const statusLower = statusText.toLowerCase();
  const statusPalette = statusLower.includes("paid") && !statusLower.includes("unpaid") && !statusLower.includes("partial")
    ? { bg: [220, 252, 231], text: [21, 128, 61] }
    : statusLower.includes("partial")
    ? { bg: [254, 243, 199], text: [180, 83, 9] }
    : statusLower.includes("unpaid")
    ? { bg: [254, 226, 226], text: [185, 28, 28] }
    : { bg: [239, 246, 255], text: COLORS.blue };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const pillLabel = statusText.toUpperCase();
  const pillW = Math.max(22, doc.getTextWidth(pillLabel) + 8);
  const pillX = pageWidth - PAGE_MARGIN - pillW;
  doc.setFillColor(...statusPalette.bg);
  doc.roundedRect(pillX, 27.5, pillW, 5.5, 2.5, 2.5, "F");
  doc.setTextColor(...statusPalette.text);
  doc.text(pillLabel, pillX + pillW / 2, 31.3, { align: "center" });

  // 2. NAVY ACCENT DIVIDER
  let y = Math.max(logoY + logoH + 5, headerY + 3, 36);
  doc.setFillColor(...COLORS.navy);
  doc.rect(PAGE_MARGIN, y, contentWidth, 1.1, "F");
  y += 6.5;

  // 3. REFERENCE STRIP
  const invoiceNum =
    valueOrEmpty(invoice.invoice_number || invoice.invoiceNumber) ||
    "Not specified";
  const invDateText = formatInvoiceDate(invoice.invoice_date);
  const dueDateText = formatInvoiceDate(invoice.due_date);
  const fourthLabel = invoice.quotation_number ? "QUOTATION REF" : "CURRENCY";
  const fourthVal = valueOrEmpty(invoice.quotation_number) || currency;

  const refCols = [
    ["INVOICE NUMBER", invoiceNum, true],
    ["INVOICE DATE", invDateText, false],
    ["DUE DATE", dueDateText, false],
    [fourthLabel, fourthVal, false],
  ];
  const refColW = contentWidth / refCols.length;
  const refBoxH = 14;

  doc.setFillColor(...COLORS.light);
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.25);
  doc.roundedRect(PAGE_MARGIN, y, contentWidth, refBoxH, 1.5, 1.5, "FD");

  refCols.forEach(([label, val, isBold], idx) => {
    const colX = PAGE_MARGIN + idx * refColW;
    if (idx > 0) {
      doc.setDrawColor(...COLORS.border);
      doc.line(colX, y + 2.5, colX, y + refBoxH - 2.5);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, colX + 3.5, y + 5.2);

    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...(isBold ? COLORS.navy : COLORS.text));
    const lines = doc.splitTextToSize(String(val), refColW - 7);
    doc.text(lines[0] || "—", colX + 3.5, y + 10.5);
  });

  y += refBoxH + 8;

  // 4. BILL TO & BILLING OVERVIEW
  const colXLeft = PAGE_MARGIN;
  const colXRight = PAGE_MARGIN + contentWidth / 2 + 5;
  const subColW = contentWidth / 2 - 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.blue);
  doc.text("BILL TO", colXLeft, y);
  doc.text("BILLING OVERVIEW", colXRight, y);

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(colXLeft, y + 2.2, colXLeft + subColW, y + 2.2);
  doc.line(colXRight, y + 2.2, colXRight + subColW, y + 2.2);

  const clientName =
    valueOrEmpty(
      invoice.customer_name || invoice.client_name || invoice.customer?.name
    ) || "Client";
  const clientCompany = valueOrEmpty(
    invoice.company_name || invoice.customer_company
  );
  const clientAddress = valueOrEmpty(
    invoice.address || invoice.customer_address || invoice.customer?.address
  );
  const clientEmail = valueOrEmpty(
    invoice.email || invoice.customer_email || invoice.customer?.email
  );
  const clientPhone = valueOrEmpty(
    invoice.phone || invoice.customer_phone || invoice.customer?.phone
  );

  let leftY = y + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.navy);
  const cNameLines = doc.splitTextToSize(clientName, subColW);
  doc.text(cNameLines, colXLeft, leftY);
  leftY += cNameLines.length * 4.5;

  const clientSubLines = [
    clientCompany,
    clientAddress,
    clientEmail,
    clientPhone,
  ].filter(Boolean);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...COLORS.muted);
  clientSubLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, subColW);
    doc.text(wrapped, colXLeft, leftY);
    leftY += wrapped.length * 4.0;
  });

  const overviewRows = [
    ["Currency", currency],
    ["Payment Status", statusText],
    ...(paidVal > 0 && invoice.payment_method
      ? [["Payment Method", valueOrEmpty(invoice.payment_method)]]
      : []),
    ["Amount Paid", formatMoney(paidVal, currency)],
  ];

  let rightY = y + 7;
  overviewRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, colXRight, rightY);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(
      ...(label === "Amount Paid" && paidVal > 0 ? [21, 128, 61] : COLORS.navy)
    );
    doc.text(String(value), colXRight + 32, rightY);
    rightY += 5.0;
  });

  y = Math.max(leftY, rightY) + 7;

  // 5. ITEMS & SERVICES TABLE
  if (y + 18 > pageBottom) {
    doc.addPage();
    y = PAGE_MARGIN;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.navy);
  doc.text("Items & Services", PAGE_MARGIN, y + 2);

  const tableRows = items.map((item, idx) => {
    const price = numericValue(item.unit_price ?? item.price);
    const taxRate = numericValue(item.tax_rate ?? item.taxRate);
    const lineTotal =
      item.line_total !== undefined && item.line_total !== null
        ? numericValue(item.line_total)
        : price * (1 + taxRate / 100);
    const itemName = valueOrEmpty(item.item_name || item.name) || `Item ${idx + 1}`;
    const desc = valueOrEmpty(item.description);
    const detailsText = desc ? `${itemName}\n${desc}` : itemName;

    return [
      String(idx + 1),
      detailsText,
      formatMoney(price, currency),
      `${taxRate}%`,
      formatMoney(lineTotal, currency),
    ];
  });

  autoTable(doc, {
    startY: y + 5.5,
    head: [["#", "ITEM / SERVICE DETAILS", "PRICE", "TAX", "LINE TOTAL"]],
    body:
      tableRows.length > 0
        ? tableRows
        : [["", "No invoice items specified.", "", "", ""]],
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
      fontSize: 8.2,
      cellPadding: 3.2,
      halign: "left",
    },
    bodyStyles: {
      textColor: COLORS.text,
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 3.6,
      overflow: "linebreak",
      valign: "top",
      lineColor: COLORS.border,
      lineWidth: 0.15,
    },
    alternateRowStyles: { fillColor: [248, 250, 253] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", fontStyle: "bold", textColor: COLORS.muted },
      1: { cellWidth: contentWidth - 10 - 30 - 16 - 34 },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 16, halign: "right", textColor: COLORS.muted },
      4: { cellWidth: 34, halign: "right", fontStyle: "bold", textColor: COLORS.navy },
    },
    didParseCell(data) {
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

  y = doc.lastAutoTable.finalY + 9;

  // 6. BOTTOM TWO-COLUMN SECTION:
  //    Left: "Thank you for business with us" (bold) -> Notes -> Terms & Conditions
  //    Right: Financial Summary Box (NO Bank Details) -> Authorized Signature
  const summaryWidth = 84;
  const summaryX = pageWidth - PAGE_MARGIN - summaryWidth;
  const leftColW = summaryX - PAGE_MARGIN - 8;

  const notesText = valueOrEmpty(invoice.notes);
  const termsText =
    valueOrEmpty(invoice.terms_and_conditions || invoice.terms) ||
    "Payment is strictly due within 14 calendar days of issuance.\nOverdue accounts may be subject to interest.";
  const authorizedName = valueOrEmpty(
    company.authorized_person || company.contact_person
  );
  const designation = valueOrEmpty(company.designation || companyName);
  const hasSignatureBlock = Boolean(signatureData || authorizedName || companyName);

  const countLines = (text, w) => (text ? doc.splitTextToSize(text, w).length : 0);
  const summaryBoxH = discountVal > 0 ? 45.5 : 40;
  const sigW = 56;
  const sigX = pageWidth - PAGE_MARGIN - sigW;
  const sigH = hasSignatureBlock ? 30 : 0;
  const estRightHeight = summaryBoxH + (hasSignatureBlock ? 10 + sigH : 0);
  const estLeftHeight =
    8 +
    (notesText ? 5 + countLines(notesText, leftColW) * 4.1 + 3.5 : 0) +
    (termsText ? 5 + countLines(termsText, leftColW) * 4.1 + 3 : 0);

  if (y + Math.max(estRightHeight, Math.min(estLeftHeight, 60)) > pageBottom) {
    doc.addPage();
    y = PAGE_MARGIN;
  }

  const sectionStartY = y;

  // Right Top: Financial Summary Box
  let sumY = sectionStartY;
  doc.setFillColor(...COLORS.light);
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.25);
  doc.roundedRect(summaryX, sumY, summaryWidth, summaryBoxH, 1.5, 1.5, "FD");

  sumY += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.muted);
  doc.text("Subtotal", summaryX + 4, sumY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text(formatMoney(subtotalVal, currency), pageWidth - PAGE_MARGIN - 4, sumY, {
    align: "right",
  });

  sumY += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  doc.text("Tax", summaryX + 4, sumY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text(formatMoney(taxVal, currency), pageWidth - PAGE_MARGIN - 4, sumY, {
    align: "right",
  });

  sumY += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...(discountVal > 0 ? [21, 128, 61] : COLORS.muted));
  doc.text("Discount", summaryX + 4, sumY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...(discountVal > 0 ? [21, 128, 61] : COLORS.text));
  doc.text(
    discountVal > 0
      ? `- ${formatMoney(discountVal, currency)}`
      : formatMoney(0, currency),
    pageWidth - PAGE_MARGIN - 4,
    sumY,
    { align: "right" }
  );

  sumY += 3.5;
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(summaryX + 3, sumY, summaryWidth - 6, 10, 1.2, 1.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(191, 219, 254);
  doc.text("GRAND TOTAL", summaryX + 6, sumY + 6.3);
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.white);
  doc.text(
    formatMoney(grandTotalVal, currency),
    pageWidth - PAGE_MARGIN - 6,
    sumY + 6.5,
    { align: "right" }
  );

  sumY += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  doc.setTextColor(21, 128, 61);
  doc.text("Paid Amount", summaryX + 4, sumY);
  doc.setFont("helvetica", "bold");
  doc.text(
    `- ${formatMoney(paidVal, currency)}`,
    pageWidth - PAGE_MARGIN - 4,
    sumY,
    { align: "right" }
  );

  sumY += 5.2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.navy);
  doc.text("Balance Due", summaryX + 4, sumY);
  doc.setTextColor(
    ...(balanceVal <= 0 && grandTotalVal > 0 ? [21, 128, 61] : [185, 28, 28])
  );
  doc.text(
    formatMoney(balanceVal, currency),
    pageWidth - PAGE_MARGIN - 4,
    sumY,
    { align: "right" }
  );

  // Right Bottom: Authorized Signature (below summary box on right side)
  let rightEndY = sectionStartY + summaryBoxH;
  if (hasSignatureBlock) {
    let sigY = sectionStartY + summaryBoxH + 10;
    if (sigY + sigH > pageBottom) {
      doc.addPage();
      sigY = PAGE_MARGIN;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(...COLORS.muted);
    doc.text("Authorized Signature", sigX + sigW / 2, sigY + 2.5, {
      align: "center",
    });

    if (signatureData) {
      containImage(doc, signatureData, sigX, sigY + 4.5, sigW, 15);
    }

    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(sigX, sigY + 21, sigX + sigW, sigY + 21);

    if (authorizedName) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.8);
      doc.setTextColor(...COLORS.navy);
      doc.text(authorizedName, sigX + sigW / 2, sigY + 25.5, {
        align: "center",
      });
    }
    if (designation) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(...COLORS.muted);
      doc.text(designation, sigX + sigW / 2, sigY + 29.5, {
        align: "center",
      });
    }
    rightEndY = sigY + sigH;
  }

  // Left Column: "Thank you for business with us" (bold) -> Notes -> Terms & Conditions
  // Restore page to sectionStartY page in case signature pushed to a new page
  const startPageNum =
    hasSignatureBlock && sectionStartY + summaryBoxH + 10 + sigH > pageBottom
      ? doc.internal.getNumberOfPages() - 1
      : doc.internal.getNumberOfPages();
  doc.setPage(startPageNum);

  let bottomLeftY = sectionStartY + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.navy);
  doc.text("Thank you for business with us", PAGE_MARGIN, bottomLeftY);
  bottomLeftY += 7;

  if (notesText) {
    if (bottomLeftY + 10 > pageBottom) {
      doc.addPage();
      bottomLeftY = PAGE_MARGIN;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.setTextColor(...COLORS.navy);
    doc.text("Notes", PAGE_MARGIN, bottomLeftY);
    bottomLeftY += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.text);
    const nLines = doc.splitTextToSize(notesText, leftColW);
    nLines.forEach((l) => {
      if (bottomLeftY + 4.1 > pageBottom) {
        doc.addPage();
        bottomLeftY = PAGE_MARGIN;
      }
      doc.text(l, PAGE_MARGIN, bottomLeftY);
      bottomLeftY += 4.1;
    });
    bottomLeftY += 4;
  }

  if (termsText) {
    if (bottomLeftY + 10 > pageBottom) {
      doc.addPage();
      bottomLeftY = PAGE_MARGIN;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.setTextColor(...COLORS.navy);
    doc.text("Terms & Conditions", PAGE_MARGIN, bottomLeftY);
    bottomLeftY += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.text);
    const tLines = doc.splitTextToSize(termsText, leftColW);
    tLines.forEach((l) => {
      if (bottomLeftY + 4.1 > pageBottom) {
        doc.addPage();
        bottomLeftY = PAGE_MARGIN;
      }
      doc.text(l, PAGE_MARGIN, bottomLeftY);
      bottomLeftY += 4.1;
    });
  }

  y = Math.max(bottomLeftY, rightEndY) + 4;

  // 8. FOOTER
  drawInvoiceFooter(doc, invoiceNum, companyName);

  return doc;
}

/**
 * Generate and download an A4 Invoice PDF from invoice form/record data.
 */
export async function downloadInvoicePdf(
  invoice,
  company = {},
  filename = "Invoice.pdf"
) {
  const doc = await createInvoicePdfDoc(invoice, company);
  const safeFilename = String(filename || "Invoice.pdf")
    .trim()
    .replace(/[<>:"/\\|?*]/g, "_");
  const pdfFilename = /\.pdf$/i.test(safeFilename)
    ? safeFilename
    : `${safeFilename}.pdf`;

  try {
    const blob = doc.output("blob");
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = pdfFilename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch {
    doc.save(pdfFilename);
  }
}
