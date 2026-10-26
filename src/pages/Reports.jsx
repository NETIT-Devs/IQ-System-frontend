
import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import "./Report.css";

// Keep the backend URL in one place for local development.
const API_BASE_URL = "http://localhost:5000";

// Update these paths if the backend developer chooses different routes.
const API_ENDPOINTS = {
  summary: "/api/reports/summary",
  invoices: "/api/reports/invoices",
  quotations: "/api/reports/quotations",
  monthlyIncome: "/api/reports/monthly-income",
};

const EMPTY_SUMMARY = {
  totalInvoices: 0,
  totalQuotations: 0,
  paidInvoices: 0,
  unpaidInvoices: 0,
  overdueInvoices: 0,
  outstandingAmount: 0,
};

// Read the authentication token saved by the login flow.
function getAuthToken() {
  const possibleKeys = ["token", "accessToken", "authToken"];

  for (const key of possibleKeys) {
    const value = localStorage.getItem(key);

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

  // Support applications that save the logged-in user as an object.
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.token || user?.accessToken || "";
  } catch {
    return "";
  }
}

// Return the first available value without replacing valid zero values.
function readValue(object, ...keys) {
  for (const key of keys) {
    if (object?.[key] !== undefined && object?.[key] !== null) {
      return object[key];
    }
  }

  return 0;
}

// Support common API response formats, including { data: [...] }.
function extractArray(response) {
  if (Array.isArray(response)) return response;
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

// Format financial amounts using Sri Lankan Rupees.
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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Build the query string used by date-filtered report endpoints.
function buildQueryParams(filters) {
  const params = new URLSearchParams();

  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);

  return params.toString();
}

// Reusable metric card for the reports dashboard.
function SummaryCard({ title, value, description, icon: Icon, tone, money }) {
  return (
    <article className="report-metric-card">
      <div className="report-metric-top">
        <div className={`report-metric-icon ${tone}`}>
          <Icon size={21} strokeWidth={2} />
        </div>

        <span className="report-metric-description">{description}</span>
      </div>

      <p className="report-metric-title">{title}</p>

      <h3 className={`report-metric-value ${money ? "report-money-value" : ""}`}>
        {money ? formatCurrency(value) : formatNumber(value)}
      </h3>
    </article>
  );
}

// Display the invoice payment breakdown using actual summary values.
function PaymentStatusChart({ summary }) {
  const paid = Number(summary.paidInvoices) || 0;
  const unpaid = Number(summary.unpaidInvoices) || 0;
  const overdue = Number(summary.overdueInvoices) || 0;
  const total = paid + unpaid + overdue;

  const paidPercent = total ? (paid / total) * 100 : 0;
  const unpaidPercent = total ? (unpaid / total) * 100 : 0;
  const overduePercent = total ? (overdue / total) * 100 : 0;

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

// Display monthly income as bars scaled against the highest returned value.
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
        <p>No monthly income data available.</p>
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

// Display a consistent status badge in report tables.
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
  } else if (normalized.includes("approved")) {
    className += " status-approved";
  } else {
    className += " status-default";
  }

  return <span className={className}>{status || "Unknown"}</span>;
}

