// React hooks import karanawa.
// useState - UI state manage karanawa.
// useEffect - page eka load weddi API call karanawa.
// useCallback - loadData function eka reuse karanawa.
import { useCallback, useEffect, useMemo, useState } from "react";

// Quotation page eke icons.
import {
  Plus,
  Search,
  FileText,
  Eye,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// Quotation components import karanawa.
import QuotationForm from "./QuotationForm";
import QuotationDetails from "./QuotationDetails";

// API base URL eka .env file eken gannawa.
// VITE_API_URL set karala nathnam localhost:5000 use karanawa.
const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

// Login ekedi token eka localStorage eke save karala thiyenawanam gannawa.
// Oyāge login code eke wena key ekak use karanawanam me function eka update karanna.
function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

// Backend API request ekak send karana common function eka.
async function apiRequest(path, options = {}) {
  // Login token eka request ekata add karanawa.
  const token = getToken();

  // JSON headers saha authentication header prepare karanawa.
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  // Backend ekata request eka send karanawa.
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  // Response eka JSON widiyata read karanawa.
  const data = await response.json().catch(() => ({}));

  // Backend error ekak awoth meaningful message ekak throw karanawa.
  if (!response.ok) {
    throw new Error(
      data.message ||
        data.error ||
        `Request failed with status ${response.status}`
    );
  }

  // Successful response eka caller ekata return karanawa.
  return data;
}

// Backend response eken records array eka extract karanawa.
function getRecords(response, key) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.[key])) return response[key];
  if (Array.isArray(response?.data?.[key])) {
    return response.data[key];
  }
  if (Array.isArray(response?.data)) return response.data;

  return [];
}

