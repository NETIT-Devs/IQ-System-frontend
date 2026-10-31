import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileText,
  LoaderCircle,
  RefreshCw,
  Receipt,
  TrendingUp,
  Wallet,
  XCircle,
  Layers,
  Menu,
} from "lucide-react";
import API_BASE_URL from "../services/api";
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
  pendingQuotations: 0,
  draftQuotations: 0,
  rejectedQuotations: 0,
  totalQuotationValue: 0,
  approvedQuotationValue: 0,
};

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

function formatDate(value) {
  if (!value) return "—";
  try {
    const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(value);
  }
}

// Build query string for report endpoints
function buildQueryParams(filters) {
  const params = new URLSearchParams();
  if (filters.startDate) {
    params.set("startDate", filters.startDate);
    params.set("from_date", filters.startDate);
  }
  if (filters.endDate) {
    params.set("endDate", filters.endDate);
    params.set("to_date", filters.endDate);
  }
  return params.toString();
}

// Safe fetch that returns response metadata without crashing on 404
async function safeFetchJson(url, token) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
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
        <Icon size={22} strokeWidth={2.2} />
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
    const approved = Number(summary.approvedQuotations) || 0;
    const pending = Number(summary.pendingQuotations) || 0;
    const draft = Number(summary.draftQuotations) || 0;
    const rejected = Number(summary.rejectedQuotations) || 0;
    const total = approved + pending + draft + rejected || Number(summary.totalQuotations) || 0;

    const approvedPercent = total ? (approved / total) * 100 : 0;
    const pendingPercent = total ? (pending / total) * 100 : 0;
    const draftPercent = total ? (draft / total) * 100 : 0;

    const segments = [
      { label: "Approved", value: approved, color: "#16a34a" },
      { label: "Pending", value: pending, color: "#f59e0b" },
      { label: "Draft", value: draft, color: "#2563eb" },
      { label: "Rejected", value: rejected, color: "#dc2626" },
    ];

    const p1 = approvedPercent;
    const p2 = p1 + pendingPercent;
    const p3 = p2 + draftPercent;

    const chartStyle = {
      background:
        total > 0
          ? `conic-gradient(
              #16a34a 0% ${p1}%,
              #f59e0b ${p1}% ${p2}%,
              #2563eb ${p2}% ${p3}%,
              #dc2626 ${p3}% 100%
            )`
          : "#e8edf5",
    };

    return (
      <div className="payment-chart-content">
        <div
          className="payment-donut"
          style={chartStyle}
          role="img"
          aria-label={`Approved ${approved}, pending ${pending}, draft ${draft}, rejected ${rejected}`}
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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isUsingLiveCalculated, setIsUsingLiveCalculated] = useState(false);

  const queryString = useMemo(
    () => buildQueryParams({ startDate, endDate }),
    [startDate, endDate]
  );

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = getAuthToken();

      if (!token) {
        throw new Error(
          "Authentication token not found. Please log in again."
        );
      }

      const qPrefix = queryString ? `?${queryString}` : "";

      // 1. Fetch Backend Report Endpoints in parallel
      const [
        reportSummaryRes,
        reportInvoicesRes,
        reportQuotationsRes,
        reportIncomeRes,
      ] = await Promise.all([
        safeFetchJson(`${API_BASE_URL}${API_ENDPOINTS.summary}${qPrefix}`, token),
        safeFetchJson(`${API_BASE_URL}${API_ENDPOINTS.invoices}${qPrefix}`, token),
        safeFetchJson(`${API_BASE_URL}${API_ENDPOINTS.quotations}${qPrefix}`, token),
        safeFetchJson(`${API_BASE_URL}${API_ENDPOINTS.monthlyIncome}${qPrefix}`, token),
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
          `${API_BASE_URL}${API_ENDPOINTS.fallbackQuotations}${qPrefix}`,
          token
        );
        if (fallbackRes.ok) {
          finalQuotations = extractArray(fallbackRes.data);
        }
      }

      // Filter quotations client-side if query dates apply
      if (startDate || endDate) {
        finalQuotations = finalQuotations.filter((q) => {
          const rawDate = String(q.quotation_date || q.created_at || "").slice(0, 10);
          if (!rawDate) return true;
          if (startDate && rawDate < startDate) return false;
          if (endDate && rawDate > endDate) return false;
          return true;
        });
      }

      // 3. Resolve Invoices: Use backend report endpoint if available, or fallback to /api/invoices
      if (reportInvoicesRes.ok) {
        finalInvoices = extractArray(reportInvoicesRes.data);
      } else {
        const fallbackInvRes = await safeFetchJson(
          `${API_BASE_URL}${API_ENDPOINTS.fallbackInvoices}${qPrefix}`,
          token
        );
        if (fallbackInvRes.ok) {
          finalInvoices = extractArray(fallbackInvRes.data);
        } else {
          finalInvoices = [];
        }
      }

      // Filter invoices client-side if query dates apply
      if (startDate || endDate) {
        finalInvoices = finalInvoices.filter((inv) => {
          const rawDate = String(inv.invoice_date || inv.created_at || "").slice(0, 10);
          if (!rawDate) return true;
          if (startDate && rawDate < startDate) return false;
          if (endDate && rawDate > endDate) return false;
          return true;
        });
      }

      // 4. Resolve Monthly Income: Use backend report endpoint if available, or compute from quotations/invoices
      if (reportIncomeRes.ok) {
        finalIncome = extractArray(reportIncomeRes.data).map((item) => ({
          label: String(
            readValue(item, "month_label", "monthLabel", "month", "period")
          ),
          amount: Number(
            readValue(item, "total_income", "totalIncome", "amount", "income")
          ),
        }));
      } else {
        // Dynamically aggregate income/revenue by month from actual records
        const monthlyMap = {};
        const recordsForTrend = finalQuotations.length > 0 ? finalQuotations : finalInvoices;

        recordsForTrend.forEach((record) => {
          const dateStr = String(
            record.quotation_date || record.invoice_date || record.created_at || ""
          ).slice(0, 7); // e.g. "2026-10"

          if (dateStr && dateStr.length === 7) {
            const amount = Number(
              readValue(record, "total_amount", "totalAmount", "grand_total")
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

      // 5. Resolve Summary: Use backend report endpoint if available, or compute live summary
      if (reportSummaryRes.ok) {
        const summaryData = extractObject(reportSummaryRes.data);
        finalSummary = {
          totalInvoices: Number(readValue(summaryData, "totalInvoices", "total_invoices")),
          totalQuotations: Number(readValue(summaryData, "totalQuotations", "total_quotations")),
          paidInvoices: Number(readValue(summaryData, "paidInvoices", "paid_invoices")),
          unpaidInvoices: Number(readValue(summaryData, "unpaidInvoices", "unpaid_invoices")),
          overdueInvoices: Number(readValue(summaryData, "overdueInvoices", "overdue_invoices")),
          outstandingAmount: Number(readValue(summaryData, "outstandingAmount", "outstanding_amount")),
          approvedQuotations: Number(readValue(summaryData, "approvedQuotations", "approved_quotations")),
          pendingQuotations: Number(readValue(summaryData, "pendingQuotations", "pending_quotations")),
          draftQuotations: Number(readValue(summaryData, "draftQuotations", "draft_quotations")),
          rejectedQuotations: Number(readValue(summaryData, "rejectedQuotations", "rejected_quotations")),
          totalQuotationValue: Number(readValue(summaryData, "totalQuotationValue", "total_quotation_value")),
          approvedQuotationValue: Number(readValue(summaryData, "approvedQuotationValue", "approved_quotation_value")),
        };
      } else {
        // Calculate dynamically from loaded records
        const totalQuotations = finalQuotations.length;
        const totalInvoices = finalInvoices.length;

        const approvedQuotations = finalQuotations.filter((q) =>
          ["approved", "accepted"].includes(String(q.status || "").toLowerCase())
        ).length;

        const pendingQuotations = finalQuotations.filter((q) =>
          String(q.status || "").toLowerCase().includes("pending")
        ).length;

        const draftQuotations = finalQuotations.filter((q) =>
          String(q.status || "").toLowerCase().includes("draft")
        ).length;

        const rejectedQuotations = finalQuotations.filter((q) =>
          ["rejected", "declined"].includes(String(q.status || "").toLowerCase())
        ).length;

        const totalQuotationValue = finalQuotations.reduce(
          (sum, q) => sum + (Number(q.total_amount) || 0),
          0
        );

        const approvedQuotationValue = finalQuotations
          .filter((q) => ["approved", "accepted"].includes(String(q.status || "").toLowerCase()))
          .reduce((sum, q) => sum + (Number(q.total_amount) || 0), 0);

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
  }, [queryString, startDate, endDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  const currentRecords = reportType === "quotations" ? quotations : invoices;

  const totalFilteredValue = currentRecords.reduce((sum, record) => {
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
        const date =
          readValue(
            record,
            isQuotation ? "quotation_date" : "invoice_date",
            "created_at"
          ) || "";
        const amount =
          readValue(
            record,
            "total_amount",
            "totalAmount",
            "grand_total",
            "grandTotal"
          ) || 0;
        const status =
          readValue(
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
        <div className="report-filter-field">
          <label htmlFor="report-type">Report type</label>
          <select
            id="report-type"
            value={reportType}
            onChange={(event) => setReportType(event.target.value)}
          >
            <option value="quotations">Quotation Report</option>
            <option value="invoices">Invoice Report</option>
          </select>
        </div>

        <div className="report-filter-field">
          <label htmlFor="report-start-date">Start date</label>
          <div className="report-date-input">
            <CalendarDays size={17} />
            <input
              id="report-start-date"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
        </div>

        <div className="report-filter-field">
          <label htmlFor="report-end-date">End date</label>
          <div className="report-date-input">
            <CalendarDays size={17} />
            <input
              id="report-end-date"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
        </div>

        <div className="report-filter-actions">
          <button
            className="report-apply-button"
            type="button"
            onClick={fetchReports}
            disabled={loading}
          >
            Apply Filters
          </button>

          <button
            className="report-clear-button"
            type="button"
            onClick={clearFilters}
          >
            Clear
          </button>
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
                  title="Approved Value"
                  value={summary.approvedQuotationValue}
                  description="Accepted business revenue"
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
                    {isUsingLiveCalculated
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
              <div>
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

              <button
                className="reports-export-button"
                type="button"
                onClick={downloadCSV}
                disabled={currentRecords.length === 0}
              >
                <ArrowDownToLine size={17} />
                Export CSV
              </button>
            </div>

            {currentRecords.length === 0 ? (
              <div className="reports-empty-state">
                <FileText size={34} />
                <h3>No records available</h3>
                <p>
                  {reportType === "invoices"
                    ? "No invoice records found. The Invoicing module is currently under development on the backend."
                    : "No quotation records were found for the selected date range."}
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

                      const date = readValue(
                        record,
                        isQuotation
                          ? "quotation_date"
                          : "invoice_date",
                        "created_at",
                        "createdAt"
                      );

                      const amount = readValue(
                        record,
                        "total_amount",
                        "totalAmount",
                        "grand_total",
                        "grandTotal"
                      );

                      const status = readValue(
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
