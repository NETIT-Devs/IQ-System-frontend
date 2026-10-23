// Quotation details walata use karana icons.
import { X, CalendarDays, UserRound, FileText } from "lucide-react";

// Backend eken ena quotation data display karana component eka.
export default function QuotationDetails({
  quotation,
  onClose,
}) {
  // Quotation ekak select karala nathnam details display karanne na.
  if (!quotation) return null;

  // Amounts currency ekath ekka format karanawa.
  const money = (amount) =>
    `${quotation.currency || "LKR"} ${Number(amount || 0).toLocaleString(
      "en-LK",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;

  // Date values readable format ekakata convert karanawa.
  const formatDate = (value) => {
    if (!value) return "Not specified";

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

  // Status ekata adala badge color eka return karanawa.
  const statusStyle = {
    Draft: "bg-slate-100 text-slate-700",
    Sent: "bg-blue-100 text-blue-700",
    Accepted: "bg-emerald-100 text-emerald-700",
    Rejected: "bg-red-100 text-red-700",
    Expired: "bg-amber-100 text-amber-800",
    Converted: "bg-purple-100 text-purple-700",
    Cancelled: "bg-rose-100 text-rose-700",
  };

  return (
    // Details modal background.
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
      <div className="mx-auto my-4 max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-5 sm:px-7">
          <div>
            <div className="mb-2 flex items-center gap-2 text-blue-700">
              <FileText size={20} />
              <span className="text-sm font-semibold">
                Quotation Details
              </span>
            </div>

            <h2 className="text-2xl font-bold text-slate-900">
              {quotation.quotation_number}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Created on {formatDate(quotation.created_at)}
            </p>
          </div>

          {/* Close details modal */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-200"
            aria-label="Close quotation details"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 p-5 sm:p-7">
          {/* Quotation status saha dates */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Status</p>

              <span
                className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  statusStyle[quotation.status] ||
                  "bg-slate-100 text-slate-700"
                }`}
              >
                {quotation.status || "Draft"}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-500">
                <CalendarDays size={16} />
                <p className="text-sm">Quotation Date</p>
              </div>

              <p className="mt-2 font-semibold text-slate-900">
                {formatDate(quotation.quotation_date)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-500">
                <CalendarDays size={16} />
                <p className="text-sm">Valid Until</p>
              </div>

              <p className="mt-2 font-semibold text-slate-900">
                {formatDate(quotation.valid_until)}
              </p>
            </div>
          </section>

          {/* Customer information */}
          <section>
            <h3 className="mb-3 font-semibold text-slate-900">
              Customer Information
            </h3>

            <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <div className="rounded-lg bg-blue-50 p-3 text-blue-700">
                <UserRound size={20} />
              </div>

              <div>
                <p className="font-semibold text-slate-900">
                  {quotation.customer_name || "Customer"}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Customer ID: {quotation.customer_id}
                </p>
              </div>
            </div>
          </section>

          {/* Item details table */}
          <section>
            <h3 className="mb-3 font-semibold text-slate-900">
              Quotation Items
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Item</th>
                    <th className="px-4 py-3 font-semibold">Quantity</th>
                    <th className="px-4 py-3 font-semibold">Unit Price</th>
                    <th className="px-4 py-3 font-semibold">Tax (%)</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Line Total
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {quotation.items?.length > 0 ? (
                    quotation.items.map((item) => (
                      <tr
                        key={item.quotation_item_id}
                        className="text-slate-700"
                      >
                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-900">
                            {item.item_name}
                          </p>

                          {item.description && (
                            <p className="mt-1 text-xs text-slate-500">
                              {item.description}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {Number(item.quantity).toLocaleString()}
                        </td>

                        <td className="px-4 py-4">
                          {money(item.unit_price)}
                        </td>

                        <td className="px-4 py-4">
                          {Number(item.tax_rate || 0)}%
                        </td>

                        <td className="px-4 py-4 text-right font-medium">
                          {money(item.line_total)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="5"
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No quotation items available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Totals summary */}
          <section className="ml-auto max-w-md space-y-3 rounded-xl bg-slate-50 p-5">
            <div className="flex justify-between gap-4 text-sm text-slate-600">
              <span>Subtotal</span>
              <span>{money(quotation.subtotal)}</span>
            </div>

            <div className="flex justify-between gap-4 text-sm text-slate-600">
              <span>Tax Amount</span>
              <span>{money(quotation.tax_amount)}</span>
            </div>

            <div className="flex justify-between gap-4 text-sm text-slate-600">
              <span>Discount</span>
              <span>- {money(quotation.discount_amount)}</span>
            </div>

            <div className="flex justify-between gap-4 border-t border-slate-200 pt-3 text-lg font-bold text-slate-900">
              <span>Total Amount</span>
              <span>{money(quotation.total_amount)}</span>
            </div>
          </section>

          {/* Optional notes */}
          {quotation.notes && (
            <section>
              <h3 className="mb-2 font-semibold text-slate-900">
                Notes
              </h3>

              <p className="whitespace-pre-wrap rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-600">
                {quotation.notes}
              </p>
            </section>
          )}

          {/* Optional terms and conditions */}
          {quotation.terms_and_conditions && (
            <section>
              <h3 className="mb-2 font-semibold text-slate-900">
                Terms and Conditions
              </h3>

              <p className="whitespace-pre-wrap rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-600">
                {quotation.terms_and_conditions}
              </p>
            </section>
          )}

          {/* Record metadata */}
          <section className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500 sm:grid-cols-2">
            <p>Created by user ID: {quotation.created_by ?? "N/A"}</p>
            <p>
              Last updated: {formatDate(quotation.updated_at)}
            </p>
          </section>

          {/* Close button */}
          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}