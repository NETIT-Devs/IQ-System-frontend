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

  const sections = [
    { label: "Description", value: service.description, splitCommas: false },
    { label: "Core Features", value: service.core_features, splitCommas: true },
    {
      label: "Maintenance Support",
      value: service.maintenance_support,
      splitCommas: true,
    },
    { label: "Content & SEO", value: service.content_seo, splitCommas: true },
  ];

  return sections
    .map(({ label, value, splitCommas }) => {
      const points = splitDeliverablePoints(value, { splitCommas });
      if (points.length === 0) return "";
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

