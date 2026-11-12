import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  ExternalLink,
  FileText,
  Globe,
  History,
  Image as ImageIcon,
  Landmark,
  Paperclip,
  Trash2,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import API_BASE_URL from "../services/api";
import { getInvoiceById } from "../services/invoiceService";
import {
  createPayment,
  deletePayment,
  getPayments,
} from "../services/paymentService";
import { addNotification } from "../services/quotationService";
import { getAuthenticatedUser } from "../utils/authStorage";
import "./InvoicePaymentModal.css";

const PAYMENT_METHOD_OPTIONS = [
  { value: "Bank Transfer", label: "Bank Transfer", icon: Landmark, tone: "blue" },
  { value: "Card", label: "Card", icon: CreditCard, tone: "purple" },
  { value: "Cash", label: "Cash", icon: Banknote, tone: "green" },
  { value: "Online", label: "Online", icon: Globe, tone: "cyan" },
  { value: "Other", label: "Other", icon: Wallet, tone: "slate" },
];

function formatCurrency(amount, currency = "LKR") {
  const code = /^[A-Z]{3}$/.test(String(currency || "")) ? currency : "LKR";
  return `${code} ${(Number(amount) || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";
  try {
    const str = String(value);
    const d = new Date(str.includes("T") ? str : `${str}T00:00:00`);
    if (Number.isNaN(d.getTime())) return str;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(value);
  }
}

function resolveSlipUrl(slipPath) {
  if (!slipPath) return "";
  if (/^https?:\/\//i.test(slipPath)) return slipPath;
  return `${API_BASE_URL}${slipPath.startsWith("/") ? "" : "/"}${slipPath}`;
}

function isPdfPath(pathOrName) {
  return /\.pdf(\?|$)/i.test(String(pathOrName || ""));
}

function getMethodTone(method) {
  const m = String(method || "").toLowerCase();
  if (m.includes("bank")) return "blue";
  if (m.includes("card")) return "purple";
  if (m.includes("cash")) return "green";
  if (m.includes("online")) return "cyan";
  return "slate";
}

export default function InvoicePaymentModal({
  isOpen,
  invoice,
  quotations = [],
  onClose,
  onPaymentUpdated,
}) {
  const authUser = getAuthenticatedUser();
  const normalizedRole = String(authUser?.role || "").trim().toLowerCase();
  const isSuperAdmin =
    normalizedRole === "super admin" || normalizedRole === "super_admin";

  const [liveInvoice, setLiveInvoice] = useState(invoice || null);
  const [transactions, setTransactions] = useState(
    Array.isArray(invoice?.payments) ? invoice.payments : []
  );
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Payment form state
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [methodMenuOpen, setMethodMenuOpen] = useState(false);
  const methodMenuRef = useRef(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [referenceNumber, setReferenceNumber] = useState("");
  const [description, setDescription] = useState("");
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreviewUrl, setSlipPreviewUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const loadSettlementData = useCallback(async (targetInvoiceId) => {
    if (!targetInvoiceId) return;
    try {
      setLoadingHistory(true);
      const [freshInv, paymentList] = await Promise.all([
        getInvoiceById(targetInvoiceId).catch(() => null),
        getPayments({ invoice_id: targetInvoiceId }).catch(() => []),
      ]);
      if (freshInv) {
        setLiveInvoice(freshInv);
      }
      if (Array.isArray(paymentList)) {
        setTransactions(paymentList);
      } else if (Array.isArray(freshInv?.payments)) {
        setTransactions(freshInv.payments);
      }
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (!methodMenuOpen) return;
    function handleOutside(e) {
      if (methodMenuRef.current && !methodMenuRef.current.contains(e.target)) {
        setMethodMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [methodMenuOpen]);

  useEffect(() => {
    if (!isOpen || !invoice?.invoice_id) return;
    let cancelled = false;

    async function fetchInitial() {
      const [freshInv, paymentList] = await Promise.all([
        getInvoiceById(invoice.invoice_id).catch(() => null),
        getPayments({ invoice_id: invoice.invoice_id }).catch(() => []),
      ]);
      if (cancelled) return;
      if (freshInv) {
        setLiveInvoice(freshInv);
      }
      if (Array.isArray(paymentList)) {
        setTransactions(paymentList);
      } else if (Array.isArray(freshInv?.payments)) {
        setTransactions(freshInv.payments);
      }
    }

    fetchInitial();
    return () => {
      cancelled = true;
    };
  }, [isOpen, invoice?.invoice_id]);

  useEffect(() => {
    return () => {
      if (slipPreviewUrl) {
        URL.revokeObjectURL(slipPreviewUrl);
      }
    };
  }, [slipPreviewUrl]);

  const activeInv = liveInvoice || invoice;

  const matchedQuotation = useMemo(() => {
    if (!activeInv?.quotation_id || !Array.isArray(quotations)) return null;
    return (
      quotations.find(
        (q) => String(q.quotation_id) === String(activeInv.quotation_id)
      ) || null
    );
  }, [activeInv, quotations]);

  const metrics = useMemo(() => {
    const totalDue = Number(activeInv?.total_amount || 0);
    const verifiedPaidFromTx = transactions
      .filter((t) => String(t.status || "").toLowerCase() === "approved")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const pendingAmount = transactions
      .filter((t) => String(t.status || "").toLowerCase() === "pending verification")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const rawPaid =
      activeInv?.amount_paid !== undefined && activeInv?.amount_paid !== null
        ? Number(activeInv.amount_paid)
        : verifiedPaidFromTx;
    const totalPaid = Number.isFinite(rawPaid) ? rawPaid : verifiedPaidFromTx;

    const rawBalance =
      activeInv?.balance_due !== undefined && activeInv?.balance_due !== null
        ? Number(activeInv.balance_due)
        : Math.max(0, totalDue - totalPaid);
    const safeBalance = Number.isFinite(rawBalance)
      ? rawBalance
      : Math.max(0, totalDue - totalPaid);
    const balanceRemaining = Math.max(0, Number(safeBalance.toFixed(2)));

    const currentPayNum = Number(paymentAmount);
    const validCurrentPay =
      Number.isFinite(currentPayNum) && currentPayNum > 0 ? currentPayNum : 0;
    const exceedsRemaining = validCurrentPay > balanceRemaining + 0.0001;
    const projectedRemaining = Math.max(
      0,
      Number((balanceRemaining - validCurrentPay).toFixed(2))
    );

    const settledPct =
      totalDue > 0
        ? Math.min(100, Math.round((totalPaid / totalDue) * 100))
        : 0;
    const projectedPct =
      totalDue > 0
        ? Math.min(
            100,
            Math.round(((totalPaid + Math.min(validCurrentPay, balanceRemaining)) / totalDue) * 100)
          )
        : 0;

    return {
      totalDue,
      totalPaid,
      balanceRemaining,
      pendingAmount,
      validCurrentPay,
      exceedsRemaining,
      projectedRemaining,
      settledPct,
      projectedPct,
    };
  }, [activeInv, transactions, paymentAmount]);

  if (!isOpen || !activeInv) return null;

  const currency = activeInv.currency || "LKR";
  const invNumber = activeInv.invoice_number || `INV-${activeInv.invoice_id}`;
  const hasQuotation = Boolean(
    activeInv.quotation_number || activeInv.quotation_id
  );
  const quotationRef =
    activeInv.quotation_number ||
    matchedQuotation?.quotation_number ||
    (activeInv.quotation_id ? `QUO-${activeInv.quotation_id}` : "");

  function handleSlipChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExts = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"];
    const dotIdx = file.name.lastIndexOf(".");
    const ext = dotIdx >= 0 ? file.name.slice(dotIdx).toLowerCase() : "";
    if (!allowedExts.includes(ext)) {
      setFormError("Unsupported file format. Upload PNG, JPG, WEBP, GIF, or PDF.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError("Payment slip file size must be 5 MB or less.");
      e.target.value = "";
      return;
    }

    if (slipPreviewUrl) URL.revokeObjectURL(slipPreviewUrl);
    setSlipFile(file);
    setSlipPreviewUrl(
      file.type.startsWith("image/") ? URL.createObjectURL(file) : ""
    );
    setFormError("");
  }

  function clearSlip() {
    if (slipPreviewUrl) URL.revokeObjectURL(slipPreviewUrl);
    setSlipFile(null);
    setSlipPreviewUrl("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    const numericAmount = Number(paymentAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError("Please enter a valid payment amount greater than zero.");
      return;
    }

    if (metrics.exceedsRemaining) {
      setFormError(
        `Amount cannot exceed balance remaining (${formatCurrency(
          metrics.balanceRemaining,
          currency
        )}).`
      );
      return;
    }

    if (!paymentDate) {
      setFormError("Payment date is required.");
      return;
    }

    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append("invoice_id", String(activeInv.invoice_id));
      fd.append("payment_date", paymentDate);
      fd.append("amount", String(Number(numericAmount.toFixed(2))));
      fd.append("payment_method", paymentMethod);
      fd.append("reference_number", referenceNumber.trim());
      fd.append("description", description.trim());
      if (slipFile) {
        fd.append("payment_slip", slipFile);
      }

      const res = await createPayment(fd);
      const created = res?.payment;

      if (!isSuperAdmin && created) {
        try {
          await addNotification({
            title: `Payment Recorded: ${
              created.payment_number || `PAY-${created.payment_id}`
            }`,
            message: `${
              authUser?.full_name || authUser?.name || "Admin"
            } recorded ${formatCurrency(
              created.amount,
              created.currency || currency
            )} for Invoice ${invNumber} (${activeInv.customer_name || ""}).`,
            type: "warning",
            reference_type: "payment",
            reference_id: created.payment_id,
            target_role: "super_admin",
            created_by: authUser?.user_id || authUser?.id,
            created_by_name: authUser?.full_name || authUser?.name || "Admin",
          });
        } catch (notifErr) {
          console.warn("Could not dispatch payment notification:", notifErr);
        }
      }

      setFormSuccess(
        res?.message ||
          (isSuperAdmin
            ? "Payment recorded & invoice balance updated."
            : "Payment submitted for Super Admin approval.")
      );
      setPaymentAmount("");
      setReferenceNumber("");
      setDescription("");
      clearSlip();

      await loadSettlementData(activeInv.invoice_id);
      if (onPaymentUpdated) {
        await onPaymentUpdated();
      }
    } catch (err) {
      setFormError(err?.message || "Failed to record payment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteTx(tx) {
    if (!tx?.payment_id) return;
    try {
      setDeletingId(tx.payment_id);
      setFormError("");
      setFormSuccess("");
      await deletePayment(tx.payment_id);
      setFormSuccess(
        `Payment ${tx.payment_number || `PAY-${tx.payment_id}`} removed.`
      );
      await loadSettlementData(activeInv.invoice_id);
      if (onPaymentUpdated) {
        await onPaymentUpdated();
      }
    } catch (err) {
      setFormError(err?.message || "Failed to delete payment.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      className="ipm-overlay"
      onClick={() => !submitting && onClose?.()}
    >
      <div
        className="ipm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ipm-modal-title"
      >
        {/* Colorful Header */}
        <div className="ipm-header">
          <div className="ipm-header-left">
            <div className="ipm-header-icon">
              <Wallet size={18} />
            </div>
            <div className="ipm-header-text">
              <h3 id="ipm-modal-title">Invoice &amp; Payment Settlement</h3>
              <div className="ipm-meta-pills">
                <span className="ipm-pill invoice">{invNumber}</span>
                <span className="ipm-pill customer">
                  {activeInv.customer_name || "Customer"}
                </span>
                {hasQuotation ? (
                  <span className="ipm-pill quotation">
                    <CheckCircle2 size={11} />
                    Quotation Accepted{quotationRef ? ` • ${quotationRef}` : ""}
                  </span>
                ) : (
                  <span className="ipm-pill direct">Direct Invoice</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="ipm-close-btn"
            onClick={() => !submitting && onClose?.()}
            aria-label="Close settlement modal"
          >
            <X size={17} />
          </button>
        </div>

        {/* Scrollable Compact Body */}
        <div className="ipm-body">
          {/* 3 Summary Boxes (Total Due, Total Paid, Balance Remaining) */}
          <div className="ipm-kpi-grid">
            <div className="ipm-kpi-card due">
              <span className="ipm-kpi-label">Total Due</span>
              <strong className="ipm-kpi-value">
                {formatCurrency(metrics.totalDue, currency)}
              </strong>
            </div>

            <div className="ipm-kpi-card paid">
              <span className="ipm-kpi-label">Total Paid</span>
              <strong className="ipm-kpi-value">
                {formatCurrency(metrics.totalPaid, currency)}
              </strong>
            </div>

            <div
              className={`ipm-kpi-card ${
                metrics.balanceRemaining <= 0 ? "settled" : "remaining"
              }`}
            >
              <span className="ipm-kpi-label">Balance Remaining</span>
              <strong className="ipm-kpi-value">
                {formatCurrency(metrics.balanceRemaining, currency)}
              </strong>
              {metrics.validCurrentPay > 0 && !metrics.exceedsRemaining && (
                <span className="ipm-kpi-preview">
                  After pay: {formatCurrency(metrics.projectedRemaining, currency)}
                </span>
              )}
            </div>
          </div>

          {/* Settlement Progress Bar */}
          <div className="ipm-progress-box">
            <div className="ipm-progress-head">
              <span className="ipm-progress-title">Settlement Progress</span>
              <div className="ipm-progress-badges">
                {metrics.pendingAmount > 0 && (
                  <span className="ipm-pending-chip">
                    <Clock3 size={11} /> Pending:{" "}
                    {formatCurrency(metrics.pendingAmount, currency)}
                  </span>
                )}
                <span
                  className={`ipm-pct-badge ${
                    metrics.settledPct >= 100
                      ? "done"
                      : metrics.settledPct > 0
                        ? "partial"
                        : "zero"
                  }`}
                >
                  {metrics.settledPct >= 100
                    ? "100% Settled"
                    : `${metrics.settledPct}% Paid`}
                </span>
              </div>
            </div>

            <div className="ipm-progress-track">
              {metrics.validCurrentPay > 0 &&
                !metrics.exceedsRemaining &&
                metrics.projectedPct > metrics.settledPct && (
                  <div
                    className="ipm-progress-projected"
                    style={{ width: `${metrics.projectedPct}%` }}
                  />
                )}
              <div
                className="ipm-progress-fill"
                style={{ width: `${metrics.settledPct}%` }}
              />
            </div>
          </div>

          {/* Feedback & Error Alerts */}
          {formError && (
            <div className="ipm-alert error" role="alert">
              <AlertCircle size={14} />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="ipm-alert success" role="status">
              <CheckCircle2 size={14} />
              <span>{formSuccess}</span>
            </div>
          )}

          {/* Compact Payment Update Form */}
          {metrics.balanceRemaining > 0 ? (
            <form onSubmit={handleSubmit} className="ipm-form-card">
              <div className="ipm-section-head">
                <span>Add Payment Settlement</span>
              </div>

              {/* Payment Method Modern Dropdown */}
              <div className="ipm-field">
                <label className="ipm-label">Payment Method</label>
                <div className="ipm-dropdown-wrap" ref={methodMenuRef}>
                  {(() => {
                    const currentOpt =
                      PAYMENT_METHOD_OPTIONS.find(
                        (o) => o.value === paymentMethod
                      ) || PAYMENT_METHOD_OPTIONS[0];
                    const CurrentIcon = currentOpt.icon;
                    return (
                      <button
                        type="button"
                        className={`ipm-dropdown-btn ${
                          methodMenuOpen ? "open" : ""
                        }`}
                        onClick={() => setMethodMenuOpen((prev) => !prev)}
                        aria-expanded={methodMenuOpen}
                        aria-haspopup="listbox"
                      >
                        <span className="ipm-dropdown-btn-left">
                          <CurrentIcon size={13} />
                          <span>{currentOpt.label}</span>
                        </span>
                        <ChevronDown
                          size={14}
                          className={`ipm-dropdown-chevron ${
                            methodMenuOpen ? "open" : ""
                          }`}
                        />
                      </button>
                    );
                  })()}

                  {methodMenuOpen && (
                    <div className="ipm-dropdown-menu" role="listbox">
                      {PAYMENT_METHOD_OPTIONS.map(
                        ({ value, label, icon: Icon }) => {
                          const isSelected = paymentMethod === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              className={`ipm-dropdown-item ${
                                isSelected ? "selected" : ""
                              }`}
                              onClick={() => {
                                setPaymentMethod(value);
                                setMethodMenuOpen(false);
                              }}
                            >
                              <span className="ipm-dropdown-item-left">
                                <Icon size={13} />
                                <span>{label}</span>
                              </span>
                              {isSelected && (
                                <Check size={13} className="ipm-dropdown-check" />
                              )}
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="ipm-grid-2">
                <div className="ipm-field">
                  <label className="ipm-label">Amount ({currency}) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={metrics.balanceRemaining}
                    value={paymentAmount}
                    onChange={(e) => {
                      setPaymentAmount(e.target.value);
                      if (formError) setFormError("");
                    }}
                    placeholder="0.00"
                    className={`ipm-input ${
                      metrics.exceedsRemaining ? "invalid" : ""
                    }`}
                    required
                  />
                  {metrics.exceedsRemaining && (
                    <span className="ipm-inline-err">
                      Exceeds remaining balance
                    </span>
                  )}
                </div>

                <div className="ipm-field">
                  <label className="ipm-label">Payment Date *</label>
                  <div className="ipm-date-wrap">
                    <Calendar size={13} className="ipm-date-icon" />
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="ipm-input with-icon"
                      required
                    />
                  </div>
                </div>

                <div className="ipm-field">
                  <label className="ipm-label">Reference #</label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="TXN / Bank / Card Ref"
                    className="ipm-input"
                  />
                </div>

                <div className="ipm-field">
                  <label className="ipm-label">Notes</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Advance / Part / Final"
                    className="ipm-input"
                  />
                </div>
              </div>

              {/* Compact Payment Slip Upload */}
              <div className="ipm-slip-row">
                <label className="ipm-upload-btn">
                  <Upload size={13} />
                  <span>{slipFile ? "Change Slip" : "Upload Slip (Optional)"}</span>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,image/*,application/pdf"
                    onChange={handleSlipChange}
                    hidden
                  />
                </label>

                {slipFile ? (
                  <div className="ipm-slip-chip">
                    {slipPreviewUrl ? (
                      <img
                        src={slipPreviewUrl}
                        alt="Slip preview"
                        className="ipm-slip-thumb"
                      />
                    ) : isPdfPath(slipFile.name) ? (
                      <FileText size={13} />
                    ) : (
                      <ImageIcon size={13} />
                    )}
                    <span className="ipm-slip-name">{slipFile.name}</span>
                    <button
                      type="button"
                      className="ipm-slip-remove"
                      onClick={clearSlip}
                      aria-label="Remove slip"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <span className="ipm-slip-hint">PNG, JPG, PDF (max 5MB)</span>
                )}

                <button
                  type="submit"
                  className="ipm-submit-btn"
                  disabled={
                    submitting ||
                    metrics.exceedsRemaining ||
                    Number(paymentAmount) <= 0
                  }
                >
                  {submitting
                    ? "Saving..."
                    : isSuperAdmin
                      ? "Add Payment"
                      : "Submit for Approval"}
                </button>
              </div>
            </form>
          ) : (
            <div className="ipm-settled-banner">
              <CheckCircle2 size={16} />
              <span>
                This invoice is <strong>100% settled</strong>. All due amounts
                have been paid.
              </span>
            </div>
          )}

          {/* Transaction History Section */}
          <div className="ipm-history-card">
            <div className="ipm-history-head">
              <div className="ipm-history-title">
                <History size={14} />
                <span>Transaction History</span>
                <span className="ipm-history-count">{transactions.length}</span>
              </div>
              {loadingHistory && (
                <span className="ipm-history-loading">Updating...</span>
              )}
            </div>

            {transactions.length === 0 ? (
              <div className="ipm-history-empty">
                No payment transactions recorded for this invoice yet.
              </div>
            ) : (
              <div className="ipm-history-list">
                {transactions.map((tx, idx) => {
                  const txStatus = String(tx.status || "Approved");
                  const statusTone =
                    txStatus === "Approved"
                      ? "approved"
                      : txStatus === "Rejected"
                        ? "rejected"
                        : "pending";
                  const methodTone = getMethodTone(tx.payment_method);
                  const canDelete =
                    isSuperAdmin || txStatus === "Pending Verification";

                  return (
                    <div
                      key={tx.payment_id || idx}
                      className="ipm-tx-row"
                    >
                      <div className="ipm-tx-left">
                        <div className="ipm-tx-top">
                          <strong className="ipm-tx-num">
                            {tx.payment_number || `PAY-${tx.payment_id}`}
                          </strong>
                          <span className={`ipm-tx-method ${methodTone}`}>
                            {tx.payment_method || "Bank Transfer"}
                          </span>
                          <span className={`ipm-tx-status ${statusTone}`}>
                            {txStatus}
                          </span>
                        </div>

                        <div className="ipm-tx-sub">
                          <span>{formatDate(tx.payment_date)}</span>
                          {(tx.reference_number || tx.reference) && (
                            <span>
                              • Ref: {tx.reference_number || tx.reference}
                            </span>
                          )}
                          {(tx.description || tx.notes) && (
                            <span>• {tx.description || tx.notes}</span>
                          )}
                          {tx.payment_slip && (
                            <a
                              href={resolveSlipUrl(tx.payment_slip)}
                              target="_blank"
                              rel="noreferrer"
                              className="ipm-tx-slip-link"
                            >
                              <Paperclip size={11} />
                              <span>View Slip</span>
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="ipm-tx-right">
                        <strong className={`ipm-tx-amount ${statusTone}`}>
                          {formatCurrency(tx.amount, tx.currency || currency)}
                        </strong>
                        {canDelete && tx.payment_id && (
                          <button
                            type="button"
                            className="ipm-tx-delete"
                            onClick={() => handleDeleteTx(tx)}
                            disabled={deletingId === tx.payment_id}
                            title="Delete payment entry"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
