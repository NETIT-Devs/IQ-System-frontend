import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = {
  navy: [16, 42, 67],
  blue: [37, 99, 235],
  text: [36, 52, 71],
  muted: [98, 116, 138],
  border: [220, 229, 239],
  light: [248, 250, 252],
  white: [255, 255, 255],
};

const PAGE_MARGIN = 14;
const FOOTER_SPACE = 17;

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
    if (company?.[key]) return company[key];
  }
  return "";
}

// Convert a loaded image to a PDF-safe data URL; inaccessible images are skipped.
function loadImageData(source, description) {
  if (!source || typeof Image === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    const image = new Image();
    if (!String(source).startsWith("data:")) {
      image.crossOrigin = "anonymous";
    }

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

    image.src = source;
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
      "PNG",
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

function drawColumnDetails(doc, entries, x, y, width) {
  let currentY = y;

  entries.forEach(([label, value]) => {
    if (!value) return;
    const labelLines = doc.splitTextToSize(label, width);
    const valueLines = doc.splitTextToSize(value, width);
    const height = (labelLines.length * 3.5) + (valueLines.length * 4.2) + 2;

    if (currentY + height > doc.internal.pageSize.getHeight() - FOOTER_SPACE) {
      doc.addPage();
      currentY = PAGE_MARGIN;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(labelLines, x, currentY);
    currentY += labelLines.length * 3.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text(valueLines, x, currentY);
    currentY += valueLines.length * 4.2 + 2;
  });

  return currentY;
}

function addWrappedSection(doc, title, content, y, margin, pageBottom) {
  if (!content) return y;

  const lines = doc.splitTextToSize(content, doc.internal.pageSize.getWidth() - margin * 2);
  const lineHeight = 4.2;
  let currentY = y;

  if (currentY + 13 > pageBottom) {
    doc.addPage();
    currentY = PAGE_MARGIN;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.navy);
  doc.text(title, margin, currentY);
  currentY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);

  lines.forEach((line) => {
    if (currentY + lineHeight > pageBottom) {
      doc.addPage();
      currentY = PAGE_MARGIN;
    }
    doc.text(line, margin, currentY);
    currentY += lineHeight;
  });

  return currentY + 5;
}

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

    if (currentY + 16 > pageBottom) {
      doc.addPage();
      currentY = margin;
    }

    if (heading) {
      // Navy Blue Header bar
      doc.setFillColor(...COLORS.navy);
      doc.roundedRect(margin, currentY, contentWidth, 6.5, 1, 1, "F");

      // Accent blue underline
      doc.setFillColor(...COLORS.blue);
      doc.rect(margin, currentY + 5.8, contentWidth, 0.7, "F");

      // Heading text
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.white);
      doc.text(heading.toUpperCase(), margin + 3.5, currentY + 4.2);

      currentY += 9.5;
    }

    if (subText) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.text);
      const lines = doc.splitTextToSize(subText, contentWidth - 4);

      lines.forEach((line) => {
        if (currentY + 4.2 > pageBottom) {
          doc.addPage();
          currentY = margin;
        }
        doc.text(line, margin + 2, currentY);
        currentY += 4.2;
      });

      currentY += 4;
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
    doc.line(
      PAGE_MARGIN,
      pageHeight - 12,
      pageWidth - PAGE_MARGIN,
      pageHeight - 12
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Quotation ${quotationNumber}`, PAGE_MARGIN, pageHeight - 7);
    doc.text(
      `Page ${page} of ${pageCount}`,
      pageWidth - PAGE_MARGIN,
      pageHeight - 7,
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

  // Company identity and quotation title follow the existing template hierarchy.
  containImage(doc, logoData, PAGE_MARGIN, 14, 22, 22);
  const companyTextX = logoData ? PAGE_MARGIN + 27 : PAGE_MARGIN;
  const companyTextWidth = logoData ? 92 : 119;
  let headerY = 16;

  if (companyName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.navy);
    const nameLines = doc.splitTextToSize(companyName, companyTextWidth);
    doc.text(nameLines, companyTextX, headerY);
    headerY += nameLines.length * 5 + 1;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  companyLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, companyTextWidth);
    doc.text(wrapped, companyTextX, headerY);
    headerY += wrapped.length * 3.6;
  });

  const headingText = valueOrEmpty(company.pdf_heading) || "QUOTATION";
  const subheadingText = valueOrEmpty(company.pdf_subheading) || "PROFESSIONAL SERVICES PROPOSAL";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...COLORS.navy);
  doc.text(headingText, pageWidth - PAGE_MARGIN, 21, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.blue);
  doc.text(subheadingText, pageWidth - PAGE_MARGIN, 27, {
    align: "right",
  });

  let y = Math.max(43, headerY + 4);
  doc.setFillColor(...COLORS.navy);
  doc.rect(PAGE_MARGIN, y, contentWidth, 1.2, "F");
  doc.setFillColor(...COLORS.blue);
  doc.rect(PAGE_MARGIN, y + 1.2, contentWidth, 0.6, "F");
  y += 5;

  const customHeaderNotice = valueOrEmpty(company.pdf_custom_lines);
  if (customHeaderNotice) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.muted);
    const splitCustom = doc.splitTextToSize(customHeaderNotice, contentWidth);
    doc.text(splitCustom, PAGE_MARGIN, y);
    y += splitCustom.length * 3.6 + 3;
  } else {
    y += 3;
  }

  const referenceData = [
    [
      "QUOTATION NUMBER",
      valueOrEmpty(quotation.quotation_number || quotation.quotationNumber) ||
        "Not specified",
    ],
    [
      "QUOTATION DATE",
      formatDate(quotation.quotation_date || quotation.date),
    ],
    ["VALID UNTIL", formatDate(quotation.valid_until)],
  ];
  const referenceWidth = contentWidth / referenceData.length;
  referenceData.forEach(([label, value], index) => {
    const x = PAGE_MARGIN + index * referenceWidth;
    doc.setFillColor(...COLORS.light);
    doc.setDrawColor(...COLORS.border);
    doc.rect(x, y, referenceWidth, 18, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, x + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.navy);
    doc.text(
      doc.splitTextToSize(value, referenceWidth - 6),
      x + 3,
      y + 11
    );
  });
  y += 25;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.blue);
  doc.text("PREPARED FOR", PAGE_MARGIN, y);
  doc.text("PROJECT DETAILS", PAGE_MARGIN + contentWidth / 2 + 5, y);
  doc.setDrawColor(...COLORS.border);
  doc.line(PAGE_MARGIN, y + 2, PAGE_MARGIN + contentWidth / 2 - 5, y + 2);
  doc.line(
    PAGE_MARGIN + contentWidth / 2 + 5,
    y + 2,
    pageWidth - PAGE_MARGIN,
    y + 2
  );
  y += 7;

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
    [
      "Start Date",
      formatDate(quotation.project_start_date),
    ],
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
  const leftEnd = drawColumnDetails(
    doc,
    clientEntries,
    PAGE_MARGIN,
    y,
    contentWidth / 2 - 8
  );
  const rightEnd = drawColumnDetails(
    doc,
    projectEntries,
    PAGE_MARGIN + contentWidth / 2 + 5,
    y,
    contentWidth / 2 - 8
  );
  y = Math.max(leftEnd, rightEnd) + 3;

  if (y + 14 > pageHeight - FOOTER_SPACE) {
    doc.addPage();
    y = PAGE_MARGIN;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.navy);
  doc.text("Services & Deliverables", PAGE_MARGIN, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.blue);
  doc.text(`${items.length} ${items.length === 1 ? "ITEM" : "ITEMS"}`, pageWidth - PAGE_MARGIN, y + 4, {
    align: "right",
  });

  const tableRows = items.map((item, index) =>
    itemValues(item, index, currency)
  );
  autoTable(doc, {
    startY: y + 8,
    head: [["#", "SERVICE DETAILS", "UNIT PRICE", "TAX", "LINE TOTAL"]],
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
      fontSize: 8,
      cellPadding: 2.5,
    },
    bodyStyles: {
      textColor: COLORS.text,
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
      valign: "top",
    },
    alternateRowStyles: { fillColor: COLORS.light },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 82 },
      2: { cellWidth: 31, halign: "right" },
      3: { cellWidth: 17, halign: "right" },
      4: { cellWidth: 35, halign: "right", fontStyle: "bold" },
    },
    showHead: "everyPage",
    rowPageBreak: "auto",
  });
  y = doc.lastAutoTable.finalY + 9;

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
  const summaryX = pageWidth - PAGE_MARGIN - 76;
  const startTotalsY = y;

  if (y + 38 > pageHeight - FOOTER_SPACE) {
    doc.addPage();
    y = PAGE_MARGIN;
  }

  // Draw Bank & Payment Details on the left (if available in company settings or quotation)
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
    const bankBoxWidth = summaryX - PAGE_MARGIN - 8;
    const bankEntries = [
      ["Bank Name", bankName],
      ["Account Name", accountName],
      ["Account Number", accountNumber],
      ["Branch", branch],
      ["SWIFT / BIC", swiftCode],
    ].filter(([, val]) => Boolean(val));

    if (bankEntries.length > 0) {
      const boxHeight = 8 + bankEntries.length * 4.6;
      doc.setFillColor(...COLORS.light);
      doc.setDrawColor(...COLORS.border);
      doc.roundedRect(bankBoxX, y - 1, bankBoxWidth, boxHeight, 1.5, 1.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.navy);
      doc.text("BANK & PAYMENT DETAILS", bankBoxX + 4, y + 3.5);

      doc.setDrawColor(...COLORS.border);
      doc.line(bankBoxX + 4, y + 5.5, bankBoxX + bankBoxWidth - 4, y + 5.5);

      let bY = y + 9.5;
      bankEntries.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.muted);
        doc.text(`${label}:`, bankBoxX + 4, bY);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.text);
        doc.text(value, bankBoxX + 28, bY);
        bY += 4.6;
      });

      bankEndY = y - 1 + boxHeight;
    }
  }

  summaryRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, summaryX, y);
    doc.setTextColor(...COLORS.text);
    doc.text(value, pageWidth - PAGE_MARGIN, y, { align: "right" });
    y += 5;
  });
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(summaryX - 3, y - 1, 79, 14, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(191, 219, 254);
  doc.text("GRAND TOTAL", summaryX, y + 4);
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.white);
  doc.text(formatMoney(grandTotal, currency), pageWidth - PAGE_MARGIN - 3, y + 4, {
    align: "right",
  });
  const summaryEndY = y + 14;
  y = Math.max(bankEndY, summaryEndY) + 10;

  const pageBottom = pageHeight - FOOTER_SPACE;

  // Custom Template Sections configured by Super Admin (e.g. Scope, Deliverables, Timeline)
  y = drawCustomTemplateSections(
    doc,
    company?.pdf_custom_sections,
    y,
    PAGE_MARGIN,
    contentWidth,
    pageBottom
  );

  y = addWrappedSection(
    doc,
    "Terms & Conditions",
    valueOrEmpty(quotation.terms_and_conditions || quotation.terms),
    y,
    PAGE_MARGIN,
    pageBottom
  );
  y = addWrappedSection(
    doc,
    "Special Notes",
    valueOrEmpty(quotation.notes),
    y,
    PAGE_MARGIN,
    pageBottom
  );

  const templateFooterNote = valueOrEmpty(company.pdf_footer_note);
  if (templateFooterNote) {
    y = addWrappedSection(
      doc,
      "Important Notice / Declaration",
      templateFooterNote,
      y,
      PAGE_MARGIN,
      pageBottom
    );
  }

  if (signatureData) {
    if (y + 31 > pageBottom) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text("Authorized Signature", pageWidth - PAGE_MARGIN - 55, y + 4);
    containImage(
      doc,
      signatureData,
      pageWidth - PAGE_MARGIN - 55,
      y + 6,
      55,
      17
    );
    doc.setDrawColor(...COLORS.border);
    doc.line(
      pageWidth - PAGE_MARGIN - 55,
      y + 24,
      pageWidth - PAGE_MARGIN,
      y + 24
    );
    const authorizedName = valueOrEmpty(
      company.authorized_person || company.contact_person
    );
    const designation = valueOrEmpty(company.designation);
    if (authorizedName) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.navy);
      doc.text(authorizedName, pageWidth - PAGE_MARGIN - 55, y + 28);
    }
    if (designation) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.muted);
      doc.text(designation, pageWidth - PAGE_MARGIN - 55, y + 32);
    }
  }

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
