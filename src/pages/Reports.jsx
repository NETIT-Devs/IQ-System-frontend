import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  LoaderCircle,
  RefreshCw,
  Receipt,
  Search,
  TrendingUp,
  Wallet,
  X,
  XCircle,
  Menu,
} from "lucide-react";
import API_BASE_URL from "../services/api";
import ThemeToggle from "../components/ThemeToggle";
import { getAuthenticatedUser } from "../utils/authStorage";
import "./Report.css";

// Backend report endpoints (seamlessly utilized when backend developer adds them)
const API_ENDPOINTS = {
  summary: "/api/reports/summary",
  invoices: "/api/reports/invoices",
  quotations: "/api/reports/quotations",
  monthlyIncome: "/api/reports/monthly-income",
  fallbackQuotations: "/api/quotations",
  fallbackInvoices: "/api/invoices",
};

const EMPTY_SUMMARY = {
  totalInvoices: 0,
  totalQuotations: 0,
  paidInvoices: 0,
  unpaidInvoices: 0,
  overdueInvoices: 0,
  outstandingAmount: 0,
  totalInvoiceValue: 0,
  approvedQuotations: 0,
  customerAcceptedQuotations: 0,
  approvedOnlyQuotations: 0,
  pendingQuotations: 0,
  draftQuotations: 0,
  rejectedQuotations: 0,
  totalQuotationValue: 0,
  approvedQuotationValue: 0,
};

function isCustomerAccepted(q) {
  const cs = String(q?.customer_status || "").trim().toLowerCase();
  return cs === "customer accepted" || cs === "accepted";
}

function isCustomerRejected(q) {
  const cs = String(q?.customer_status || "").trim().toLowerCase();
  return cs === "customer rejected" || cs === "rejected";
}

function resolveQuotationReportStatus(q) {
  if (!q) return "Draft";
  if (isCustomerAccepted(q)) {
    return "Accepted by Customer";
  }
  if (isCustomerRejected(q)) {
    return "Rejected by Customer";
  }

  const approval = String(q.approval_status || "").trim().toLowerCase();
  const rawStatus = String(
    q.status || q.quotation_status || ""
  ).trim().toLowerCase();
  const role = String(q.created_by_role || "").trim().toLowerCase();
  const isSuperCreator = role.includes("super") || q.created_by === 2;

  if (isSuperCreator) {
    return rawStatus === "draft" ? "Draft" : "Approved";
  }
  if (
    approval === "pending" ||
    rawStatus.includes("pending") ||
    rawStatus === "sent"
  ) {
    return "Pending Approval";
  }
  if (
    approval === "approved" ||
    ["approved", "accepted"].includes(rawStatus)
  ) {
    return "Approved";
  }
  if (
    approval === "rejected" ||
    ["rejected", "declined"].includes(rawStatus)
  ) {
    return "Rejected";
  }
  if (rawStatus === "draft") {
    return "Draft";
  }
  return q.status || "Draft";
}

// Read the authentication token saved by the login flow
function getAuthToken() {
  const possibleKeys = ["authToken", "token", "accessToken"];

  for (const storage of [localStorage, sessionStorage]) {
    for (const key of possibleKeys) {
      const value = storage.getItem(key);
      if (value) {
        try {
          const parsed = JSON.parse(value);
          if (typeof parsed === "string") return parsed;
          if (parsed?.token) return parsed.token;
          if (parsed?.accessToken) return parsed.accessToken;
        } catch {
          return value;
        }
      }
    }
  }

  try {
    const user = JSON.parse(localStorage.getItem("authUser") || localStorage.getItem("user") || "null");
    return user?.token || user?.accessToken || "";
  } catch {
    return "";
  }
}

// Return the first available value without replacing valid zero values
function readValue(object, ...keys) {
  for (const key of keys) {
    if (object?.[key] !== undefined && object?.[key] !== null) {
      return object[key];
    }
  }
  return 0;
}

// Extract arrays safely from various API response shapes
function extractArray(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.quotations)) return response.quotations;
  if (Array.isArray(response?.invoices)) return response.invoices;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.rows)) return response.rows;
  if (Array.isArray(response?.results)) return response.results;
  return [];
}

function extractObject(response) {
  return response?.data && !Array.isArray(response.data)
    ? response.data
    : response;
}

// Format financial amounts using Sri Lankan Rupees
function formatCurrency(value) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-LK").format(Number(value) || 0);
}

