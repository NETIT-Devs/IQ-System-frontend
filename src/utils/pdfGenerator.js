import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import API_BASE_URL from "../services/api";
import {
  formatDescriptionPointByPoint,
  parseDeliverableSections,
  categorizeQuotationItems,
  getAdditionalItemCustomText,
} from "./deliverablesFormatter";

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

  let cachedBranding = {};
  let cachedQuotationTemplate = {};
  try {
    const rawBrand =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("company_branding")
        : null;
    if (rawBrand) cachedBranding = JSON.parse(rawBrand);
  } catch {
    // ignore
  }
  try {
    const rawTpl =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("iq_quotation_template_settings")
        : null;
    if (rawTpl) cachedQuotationTemplate = JSON.parse(rawTpl);
  } catch {
    // ignore
  }

  const mergedCompany = {
    ...cachedBranding,
    ...cachedQuotationTemplate,
    ...(company || {}),
  };
  for (const [k, v] of Object.entries({
    ...cachedBranding,
    ...cachedQuotationTemplate,
  })) {
    if (
      (mergedCompany[k] === undefined ||
        mergedCompany[k] === null ||
        mergedCompany[k] === "") &&
      v
    ) {
      mergedCompany[k] = v;
    }
  }

  const currency = quotation.currency || "LKR";
  const items = Array.isArray(quotation.items)
    ? quotation.items
    : Array.isArray(quotation.services)
      ? quotation.services
      : [];
  const logoSource = resolveImageSource(mergedCompany, [
    "logo_url",
    "logo",
    "company_logo",
  ]);
  const signatureSource = resolveImageSource(mergedCompany, [
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
  const companyName = valueOrEmpty(mergedCompany.name || mergedCompany.company_name);
  const companyLines = [
    mergedCompany.address || mergedCompany.company_address,
    mergedCompany.phone || mergedCompany.contact_number,
    mergedCompany.email || mergedCompany.email_address,
    mergedCompany.website,
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
  const headingText = valueOrEmpty(mergedCompany.pdf_heading) || "QUOTATION";
  const subheadingText =
    valueOrEmpty(mergedCompany.pdf_subheading) || "PROFESSIONAL SERVICES PROPOSAL";

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

  const customHeaderNotice = valueOrEmpty(mergedCompany.pdf_custom_lines);
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

  // 3. QUOTATION NUMBER, PREPARED FOR, DATE, VALID UNTIL (Single row across contentWidth)
  const quotationNum =
    valueOrEmpty(quotation.quotation_number || quotation.quotationNumber) ||
    "Not specified";
  const quotationDate = formatDate(quotation.quotation_date || quotation.date);
  const validUntil = formatDate(quotation.valid_until);

  const clientName =
    customer.customer_name ||
    customer.name ||
    quotation.customer_name ||
    quotation.client_name ||
    quotation.customer?.name ||
    quotation.client?.name ||
    "";
  const clientPhone =
    customer.phone ||
    customer.contact_number ||
    customer.customer_phone ||
    quotation.customer_phone ||
    quotation.phone ||
    quotation.customer?.phone ||
    quotation.client?.phone ||
    "";

  // 4 equally spaced columns across contentWidth
  const colW = contentWidth / 4;
  const colMaxW = colW - 4;

  const col1X = PAGE_MARGIN;
  const col2X = PAGE_MARGIN + colW;
  const col3X = PAGE_MARGIN + colW * 2;
  const col4X = PAGE_MARGIN + colW * 3;

  // Column 1: Prepared For
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.navy);
  doc.text("PREPARED FOR", col1X, y);

  let cY = y + 4.8;
  let clientTotalLines = 0;

  const trimmedName = valueOrEmpty(clientName);
  const trimmedPhone = valueOrEmpty(clientPhone);

  if (trimmedName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(...COLORS.navy);
    const cNameLines = doc.splitTextToSize(trimmedName, colMaxW);
    doc.text(cNameLines, col1X, cY);
    cY += cNameLines.length * 4.0;
    clientTotalLines += cNameLines.length;
  }

  if (trimmedPhone) {
    doc.setFont("helvetica", trimmedName ? "normal" : "bold");
    doc.setFontSize(trimmedName ? 7.8 : 8.2);
    doc.setTextColor(...(trimmedName ? COLORS.text : COLORS.navy));
    const phoneLines = doc.splitTextToSize(trimmedPhone, colMaxW);
    doc.text(phoneLines, col1X, cY);
    clientTotalLines += phoneLines.length;
  }

  // Column 2: Quotation Number
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.navy);
  doc.text("QUOTATION NUMBER", col2X, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(...COLORS.navy);
  const qNumLines = doc.splitTextToSize(quotationNum, colMaxW);
  doc.text(qNumLines, col2X, y + 4.8);

  // Column 3: Quotation Date
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.navy);
  doc.text("QUOTATION DATE", col3X, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...COLORS.text);
  const qDateLines = doc.splitTextToSize(quotationDate, colMaxW);
  doc.text(qDateLines, col3X, y + 4.8);

  // Column 4: Valid Until
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.navy);
  doc.text("VALID UNTIL", col4X, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...COLORS.text);
  const qValidLines = doc.splitTextToSize(validUntil, colMaxW);
  doc.text(qValidLines, col4X, y + 4.8);

  const maxRefLines = Math.max(
    qNumLines.length,
    clientTotalLines,
    qDateLines.length,
    qValidLines.length,
    1
  );
  y += 10 + maxRefLines * 4.2;

  // 4. PROJECT DETAILS (Left Side below reference row)
  const serviceName = valueOrEmpty(
    items[0]?.item_name ||
    items[0]?.service_name ||
    items[0]?.name ||
    quotation.service_name ||
    quotation.item_name ||
    ""
  );

  const websiteType = valueOrEmpty(
    quotation.website_type ||
    quotation.project_type ||
    items.find((it) => it.website_type)?.website_type ||
    items[0]?.website_type ||
    ""
  );

  let projectDisplayName = "Not specified";
  if (serviceName && websiteType) {
    projectDisplayName = `${serviceName} (${websiteType})`;
  } else if (serviceName) {
    projectDisplayName = serviceName;
  } else if (websiteType) {
    projectDisplayName = websiteType;
  }

  const technologyStack =
    quotation.technology ||
    quotation.technology_stack ||
    items.find((it) => it.technology)?.technology ||
    items[0]?.technology ||
    "";

  const durationStr =
    quotation.estimated_duration || quotation.project_duration
      ? `${quotation.estimated_duration || quotation.project_duration} ${quotation.duration_unit || quotation.project_duration_unit || ""
        }`.trim()
      : "Not specified";

  const projectEntries = [
    ["Project", projectDisplayName],
    ["Technology Stack", technologyStack || "Not specified"],
    ["Start Date", "Initial Advance Payment Date"],
    ["Duration", durationStr],
  ];

  const projectSectionWidth = 105;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.setTextColor(...COLORS.navy);
  doc.text("PROJECT DETAILS", PAGE_MARGIN, y);

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(PAGE_MARGIN, y + 2.5, PAGE_MARGIN + projectSectionWidth, y + 2.5);

  y += 7.5;
  projectEntries.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    doc.setTextColor(...COLORS.muted);
    const labelStr = `${label}:`;
    const labelWidth = doc.getTextWidth(labelStr);
    doc.text(labelStr, PAGE_MARGIN, y);

    if (label === "Start Date") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.blue);
    } else if (label === "Project") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.navy);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.text);
    }
    const spaceWidth = 2.0;
    const valueX = PAGE_MARGIN + labelWidth + spaceWidth;
    const valText = doc.splitTextToSize(
      value,
      projectSectionWidth - (labelWidth + spaceWidth)
    );
    doc.text(valText, valueX, y);
    y += Math.max(valText.length * 4.2, 4.6);
  });

  y += 4;

  const pageBottom = pageHeight - FOOTER_SPACE;

  const ensureSpace = (needed) => {
    if (y + needed > pageBottom) {
      doc.addPage();
      y = PAGE_MARGIN;
      return true;
    }
    return false;
  };

  ensureSpace(16);

  // Light gray divider line between Project Details and Services & Deliverables
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.25);
  doc.line(PAGE_MARGIN, y, PAGE_MARGIN + contentWidth, y);
  y += 6.5;

  // 5. SERVICES & DELIVERABLES (Section without table)

  const { mainServices, additionalItems } = categorizeQuotationItems(items);

  mainServices.forEach((item, itemIndex) => {
    // Divider between multiple main services
    if (itemIndex > 0) {
      ensureSpace(12);
      y += 2.5;
      doc.setDrawColor(...COLORS.border);
      doc.setLineWidth(0.35);
      doc.line(PAGE_MARGIN, y, PAGE_MARGIN + contentWidth, y);
      y += 6.5;
    }

    const serviceTextX = PAGE_MARGIN;

    // Subheading: "Services & Deliverables:"
    ensureSpace(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.setTextColor(...COLORS.blue);
    doc.text("Services & Deliverables:", serviceTextX, y);
    y += 5.2;

    // Parse description sections (Description, Core Features, Maintenance Support, Content & SEO, Hosting, etc.)
    const sections = parseDeliverableSections(item.description, {
      hostingDomain: item.hosting_domain,
      deliverables: item.deliverables,
    });

    const sectionLeftX = serviceTextX;

    sections.forEach((sec, sIdx) => {
      // Light gray row separator between sections (e.g. between Description, Core Features, etc.)
      if (sIdx > 0) {
        ensureSpace(8);
        y += 1.8;
        doc.setDrawColor(...COLORS.border);
        doc.setLineWidth(0.18);
        doc.line(sectionLeftX, y, PAGE_MARGIN + contentWidth, y);
        y += 4.5;
      }

      if (sec.title) {
        ensureSpace(7);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...COLORS.navy);
        const headingText = sec.title.endsWith(":") ? sec.title : `${sec.title}:`;
        doc.text(headingText, sectionLeftX, y);
        y += 4.5;
      }

      sec.points.forEach((point) => {
        if (!point) return;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.2);
        doc.setTextColor(...COLORS.text);

        const pointIndent = 3.5;
        const bulletRadius = 0.55;
        const bulletX = sectionLeftX + pointIndent;
        const textX = sectionLeftX + pointIndent + 3.2;
        const textW = contentWidth - (sectionLeftX - PAGE_MARGIN + pointIndent + 3.2);
        const lines = doc.splitTextToSize(point, textW);
        const ptHeight = lines.length * 4.0 + 1.2;

        ensureSpace(ptHeight);

        // Draw crisp circular bullet point
        doc.setFillColor(...COLORS.navy);
        doc.circle(bulletX, y - 0.95, bulletRadius, "F");

        doc.text(lines, textX, y);
        y += lines.length * 4.0 + 1.2;
      });

      y += 2.2;
    });

    // If this is the last main service and there are additional items,
    // render "Additional Development:" heading and bullet points separated by a divider line
    if (itemIndex === mainServices.length - 1 && additionalItems.length > 0) {
      ensureSpace(12);
      y += 1.8;
      doc.setDrawColor(...COLORS.border);
      doc.setLineWidth(0.18);
      doc.line(sectionLeftX, y, PAGE_MARGIN + contentWidth, y);
      y += 4.5;

      // Heading: Additional Development:
      ensureSpace(8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.navy);
      doc.text("Additional Development:", sectionLeftX, y);
      y += 4.5;

      additionalItems.forEach((addItem) => {
        const rawName =
          valueOrEmpty(addItem.item_name || addItem.service_name || addItem.name) ||
          "Additional Item";
        const addDesc = valueOrEmpty(addItem.description);
        const pointText = addDesc ? `${rawName} - ${addDesc}` : rawName;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.2);
        doc.setTextColor(...COLORS.text);

        const pointIndent = 3.5;
        const bulletRadius = 0.55;
        const bulletX = sectionLeftX + pointIndent;
        const textX = sectionLeftX + pointIndent + 3.2;
        const textW = contentWidth - (sectionLeftX - PAGE_MARGIN + pointIndent + 3.2);
        const lines = doc.splitTextToSize(pointText, textW);
        const ptHeight = lines.length * 4.0 + 1.2;

        ensureSpace(ptHeight);

        // Draw crisp circular bullet point
        doc.setFillColor(...COLORS.navy);
        doc.circle(bulletX, y - 0.95, bulletRadius, "F");

        doc.text(lines, textX, y);
        y += lines.length * 4.0 + 1.2;
      });

      y += 2.2;
    }

    y += 3.0;
  });

  // Special Notes right after deliverables
  const notesText = valueOrEmpty(quotation.notes);
  if (notesText) {
    ensureSpace(16);
    y += 1.8;
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(PAGE_MARGIN, y, PAGE_MARGIN + contentWidth, y);
    y += 5.5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.setTextColor(...COLORS.navy);
    doc.text("Special Notes:", PAGE_MARGIN, y);
    y += 4.8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...COLORS.text);
    const noteLines = doc.splitTextToSize(notesText, contentWidth - 4);
    noteLines.forEach((line) => {
      ensureSpace(4.4);
      doc.text(line, PAGE_MARGIN + 2, y);
      y += 4.2;
    });
    y += 5.5;
  }

  // 6. PRICING TABLE (DEVELOPMENT COST)
  let calcSubtotal = 0;
  let calcTaxAmount = 0;

  items.forEach((item, index) => {
    if (getAdditionalItemCustomText(item, index)) return;
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

  // Spacing above DEVELOPMENT COST section
  y += 5.5;
  ensureSpace(28);

  // Table Title: DEVELOPMENT COST
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.setTextColor(...COLORS.navy);
  doc.text("DEVELOPMENT COST", PAGE_MARGIN, y);
  y += 2.5;

  const pricingRows = items.map((item, index) => {
    const customText = getAdditionalItemCustomText(item, index);
    const name =
      valueOrEmpty(item.item_name || item.service_name || item.name) ||
      `Service ${index + 1}`;

    if (customText) {
      return [
        String(index + 1),
        name,
        "",
        "",
        {
          content: customText,
          styles: {
            halign: "right",
            fontStyle: "bold",
            textColor: COLORS.navy,
          },
        },
      ];
    }

    const price = numericValue(item.unit_price ?? item.Price ?? item.price);
    const taxRate = numericValue(item.tax_rate ?? item.taxRate);
    const lineTax = (price * taxRate) / 100;
    const lineTotal =
      item.line_total != null &&
        Number(item.line_total) > 0 &&
        Math.abs(Number(item.line_total) - (price + lineTax)) < 0.01
        ? numericValue(item.line_total)
        : price + lineTax;

    return [
      String(index + 1),
      name,
      {
        content: formatMoney(price, currency),
        currency: currency,
        amount: numericValue(price).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        isCurrencyCell: true,
      },
      `${taxRate}%`,
      {
        content: formatMoney(lineTotal, currency),
        currency: currency,
        amount: numericValue(lineTotal).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        isCurrencyCell: true,
      },
    ];
  });

  const tableBody = [
    ...(pricingRows.length > 0
      ? pricingRows
      : [["", "No service items available.", "", "", ""]]),
    [
      {
        content: "Discount (-)",
        colSpan: 4,
        styles: {
          halign: "left",
          fontStyle: "bold",
          textColor: COLORS.muted,
          fillColor: [255, 255, 255],
        },
      },
      {
        content:
          numDiscount > 0
            ? `${currency} -${numericValue(numDiscount).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
            : formatMoney(0, currency),
        currency: currency,
        amount:
          numDiscount > 0
            ? `-${numericValue(numDiscount).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
            : "0.00",
        isCurrencyCell: true,
        styles: {
          halign: "right",
          fontStyle: "bold",
          textColor: numDiscount > 0 ? COLORS.navy : COLORS.muted,
          fillColor: [255, 255, 255],
        },
      },
    ],
    [
      {
        content: "Total Project Cost",
        colSpan: 4,
        styles: {
          halign: "left",
          fontStyle: "bold",
          textColor: COLORS.navy,
          fillColor: [232, 238, 247],
        },
      },
      {
        content: formatMoney(grandTotal, currency),
        currency: currency,
        amount: numericValue(grandTotal).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        isCurrencyCell: true,
        styles: {
          halign: "right",
          fontStyle: "bold",
          textColor: COLORS.blue,
          fillColor: [232, 238, 247],
        },
      },
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [["#", "SERVICE / ITEM", "UNIT PRICE", "TAX", "LINE TOTAL"]],
    body: tableBody,
    margin: {
      left: PAGE_MARGIN,
      right: PAGE_MARGIN,
      top: PAGE_MARGIN,
      bottom: 11,
    },
    theme: "grid",
    headStyles: {
      fillColor: COLORS.navy,
      textColor: COLORS.white,
      font: "helvetica",
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: 2.8,
      halign: "left",
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: COLORS.text,
      font: "helvetica",
      fontSize: 8.2,
      cellPadding: 2.8,
      overflow: "linebreak",
      valign: "middle",
      lineColor: COLORS.border,
      lineWidth: 0.15,
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
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
      if (data.section === "body") {
        if (data.cell.raw && typeof data.cell.raw === "object" && data.cell.raw.styles) {
          Object.assign(data.cell.styles, data.cell.raw.styles);
        } else if (data.column.index === 4) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = COLORS.navy;
        }
      }
    },
    willDrawCell: function (data) {
      if (data.section === "body" && data.cell.raw && data.cell.raw.isCurrencyCell) {
        data.cell.text = [];
      }
    },
    didDrawCell: function (data) {
      if (data.section === "body" && data.cell.raw && data.cell.raw.isCurrencyCell) {
        const raw = data.cell.raw;
        const padLeft = (data.cell.padding && typeof data.cell.padding === "function")
          ? data.cell.padding("left")
          : (data.cell.paddingLeft || 3.5);
        const padRight = (data.cell.padding && typeof data.cell.padding === "function")
          ? data.cell.padding("right")
          : (data.cell.paddingRight || 3.5);
        const cellX = data.cell.x;
        const cellY = data.cell.y;
        const cellW = data.cell.width;
        const cellH = data.cell.height;

        doc.setFont("helvetica", data.cell.styles.fontStyle || "normal");
        doc.setFontSize(data.cell.styles.fontSize || 8.5);
        if (Array.isArray(data.cell.styles.textColor)) {
          doc.setTextColor(...data.cell.styles.textColor);
        } else {
          doc.setTextColor(...COLORS.text);
        }

        const fontSizeMm = (data.cell.styles.fontSize || 8.5) * 0.352778;
        const textY = cellY + cellH / 2 + fontSizeMm * 0.35;

        // Draw currency aligned to the left
        doc.text(raw.currency || "LKR", cellX + padLeft, textY, { align: "left" });

        // Draw amount aligned to the right
        doc.text(raw.amount || "0.00", cellX + cellW - padRight, textY, { align: "right" });
      }
    },
    showHead: "everyPage",
    rowPageBreak: "auto",
  });
  y = doc.lastAutoTable.finalY + 8;

  // 7. PAYMENT TERMS, BANK DETAILS & TERMS AND CONDITIONS
  const colGap = 8;
  const colWidth = (contentWidth - colGap) / 2; // 87mm each
  const leftColX = PAGE_MARGIN;
  const rightColX = PAGE_MARGIN + colWidth + colGap;

  if (y + 50 > pageHeight - FOOTER_SPACE) {
    doc.addPage();
    y = PAGE_MARGIN;
  }

  const sectionStartY = y;

  // 1. LEFT SIDE: PAYMENT TERMS (Directly below DEVELOPMENT COST table on the left side)
  const advancePrice = numericValue(
    quotation.advance_price ??
    quotation.advance_amount ??
    quotation.advancePrice ??
    quotation.advanceAmount ??
    0
  );
  const remainingBalance = Math.max(0, grandTotal - advancePrice);

  // Heading outside the box: "PAYMENT TERMS"
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.setTextColor(...COLORS.navy);
  doc.text("PAYMENT TERMS", leftColX, sectionStartY + 3.2);

  const ptBoxY = sectionStartY + 5.8;
  const ptBoxHeight = 31.0; // Spacious, generous padding

  // Box background: "white walata huru laaaa blue"
  doc.setFillColor(248, 250, 254);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.roundedRect(leftColX, ptBoxY, colWidth, ptBoxHeight, 1.5, 1.5, "FD");

  // Column Headers: "Payment Stage" (left) and "Amount" (right)
  const ptHeaderY = ptBoxY + 6.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.0);
  doc.setTextColor(100, 116, 139);
  doc.text("Payment Stage", leftColX + 6.0, ptHeaderY);
  doc.text("Amount", leftColX + colWidth - 6.0, ptHeaderY, { align: "right" });

  // Divider line under column headers
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(leftColX + 6.0, ptHeaderY + 2.8, leftColX + colWidth - 6.0, ptHeaderY + 2.8);

  // Row 1: Advance Payment
  const row1Y = ptHeaderY + 9.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42); // Black
  doc.text("Advance Payment", leftColX + 6.0, row1Y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42); // Black
  doc.text(formatMoney(advancePrice, currency), leftColX + colWidth - 6.0, row1Y, {
    align: "right",
  });

  // Row 2: Balance Payment
  const row2Y = row1Y + 7.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42); // Black
  doc.text("Balance Payment", leftColX + 6.0, row2Y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42); // Black
  doc.text(formatMoney(remainingBalance, currency), leftColX + colWidth - 6.0, row2Y, {
    align: "right",
  });

  let leftEndY = ptBoxY + ptBoxHeight;

  // 2. RIGHT SIDE: Bank Details
  let rightEndY = sectionStartY;

  const bankName = valueOrEmpty(mergedCompany.bank_name || quotation.bank_name);
  const accountName = valueOrEmpty(
    mergedCompany.bank_account_name || quotation.bank_account_name
  );
  const accountNumber = valueOrEmpty(
    mergedCompany.bank_account_number || quotation.bank_account_number
  );
  const branch = valueOrEmpty(mergedCompany.bank_branch || quotation.bank_branch);
  const swiftCode = valueOrEmpty(
    mergedCompany.bank_swift_code || quotation.bank_swift_code
  );

  const hasBankDetails = Boolean(bankName || accountNumber || accountName);

  if (hasBankDetails) {
    const bankBoxX = rightColX;
    const bankBoxWidth = colWidth;
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
      const bankBoxY = sectionStartY + 5.8;

      doc.setFillColor(...COLORS.light);
      doc.setDrawColor(...COLORS.border);
      doc.roundedRect(bankBoxX, bankBoxY, bankBoxWidth, boxHeight, 1.5, 1.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.8);
      doc.setTextColor(...COLORS.navy);
      doc.text("BANK & PAYMENT DETAILS", bankBoxX + 4.5, bankBoxY + 4.5);

      doc.setDrawColor(...COLORS.blue);
      doc.setLineWidth(0.4);
      doc.line(bankBoxX + 4.5, bankBoxY + 6.2, bankBoxX + 40, bankBoxY + 6.2);
      doc.setLineWidth(0.2);

      let bY = bankBoxY + 10.2;
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

      rightEndY = bankBoxY + boxHeight;
    }
  }

  // 3. TERMS & CONDITIONS (Directly below Payment Terms on the left side)
  const termsText = valueOrEmpty(
    quotation.terms_and_conditions || quotation.terms || mergedCompany.default_terms_and_conditions
  );

  const sectionStartPage = doc.internal.getCurrentPageInfo().pageNumber;

  if (termsText) {
    // Increased gap between Payment Terms box and Terms & Conditions
    leftEndY += 9.5;

    // Check if there is enough space for the heading + at least 2 lines of text (approx 16mm)
    if (leftEndY + 16 > pageBottom) {
      doc.addPage();
      leftEndY = PAGE_MARGIN + 5;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.navy);
    doc.text("Terms & Conditions", leftColX + 1, leftEndY + 2.5);
    leftEndY += 6.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(...COLORS.text);
    const tLines = doc.splitTextToSize(termsText, colWidth - 2);
    tLines.forEach((l) => {
      if (leftEndY + 4.0 > pageBottom) {
        doc.addPage();
        leftEndY = PAGE_MARGIN + 5;
      }
      doc.text(l, leftColX + 1, leftEndY);
      leftEndY += 4.0;
    });
    leftEndY += 2;
  }

  const currentTermsPage = doc.internal.getCurrentPageInfo().pageNumber;
  if (currentTermsPage > sectionStartPage) {
    y = leftEndY + 5.0;
  } else {
    y = Math.max(leftEndY, rightEndY) + 5.0;
  }

  // 7. CUSTOM TEMPLATE SECTIONS (Configured in Template Settings)
  y = drawCustomTemplateSections(
    doc,
    mergedCompany?.pdf_custom_sections || mergedCompany?.customSections,
    y,
    PAGE_MARGIN,
    contentWidth,
    pageBottom
  );

  // 8. BOTTOM SECTION: THANK YOU MESSAGE, PREPARED BY & AUTHORIZED SIGNATURE
  const thankYouTitle = valueOrEmpty(
    mergedCompany.quotation_thank_you_title || "Thank You"
  );
  const thankYouMessage = valueOrEmpty(
    mergedCompany.quotation_thank_you_message
  );
  const preparedBy = valueOrEmpty(
    mergedCompany.quotation_prepared_by || "NetIT Technology"
  );
  const preparedByServices = valueOrEmpty(
    mergedCompany.quotation_prepared_by_services ||
    "Web Development • Software Solutions • Digital Marketing"
  );
  const ceoName = valueOrEmpty(
    mergedCompany.quotation_ceo_name ||
    mergedCompany.authorized_person ||
    mergedCompany.contact_person ||
    "D M N K DISSANAYAKA"
  );
  const ceoDesignation = valueOrEmpty(
    mergedCompany.quotation_ceo_designation ||
    mergedCompany.designation ||
    "CEO (NetIT Technology)"
  );
  const templateFooterNote = valueOrEmpty(mergedCompany.pdf_footer_note);

  const countLines = (text, w) => (text ? doc.splitTextToSize(text, w).length : 0);
  const thankYouLinesCount = countLines(thankYouMessage, contentWidth);
  const neededThankYouHeight =
    (thankYouTitle ? 6.5 : 0) + (thankYouMessage ? thankYouLinesCount * 4.0 + 2.0 : 0);

  // Only break to a new page if the Thank You message itself cannot fit on the current page
  if (neededThankYouHeight > 0 && y + neededThankYouHeight > pageBottom) {
    doc.addPage();
    y = PAGE_MARGIN + 5;
  }

  // 1) Thank You Title and Message
  if (thankYouTitle || thankYouMessage) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.setTextColor(...COLORS.navy);
    doc.text(thankYouTitle, PAGE_MARGIN, y);
    y += 6.5; // Gap between "Thank You" title and paragraph slightly increased

    if (thankYouMessage) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.0);
      doc.setTextColor(...COLORS.text);
      const msgLines = doc.splitTextToSize(thankYouMessage, contentWidth);
      msgLines.forEach((line) => {
        doc.text(line, PAGE_MARGIN, y);
        y += 4.0;
      });
      y += 2.0;
    }
  }

  // 2) Prepared by and Services
  if (preparedBy || preparedByServices) {
    if (y + 16.0 > pageBottom) {
      doc.addPage();
      y = PAGE_MARGIN + 5;
    }
    y += 5.0; // Increased gap between Thank You paragraph and Prepared by section

    // Row 1: "Prepared by:" in black bold
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(15, 23, 42); // Black bold
    doc.text("Prepared by:", PAGE_MARGIN, y);
    y += 4.2;

    // Row 2: Company name (NetIT Technology) in next row, black bold
    if (preparedBy) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.8);
      doc.setTextColor(15, 23, 42); // Black bold
      doc.text(preparedBy, PAGE_MARGIN, y);
      y += 4.0;
    }

    // Row 3: Services in next row, black color text
    if (preparedByServices) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(15, 23, 42); // Black text
      doc.text(preparedByServices, PAGE_MARGIN, y);
      y += 4.5;
    }
  }

  // Optional Important Notice if configured in template
  if (templateFooterNote) {
    if (y + 16.0 > pageBottom) {
      doc.addPage();
      y = PAGE_MARGIN + 5;
    }
    y += 2.0;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(...COLORS.navy);
    doc.text("Important Notice", PAGE_MARGIN, y);
    y += 4.0;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(...COLORS.text);
    const fLines = doc.splitTextToSize(templateFooterNote, contentWidth);
    fLines.forEach((l) => {
      doc.text(l, PAGE_MARGIN, y);
      y += 3.8;
    });
    y += 2.0;
  }

  // 3) Signature section below Prepared by with CEO Name and Designation (Left-aligned, text centered to signature)
  const hasSignatureBlock = Boolean(signatureData || ceoName);
  if (hasSignatureBlock) {
    y += 8.5; // Increased gap between Prepared by / Services and Signature block
    if (y + 32.0 > pageBottom) {
      doc.addPage();
      y = PAGE_MARGIN + 5;
    }
    const sigW = 60;
    const sigX = PAGE_MARGIN;
    const sigY = y;

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

    if (ceoName) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.navy);
      doc.text(ceoName, sigX + sigW / 2, sigY + 25.5, {
        align: "center",
      });
    }
    if (ceoDesignation) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.muted);
      doc.text(ceoDesignation, sigX + sigW / 2, sigY + 29.5, {
        align: "center",
      });
    }

    y = sigY + 34;
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
 * Render a sharp, professional Bank icon on an in-memory canvas (blue).
 */