export default function Reports() {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [invoices, setInvoices] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [monthlyIncome, setMonthlyIncome] = useState([]);

  const [reportType, setReportType] = useState("invoices");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

      // Attach the bearer token to protected API requests.
      const request = async (endpoint) => {
        const url = new URL(`${API_BASE_URL}${endpoint}`);

        if (queryString) {
          new URLSearchParams(queryString).forEach((value, key) => {
            url.searchParams.set(key, value);
          });
        }

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const responseText = await response.text();
          throw new Error(
            responseText || `Request failed (${response.status}): ${endpoint}`
          );
        }

        return response.json();
      };

      // Load all report resources together from the backend.
      const [summaryResponse, invoiceResponse, quotationResponse, incomeResponse] =
        await Promise.all([
          request(API_ENDPOINTS.summary),
          request(API_ENDPOINTS.invoices),
          request(API_ENDPOINTS.quotations),
          request(API_ENDPOINTS.monthlyIncome),
        ]);

      const summaryData = extractObject(summaryResponse);

      setSummary({
        totalInvoices: Number(
          readValue(summaryData, "totalInvoices", "total_invoices")
        ),
        totalQuotations: Number(
          readValue(summaryData, "totalQuotations", "total_quotations")
        ),
        paidInvoices: Number(
          readValue(summaryData, "paidInvoices", "paid_invoices")
        ),
        unpaidInvoices: Number(
          readValue(summaryData, "unpaidInvoices", "unpaid_invoices")
        ),
        overdueInvoices: Number(
          readValue(summaryData, "overdueInvoices", "overdue_invoices")
        ),
        outstandingAmount: Number(
          readValue(summaryData, "outstandingAmount", "outstanding_amount")
        ),
      });

      setInvoices(extractArray(invoiceResponse));
      setQuotations(extractArray(quotationResponse));

      const incomeData = extractArray(incomeResponse).map((item) => ({
        label: String(
          readValue(item, "month_label", "monthLabel", "month", "period")
        ),
        amount: Number(
          readValue(item, "total_income", "totalIncome", "amount", "income")
        ),
      }));

      setMonthlyIncome(incomeData);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load reports. Please check the backend connection."
      );
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

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

  // Download the currently displayed records as a CSV file.
  const downloadCSV = () => {
    if (currentRecords.length === 0) return;

    const headers =
      reportType === "quotations"
        ? [
            "quotation_id",
            "quotation_number",
            "customer_id",
            "quotation_date",
            "total_amount",
            "status",
          ]
        : [
            "invoice_id",
            "invoice_number",
            "customer_id",
            "invoice_date",
            "total_amount",
            "payment_status",
          ];

    const csvRows = [
      headers,
      ...currentRecords.map((record) =>
        headers.map((header) => {
          const value = record[header] ?? "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
      ),
    ];

    const csvContent = csvRows.map((row) => row.join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${reportType}-report.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <main className="reports-page">
      <div className="reports-page-header">
        <div className="reports-heading">
          <span className="reports-eyebrow">BUSINESS OVERVIEW</span>
          <h1>Reports &amp; Analytics</h1>
          <p>
            Monitor invoices, quotations, payment performance and income.
          </p>
        </div>

        <button
          className="reports-refresh-button"
          type="button"
          onClick={fetchReports}
          disabled={loading}
        >
          {loading ? (
            <LoaderCircle size={17} className="reports-spin" />
          ) : (
            <RefreshCw size={17} />
          )}
          <span>Refresh</span>
        </button>
      </div>

      <section className="reports-filter-panel" aria-label="Report filters">
        <div className="report-filter-field">
          <label htmlFor="report-type">Report type</label>
          <select
            id="report-type"
            value={reportType}
            onChange={(event) => setReportType(event.target.value)}
          >
            <option value="invoices">Invoice Report</option>
            <option value="quotations">Quotation Report</option>
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

      {error && (
        <div className="reports-error-message" role="alert">
          <AlertCircle size={20} />
          <div>
            <strong>Could not load reports</strong>
            <p>{error}</p>
            <span>
              Check that the backend is running and the report endpoints exist.
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
          <p>Loading reports from the server...</p>
        </div>
      ) : (
        <>
          <section className="reports-summary-grid" aria-label="Report summary">
            <SummaryCard
              title="Total Invoices"
              value={summary.totalInvoices}
              description="All recorded invoices"
              icon={Receipt}
              tone="metric-blue"
            />
            <SummaryCard
              title="Total Quotations"
              value={summary.totalQuotations}
              description="All recorded quotations"
              icon={FileText}
              tone="metric-purple"
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
              title="Outstanding Amount"
              value={summary.outstandingAmount}
              description="Amount still outstanding"
              icon={TrendingUp}
              tone="metric-navy"
              money
            />
          </section>

          <section className="reports-charts-grid">
            <article className="reports-panel">
              <div className="reports-panel-heading">
                <div className="reports-panel-icon">
                  <Activity size={19} />
                </div>
                <div>
                  <h2>Invoice Payment Status</h2>
                  <p>Breakdown of payment performance</p>
                </div>
              </div>

              <PaymentStatusChart summary={summary} />
            </article>

            <article className="reports-panel">
              <div className="reports-panel-heading">
                <div className="reports-panel-icon">
                  <BarChart3 size={19} />
                </div>
                <div>
                  <h2>Monthly Income</h2>
                  <p>Income returned by the backend</p>
                </div>
              </div>

              <MonthlyIncomeChart items={monthlyIncome} />
            </article>
          </section>

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
                  No records were returned for this report and selected date
                  range.
                </p>
              </div>
            ) : (
              <div className="reports-table-wrapper">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Reference</th>
                      <th>Customer ID</th>
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
                        "payment_status",
                        "status",
                        "quotation_status"
                      );

                      return (
                        <tr key={id || `${reference}-${index}`}>
                          <td className="report-id-cell">{id || "—"}</td>
                          <td className="report-reference-cell">
                            {reference || "—"}
                          </td>
                          <td>{customerId || "—"}</td>
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
    </main>
  );
}