// Convert any date value or UTC ISO string to local YYYY-MM-DD matching Quotations page
function toLocalDateStr(value) {
  if (!value) return "";
  const str = String(value).trim();
  if (!str) return "";
  const date = str.includes("T") ? new Date(str) : new Date(`${str.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return str.slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolveRecordDate(record, isQuotation) {
  if (!record) return "";
  if (isQuotation) {
    const qDate = toLocalDateStr(record.quotation_date || record.date);
    const cDate = toLocalDateStr(record.created_at || record.createdAt);
    if (qDate && cDate && qDate < cDate) {
      return cDate;
    }
    return qDate || cDate || "";
  }
  const iDate = toLocalDateStr(record.invoice_date || record.date);
  const cDate = toLocalDateStr(record.created_at || record.createdAt);
  if (iDate && cDate && iDate < cDate) {
    return cDate;
  }
  return iDate || cDate || "";
}

function formatDate(value) {
  if (!value) return "—";
  try {
    const str = String(value).trim();
    const date = str.includes("T") ? new Date(str) : new Date(`${str.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return str;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(value);
  }
}

// Safe fetch that returns response metadata without crashing on 404
async function safeFetchJson(url, token) {
  try {
    const headers = { Accept: "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return { ok: false, status: response.status, data: null };
    }

    const data = await response.json();
    return { ok: true, status: response.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: err, data: null };
  }
}

// Reusable metric card for the reports dashboard matching Overview size and structure
function SummaryCard({ title, value, description, icon: Icon, tone, money }) {
  return (
    <article className="report-metric-card">
      <div className={`report-metric-icon ${tone}`}>
        <Icon size={18} strokeWidth={1.9} />
      </div>

      <div className="report-metric-content">
        <p className="report-metric-title">{title}</p>
        <h3 className={`report-metric-value ${money ? "report-money-value" : ""}`}>
          {money ? formatCurrency(value) : formatNumber(value)}
        </h3>
        <span className="report-metric-note">{description}</span>
      </div>
    </article>
  );
}

// Display donut chart breakdown for either Quotations or Invoices
function StatusBreakdownChart({ summary, reportType }) {
  if (reportType === "quotations") {
    const acceptedByCustomer = Number(summary.customerAcceptedQuotations) || 0;
    const approved = Number(summary.approvedOnlyQuotations) || 0;
    const pending = Number(summary.pendingQuotations) || 0;
    const draft = Number(summary.draftQuotations) || 0;
    const rejected = Number(summary.rejectedQuotations) || 0;
    const total =
      acceptedByCustomer + approved + pending + draft + rejected ||
      Number(summary.totalQuotations) ||
      0;

    const acceptedPercent = total ? (acceptedByCustomer / total) * 100 : 0;
    const approvedPercent = total ? (approved / total) * 100 : 0;
    const pendingPercent = total ? (pending / total) * 100 : 0;
    const draftPercent = total ? (draft / total) * 100 : 0;

    const segments = [
      { label: "Accepted by Customer", value: acceptedByCustomer, color: "#16a34a" },
      { label: "Approved", value: approved, color: "#0284c7" },
      { label: "Pending", value: pending, color: "#f59e0b" },
      { label: "Draft", value: draft, color: "#2563eb" },
      { label: "Rejected", value: rejected, color: "#dc2626" },
    ];

    const p1 = acceptedPercent;
    const p2 = p1 + approvedPercent;
    const p3 = p2 + pendingPercent;
    const p4 = p3 + draftPercent;

    const chartStyle = {
      background:
        total > 0
          ? `conic-gradient(
              #16a34a 0% ${p1}%,
              #0284c7 ${p1}% ${p2}%,
              #f59e0b ${p2}% ${p3}%,
              #2563eb ${p3}% ${p4}%,
              #dc2626 ${p4}% 100%
            )`
          : "#e8edf5",
    };

    return (
      <div className="payment-chart-content">
        <div
          className="payment-donut"
          style={chartStyle}
          role="img"
          aria-label={`Accepted by Customer ${acceptedByCustomer}, approved ${approved}, pending ${pending}, draft ${draft}, rejected ${rejected}`}
        >
          <div className="payment-donut-inner">
            <strong>{formatNumber(total)}</strong>
            <span>Quotations</span>
          </div>
        </div>

        <div className="payment-legend">
          {segments.map((segment) => (
            <div className="payment-legend-item" key={segment.label}>
              <span
                className="payment-legend-dot"
                style={{ backgroundColor: segment.color }}
              />
              <span className="payment-legend-label">{segment.label}</span>
              <strong>{formatNumber(segment.value)}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Invoice Breakdown
  const paid = Number(summary.paidInvoices) || 0;
  const unpaid = Number(summary.unpaidInvoices) || 0;
  const overdue = Number(summary.overdueInvoices) || 0;
  const total = paid + unpaid + overdue || Number(summary.totalInvoices) || 0;

  const paidPercent = total ? (paid / total) * 100 : 0;
  const unpaidPercent = total ? (unpaid / total) * 100 : 0;

  const segments = [
    { label: "Paid", value: paid, color: "#16a34a" },
    { label: "Unpaid", value: unpaid, color: "#2563eb" },
    { label: "Overdue", value: overdue, color: "#dc2626" },
  ];

  const paidEnd = paidPercent;
  const unpaidEnd = paidPercent + unpaidPercent;

  const chartStyle = {
    background:
      total > 0
        ? `conic-gradient(
            #16a34a 0% ${paidEnd}%,
            #2563eb ${paidEnd}% ${unpaidEnd}%,
            #dc2626 ${unpaidEnd}% 100%
          )`
        : "#e8edf5",
  };

  return (
    <div className="payment-chart-content">
      <div
        className="payment-donut"
        style={chartStyle}
        role="img"
        aria-label={`Paid ${paid}, unpaid ${unpaid}, overdue ${overdue}`}
      >
        <div className="payment-donut-inner">
          <strong>{formatNumber(total)}</strong>
          <span>Invoices</span>
        </div>
      </div>

      <div className="payment-legend">
        {segments.map((segment) => (
          <div className="payment-legend-item" key={segment.label}>
            <span
              className="payment-legend-dot"
              style={{ backgroundColor: segment.color }}
            />
            <span className="payment-legend-label">{segment.label}</span>
            <strong>{formatNumber(segment.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

// Display monthly income / revenue bar chart
function MonthlyIncomeChart({ items }) {
  const chartItems = items.slice(-6);

  const highestValue = Math.max(
    ...chartItems.map((item) => Number(item.amount) || 0),
    0
  );

  if (chartItems.length === 0) {
    return (
      <div className="report-empty-chart">
        <BarChart3 size={30} />
        <p>No monthly revenue trend data available.</p>
      </div>
    );
  }

  return (
    <div className="monthly-income-chart">
      {chartItems.map((item, index) => {
        const amount = Number(item.amount) || 0;
        const width = highestValue > 0 ? (amount / highestValue) * 100 : 0;

        return (
          <div className="income-bar-row" key={`${item.label}-${index}`}>
            <span className="income-month-label">{item.label}</span>

            <div className="income-bar-track">
              <div
                className="income-bar-fill"
                style={{ width: `${width}%` }}
                role="img"
                aria-label={`${item.label}: ${formatCurrency(amount)}`}
              />
            </div>

            <strong className="income-bar-value">
              {formatCurrency(amount)}
            </strong>
          </div>
        );
      })}
    </div>
  );
}

// Display consistent status badge
function StatusBadge({ status }) {
  const normalized = String(status || "Unknown").toLowerCase();

  let className = "report-status-badge";

  if (normalized.includes("paid") && !normalized.includes("unpaid")) {
    className += " status-paid";
  } else if (normalized.includes("overdue")) {
    className += " status-overdue";
  } else if (
    normalized.includes("unpaid") ||
    normalized.includes("pending")
  ) {
    className += " status-pending";
  } else if (normalized.includes("partial")) {
    className += " status-partial";
  } else if (normalized.includes("approved") || normalized.includes("accept")) {
    className += " status-approved";
  } else if (normalized.includes("draft")) {
    className += " status-default";
  } else if (normalized.includes("reject") || normalized.includes("declin")) {
    className += " status-overdue";
  } else {
    className += " status-default";
  }

  return <span className={className}>{status || "Unknown"}</span>;
}

export default function Reports() {
  const { openSidebar } = useOutletContext() || {};

  const authUser = getAuthenticatedUser();
  const isSuperAdmin =
    String(authUser?.role || "").trim().toLowerCase() === "super admin" ||
    authUser?.role === "super_admin";
  const userInitials = isSuperAdmin ? "SA" : "A";
  const userRoleTitle = isSuperAdmin ? "Super Admin" : "Admin";

  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [invoices, setInvoices] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [monthlyIncome, setMonthlyIncome] = useState([]);

  // Default to quotations report so real live data immediately populates
  const [reportType, setReportType] = useState("quotations");
  const [reportDropdownOpen, setReportDropdownOpen] = useState(false);
  const reportDropdownRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        reportDropdownRef.current &&
        !reportDropdownRef.current.contains(event.target)
      ) {
        setReportDropdownOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setReportDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isUsingLiveCalculated, setIsUsingLiveCalculated] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = getAuthToken();

      // 1. Fetch Backend Report Endpoints in parallel
      const [
        reportSummaryRes,
        reportInvoicesRes,
        reportQuotationsRes,
        reportIncomeRes,
      ] = await Promise.all([
        safeFetchJson(`${API_BASE_URL}${API_ENDPOINTS.summary}`, token),
        safeFetchJson(`${API_BASE_URL}${API_ENDPOINTS.invoices}`, token),
        safeFetchJson(`${API_BASE_URL}${API_ENDPOINTS.quotations}`, token),
        safeFetchJson(`${API_BASE_URL}${API_ENDPOINTS.monthlyIncome}`, token),
      ]);

      let finalQuotations = [];
      let finalInvoices = [];
      let finalIncome = [];
      let finalSummary = { ...EMPTY_SUMMARY };
      let liveFallbackUsed = false;

      // 2. Resolve Quotations: Use backend report endpoint if available, or fall back to /api/quotations
      if (reportQuotationsRes.ok) {
        finalQuotations = extractArray(reportQuotationsRes.data);
      } else {
        liveFallbackUsed = true;
        const fallbackRes = await safeFetchJson(
          `${API_BASE_URL}${API_ENDPOINTS.fallbackQuotations}`,
          token
        );
        if (fallbackRes.ok) {
          finalQuotations = extractArray(fallbackRes.data);
        }
      }

      // 3. Resolve Invoices: Use backend report endpoint if available, or fallback to /api/invoices
      if (reportInvoicesRes.ok) {
        finalInvoices = extractArray(reportInvoicesRes.data);
      } else {
        const fallbackInvRes = await safeFetchJson(
          `${API_BASE_URL}${API_ENDPOINTS.fallbackInvoices}`,
          token
        );
        if (fallbackInvRes.ok) {
          finalInvoices = extractArray(fallbackInvRes.data);
        } else {
          finalInvoices = [];
        }
      }

      // 4. Resolve Monthly Income: Aggregate from Customer Accepted quotations (or invoices)
      const acceptedQuotationsForTrend = finalQuotations.filter((q) =>
        isCustomerAccepted(q)
      );

      if (reportIncomeRes.ok && acceptedQuotationsForTrend.length === 0 && finalQuotations.length === 0) {
        finalIncome = extractArray(reportIncomeRes.data).map((item) => ({
          label: String(
            readValue(item, "month_label", "monthLabel", "month", "period")
          ),
          amount: Number(
            readValue(item, "total_income", "totalIncome", "amount", "income")
          ),
        }));
      } else {
        // Dynamically aggregate accepted revenue by month from Customer Accepted quotations
        const monthlyMap = {};
        const recordsForTrend =
          finalQuotations.length > 0 ? acceptedQuotationsForTrend : finalInvoices;

        recordsForTrend.forEach((record) => {
          const isQ = finalQuotations.length > 0;
          const dateStr = String(
            resolveRecordDate(record, isQ)
          ).slice(0, 7); // e.g. "2026-10"

          if (dateStr && dateStr.length === 7) {
            const amount = Number(
              readValue(record, "total_amount", "totalAmount", "grand_total", "grandTotal")
            ) || 0;
            monthlyMap[dateStr] = (monthlyMap[dateStr] || 0) + amount;
          }
        });

        const sortedMonths = Object.keys(monthlyMap).sort();
        if (sortedMonths.length > 0) {
          finalIncome = sortedMonths.map((key) => {
            const [y, m] = key.split("-");
            const d = new Date(Number(y), Number(m) - 1, 1);
            const label = !Number.isNaN(d.getTime())
              ? d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
              : key;
            return { label, amount: monthlyMap[key] };
          });
        } else {
          finalIncome = [];
        }
      }

      // 5. Resolve Summary: Compute quotation metrics using live Customer Accepted status
      const totalQuotations = finalQuotations.length;
      const totalInvoices = finalInvoices.length;

      let customerAcceptedQuotations = 0;
      let approvedOnlyQuotations = 0;
      let pendingQuotations = 0;
      let draftQuotations = 0;
      let rejectedQuotations = 0;

      finalQuotations.forEach((q) => {
        const resolvedStatus = resolveQuotationReportStatus(q);
        if (resolvedStatus === "Accepted by Customer") {
          customerAcceptedQuotations += 1;
        } else if (resolvedStatus === "Approved") {
          approvedOnlyQuotations += 1;
        } else if (resolvedStatus === "Pending Approval") {
          pendingQuotations += 1;
        } else if (
          resolvedStatus === "Rejected" ||
          resolvedStatus === "Rejected by Customer"
        ) {
          rejectedQuotations += 1;
        } else {
          draftQuotations += 1;
        }
      });

      const approvedQuotations =
        customerAcceptedQuotations + approvedOnlyQuotations;

      const totalQuotationValue = finalQuotations.reduce(
        (sum, q) =>
          sum +
          (Number(
            readValue(q, "total_amount", "totalAmount", "grand_total", "grandTotal")
          ) || 0),
        0
      );

      // Approved / Customer Accepted Value: strictly sum of Customer Accepted quotations
      const approvedQuotationValue = finalQuotations
        .filter((q) => isCustomerAccepted(q))
        .reduce(
          (sum, q) =>
            sum +
            (Number(
              readValue(q, "total_amount", "totalAmount", "grand_total", "grandTotal")
            ) || 0),
          0
        );

      if (reportSummaryRes.ok && finalQuotations.length === 0) {
        const summaryData = extractObject(reportSummaryRes.data);
        finalSummary = {
          totalInvoices: Number(readValue(summaryData, "totalInvoices", "total_invoices")),
          totalQuotations: Number(readValue(summaryData, "totalQuotations", "total_quotations")),
          paidInvoices: Number(readValue(summaryData, "paidInvoices", "paid_invoices")),
          unpaidInvoices: Number(readValue(summaryData, "unpaidInvoices", "unpaid_invoices")),
          overdueInvoices: Number(readValue(summaryData, "overdueInvoices", "overdue_invoices")),
          outstandingAmount: Number(readValue(summaryData, "outstandingAmount", "outstanding_amount")),
          approvedQuotations: Number(readValue(summaryData, "approvedQuotations", "approved_quotations")),
          customerAcceptedQuotations: 0,
          approvedOnlyQuotations: Number(readValue(summaryData, "approvedQuotations", "approved_quotations")),
          pendingQuotations: Number(readValue(summaryData, "pendingQuotations", "pending_quotations")),
          draftQuotations: Number(readValue(summaryData, "draftQuotations", "draft_quotations")),
          rejectedQuotations: Number(readValue(summaryData, "rejectedQuotations", "rejected_quotations")),
          totalQuotationValue: Number(readValue(summaryData, "totalQuotationValue", "total_quotation_value")),
          approvedQuotationValue: Number(readValue(summaryData, "approvedQuotationValue", "approved_quotation_value")),
        };
      } else {
        const paidInvoices = finalInvoices.filter((i) =>
          String(i.payment_status || i.status || "").toLowerCase().includes("paid")
        ).length;

        const unpaidInvoices = finalInvoices.filter((i) =>
          String(i.payment_status || i.status || "").toLowerCase().includes("unpaid")
        ).length;

        const overdueInvoices = finalInvoices.filter((i) =>
          String(i.payment_status || i.status || "").toLowerCase().includes("overdue")
        ).length;

        const outstandingAmount = finalInvoices.reduce(
          (sum, i) => sum + (Number(i.balance_due || i.total_amount) || 0),
          0
        );

        const totalInvoiceValue = finalInvoices.reduce(
          (sum, i) => sum + (Number(i.total_amount) || 0),
          0
        );

        finalSummary = {
          totalInvoices,
          totalQuotations,
          paidInvoices,
          unpaidInvoices,
          overdueInvoices,
          outstandingAmount,
          totalInvoiceValue,
          approvedQuotations,
          customerAcceptedQuotations,
          approvedOnlyQuotations,
          pendingQuotations,
          draftQuotations,
          rejectedQuotations,
          totalQuotationValue,
          approvedQuotationValue,
        };
      }

      setQuotations(finalQuotations);
      setInvoices(finalInvoices);
      setMonthlyIncome(finalIncome);
      setSummary(finalSummary);
      setIsUsingLiveCalculated(liveFallbackUsed);
    } catch (err) {
      console.error("Reports loading error:", err);
      setError(
        err.message ||
        "Unable to load reports. Please check your backend connection."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(fetchReports);
  }, [fetchReports]);

  const allRecords = reportType === "quotations" ? quotations : invoices;

  // Search filtered records matching reference or customer name
  const currentRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return allRecords;

    const isQuotation = reportType === "quotations";

    return allRecords.filter((record) => {
      const id = String(
        readValue(record, isQuotation ? "quotation_id" : "invoice_id", "id") || ""
      ).toLowerCase();

      const reference = String(
        readValue(
          record,
          isQuotation ? "quotation_number" : "invoice_number",
          "quotation_id"
        ) || id
      ).toLowerCase();

      const customerName = String(
        readValue(
          record,
          "customer_name",
          "clientName",
          "customer_company"
        ) || ""
      ).toLowerCase();

      const customerId = String(readValue(record, "customer_id") || "").toLowerCase();

      return (
        reference.includes(term) ||
        id.includes(term) ||
        customerName.includes(term) ||
        customerId.includes(term)
      );
    });
  }, [allRecords, searchTerm, reportType]);

  const totalFilteredValue = useMemo(() => {
    return currentRecords.reduce((sum, record) => {
      const amount = Number(
        readValue(
          record,
          "total_amount",
          "totalAmount",
          "grand_total",
          "grandTotal"
        )
      );
      return sum + amount;
    }, 0);
  }, [currentRecords]);

  // Download the currently displayed records as a CSV file
  const downloadCSV = () => {
    if (currentRecords.length === 0) return;

    const isQuotation = reportType === "quotations";
    const headers = isQuotation
      ? [
        "Quotation ID",
        "Quotation Number",
        "Customer",
        "Date",
        "Total Amount",
        "Status",
      ]
      : [
        "Invoice ID",
        "Invoice Number",
        "Customer",
        "Date",
        "Total Amount",
        "Payment Status",
      ];

    const csvRows = [
      headers,
      ...currentRecords.map((record) => {
        const id = readValue(record, isQuotation ? "quotation_id" : "invoice_id");
        const ref =
          readValue(
            record,
            isQuotation ? "quotation_number" : "invoice_number"
          ) || id;
        const customer =
          readValue(
            record,
            "customer_name",
            "clientName",
            "customer_company"
          ) ||
          (readValue(record, "customer_id")
            ? `Customer #${readValue(record, "customer_id")}`
            : "");
        const date = resolveRecordDate(record, isQuotation);
        const amount =
          readValue(
            record,
            "total_amount",
            "totalAmount",
            "grand_total",
            "grandTotal"
          ) || 0;
        const status = isQuotation
          ? resolveQuotationReportStatus(record)
          : readValue(
            record,
            "payment_status",
            "status",
            "quotation_status"
          ) || "Unknown";

        return [
          `"${id || ""}"`,
          `"${ref || ""}"`,
          `"${String(customer).replace(/"/g, '""')}"`,
          `"${date}"`,
          Number(amount) || 0,
          `"${status}"`,
        ];
      }),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      csvRows.map((e) => (Array.isArray(e) ? e.join(",") : e)).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="reports-page">
      {/* Top bar header matching Overview styling */}
      <header className="reports-topbar">
        <div className="reports-topbar-left">
          {openSidebar && (
            <button
              type="button"
              className="reports-menu-button"
              aria-label="Open navigation menu"
              onClick={openSidebar}
            >
              <Menu size={20} />
            </button>
          )}

          <div className="reports-breadcrumb-wrap">
            <span className="reports-breadcrumb">Dashboard / Reports</span>
          </div>
        </div>

        <div className="reports-header-actions">
          <ThemeToggle />
          <span className="reports-header-date" title="Today's Date">
            {new Intl.DateTimeFormat("en-US", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date())}
          </span>

          <div className="reports-header-profile" title={userRoleTitle}>
            <span className="reports-profile-avatar" aria-label={`${userRoleTitle} profile`}>
              {userInitials}
            </span>
          </div>
        </div>
      </header>

      <div className="reports-content">
        {/* Welcome / Heading Row right below topbar */}
        <div className="reports-welcome-bar">
          <div className="reports-welcome-text">
            <h1>Reports &amp; Analytics</h1>
            <p className="reports-subtitle">
              Track system financial performance, active quotations, and client billing analytics.
            </p>
          </div>

          <button
            type="button"
            className="reports-refresh-button"
            onClick={fetchReports}
            disabled={loading}
            aria-label="Refresh reports"
          >
            {loading ? (
              <LoaderCircle size={17} className="reports-spin" />
            ) : (
              <RefreshCw size={17} />
            )}
            <span>Refresh</span>
          </button>
        </div>

        {/* Filter panel */}
        <section className="reports-filter-panel" aria-label="Report filters">
          <div className="report-filter-field report-type-field">
            <label htmlFor="report-type">Report type</label>
            <div className="report-dropdown-wrap" ref={reportDropdownRef}>
              <button
                type="button"
                id="report-type"
                className={`report-dropdown-btn ${reportDropdownOpen ? "active" : ""}`}
                onClick={() => setReportDropdownOpen((prev) => !prev)}
                aria-expanded={reportDropdownOpen}
                aria-label="Select report type"
              >
                <span className="report-dropdown-label">
                  {reportType === "invoices" ? "Invoice Report" : "Quotation Report"}
                </span>
                <ChevronDown
                  size={14}
                  className={`report-dropdown-chevron ${reportDropdownOpen ? "open" : ""}`}
                />
              </button>

              {reportDropdownOpen && (
                <div className="report-dropdown-menu" role="listbox">
                  <div className="report-dropdown-header">
                    <span>Select Report Type</span>
                  </div>
                  <div className="report-dropdown-list">
                    {[
                      { value: "quotations", label: "Quotation Report", color: "#2563eb" },
                      { value: "invoices", label: "Invoice Report", color: "#7c3aed" },
                    ].map((opt) => {
                      const isSelected = reportType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className={`report-dropdown-item ${isSelected ? "selected" : ""}`}
                          onClick={() => {
                            setReportType(opt.value);
                            setReportDropdownOpen(false);
                          }}
                        >
                          <div className="report-dropdown-item-left">
                            <span
                              className="report-dropdown-dot"
                              style={{ backgroundColor: opt.color }}
                            />
                            <span className="report-dropdown-item-text">{opt.label}</span>
                          </div>
                          {isSelected && <Check size={14} className="report-dropdown-check" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Fatal connection error notice */}
        {error && (
          <div className="reports-error-message" role="alert">
            <AlertCircle size={20} />
            <div>
              <strong>Could not load reports</strong>
              <p>{error}</p>
              <span>
                Check that the backend server is running and accessible at {API_BASE_URL}.
              </span>
            </div>
            <button type="button" onClick={fetchReports} aria-label="Retry">
              <RefreshCw size={17} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="reports-loading" role="status">
            <LoaderCircle size={30} className="reports-spin" />
            <p>Loading reports and computing analytics...</p>
          </div>
        ) : (
          <>
            {/* Summary Metric Cards */}
            <section className="reports-summary-grid" aria-label="Report summary">
              {reportType === "quotations" ? (
                <>
                  <SummaryCard
                    title="Total Quotations"
                    value={summary.totalQuotations}
                    description="All recorded quotations"
                    icon={FileText}
                    tone="metric-purple"
                  />
                  <SummaryCard
                    title="Approved Quotations"
                    value={summary.approvedQuotations}
                    description="Client accepted / approved"
                    icon={CheckCircle2}
                    tone="metric-green"
                  />
                  <SummaryCard
                    title="Pending Quotations"
                    value={summary.pendingQuotations}
                    description="Awaiting approval / sent"
                    icon={Wallet}
                    tone="metric-orange"
                  />
                  <SummaryCard
                    title="Draft Quotations"
                    value={summary.draftQuotations}
                    description="Draft quotations"
                    icon={Receipt}
                    tone="metric-blue"
                  />
                  <SummaryCard
                    title="Total Pipeline Value"
                    value={summary.totalQuotationValue}
                    description="Gross value of all quotations"
                    icon={TrendingUp}
                    tone="metric-navy"
                    money
                  />
                  <SummaryCard
                    title="Customer Accepted Value"
                    value={summary.approvedQuotationValue}
                    description="Customer accepted quotations value"
                    icon={TrendingUp}
                    tone="metric-green"
                    money
                  />
                </>
              ) : (
                <>
                  <SummaryCard
                    title="Total Invoices"
                    value={summary.totalInvoices}
                    description="All recorded invoices"
                    icon={Receipt}
                    tone="metric-blue"
                  />
                  <SummaryCard
                    title="Paid Invoices"
                    value={summary.paidInvoices}
                    description="Fully paid invoices"
                    icon={CheckCircle2}
                    tone="metric-green"
                  />
                  <SummaryCard
                    title="Unpaid Invoices"
                    value={summary.unpaidInvoices}
                    description="Awaiting payment"
                    icon={Wallet}
                    tone="metric-orange"
                  />
                  <SummaryCard
                    title="Overdue Invoices"
                    value={summary.overdueInvoices}
                    description="Past their due date"
                    icon={XCircle}
                    tone="metric-red"
                  />
                  <SummaryCard
                    title="Total Invoiced Value"
                    value={summary.totalInvoiceValue || 0}
                    description="Gross value of invoices"
                    icon={TrendingUp}
                    tone="metric-purple"
                    money
                  />
                  <SummaryCard
                    title="Outstanding Amount"
                    value={summary.outstandingAmount}
                    description="Amount still outstanding"
                    icon={TrendingUp}
                    tone="metric-navy"
                    money
                  />
                </>
              )}
            </section>

            {/* Charts section */}
            <section className="reports-charts-grid">
              <article className="reports-panel">
                <div className="reports-panel-heading">
                  <div className="reports-panel-icon">
                    <Activity size={19} />
                  </div>
                  <div>
                    <h2>
                      {reportType === "quotations"
                        ? "Quotation Status Distribution"
                        : "Invoice Payment Status"}
                    </h2>
                    <p>
                      {reportType === "quotations"
                        ? "Breakdown of quotations by current stage"
                        : "Breakdown of payment performance"}
                    </p>
                  </div>
                </div>

                <StatusBreakdownChart summary={summary} reportType={reportType} />
              </article>

              <article className="reports-panel">
                <div className="reports-panel-heading">
                  <div className="reports-panel-icon">
                    <BarChart3 size={19} />
                  </div>
                  <div>
                    <h2>Monthly Revenue &amp; Income Trends</h2>
                    <p>
                      {reportType === "quotations"
                        ? "Monthly revenue from customer accepted quotations"
                        : isUsingLiveCalculated
                          ? "Monthly trend calculated from active database records"
                          : "Income returned by backend reports endpoint"}
                    </p>
                  </div>
                </div>

                <MonthlyIncomeChart items={monthlyIncome} />
              </article>
            </section>

            {/* Table section */}
            <section className="reports-panel reports-table-panel">
              <div className="reports-table-heading">
                <div className="reports-table-heading-left">
                  <div className="reports-table-heading-info">
                    <h2>
                      {reportType === "quotations"
                        ? "Quotation Records"
                        : "Invoice Records"}
                    </h2>
                    <p>
                      {formatNumber(currentRecords.length)} records · Total value:{" "}
                      {formatCurrency(totalFilteredValue)}
                    </p>
                  </div>

                  <div className="reports-search-wrap">
                    <Search size={16} className="reports-search-icon" />
                    <input
                      id="report-search"
                      type="text"
                      placeholder="Search records..."
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="reports-search-input"
                      aria-label="Search records"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        className="reports-search-clear"
                        onClick={() => setSearchTerm("")}
                        aria-label="Clear search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  className="reports-export-button"
                  type="button"
                  onClick={downloadCSV}
                  disabled={currentRecords.length === 0}
                >
                  <ArrowDownToLine size={17} />
                  <span>Export CSV</span>
                </button>
              </div>

              {currentRecords.length === 0 ? (
                <div className="reports-empty-state">
                  <FileText size={34} />
                  <h3>No records available</h3>
                  <p>
                    {searchTerm
                      ? `No ${reportType === "quotations" ? "quotation" : "invoice"} records found matching "${searchTerm}".`
                      : reportType === "invoices"
                        ? "No invoice records found. The Invoicing module is currently under development on the backend."
                        : "No quotation records were found."}
                  </p>
                </div>
              ) : (
                <div className="reports-table-wrapper">
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Reference</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentRecords.map((record, index) => {
                        const isQuotation = reportType === "quotations";

                        const id = readValue(
                          record,
                          isQuotation ? "quotation_id" : "invoice_id"
                        );

                        const reference =
                          readValue(
                            record,
                            isQuotation
                              ? "quotation_number"
                              : "invoice_number"
                          ) || id;

                        const customerId = readValue(record, "customer_id");
                        const customerName = readValue(
                          record,
                          "customer_name",
                          "clientName",
                          "customer_company"
                        );

                        const date = resolveRecordDate(record, isQuotation);

                        const amount = readValue(
                          record,
                          "total_amount",
                          "totalAmount",
                          "grand_total",
                          "grandTotal"
                        );

                        const status = isQuotation
                          ? resolveQuotationReportStatus(record)
                          : readValue(
                            record,
                            "status",
                            "payment_status",
                            "quotation_status"
                          );

                        return (
                          <tr key={id || `${reference}-${index}`}>
                            <td className="report-id-cell">{id || "—"}</td>
                            <td className="report-reference-cell">
                              {reference || "—"}
                            </td>
                            <td>
                              {customerName ||
                                (customerId ? `Customer #${customerId}` : "—")}
                            </td>
                            <td>{formatDate(date)}</td>
                            <td className="report-amount-cell">
                              {formatCurrency(amount)}
                            </td>
                            <td>
                              <StatusBadge status={status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