// Main Quotations page component eka.
export default function Quotations() {
  // Backend eken load karapu quotation records.
  const [quotations, setQuotations] = useState([]);

  // Customer dropdown ekata ona customer records.
  const [customers, setCustomers] = useState([]);

  // Loading status eka.
  const [loading, setLoading] = useState(true);

  // Create quotation request eka process wenawada kiyala.
  const [saving, setSaving] = useState(false);

  // API error messages display karanna.
  const [error, setError] = useState("");

  // Successful save message eka display karanna.
  const [success, setSuccess] = useState("");

  // Search field eke value eka.
  const [searchTerm, setSearchTerm] = useState("");

  // Status filter eke selected value eka.
  const [statusFilter, setStatusFilter] = useState("All");

  // Create form modal eka open da kiyala.
  const [showForm, setShowForm] = useState(false);

  // Details modal eke display karana quotation eka.
  const [selectedQuotation, setSelectedQuotation] = useState(null);

  // Quotations saha customers backend eken load karanawa.
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // API endpoints deka request karanawa.
      // Me URLs backend route mount karapu paths ekata match wenna one.
      const [quotationResponse, customerResponse] =
        await Promise.all([
          apiRequest("/api/quotations"),
          apiRequest("/api/customers"),
        ]);

      // Quotations controller eke response:
      // { success: true, quotations: [...] }
      const quotationRecords = getRecords(
        quotationResponse,
        "quotations"
      );

      // Customer API response eken customer list eka gannawa.
      const customerRecords = getRecords(
        customerResponse,
        "customers"
      );

      // UI state update karanawa.
      setQuotations(quotationRecords);
      setCustomers(customerRecords);
    } catch (err) {
      // API/auth/server errors user ta pennanawa.
      setError(
        err.message ||
          "Unable to load quotations. Check the backend connection."
      );
    } finally {
      // Request eka iwara unama loading state eka stop karanawa.
      setLoading(false);
    }
  }, []);

  // Page eka first load weddi data load karanawa.
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Search term saha status eka anuwa records filter karanawa.
  const filteredQuotations = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return quotations.filter((quotation) => {
      // Quotation number/customer name search karanawa.
      const matchesSearch =
        !search ||
        String(quotation.quotation_number || "")
          .toLowerCase()
          .includes(search) ||
        String(quotation.customer_name || "")
          .toLowerCase()
          .includes(search);

      // Status filter eka apply karanawa.
      const matchesStatus =
        statusFilter === "All" ||
        quotation.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [quotations, searchTerm, statusFilter]);

  // Quotation records walin dashboard summary values calculate karanawa.
  const summary = useMemo(() => {
    return {
      total: quotations.length,
      draft: quotations.filter((item) => item.status === "Draft").length,
      sent: quotations.filter((item) => item.status === "Sent").length,
      accepted: quotations.filter(
        (item) => item.status === "Accepted"
      ).length,
    };
  }, [quotations]);

  // New quotation eka backend ekata save karana function eka.
  const handleCreateQuotation = async (payload) => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      // Backend controller eka POST /api/quotations accept karanawa.
      // Payload eka QuotationForm eken receive karanawa.
      const response = await apiRequest("/api/quotations", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Save successful nam modal eka close karanawa.
      setShowForm(false);

      // Success message eka display karanawa.
      setSuccess(
        response.message || "Quotation created successfully."
      );

      // Latest quotation list eka backend eken aye load karanawa.
      await loadData();
    } catch (err) {
      // Form ekata error eka yawanawa, e nisa form eka close wenne na.
      throw new Error(
        err.message || "Failed to create quotation."
      );
    } finally {
      // Save request eka iwara unama button eka enable karanawa.
      setSaving(false);
    }
  };

  // Quotation status badge color eka select karanawa.
  const getStatusClass = (status) => {
    const styles = {
      Draft: "bg-slate-100 text-slate-700",
      Sent: "bg-blue-100 text-blue-700",
      Accepted: "bg-emerald-100 text-emerald-700",
      Rejected: "bg-red-100 text-red-700",
      Expired: "bg-amber-100 text-amber-800",
      Converted: "bg-purple-100 text-purple-700",
      Cancelled: "bg-rose-100 text-rose-700",
    };

    return styles[status] || "bg-slate-100 text-slate-700";
  };

  // Amount currency ekath ekka format karanawa.
  const money = (amount, currency = "LKR") =>
    `${currency} ${Number(amount || 0).toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  // Date eka readable format ekakata convert karanawa.
  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value).slice(0, 10);
    }

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    // Main page wrapper.
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Page heading saha action buttons */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700">
              <FileText size={18} />
              <span>Management</span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Quotations
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Create and manage customer quotations.
            </p>
          </div>

          {/* Refresh saha create buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
                setShowForm(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
            >
              <Plus size={18} />
              Create Quotation
            </button>
          </div>
        </div>

        {/* API error message */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />

            <div className="flex-1">
              <p className="font-semibold">Something went wrong</p>
              <p className="mt-1">{error}</p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Successful save message */}
        {success && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 size={19} className="shrink-0" />

            <p className="flex-1">{success}</p>

            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Dismiss success message"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Total quotations */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Total Quotations
              </p>

              <span className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
                <FileText size={20} />
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold text-slate-900">
              {loading ? "—" : summary.total}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              All quotation records
            </p>
          </div>

          {/* Draft quotations */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Draft
              </p>

              <span className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
                <FileText size={20} />
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold text-slate-900">
              {loading ? "—" : summary.draft}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Draft quotations
            </p>
          </div>

          {/* Sent quotations */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Sent
              </p>

              <span className="rounded-xl bg-sky-50 p-2.5 text-sky-700">
                <FileText size={20} />
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold text-slate-900">
              {loading ? "—" : summary.sent}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Sent to customers
            </p>
          </div>

          {/* Accepted quotations */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Accepted
              </p>

              <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
                <CheckCircle2 size={20} />
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold text-slate-900">
              {loading ? "—" : summary.accepted}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Accepted quotations
            </p>
          </div>
        </div>

        {/* Quotations table container */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Search saha status filter */}
          <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                All Quotations
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                View quotation records and their current statuses.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {/* Search by quotation number/customer name */}
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search quotations..."
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:w-64"
                />
              </div>

              {/* Filter by quotation status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              >
                <option value="All">All Statuses</option>

                {[
                  "Draft",
                  "Sent",
                  "Accepted",
                  "Rejected",
                  "Expired",
                  "Converted",
                  "Cancelled",
                ].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Loading state */}
          {loading ? (
            <div className="flex flex-col items-center justify-center px-6 py-16">
              <RefreshCw
                size={28}
                className="animate-spin text-blue-700"
              />

              <p className="mt-4 text-sm text-slate-500">
                Loading quotations...
              </p>
            </div>
          ) : filteredQuotations.length === 0 ? (
            // Empty state: records nathnam me message eka display karanawa.
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="rounded-2xl bg-slate-100 p-4 text-slate-500">
                <FileText size={30} />
              </div>

              <h3 className="mt-4 font-semibold text-slate-900">
                No quotations found
              </h3>

              <p className="mt-2 max-w-sm text-sm text-slate-500">
                {quotations.length === 0
                  ? "No quotations have been created yet."
                  : "Try changing your search term or status filter."}
              </p>

              {/* First quotation eka create karanna shortcut eka */}
              {quotations.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  <Plus size={17} />
                  Create Quotation
                </button>
              )}
            </div>
          ) : (
            // Records thiyenawanam table eka display karanawa.
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                {/* Table headings */}
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">
                      Quotation
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Customer
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Date
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Valid Until
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Total Amount
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Status
                    </th>

                    <th className="px-5 py-4 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>

                {/* Backend eken load karapu records */}
                <tbody className="divide-y divide-slate-100">
                  {filteredQuotations.map((quotation) => (
                    <tr
                      key={quotation.quotation_id}
                      className="transition hover:bg-slate-50"
                    >
                      {/* Quotation number saha database ID */}
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {quotation.quotation_number}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          ID: {quotation.quotation_id}
                        </p>
                      </td>

                      {/* Customer name */}
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-800">
                          {quotation.customer_name || "Customer"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Customer ID: {quotation.customer_id}
                        </p>
                      </td>

                      {/* Quotation dates */}
                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(quotation.quotation_date)}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(quotation.valid_until)}
                      </td>

                      {/* Total amount */}
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {money(
                          quotation.total_amount,
                          quotation.currency
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(
                            quotation.status
                          )}`}
                        >
                          {quotation.status || "Draft"}
                        </span>
                      </td>

                      {/* View quotation details */}
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedQuotation(quotation)
                          }
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Eye size={15} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table footer with result count */}
          {!loading && filteredQuotations.length > 0 && (
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
              Showing {filteredQuotations.length} of {quotations.length} quotations
            </div>
          )}
        </section>
      </div>

      {/* Create form modal eka open karanawa */}
      {showForm && (
        <QuotationForm
          customers={customers}
          saving={saving}
          onClose={() => setShowForm(false)}
          onSave={handleCreateQuotation}
        />
      )}

      {/* Selected quotation eke details modal eka */}
      {selectedQuotation && (
        <QuotationDetails
          quotation={selectedQuotation}
          onClose={() => setSelectedQuotation(null)}
        />
      )}
    </div>
  );
}