function createBankIconImage(color = "#1c56db") {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    const scale = 3;
    const w = 24 * scale;
    const h = 24 * scale;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    // Roof triangle pediment
    ctx.beginPath();
    ctx.moveTo(w / 2, 2.5 * scale);
    ctx.lineTo(2 * scale, 8 * scale);
    ctx.lineTo(w - 2 * scale, 8 * scale);
    ctx.closePath();
    ctx.fill();

    // Architrave (beam under roof)
    ctx.fillRect(2 * scale, 9 * scale, w - 4 * scale, 1.8 * scale);

    // Columns: 4 vertical pillars
    const colW = 2.2 * scale;
    const colTop = 11.5 * scale;
    const colH = 7.5 * scale;
    const cols = [3.5 * scale, 8.5 * scale, 13.5 * scale, 18.5 * scale];
    cols.forEach((cx) => {
      ctx.fillRect(cx, colTop, colW, colH);
    });

    // Base (2-step foundation steps)
    ctx.fillRect(2 * scale, 19.5 * scale, w - 4 * scale, 1.6 * scale);
    ctx.fillRect(1 * scale, 21.5 * scale, w - 2 * scale, 1.8 * scale);

    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function drawBankIconVector(doc, x, y, size = 4.2) {
  try {
    doc.setFillColor(28, 86, 219); // Professional Accent Blue (#1C56DB)
    // Roof triangle
    doc.triangle(
      x + size / 2, y,
      x, y + size * 0.32,
      x + size, y + size * 0.32,
      "F"
    );
    // Beam
    doc.rect(x, y + size * 0.36, size, size * 0.08, "F");
    // 3 Columns
    const colW = size * 0.16;
    const colH = size * 0.34;
    const colY = y + size * 0.46;
    doc.rect(x + size * 0.1, colY, colW, colH, "F");
    doc.rect(x + size * 0.42, colY, colW, colH, "F");
    doc.rect(x + size * 0.74, colY, colW, colH, "F");
    // Base steps
    doc.rect(x, y + size * 0.82, size, size * 0.08, "F");
    doc.rect(x - size * 0.05, y + size * 0.91, size * 1.1, size * 0.09, "F");
  } catch {
    // ignore
  }
}

/**
 * Render a high-resolution red official circular rubber stamp seal on an in-memory canvas.
 * Features authentic concentric circular borders, decorative dashed ring, horizontal divider bars,
 * top & bottom curved stars/seal text, and semi-transparent red ink so underlying financial figures remain legible.
 */
function createPaidSealImage(statusText = "PAID") {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    const scale = 3;
    const dim = 120 * scale; // Square canvas for perfect circle
    canvas.width = dim;
    canvas.height = dim;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, dim, dim);

    const cx = dim / 2;
    const cy = dim / 2;

    // Subtle natural hand-stamp tilt (-11.5 degrees)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.20);
    ctx.translate(-cx, -cy);

    const red = "#dc2626"; // Vibrant stamp red
    ctx.globalAlpha = 0.82; // Semi-transparent stamp ink so underlying text remains visible

    // Outer thick circle border
    const pad = 4 * scale;
    const rOuter = dim / 2 - pad;
    ctx.strokeStyle = red;
    ctx.lineWidth = 2.8 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
    ctx.stroke();

    // Inner thin concentric circle border
    const rInner = rOuter - 3.8 * scale;
    ctx.lineWidth = 1.1 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
    ctx.stroke();

    // Decorative inner security dotted ring
    const rDotted = rInner - 3.2 * scale;
    ctx.save();
    ctx.lineWidth = 0.85 * scale;
    ctx.setLineDash([2 * scale, 2.5 * scale]);
    ctx.beginPath();
    ctx.arc(cx, cy, rDotted, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Center horizontal divider bars enclosing the main status text
    const barHalfW = rDotted * 0.76;
    const barOffset = 12 * scale;

    ctx.lineWidth = 1.4 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - barHalfW, cy - barOffset);
    ctx.lineTo(cx + barHalfW, cy - barOffset);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - barHalfW, cy + barOffset);
    ctx.lineTo(cx + barHalfW, cy + barOffset);
    ctx.stroke();

    // Helper to render text curved along an arc
    const drawCurvedText = (text, radius, isTop) => {
      ctx.save();
      ctx.font = `bold ${6.8 * scale}px "Helvetica Neue", Arial, sans-serif`;
      ctx.fillStyle = red;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const chars = text.split("");
      let totalWidth = 0;
      const widths = chars.map((ch) => {
        const w = ctx.measureText(ch).width;
        totalWidth += w;
        return w;
      });

      const totalAngle = Math.min(Math.PI * 0.72, (totalWidth / radius) * 1.15);
      let curAngle = isTop
        ? -Math.PI / 2 - totalAngle / 2
        : Math.PI / 2 + totalAngle / 2;

      for (let i = 0; i < chars.length; i++) {
        const charAngle = (widths[i] / totalWidth) * totalAngle;
        const halfAngle = charAngle / 2;
        curAngle += isTop ? halfAngle : -halfAngle;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(curAngle + (isTop ? Math.PI / 2 : -Math.PI / 2));
        ctx.fillText(chars[i], 0, isTop ? -radius : radius);
        ctx.restore();

        curAngle += isTop ? halfAngle : -halfAngle;
      }
      ctx.restore();
    };

    // Curved text along upper and lower rim
    const text = String(statusText || "PAID").trim().toUpperCase();
    const topArcText =
      text === "ADVANCED"
        ? "★  ADVANCE PAYMENT  ★"
        : text === "PARTIAL"
          ? "★  PARTIAL PAYMENT  ★"
          : "★  PAYMENT RECEIVED  ★";
    const bottomArcText = "★  OFFICIAL SEAL  ★";

    const rArc = (rDotted + barOffset) / 2 + 3 * scale;
    drawCurvedText(topArcText, rArc, true);
    drawCurvedText(bottomArcText, rArc, false);

    // Main center status text (e.g. "PAID")
    let fontSize = 22;
    if (text === "ADVANCED") {
      fontSize = 13;
    } else if (text === "PARTIAL") {
      fontSize = 16;
    } else if (text.length > 5) {
      fontSize = 13;
    }

    ctx.fillStyle = red;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${fontSize * scale}px "Arial Black", "Impact", "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(text, cx, cy + 0.5 * scale);

    ctx.restore();

    return canvas.toDataURL("image/png");
  } catch {
    return null;
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

  let localInvSettings = {};
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("iq_invoice_settings")
        : null;
    if (raw) localInvSettings = JSON.parse(raw);
  } catch {
    // ignore
  }

  let cachedBranding = {};
  try {
    const rawBrand =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("company_branding")
        : null;
    if (rawBrand) cachedBranding = JSON.parse(rawBrand);
  } catch {
    // ignore
  }

  const mergedCompany = {
    ...cachedBranding,
    ...(company || {}),
  };
  for (const [k, v] of Object.entries(cachedBranding)) {
    if (
      (mergedCompany[k] === undefined ||
        mergedCompany[k] === null ||
        mergedCompany[k] === "") &&
      v
    ) {
      mergedCompany[k] = v;
    }
  }

  const currency =
    valueOrEmpty(invoice.currency) ||
    valueOrEmpty(localInvSettings.default_currency) ||
    "LKR";
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  const logoSource = resolveImageSource(mergedCompany, [
    "logo_url",
    "logo",
    "company_logo",
  ]);
  const signatureSource = resolveImageSource(mergedCompany, [
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
  const pageBottom = pageHeight - 11;

  const companyName = valueOrEmpty(mergedCompany.name || mergedCompany.company_name);
  const companyLines = [
    mergedCompany.address || mergedCompany.company_address,
    mergedCompany.phone || mergedCompany.contact_number
      ? `Phone: ${mergedCompany.phone || mergedCompany.contact_number}`
      : "",
    mergedCompany.email || mergedCompany.email_address
      ? `Email: ${mergedCompany.email || mergedCompany.email_address}`
      : "",
    mergedCompany.website,
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
  const pdfHeading =
    valueOrEmpty(localInvSettings.pdf_heading) ||
    valueOrEmpty(mergedCompany.invoice_pdf_heading) ||
    "INVOICE";

  const pdfSubheading =
    localInvSettings.pdf_subheading !== undefined &&
    localInvSettings.pdf_subheading !== null
      ? String(localInvSettings.pdf_subheading).trim()
      : valueOrEmpty(mergedCompany.invoice_pdf_subheading) ||
        "OFFICIAL BILLING DOCUMENT";

  if (pdfSubheading) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.blue);
    doc.text(pdfSubheading.toUpperCase(), pageWidth - PAGE_MARGIN, 17, {
      align: "right",
    });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(23);
  doc.setTextColor(...COLORS.navy);
  doc.text(pdfHeading.toUpperCase(), pageWidth - PAGE_MARGIN, 25, { align: "right" });

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
    valueOrEmpty(invoice.payment_status) ||
    (grandTotalVal > 0 && balanceVal <= 0
      ? "Full Paid"
      : paidVal > 0
        ? "Partial"
        : "Unpaid");

  const statusLower = statusText.toLowerCase();
  const isFullPaid =
    (grandTotalVal > 0 && balanceVal <= 0) ||
    (grandTotalVal > 0 && paidVal >= grandTotalVal) ||
    statusLower === "paid" ||
    statusLower === "full paid" ||
    String(invoice.payment_status || "").trim().toLowerCase() === "paid" ||
    String(invoice.payment_status || "").trim().toLowerCase() === "full paid";

  const statusPalette = statusLower.includes("advanced")
    ? { bg: [245, 243, 255], text: [124, 58, 237] }
    : statusLower.includes("paid") && !statusLower.includes("unpaid") && !statusLower.includes("partial")
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
  let y = Math.max(logoY + logoH + 3.5, headerY + 2.5, 36);
  doc.setFillColor(...COLORS.navy);
  doc.rect(PAGE_MARGIN, y, contentWidth, 1.1, "F");
  y += 5.2;

  // 3. BILL TO & INVOICE DETAILS
  const invoiceNum =
    valueOrEmpty(invoice.invoice_number || invoice.invoiceNumber) ||
    "Not specified";
  const invDateText = formatInvoiceDate(invoice.invoice_date);
  const dueDateText = formatInvoiceDate(invoice.due_date);

  const colXLeft = PAGE_MARGIN;
  const colXRight = PAGE_MARGIN + contentWidth / 2 + 5;
  const subColW = contentWidth / 2 - 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.blue);
  doc.text("BILL TO", colXLeft, y);
  doc.text("INVOICE DETAILS", colXRight, y);

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(colXLeft, y + 2.0, colXLeft + subColW, y + 2.0);
  doc.line(colXRight, y + 2.0, colXRight + subColW, y + 2.0);

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

  let leftY = y + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.navy);
  const cNameLines = doc.splitTextToSize(clientName, subColW);
  doc.text(cNameLines, colXLeft, leftY);
  leftY += cNameLines.length * 4.2;

  const clientSubLines = [
    clientCompany,
    clientAddress,
    clientEmail,
    clientPhone,
  ].filter(Boolean);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.0);
  doc.setTextColor(...COLORS.muted);
  clientSubLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, subColW);
    doc.text(wrapped, colXLeft, leftY);
    leftY += wrapped.length * 3.7;
  });

  const invoiceDetailsRows = [
    ["INVOICE NUMBER", invoiceNum, true],
    ["INVOICE DATE", invDateText, false],
    ["DUE DATE", dueDateText, false],
    ...(valueOrEmpty(invoice.quotation_number)
      ? [["QUOTATION REF", String(invoice.quotation_number), false]]
      : []),
  ];

  let rightY = y + 6;
  invoiceDetailsRows.forEach(([label, value, isBold]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, colXRight, rightY);

    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(8.0);
    doc.setTextColor(...(isBold ? COLORS.navy : COLORS.text));
    const valLines = doc.splitTextToSize(String(value), subColW - 33);
    doc.text(valLines[0] || "—", colXRight + 32, rightY);
    rightY += 4.8;
  });

  y = Math.max(leftY, rightY) + 5;

  // 5. ITEMS & SERVICES TABLE
  if (y + 18 > pageBottom) {
    doc.addPage();
    y = PAGE_MARGIN;
  }

  const pricingRows = items.map((item, index) => {
    const customText = getAdditionalItemCustomText(item, index);
    const name =
      valueOrEmpty(item.item_name || item.service_name || item.name) ||
      `Service ${index + 1}`;

    if (customText) {
      return [
        String(index + 1),
        name,
        "",
        "",
        {
          content: customText,
          styles: {
            halign: "right",
            fontStyle: "bold",
            textColor: COLORS.navy,
          },
        },
      ];
    }

    const price = numericValue(item.unit_price ?? item.Price ?? item.price);
    const taxRate = numericValue(item.tax_rate ?? item.taxRate);
    const lineTax = (price * taxRate) / 100;
    const lineTotal =
      item.line_total != null &&
        Number(item.line_total) > 0 &&
        Math.abs(Number(item.line_total) - (price + lineTax)) < 0.01
        ? numericValue(item.line_total)
        : price + lineTax;

    return [
      String(index + 1),
      name,
      {
        content: formatMoney(price, currency),
        currency: currency,
        amount: numericValue(price).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        isCurrencyCell: true,
      },
      `${taxRate}%`,
      {
        content: formatMoney(lineTotal, currency),
        currency: currency,
        amount: numericValue(lineTotal).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        isCurrencyCell: true,
      },
    ];
  });

  const tableBody = [
    ...(pricingRows.length > 0
      ? pricingRows
      : [["", "No service items available.", "", "", ""]]),
    [
      {
        content: "Discount (-)",
        colSpan: 4,
        styles: {
          halign: "left",
          fontStyle: "bold",
          textColor: COLORS.muted,
          fillColor: [255, 255, 255],
        },
      },
      {
        content:
          discountVal > 0
            ? `${currency} -${numericValue(discountVal).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
            : formatMoney(0, currency),
        currency: currency,
        amount:
          discountVal > 0
            ? `-${numericValue(discountVal).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
            : "0.00",
        isCurrencyCell: true,
        styles: {
          halign: "right",
          fontStyle: "bold",
          textColor: discountVal > 0 ? COLORS.navy : COLORS.muted,
          fillColor: [255, 255, 255],
        },
      },
    ],
    [
      {
        content: "Total Cost",
        colSpan: 4,
        styles: {
          halign: "left",
          fontStyle: "bold",
          textColor: COLORS.navy,
          fillColor: [255, 255, 255],
        },
      },
      {
        content: formatMoney(grandTotalVal, currency),
        currency: currency,
        amount: numericValue(grandTotalVal).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        isCurrencyCell: true,
        styles: {
          halign: "right",
          fontStyle: "bold",
          textColor: COLORS.navy,
          fillColor: [255, 255, 255],
        },
      },
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [["#", "SERVICE / ITEM", "UNIT PRICE", "TAX", "LINE TOTAL"]],
    body: tableBody,
    margin: {
      left: PAGE_MARGIN,
      right: PAGE_MARGIN,
      top: PAGE_MARGIN,
      bottom: 11,
    },
    theme: "grid",
    headStyles: {
      fillColor: COLORS.navy,
      textColor: COLORS.white,
      font: "helvetica",
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: 2.8,
      halign: "left",
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: COLORS.text,
      font: "helvetica",
      fontSize: 8.2,
      cellPadding: 2.8,
      overflow: "linebreak",
      valign: "middle",
      lineColor: COLORS.border,
      lineWidth: 0.15,
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
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
      if (data.section === "body") {
        if (data.cell.raw && typeof data.cell.raw === "object" && data.cell.raw.styles) {
          Object.assign(data.cell.styles, data.cell.raw.styles);
        } else if (data.column.index === 4) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = COLORS.navy;
        }
      }
    },
    willDrawCell: function (data) {
      if (data.section === "body" && data.cell.raw && data.cell.raw.isCurrencyCell) {
        data.cell.text = [];
      }
    },
    didDrawCell: function (data) {
      if (data.section === "body" && data.cell.raw && data.cell.raw.isCurrencyCell) {
        const raw = data.cell.raw;
        const padLeft = (data.cell.padding && typeof data.cell.padding === "function")
          ? data.cell.padding("left")
          : (data.cell.paddingLeft || 3.5);
        const padRight = (data.cell.padding && typeof data.cell.padding === "function")
          ? data.cell.padding("right")
          : (data.cell.paddingRight || 3.5);
        const cellX = data.cell.x;
        const cellY = data.cell.y;
        const cellW = data.cell.width;
        const cellH = data.cell.height;

        doc.setFont("helvetica", data.cell.styles.fontStyle || "normal");
        doc.setFontSize(data.cell.styles.fontSize || 8.5);
        if (Array.isArray(data.cell.styles.textColor)) {
          doc.setTextColor(...data.cell.styles.textColor);
        } else {
          doc.setTextColor(...COLORS.text);
        }

        const fontSizeMm = (data.cell.styles.fontSize || 8.5) * 0.352778;
        const textY = cellY + cellH / 2 + fontSizeMm * 0.35;

        // Draw currency aligned to the left
        doc.text(raw.currency || currency || "LKR", cellX + padLeft, textY, { align: "left" });

        // Draw amount aligned to the right
        doc.text(raw.amount || "0.00", cellX + cellW - padRight, textY, { align: "right" });
      }
    },
    showHead: "everyPage",
    rowPageBreak: "auto",
  });

  y = doc.lastAutoTable.finalY + 4;

  // 6. BOTTOM SECTION:
  //    Right: Financial Summary Box (GRAND TOTAL, Paid Amount, Balance Due)
  //    Left: Payment / Bank Notes (soft yellow box with bank icon)
  //    Below: Terms & Conditions, Thank You Message, Prepared by, Authorized Signature (from Company Settings)
  const summaryWidth = 84;
  const summaryX = pageWidth - PAGE_MARGIN - summaryWidth;
  const noteBoxW = summaryX - PAGE_MARGIN - 6;

  // Resolve payment / bank notes from invoice form / record or settings
  const rawNotes = valueOrEmpty(
    invoice.notes ||
    invoice.payment_notes ||
    invoice.bank_notes ||
    localInvSettings.default_notes
  );

  const defaultBankRemittance = mergedCompany.bank_name
    ? `Please remit payment via bank transfer to ${mergedCompany.bank_name} (A/C: ${mergedCompany.bank_account_number || "—"}, Beneficiary: ${mergedCompany.bank_account_name || mergedCompany.company_name || "—"}). Reference the invoice number on your payment slip.`
    : "";

  let paymentNotesText = defaultBankRemittance || rawNotes;
  if (
    rawNotes &&
    !rawNotes.toLowerCase().includes("please deposit payments into our registered commercial") &&
    !rawNotes.toLowerCase().includes("accounts@company.lk")
  ) {
    paymentNotesText = rawNotes;
  } else if (defaultBankRemittance) {
    paymentNotesText = defaultBankRemittance;
  } else if (rawNotes) {
    paymentNotesText = rawNotes;
  }

  const noteLines = paymentNotesText
    ? doc.splitTextToSize(paymentNotesText, noteBoxW - 13)
    : [];

  const neededNoteBoxH = paymentNotesText
    ? Math.max(28, 9.5 + noteLines.length * 3.5 + 3.0)
    : 28;

  const defaultInvoiceTerms =
    "Payment is strictly due within 14 calendar days of issuance.\nOverdue accounts may be subject to interest.";

  const settingTerms = valueOrEmpty(
    localInvSettings.default_terms ||
    mergedCompany.invoice_default_terms ||
    mergedCompany.invoice_terms
  );

  const rawInvoiceTerms = valueOrEmpty(invoice.terms_and_conditions || invoice.terms);
  const quotationCompanyTerms = valueOrEmpty(mergedCompany.default_terms_and_conditions);

  let termsText = settingTerms || defaultInvoiceTerms;
  if (settingTerms) {
    termsText = settingTerms;
  } else if (
    rawInvoiceTerms &&
    rawInvoiceTerms !== defaultInvoiceTerms &&
    rawInvoiceTerms !== quotationCompanyTerms &&
    !rawInvoiceTerms.toLowerCase().includes("quotation is valid")
  ) {
    termsText = rawInvoiceTerms;
  }

  const summaryBoxH = Math.max(28, neededNoteBoxH);

  if (items.length > 3 && y + summaryBoxH > pageBottom) {
    doc.addPage();
    y = PAGE_MARGIN;
  }

  const sectionStartY = y;

  // Left Side: Payment / Bank Notes (rendered in a soft light blue box with bank icon)
  if (paymentNotesText) {
    // 1. Soft light blue background (lighter soft blue)
    doc.setFillColor(246, 250, 255); // #F6FAFF (lighter, softer blue fill)
    doc.setDrawColor(219, 234, 254); // #DBEAFE (blue-100, clean lighter soft blue border)
    doc.setLineWidth(0.3);
    doc.roundedRect(PAGE_MARGIN, sectionStartY, noteBoxW, summaryBoxH, 1.8, 1.8, "FD");

    // 2. Bank Icon badge (crisp canvas image or vector fallback)
    const bankIconUrl = createBankIconImage("#1c56db");
    const iconSize = 4.6;
    const iconX = PAGE_MARGIN + 5.0;
    const iconY = sectionStartY + 3.2;

    if (bankIconUrl) {
      try {
        doc.addImage(bankIconUrl, "PNG", iconX, iconY, iconSize, iconSize);
      } catch {
        drawBankIconVector(doc, iconX, iconY, iconSize);
      }
    } else {
      drawBankIconVector(doc, iconX, iconY, iconSize);
    }

    // 4. Header: PAYMENT / BANK INSTRUCTIONS
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(28, 86, 219); // #1C56DB (COLORS.blue)
    doc.text("PAYMENT / BANK INSTRUCTIONS", PAGE_MARGIN + 11.2, sectionStartY + 6.8);

    // 5. Subtle header divider line
    doc.setDrawColor(219, 234, 254); // #DBEAFE (blue-100)
    doc.setLineWidth(0.2);
    doc.line(
      PAGE_MARGIN + 5.0,
      sectionStartY + 9.2,
      PAGE_MARGIN + noteBoxW - 5.0,
      sectionStartY + 9.2
    );

    // 6. Payment Notes text lines
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(30, 41, 59); // Slate-800 (#1E293B, COLORS.text)
    let noteLineY = sectionStartY + 13.0;
    noteLines.forEach((l) => {
      doc.text(l, PAGE_MARGIN + 5.5, noteLineY);
      noteLineY += 3.6;
    });
  }

  // Right Top: Financial Summary Box
  let sumY = sectionStartY;
  doc.setFillColor(...COLORS.light);
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.25);
  doc.roundedRect(summaryX, sumY, summaryWidth, summaryBoxH, 1.5, 1.5, "FD");

  const rightX = pageWidth - PAGE_MARGIN - 4;

  sumY += 2.5;
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
    paidVal > 0
      ? `- ${formatMoney(paidVal, currency)}`
      : formatMoney(0, currency),
    rightX,
    sumY,
    { align: "right" }
  );

  sumY += 5.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.navy);
  doc.text("Balance Due", summaryX + 4, sumY);
  doc.setTextColor(
    ...(balanceVal <= 0 && grandTotalVal > 0 ? [21, 128, 61] : [185, 28, 28])
  );
  doc.text(
    formatMoney(balanceVal, currency),
    rightX,
    sumY,
    { align: "right" }
  );

  // Circular "PAID" Stamp: Appears for full payment, advanced payment, partial paid, or balance payment
  // (omitted only when completely unpaid with no payment)
  const invStatus = String(invoice?.status || "").trim().toLowerCase();
  const invPayStatus = String(invoice?.payment_status || "").trim().toLowerCase();
  const isUnpaid =
    (paidVal <= 0 &&
      (statusLower === "unpaid" ||
        invStatus === "unpaid" ||
        invPayStatus === "unpaid")) ||
    (statusLower === "unpaid" && paidVal <= 0);

  const shouldShowPaidSeal =
    !isUnpaid &&
    (paidVal > 0 ||
      isFullPaid ||
      (balanceVal <= 0.001 && grandTotalVal > 0) ||
      invStatus === "paid" ||
      invStatus === "full paid" ||
      invStatus === "advanced" ||
      invStatus === "advance" ||
      invStatus === "partial" ||
      invStatus === "partially paid" ||
      invPayStatus === "paid" ||
      invPayStatus === "full paid" ||
      invPayStatus === "advanced" ||
      invPayStatus === "advance" ||
      invPayStatus === "partial" ||
      invPayStatus === "partially paid" ||
      statusLower.includes("paid") ||
      statusLower.includes("advanced") ||
      statusLower.includes("partial"));

  if (shouldShowPaidSeal) {
    const paidSealDataUrl = createPaidSealImage("PAID");
    if (paidSealDataUrl) {
      const sealSize = 25; // 25mm circular stamp (equal width & height)
      const sealX = summaryX + 30;
      const sealY = sectionStartY + 2.5;
      doc.addImage(paidSealDataUrl, "PNG", sealX, sealY, sealSize, sealSize);
    }
  }

  // Next section starts below Grand Total Box from the left side with comfortable breathing space
  y = sectionStartY + summaryBoxH + 7.5;

  // 7. TERMS & CONDITIONS, THANK YOU MESSAGE, PREPARED BY & AUTHORIZED SIGNATURE
  const defaultThankYouMessage =
    "We appreciate the opportunity to work with your business.";

  const thankYouTitle = valueOrEmpty(
    localInvSettings.thank_you_title ||
    mergedCompany.invoice_thank_you_title ||
    "Thank You"
  );
  const rawThankYou = valueOrEmpty(
    localInvSettings.thank_you_message !== undefined && localInvSettings.thank_you_message !== null
      ? localInvSettings.thank_you_message
      : mergedCompany.invoice_thank_you_message
  );
  const thankYouMessage = rawThankYou || defaultThankYouMessage;

  const preparedBy = valueOrEmpty(
    localInvSettings.prepared_by ||
    mergedCompany.invoice_prepared_by ||
    mergedCompany.name ||
    mergedCompany.company_name ||
    "NetIT Technology"
  );
  const preparedByServices = valueOrEmpty(
    localInvSettings.prepared_by_services ||
    mergedCompany.invoice_prepared_by_services ||
    "Web Development • Software Solutions • Digital Marketing"
  );
  const ceoName = valueOrEmpty(
    localInvSettings.ceo_name ||
    mergedCompany.invoice_ceo_name ||
    mergedCompany.authorized_person ||
    mergedCompany.contact_person ||
    "D M N K DISSANAYAKA"
  );
  const ceoDesignation = valueOrEmpty(
    localInvSettings.ceo_designation ||
    mergedCompany.invoice_ceo_designation ||
    mergedCompany.designation ||
    "CEO (NetIT Technology)"
  );

  const hasSignatureBlock = Boolean(signatureData || ceoName);
  const tLines = termsText ? doc.splitTextToSize(termsText, contentWidth) : [];
  const msgLines = thankYouMessage ? doc.splitTextToSize(thankYouMessage, contentWidth) : [];

  const neededTermsH = termsText ? 4.5 + tLines.length * 3.8 + 3.0 : 0;
  const neededThankYouH = (thankYouTitle || thankYouMessage) ? 4.5 + msgLines.length * 3.8 + 3.0 : 0;
  const neededPreparedH = (preparedBy || preparedByServices) ? 12.5 : 0;
  const neededSigH = hasSignatureBlock ? 28.0 : 0;
  const totalBottomH = neededTermsH + neededThankYouH + neededPreparedH + neededSigH;

  // For up to 3 service items, guarantee single-page invoice layout.
  // For 4, 5+ service items, break cleanly to next page only if bottom section exceeds page height.
  if (items.length > 3 && y + totalBottomH > pageBottom) {
    doc.addPage();
    y = PAGE_MARGIN + 5;
  }

  // 1) Terms & Conditions
  if (termsText) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.navy);
    doc.text("Terms & Conditions", PAGE_MARGIN, y);
    y += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.text);
    tLines.forEach((l) => {
      doc.text(l, PAGE_MARGIN, y);
      y += 3.8;
    });
    y += 3.0;
  }

  // 2) Thank You Title and Message
  if (thankYouTitle || thankYouMessage) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.navy);
    doc.text(thankYouTitle, PAGE_MARGIN, y);
    y += 4.5;

    if (thankYouMessage) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(...COLORS.text);
      msgLines.forEach((line) => {
        doc.text(line, PAGE_MARGIN, y);
        y += 3.8;
      });
      y += 3.0;
    }
  }

  // 3) Prepared by and Services
  if (preparedBy || preparedByServices) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.0);
    doc.setTextColor(15, 23, 42);
    doc.text("Prepared by:", PAGE_MARGIN, y);
    y += 4.0;

    if (preparedBy) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(preparedBy, PAGE_MARGIN, y);
      y += 3.8;
    }

    if (preparedByServices) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(preparedByServices, PAGE_MARGIN, y);
      y += 4.2;
    }
  }

  // 4) Signature section below Prepared by with CEO Name and Designation
  if (hasSignatureBlock) {
    y += 2.5;
    const sigW = 55;
    const sigX = PAGE_MARGIN;
    const sigY = y;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.0);
    doc.setTextColor(...COLORS.muted);
    doc.text("Authorized Signature", sigX + sigW / 2, sigY + 2.0, {
      align: "center",
    });

    if (signatureData) {
      containImage(doc, signatureData, sigX, sigY + 3.5, sigW, 12);
    }

    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(sigX, sigY + 17, sigX + sigW, sigY + 17);

    if (ceoName) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.navy);
      doc.text(ceoName, sigX + sigW / 2, sigY + 21.0, {
        align: "center",
      });
    }
    if (ceoDesignation) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.muted);
      doc.text(ceoDesignation, sigX + sigW / 2, sigY + 24.5, {
        align: "center",
      });
    }

    y = sigY + 28;
  }

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
