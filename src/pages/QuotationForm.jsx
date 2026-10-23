
import { useMemo, useState } from "react";
import { Plus, Trash2, X, Save } from "lucide-react";

const initialItem = {
  item_name: "",
  description: "",
  unit_price: "",
  tax_rate: "0",
};

export default function QuotationForm({
  customers = [],
  onSave,
  onClose,
}) {
  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    quotation_number: `QUO-${Date.now()}`,
    customer: "",
    quotation_date: today,
    valid_until: "",
    currency: "LKR",
    discount_amount: "0",
    notes: "",
    terms_and_conditions: "",
  });

  const [items, setItems] = useState([{ ...initialItem }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateField = (field, value) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const updateItem = (index, field, value) => {
    setItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      )
    );
  };

  const addItem = () => {
    setItems((previous) => [
      ...previous,
      { ...initialItem },
    ]);
  };

  const removeItem = (index) => {
    setItems((previous) =>
      previous.length > 1
        ? previous.filter(
            (_, itemIndex) => itemIndex !== index
          )
        : previous
    );
  };

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) =>
        sum + (Number(item.unit_price) || 0),
      0
    );

    const taxAmount = items.reduce((sum, item) => {
      const price = Number(item.unit_price) || 0;
      const taxRate = Number(item.tax_rate) || 0;

      return sum + (price * taxRate) / 100;
    }, 0);

    const discount = Math.max(
      0,
      Number(formData.discount_amount) || 0
    );

    return {
      subtotal,
      taxAmount,
      discount,
      total: Math.max(
        0,
        subtotal + taxAmount - discount
      ),
    };
  }, [items, formData.discount_amount]);

  const formatMoney = (amount) =>
    new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: formData.currency,
      minimumFractionDigits: 2,
    }).format(amount);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!formData.quotation_number.trim()) {
      setError("Please enter a quotation number.");
      return;
    }

    if (!formData.customer.trim()) {
      setError("Please enter the customer name.");
      return;
    }

    if (!formData.quotation_date) {
      setError("Please select a quotation date.");
      return;
    }

    if (
      formData.valid_until &&
      formData.valid_until < formData.quotation_date
    ) {
      setError(
        "The valid-until date cannot be before the quotation date."
      );
      return;
    }

    for (let index = 0; index < items.length; index++) {
      const item = items[index];

      if (!item.item_name.trim()) {
        setError(
          `Please enter the item name for item ${index + 1}.`
        );
        return;
      }

      if (
        item.unit_price === "" ||
        !Number.isFinite(Number(item.unit_price)) ||
        Number(item.unit_price) < 0
      ) {
        setError(
          `Please enter a valid price for item ${index + 1}.`
        );
        return;
      }

      const taxRate = Number(item.tax_rate);

      if (
        item.tax_rate === "" ||
        !Number.isFinite(taxRate) ||
        taxRate < 0 ||
        taxRate > 100
      ) {
        setError(
          `Tax rate for item ${index + 1} must be between 0 and 100.`
        );
        return;
      }
    }

    if (
      !Number.isFinite(Number(formData.discount_amount)) ||
      Number(formData.discount_amount) < 0
    ) {
      setError("Please enter a valid discount amount.");
      return;
    }

    if (totals.discount > totals.subtotal + totals.taxAmount) {
      setError(
        "The discount cannot exceed the subtotal plus tax."
      );
      return;
    }

    // Find an existing customer by the entered name.
    // The current backend expects customer_id, not a customer name.
    const customer = customers.find((entry) => {
      const name =
        entry.customer_name ??
        entry.name ??
        entry.company_name ??
        "";

      return (
        String(name).trim().toLowerCase() ===
        formData.customer.trim().toLowerCase()
      );
    });

    if (!customer) {
      setError(
        "This customer was not found in the existing customer records. The backend must support creating or saving customers by name, or you must enter an existing customer's exact name."
      );
      return;
    }

    const customerId =
      customer.customer_id ?? customer.id;

    if (!customerId) {
      setError(
        "Could not find the customer ID. Please check the customer API response."
      );
      return;
    }

    const payload = {
      quotation_number: formData.quotation_number.trim(),
      customer_id: customerId,
      quotation_date: formData.quotation_date,
      valid_until: formData.valid_until || null,
      status: "Draft",
      currency: formData.currency,
      subtotal: Number(totals.subtotal.toFixed(2)),
      discount_amount: Number(totals.discount.toFixed(2)),
      tax_amount: Number(totals.taxAmount.toFixed(2)),
      total_amount: Number(totals.total.toFixed(2)),
      notes: formData.notes.trim(),
      terms_and_conditions:
        formData.terms_and_conditions.trim(),

      // Quantity is not shown in the form.
      // A default value of 1 is sent for backend compatibility.
      items: items.map((item) => ({
        item_name: item.item_name.trim(),
        description: item.description.trim(),
        quantity: 1,
        unit_price: Number(item.unit_price),
        tax_rate: Number(item.tax_rate),
      })),
    };

    try {
      setSaving(true);
      await onSave(payload);
    } catch (err) {
      setError(
        err?.message || "Failed to save the quotation."
      );
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  const labelClass =
    "mb-1.5 block text-sm font-medium text-slate-700";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-6">
      <div className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Create Quotation
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter the customer and quotation details below.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close quotation form"
          >
            <X size={21} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-7 p-5 sm:p-7">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {/* Basic quotation information */}
            <section>
              <h3 className="mb-4 text-base font-semibold text-slate-900">
                Quotation Information
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>
                    Quotation Number
                  </label>
                  <input
                    className={inputClass}
                    value={formData.quotation_number}
                    onChange={(e) =>
                      updateField(
                        "quotation_number",
                        e.target.value
                      )
                    }
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Customer
                  </label>
                  <input
                    type="text"
                    className={inputClass}
                    value={formData.customer}
                    onChange={(e) =>
                      updateField("customer", e.target.value)
                    }
                    placeholder="Enter customer name"
                    autoComplete="off"
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Quotation Date
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    value={formData.quotation_date}
                    onChange={(e) =>
                      updateField(
                        "quotation_date",
                        e.target.value
                      )
                    }
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Valid Until
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    min={formData.quotation_date}
                    value={formData.valid_until}
                    onChange={(e) =>
                      updateField(
                        "valid_until",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Currency
                  </label>
                  <select
                    className={inputClass}
                    value={formData.currency}
                    onChange={(e) =>
                      updateField("currency", e.target.value)
                    }
                  >
                    <option value="LKR">LKR - Sri Lankan Rupee</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Items */}
            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Items / Services
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Add the items or services included in this quotation.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  <Plus size={16} />
                  Add Item
                </button>
              </div>

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">
                        Item {index + 1}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                        className="rounded-lg p-2 text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={`Remove item ${index + 1}`}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className={labelClass}>
                          Item / Service Name
                        </label>
                        <input
                          type="text"
                          className={inputClass}
                          value={item.item_name}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "item_name",
                              e.target.value
                            )
                          }
                          placeholder="Enter item or service name"
                          required
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className={labelClass}>
                          Description
                        </label>
                        <textarea
                          className={inputClass}
                          rows={2}
                          value={item.description}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "description",
                              e.target.value
                            )
                          }
                          placeholder="Enter item description (optional)"
                        />
                      </div>

                      <div>
                        <label className={labelClass}>
                          Price ({formData.currency})
                        </label>
                        <input
                          type="number"
                          className={inputClass}
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "unit_price",
                              e.target.value
                            )
                          }
                          placeholder="0.00"
                          required
                        />
                      </div>

                      <div>
                        <label className={labelClass}>
                          Tax Rate (%)
                        </label>
                        <input
                          type="number"
                          className={inputClass}
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.tax_rate}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "tax_rate",
                              e.target.value
                            )
                          }
                          placeholder="0"
                          required
                        />
                      </div>

                      <div className="sm:col-span-2 flex items-center justify-between border-t border-slate-200 pt-3">
                        <span className="text-sm text-slate-500">
                          Item Total (including tax)
                        </span>
                        <span className="font-semibold text-slate-900">
                          {formatMoney(
                            (Number(item.unit_price) || 0) *
                              (1 +
                                (Number(item.tax_rate) || 0) /
                                  100)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Notes and terms */}
            <section>
              <h3 className="mb-4 text-base font-semibold text-slate-900">
                Additional Information
              </h3>

              <div className="space-y-4">
                <div>
                  <label className={labelClass}>
                    Notes
                  </label>
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={formData.notes}
                    onChange={(e) =>
                      updateField("notes", e.target.value)
                    }
                    placeholder="Additional notes (optional)"
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Terms and Conditions
                  </label>
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={formData.terms_and_conditions}
                    onChange={(e) =>
                      updateField(
                        "terms_and_conditions",
                        e.target.value
                      )
                    }
                    placeholder="Enter quotation terms and conditions (optional)"
                  />
                </div>
              </div>
            </section>

            {/* Summary */}
            <section className="ml-auto max-w-md rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="mb-4 font-semibold text-slate-900">
                Quotation Summary
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-medium text-slate-800">
                    {formatMoney(totals.subtotal)}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-slate-600">Tax</span>
                  <span className="font-medium text-slate-800">
                    {formatMoney(totals.taxAmount)}
                  </span>
                </div>

                <div>
                  <label className={labelClass}>
                    Discount ({formData.currency})
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    min="0"
                    step="0.01"
                    value={formData.discount_amount}
                    onChange={(e) =>
                      updateField(
                        "discount_amount",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="flex justify-between gap-4 border-t border-slate-200 pt-3">
                  <span className="font-bold text-slate-900">
                    Total
                  </span>
                  <span className="text-lg font-bold text-blue-700">
                    {formatMoney(totals.total)}
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* Form buttons */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={17} />
              {saving ? "Saving..." : "Save Quotation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
