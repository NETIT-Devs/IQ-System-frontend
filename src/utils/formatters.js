// Monthly document number formatting and sequential helpers (QUO-YYMM-NNN / INV-YYMM-NNN).

export function getYearMonthCode(dateStr) {
  const raw = String(dateStr || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})/);
  if (match) {
    return `${match[1].slice(2, 4)}${match[2]}`;
  }
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2, 4);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${yy}${mm}`;
}

export function getNextSequenceNumber(prefix, existingNumbers = [], dateStr) {
  const upperPrefix = String(prefix || "").toUpperCase();
  const yymm = getYearMonthCode(dateStr);
  const pattern = new RegExp(`^${upperPrefix}-${yymm}-(\\d+)$`, "i");
  let maxSeq = 0;

  for (const num of existingNumbers) {
    const match = String(num || "").trim().match(pattern);
    if (match) {
      const seq = Number(match[1]);
      if (Number.isFinite(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  return `${upperPrefix}-${yymm}-${String(maxSeq + 1).padStart(3, "0")}`;
}

export function getNextQuotationNumber(quotations = [], dateStr) {
  const numbers = Array.isArray(quotations)
    ? quotations.map((q) => q?.quotation_number || q?.id).filter(Boolean)
    : [];
  return getNextSequenceNumber("QUO", numbers, dateStr);
}

export function getNextInvoiceNumber(invoices = [], dateStr, prefix = "INV") {
  const numbers = Array.isArray(invoices)
    ? invoices.map((inv) => inv?.invoice_number).filter(Boolean)
    : [];
  return getNextSequenceNumber(prefix, numbers, dateStr);
}

export function toInvoiceNumberFromQuotation(quotationNumber) {
  const trimmed = String(quotationNumber || "").trim();
  if (!trimmed) return "";
  if (/^QUO-/i.test(trimmed)) {
    return `INV-${trimmed.slice(4)}`;
  }
  if (/^INV-/i.test(trimmed)) {
    return trimmed;
  }
  return `INV-${trimmed}`;
}

export const OVERVIEW_PERIOD_OPTIONS = [
  { label: "All Time", value: "all" },
  { label: "1 Week", value: "1w" },
  { label: "1 Month", value: "1m" },
  { label: "1 Year", value: "1y" },
  { label: "Custom Range", value: "custom" },
];

export function getOverviewDateCutoff(period) {
  if (!period || period === "all" || period === "custom") return null;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  if (period === "1w") cutoff.setDate(cutoff.getDate() - 7);
  else if (period === "1m") cutoff.setMonth(cutoff.getMonth() - 1);
  else if (period === "3m") cutoff.setMonth(cutoff.getMonth() - 3);
  else if (period === "1y") cutoff.setFullYear(cutoff.getFullYear() - 1);
  else if (period === "2y") cutoff.setFullYear(cutoff.getFullYear() - 2);
  return cutoff;
}

export function filterByOverviewPeriod(items, filterValue, getDateValue) {
  const list = Array.isArray(items) ? items : [];
  const period =
    typeof filterValue === "string" ? filterValue : filterValue?.period || "all";

  if (period === "custom") {
    const startStr = filterValue?.startDate || "";
    const endStr = filterValue?.endDate || "";
    const startBound = startStr ? new Date(`${startStr}T00:00:00`) : null;
    const endBound = endStr ? new Date(`${endStr}T23:59:59.999`) : null;

    if (!startBound && !endBound) return list;

    return list.filter((item) => {
      const rawValue = getDateValue(item);
      if (!rawValue) return false;
      const raw = String(rawValue).trim();
      const parsed = new Date(raw.includes("T") ? raw : `${raw}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) return false;
      if (startBound && parsed < startBound) return false;
      if (endBound && parsed > endBound) return false;
      return true;
    });
  }

  const cutoff = getOverviewDateCutoff(period);
  if (!cutoff) return list;

  return list.filter((item) => {
    const rawValue = getDateValue(item);
    if (!rawValue) return false;
    const raw = String(rawValue).trim();
    const parsed = new Date(raw.includes("T") ? raw : `${raw}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed >= cutoff;
  });
}

