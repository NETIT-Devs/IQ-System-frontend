const SECTION_LABEL_REGEX =
  /^(Description|Core\s*features?|Maintenance\s*(?:&|and)?\s*support|Content\s*(?:&|and)?\s*SEO|Deliverables?|Scope)\s*:\s*(.*)$/i;

const COMMA_SPLIT_LABELS = new Set([
  "core features",
  "core feature",
  "maintenance support",
  "maintenance & support",
  "maintenance and support",
  "content & seo",
  "content and seo",
  "deliverables",
  "deliverable",
]);

function normalizeSectionTitle(rawLabel) {
  const lower = String(rawLabel || "").trim().toLowerCase();
  if (lower === "description") return "Description";
  if (lower.startsWith("core feature")) return "Core Features";
  if (lower.startsWith("maintenance")) return "Maintenance Support";
  if (lower.startsWith("content")) return "Content & SEO";
  if (lower.startsWith("hosting")) return "Hosting & Domain";
  if (lower.startsWith("deliverable")) return "Deliverables";
  if (lower === "scope") return "Scope";
  return String(rawLabel || "").trim();
}

function splitOutsideParens(text) {
  const parts = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "(") depth += 1;
    else if (ch === ")" && depth > 0) depth -= 1;

    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function stripBulletPrefix(line) {
  return String(line || "")
    .trim()
    .replace(/^[\u2022•*\-–—]+\s*/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
}

/**
 * Split a service deliverable string into clean individual points.
 */
export function splitDeliverablePoints(rawValue, { splitCommas = false } = {}) {
  const raw = String(rawValue || "").trim();
  if (!raw) return [];

  const points = [];
  const rawLines = raw.split(/\r?\n/);

  for (const rawLine of rawLines) {
    const cleaned = stripBulletPrefix(rawLine);
    if (!cleaned) continue;

    const semiParts = cleaned.split(/\s*;\s*/).filter(Boolean);
    for (const part of semiParts) {
      if (splitCommas) {
        const commaParts = splitOutsideParens(part);
        for (const cp of commaParts) {
          const item = stripBulletPrefix(cp);
          if (item) points.push(item);
        }
      } else {
        const item = stripBulletPrefix(part);
        if (item) points.push(item);
      }
    }
  }

  return points;
}

/**
 * Format a service catalog preset into clean point-by-point sections for the Quotation Form.
 */
export function formatServicePresetDescription(service) {
  if (!service) return "";

  const hostingVal =
    service.hosting_domain || service.hosting || "";

  const sections = [
    { label: "Description", value: service.description, splitCommas: false },
    { label: "Core Features", value: service.core_features, splitCommas: true },
    {
      label: "Maintenance Support",
      value: service.maintenance_support,
      splitCommas: true,
    },
    { label: "Content & SEO", value: service.content_seo, splitCommas: true },
    {
      label: "Hosting & Domain",
      value: hostingVal || "Domain and hosting setup assistance included",
      splitCommas: false,
    },
  ];

  return sections
    .map(({ label, value, splitCommas }) => {
      const points = splitDeliverablePoints(value, { splitCommas });
      if (points.length === 0) {
        if (value) {
          return `${label}:\n\u2022 ${value.trim()}`;
        }
        return "";
      }
      return `${label}:\n${points.map((pt) => `\u2022 ${pt}`).join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Format description text into clean point-by-point lines for both Form and PDF table.
 */
export function formatDescriptionPointByPoint(
  rawText,
  { indent = "", ensureBullets = false } = {}
) {
  const text = String(rawText || "").trim();
  if (!text) return "";

  const lines = text.split(/\r?\n/);
  const hasSectionHeaders = lines.some((l) => SECTION_LABEL_REGEX.test(l.trim()));

  if (hasSectionHeaders) {
    const sections = [];
    let current = null;

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      const match = trimmed.match(SECTION_LABEL_REGEX);
      if (match) {
        if (current) sections.push(current);
        const title = normalizeSectionTitle(match[1]);
        const inlineRest = String(match[2] || "").trim();
        current = {
          title,
          splitCommas: COMMA_SPLIT_LABELS.has(title.toLowerCase()),
          rawLines: inlineRest ? [inlineRest] : [],
        };
      } else if (current) {
        current.rawLines.push(trimmed);
      } else {
        current = {
          title: "",
          splitCommas: false,
          rawLines: [trimmed],
        };
      }
    }
    if (current) sections.push(current);

    return sections
      .map((sec) => {
        const pts = splitDeliverablePoints(sec.rawLines.join("\n"), {
          splitCommas: sec.splitCommas,
        });
        if (pts.length === 0) return sec.title ? `${sec.title}:` : "";
        const bulletLines = pts.map((pt) => `${indent}\u2022 ${pt}`).join("\n");
        return sec.title ? `${sec.title}:\n${bulletLines}` : bulletLines;
      })
      .filter(Boolean)
      .join("\n\n");
  }

  const hasBulletOrMulti =
    lines.length > 1 ||
    text.includes(";") ||
    /^[\u2022•*\-–—]\s+|^\d+[.)]\s+/m.test(text);

  if (hasBulletOrMulti || ensureBullets) {
    const pts = splitDeliverablePoints(text, { splitCommas: false });
    if (pts.length === 0) return "";
    return pts.map((pt) => `${indent}\u2022 ${pt}`).join("\n");
  }

  return text;
}

/**
 * Parse structured deliverable text into sections with title and array of bullet points.
 * Handles headings like "Description:", "Core Features:", "Maintenance Support:", "Content & SEO:",
 * custom section headings, bullet lists, hosting & domain, and deliverables.
 */
export function parseDeliverableSections(
  rawText,
  { hostingDomain = "", deliverables = "" } = {}
) {
  const sections = [];
  const text = String(rawText || "").trim();

  if (text) {
    const lines = text.split(/\r?\n/);
    let current = null;

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      const isBullet =
        /^[\u2022•*\-–—]/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed);

      const colonMatch =
        !isBullet && trimmed.match(/^([A-Za-z0-9\s&/()+-]+):\s*(.*)$/);

      if (colonMatch) {
        if (current && (current.title || current.points.length > 0)) {
          sections.push(current);
        }
        const rawTitle = colonMatch[1].trim();
        const inlineRest = colonMatch[2].trim();
        const normTitle = normalizeSectionTitle(rawTitle);

        current = {
          title: normTitle,
          points: [],
        };

        if (inlineRest) {
          const shouldSplitCommas = COMMA_SPLIT_LABELS.has(normTitle.toLowerCase());
          const pts = splitDeliverablePoints(inlineRest, {
            splitCommas: shouldSplitCommas,
          });
          if (pts.length > 0) {
            current.points.push(...pts);
          } else {
            const stripped = stripBulletPrefix(inlineRest);
            if (stripped) current.points.push(stripped);
          }
        }
      } else {
        const cleaned = stripBulletPrefix(trimmed);
        if (cleaned) {
          if (!current) {
            current = {
              title: "",
              points: [],
            };
          }
          const shouldSplitCommas =
            current.title && COMMA_SPLIT_LABELS.has(current.title.toLowerCase());
          if (trimmed.includes(";") || (shouldSplitCommas && trimmed.includes(","))) {
            const pts = splitDeliverablePoints(cleaned, {
              splitCommas: shouldSplitCommas,
            });
            if (pts.length > 0) {
              current.points.push(...pts);
            } else {
              current.points.push(cleaned);
            }
          } else {
            current.points.push(cleaned);
          }
        }
      }
    }

    if (current && (current.title || current.points.length > 0)) {
      sections.push(current);
    }
  }

  // Add or update Hosting & Domain if specified
  const hostingStr = String(hostingDomain || "").trim();
  if (hostingStr) {
    const hostingPoints = splitDeliverablePoints(hostingStr, {
      splitCommas: false,
    });
    const finalPoints = hostingPoints.length > 0 ? hostingPoints : [hostingStr];

    const hostingSecIdx = sections.findIndex((sec) =>
      /hosting/i.test(sec.title)
    );
    if (hostingSecIdx !== -1) {
      sections[hostingSecIdx].points = finalPoints;
    } else {
      sections.push({
        title: "Hosting & Domain",
        points: finalPoints,
      });
    }
  }

  // Add Deliverables if specified and not already in sections
  const delivStr = String(deliverables || "").trim();
  if (delivStr) {
    const hasDelivSection = sections.some((sec) =>
      /deliverable/i.test(sec.title)
    );
    if (!hasDelivSection) {
      const delivPoints = splitDeliverablePoints(delivStr, {
        splitCommas: false,
      });
      sections.push({
        title: "Deliverables",
        points: delivPoints.length > 0 ? delivPoints : [delivStr],
      });
    }
  }

  return sections;
}

/**
 * Detect whether an item is an additional item (e.g. Logo, Domain, SSL)
 * added via "+ Add Additional Item" rather than a full primary service.
 */
export function isAdditionalQuotationItem(item, index = 0) {
  if (!item) return false;
  if (Boolean(item.is_additional)) return true;
  if (index > 0) {
    const hasServiceConfig = Boolean(
      item.technology || item.website_type || item.hosting_domain
    );
    const desc = String(item.description || "").trim();
    const hasPresetSections =
      desc.includes("Description:") ||
      desc.includes("Core Features:") ||
      desc.includes("Deliverables:") ||
      desc.includes("Maintenance Support:") ||
      desc.includes("Hosting & Domain:") ||
      desc.includes("Content & SEO:");
    if (!hasServiceConfig && !hasPresetSections) {
      return true;
    }
  }
  return false;
}

/**
 * Split a list of quotation items into main services and additional development items.
 */
export function categorizeQuotationItems(items = []) {
  const safeItems = Array.isArray(items) ? items : [];
  const mainServices = [];
  const additionalItems = [];

  safeItems.forEach((it, idx) => {
    if (isAdditionalQuotationItem(it, idx)) {
      additionalItems.push(it);
    } else {
      mainServices.push(it);
    }
  });

  // Guarantee at least one main service if items exist
  if (mainServices.length === 0 && safeItems.length > 0) {
    mainServices.push(safeItems[0]);
    return {
      mainServices,
      additionalItems: safeItems.slice(1),
    };
  }

  return { mainServices, additionalItems };
}

/**
 * Detect if an item (typically an additional item) has a text-based amount (e.g. "Free")
 * rather than a numeric fee.
 */
export function getAdditionalItemCustomText(item, index = 0) {
  if (!item) return "";

  // 1. Explicit property if already attached
  const directText = String(item.unit_price_text || item.custom_amount || "").trim();
  if (directText && Number.isNaN(Number(directText))) {
    return directText.toLowerCase() === "free" ? "Free" : directText;
  }

  // 2. Check if unit_price itself is a non-numeric string (e.g. "Free")
  if (typeof item.unit_price === "string") {
    const trimmed = item.unit_price.trim();
    if (trimmed && Number.isNaN(Number(trimmed))) {
      return trimmed.toLowerCase() === "free" ? "Free" : trimmed;
    }
  }

  // 3. Check if stored in description as [custom_amount:XYZ]
  const descMatch = String(item.description || "").match(/\[custom_amount:([^\]]+)\]/i);
  if (descMatch && descMatch[1]) {
    const val = descMatch[1].trim();
    return val.toLowerCase() === "free" ? "Free" : val;
  }

  // 4. Check if description is literally "Free" on an additional item
  if (isAdditionalQuotationItem(item, index)) {
    const desc = String(item.description || "").trim();
    if (desc && desc.toLowerCase() === "free") {
      return "Free";
    }
  }

  return "";
}



