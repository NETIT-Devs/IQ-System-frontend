import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext, useLocation } from "react-router-dom";
import {
  Search,
  RefreshCw,
  Eye,
  Check,
  X,
  Clock3,
  FileText,
  AlertCircle,
  XCircle,
  CheckCircle2,
  Receipt,
  Layers,
  User,
  Filter,
  Menu,
  ChevronDown,
  Wallet,
  ExternalLink,
} from "lucide-react";
import API_BASE_URL from "../services/api";
import ThemeToggle from "../components/ThemeToggle";
import NotificationBell from "../components/NotificationBell";
import {
  getQuotations,
  getQuotationById,
  getCompanyDetails,
  getCustomers,
  approveQuotation,
  rejectQuotation,
  getNotifications,
  addNotification,
} from "../services/quotationService";
import {
  getInvoices,
  approveInvoice as approveInvoiceService,
  rejectInvoice as rejectInvoiceService,
} from "../services/invoiceService";
import {
  getPayments,
  approvePayment as approvePaymentService,
  rejectPayment as rejectPaymentService,
} from "../services/paymentService";
import { getAuthenticatedUser } from "../utils/authStorage";
import { openQuotationPdf } from "../utils/pdfGenerator";
import QuotationDetails from "./QuotationDetails";
import InvoiceDetails from "./InvoiceDetails";
import "./Approvals.css";

function formatCurrency(amount, currency = "LKR") {
  if (amount === null || amount === undefined || amount === "") {
    return "—";
  }

  const number = Number(amount);
  if (!Number.isFinite(number)) return "—";

  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "LKR",
    maximumFractionDigits: 2,
  }).format(number);
}

function formatDate(date) {
  if (!date) return "—";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return String(date);

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isSuperCreatorItem(item, currentUserId = null) {
  const role = String(
    item?.created_by_role || item?.creator_role || item?.creatorRole || ""
  )
    .trim()
    .toLowerCase();
  const name = String(item?.created_by_name || "").trim().toLowerCase();
  const createdBy = Number(item?.created_by);

  if (
    role.includes("super") ||
    name.includes("super admin") ||
    name.includes("super_admin")
  ) {
    return true;
  }
  if (createdBy === 2) {
    return true;
  }
  if (currentUserId && Number(currentUserId) === createdBy) {
    return true;
  }
  return false;
}

function getQuotationStatusCategory(quotation, currentUserId = null) {
  if (isSuperCreatorItem(quotation, currentUserId)) {
    return "super_admin";
  }

  const approval = String(quotation?.approval_status || "").trim().toLowerCase();
  const status = String(quotation?.status || "").trim().toLowerCase();

  // Admin submitted quotations
  if (approval === "approved" || status.includes("approv") || status.includes("accept")) {
    return "approved";
  }
  if (approval === "rejected" || status.includes("reject") || status.includes("declin")) {
    return "rejected";
  }
  if (status === "draft" && approval !== "pending") {
    return "draft";
  }
  if (approval === "pending" || status.includes("pending") || status === "sent") {
    return "pending";
  }

  return "draft";
}

function getInvoiceStatusCategory(invoice, currentUserId = null) {
  if (isSuperCreatorItem(invoice, currentUserId)) {
    return "super_admin";
  }

  const approval = String(invoice?.approval_status || "").trim().toLowerCase();
  const status = String(invoice?.status || invoice?.payment_status || "").trim().toLowerCase();

  if (approval === "approved" || status.includes("approv") || status === "paid" || status === "partial" || status === "unpaid") {
    if (approval === "pending" || status.includes("pending")) return "pending";
    if (approval === "rejected" || status.includes("reject")) return "rejected";
    if (status === "draft") return "draft";
    return "approved";
  }
  if (approval === "rejected" || status.includes("reject") || status.includes("declin")) {
    return "rejected";
  }
  if (status === "draft" && approval !== "pending") {
    return "draft";
  }
  if (approval === "pending" || status.includes("pending") || status === "sent") {
    return "pending";
  }

  return "draft";
}

function SummaryCard({ label, value, icon, note, tone = "blue", active = false, onClick }) {
  return (
    <article
      className={`approval-summary-card clickable ${active ? "active" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      title={`Click to view ${label}`}
    >
      <div className={`approval-summary-icon ${tone}`}>{icon}</div>
      <div className="approval-summary-info">
        <p>{label}</p>
        <strong>{value}</strong>
        {note && <span className="approval-card-note">{note}</span>}
      </div>
      {active && <span className="approval-card-indicator" />}
    </article>
  );
}

export default function Approvals() {
  const { openSidebar } = useOutletContext() || {};
  const location = useLocation();
  const user = getAuthenticatedUser();
  const role = String(user?.role || "").trim().toLowerCase();
  const isSuperAdmin = role === "super admin";

  const [activeTab, setActiveTab] = useState("quotations"); // "quotations" | "invoices" | "payments"
  const [statusFilter, setStatusFilter] = useState("pending"); // "pending" | "approved" | "rejected" | "draft" | "all"
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef(null);

  // Sync tab and filter from router navigation state (e.g. from notification clicks)
  useEffect(() => {
    if (location.state?.tab === "invoices") {
      setActiveTab("invoices");
      if (location.state?.status) {
        setInvoiceStatusFilter(location.state.status);
      }
    } else if (location.state?.tab === "payments") {
      setActiveTab("payments");
      if (location.state?.status) {
        setPaymentStatusFilter(location.state.status);
      }
    } else if (location.state?.tab === "quotations") {
      setActiveTab("quotations");
      if (location.state?.status) {
        setStatusFilter(location.state.status);
      }
    }
  }, [location.state]);

  // Invoice Approvals state
  const [allInvoices, setAllInvoices] = useState([]);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("pending"); // "pending" | "approved" | "rejected" | "draft" | "all"
  const [invoiceDropdownOpen, setInvoiceDropdownOpen] = useState(false);
  const invoiceDropdownRef = useRef(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [approvingInvoice, setApprovingInvoice] = useState(null);
  const [rejectingInvoice, setRejectingInvoice] = useState(null);
  const [invoiceRejectionReason, setInvoiceRejectionReason] = useState("");
  const [invoiceRejectionError, setInvoiceRejectionError] = useState("");

  // Payment Approvals state
  const [allPayments, setAllPayments] = useState([]);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("pending"); // "pending" | "approved" | "rejected" | "all"
  const [paymentDropdownOpen, setPaymentDropdownOpen] = useState(false);
  const paymentDropdownRef = useRef(null);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [viewingPayment, setViewingPayment] = useState(null);
  const [approvingPayment, setApprovingPayment] = useState(null);
  const [rejectingPayment, setRejectingPayment] = useState(null);
  const [paymentRejectionReason, setPaymentRejectionReason] = useState("");
  const [paymentRejectionError, setPaymentRejectionError] = useState("");

  useEffect(() => {
    function handleOutsideClick(e) {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(e.target)
      ) {
        setStatusDropdownOpen(false);
      }
      if (
        invoiceDropdownRef.current &&
        !invoiceDropdownRef.current.contains(e.target)
      ) {
        setInvoiceDropdownOpen(false);
      }
      if (
        paymentDropdownRef.current &&
        !paymentDropdownRef.current.contains(e.target)
      ) {
        setPaymentDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);
  const [allQuotations, setAllQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Modal states
  const [viewingPdfId, setViewingPdfId] = useState(null);
  const [viewingQuotation, setViewingQuotation] = useState(null);
  const [approvingQuotation, setApprovingQuotation] = useState(null);
  const [rejectingQuotation, setRejectingQuotation] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [records, notifications, invoicesList, paymentsList] = await Promise.all([
        getQuotations(),
        getNotifications().catch(() => []),
        getInvoices().catch(() => []),
        getPayments({ approval_queue: true }).catch(() => []),
      ]);

      const storedReasons = (() => {
        try {
          return JSON.parse(
            localStorage.getItem("iq_quotation_rejection_reasons") || "{}"
          );
        } catch {
          return {};
        }
      })();

      // Extract rejection reasons from notifications as well
      const notifReasonMap = {};
      if (Array.isArray(notifications)) {
        notifications.forEach((n) => {
          const refType = String(
            n.reference_type || n.referenceType || ""
          ).toLowerCase();
          const refId = n.reference_id || n.referenceId;
          if (refType === "quotation" && refId) {
            const msg = String(n.message || "");
            const match = msg.match(/:\s*"([^"]+)"/);
            if (match && match[1]) {
              notifReasonMap[refId] = match[1];
            }
          }
        });
      }

      const mergedQuotations = (Array.isArray(records) ? records : []).map(
        (q) => {
          const qId = q.quotation_id;
          const qNum = q.quotation_number;
          const existingReason = q.rejection_reason;
          const localReason =
            storedReasons[qId] || (qNum ? storedReasons[qNum] : null);
          const notifReason = notifReasonMap[qId];

          const finalReason =
            existingReason || localReason || notifReason || null;

          return {
            ...q,
            rejection_reason: finalReason,
          };
        }
      );

      setAllQuotations(mergedQuotations);
      setAllInvoices(Array.isArray(invoicesList) ? invoicesList : []);
      setAllPayments(Array.isArray(paymentsList) ? paymentsList : []);
    } catch (err) {
      console.error("Failed to load approvals data:", err);
      setError(
        err?.message || "Could not load approvals data from the backend."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener("iq-notifications-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("iq-notifications-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [loadData]);

  const currentSuperAdminId = isSuperAdmin ? user?.user_id || user?.id : null;

  // Overall counts for summary cards
  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let drafts = 0;

    allQuotations.forEach((q) => {
      if (isSuperCreatorItem(q, currentSuperAdminId)) return;
      const cat = getQuotationStatusCategory(q, currentSuperAdminId);
      if (cat === "pending") pending += 1;
      else if (cat === "approved") approved += 1;
      else if (cat === "rejected") rejected += 1;
      else if (cat === "draft") drafts += 1;
    });

    const totalRequests = pending + approved + rejected;

    return {
      total: totalRequests,
      pending,
      approved,
      rejected,
      drafts,
    };
  }, [allQuotations, currentSuperAdminId]);

  // Filter quotations by status filter & search query
  const filteredQuotations = useMemo(() => {
    const q = search.trim().toLowerCase();

    return allQuotations.filter((item) => {
      if (isSuperCreatorItem(item, currentSuperAdminId)) {
        return false;
      }
      const cat = getQuotationStatusCategory(item, currentSuperAdminId);
      // Draft quotations are not approval requests and should never appear in Approvals page or Total Requests
      if (cat === "draft" || cat === "super_admin") {
        return false;
      }
      if (statusFilter !== "all" && cat !== statusFilter) {
        return false;
      }

      if (!q) return true;

      const num = item.quotation_number || "";
      const client = item.customer_name || item.client_name || "";
      const proj =
        item.items?.[0]?.website_type ||
        item.items?.[0]?.item_name ||
        item.project_name ||
        "";
      const createdBy = item.created_by_name || String(item.created_by || "");
      const reason = item.rejection_reason || "";

      return (
        num.toLowerCase().includes(q) ||
        client.toLowerCase().includes(q) ||
        proj.toLowerCase().includes(q) ||
        createdBy.toLowerCase().includes(q) ||
        reason.toLowerCase().includes(q)
      );
    });
  }, [allQuotations, statusFilter, search, currentSuperAdminId]);

  const headingInfo = useMemo(() => {
    switch (statusFilter) {
      case "approved":
        return {
          title: "Approved Quotations History",
          subtitle: "Quotations reviewed and approved by the Super Admin.",
          badge: `${filteredQuotations.length} Approved`,
        };
      case "rejected":
        return {
          title: "Rejected Quotations History",
          subtitle: "Quotations rejected by the Super Admin with specific feedback and revision notes.",
          badge: `${filteredQuotations.length} Rejected`,
        };
      case "draft":
        return {
          title: "Draft Quotations",
          subtitle: "Quotations currently saved as drafts and not yet submitted for approval.",
          badge: `${filteredQuotations.length} Drafts`,
        };
      case "all":
        return {
          title: "All Quotations Approvals History",
          subtitle: "Comprehensive review trail of all quotations across all review statuses.",
          badge: `${filteredQuotations.length} Total`,
        };
      case "pending":
      default:
        return {
          title: "Pending Quotations Awaiting Approval",
          subtitle: "Quotations submitted by administrators that require your review and decision.",
          badge: `${filteredQuotations.length} Pending`,
        };
    }
  }, [statusFilter, filteredQuotations.length]);

  // Overall counts for Invoice summary cards
  const invoiceStats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let drafts = 0;

    allInvoices.forEach((inv) => {
      if (isSuperCreatorItem(inv, currentSuperAdminId)) return;
      const cat = getInvoiceStatusCategory(inv, currentSuperAdminId);
      if (cat === "pending") pending += 1;
      else if (cat === "approved") approved += 1;
      else if (cat === "rejected") rejected += 1;
      else if (cat === "draft") drafts += 1;
    });

    const totalRequests = pending + approved + rejected;

    return {
      total: totalRequests,
      pending,
      approved,
      rejected,
      drafts,
    };
  }, [allInvoices, currentSuperAdminId]);

  // Filter invoices by status filter & search query
  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();

    return allInvoices.filter((item) => {
      if (isSuperCreatorItem(item, currentSuperAdminId)) {
        return false;
      }
      const cat = getInvoiceStatusCategory(item, currentSuperAdminId);
      // Draft invoices are not approval requests and should never appear in Approvals page or Total Requests
      if (cat === "draft" || cat === "super_admin") {
        return false;
      }
      if (invoiceStatusFilter !== "all" && cat !== invoiceStatusFilter) {
        return false;
      }

      if (!q) return true;

      const num = item.invoice_number || "";
      const client = item.customer_name || item.client_name || "";
      const proj =
        item.items?.[0]?.website_type ||
        item.items?.[0]?.item_name ||
        item.project_name ||
        "";
      const createdBy = item.created_by_name || String(item.created_by || "");
      const reason = item.rejection_reason || "";

      return (
        num.toLowerCase().includes(q) ||
        client.toLowerCase().includes(q) ||
        proj.toLowerCase().includes(q) ||
        createdBy.toLowerCase().includes(q) ||
        reason.toLowerCase().includes(q)
      );
    });
  }, [allInvoices, invoiceStatusFilter, invoiceSearch]);

  const invoiceHeadingInfo = useMemo(() => {
    switch (invoiceStatusFilter) {
      case "approved":
        return {
          title: "Approved Invoices History",
          subtitle: "Invoices reviewed and approved by the Super Admin.",
          badge: `${filteredInvoices.length} Approved`,
        };
      case "rejected":
        return {
          title: "Rejected Invoices History",
          subtitle: "Invoices rejected by the Super Admin with specific feedback and revision notes.",
          badge: `${filteredInvoices.length} Rejected`,
        };
      case "draft":
        return {
          title: "Draft Invoices",
          subtitle: "Invoices currently saved as drafts and not yet submitted for approval.",
          badge: `${filteredInvoices.length} Drafts`,
        };
      case "all":
        return {
          title: "All Invoices Approvals History",
          subtitle: "Comprehensive review trail of all invoices across all review statuses.",
          badge: `${filteredInvoices.length} Total`,
        };
      case "pending":
      default:
        return {
          title: "Pending Invoices Awaiting Approval",
          subtitle: "Invoices submitted by administrators that require your review and decision.",
          badge: `${filteredInvoices.length} Pending`,
        };
    }
  }, [invoiceStatusFilter, filteredInvoices.length]);

  // Approve Invoice handler
  const paymentStats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    allPayments.forEach((p) => {
      const s = String(p?.status || "").trim().toLowerCase();
      if (s === "approved") approved += 1;
      else if (s === "rejected") rejected += 1;
      else pending += 1;
    });

    return {
      total: pending + approved + rejected,
      pending,
      approved,
      rejected,
    };
  }, [allPayments]);

  const filteredPayments = useMemo(() => {
    const q = paymentSearch.trim().toLowerCase();

    return allPayments.filter((p) => {
      const s = String(p?.status || "").trim().toLowerCase();
      const cat = s === "approved" ? "approved" : s === "rejected" ? "rejected" : "pending";
      if (paymentStatusFilter !== "all" && cat !== paymentStatusFilter) {
        return false;
      }

      if (!q) return true;

      const payNum = p.payment_number || "";
      const invNum = p.invoice_number || "";
      const client = p.customer_name || "";
      const method = p.payment_method || "";
      const recordedBy = p.recorded_by_name || "";
      const reason = p.rejection_reason || "";

      return (
        payNum.toLowerCase().includes(q) ||
        invNum.toLowerCase().includes(q) ||
        client.toLowerCase().includes(q) ||
        method.toLowerCase().includes(q) ||
        recordedBy.toLowerCase().includes(q) ||
        reason.toLowerCase().includes(q)
      );
    });
  }, [allPayments, paymentStatusFilter, paymentSearch]);

  const paymentHeadingInfo = useMemo(() => {
    switch (paymentStatusFilter) {
      case "approved":
        return {
          title: "Approved Payments History",
          subtitle: "Payments verified by Super Admin and applied to invoice balances.",
          badge: `${filteredPayments.length} Approved`,
        };
      case "rejected":
        return {
          title: "Rejected Payments History",
          subtitle: "Payments rejected by Super Admin with feedback notes.",
          badge: `${filteredPayments.length} Rejected`,
        };
      case "all":
        return {
          title: "All Payment Approvals History",
          subtitle: "Complete trail of payment verification requests submitted by administrators.",
          badge: `${filteredPayments.length} Total`,
        };
      case "pending":
      default:
        return {
          title: "Pending Payments Awaiting Approval",
          subtitle: "Payments recorded by administrators awaiting Super Admin verification.",
          badge: `${filteredPayments.length} Pending`,
        };
    }
  }, [paymentStatusFilter, filteredPayments.length]);

  const handleApprovePayment = (payment) => {
    if (!isSuperAdmin) {
      setFeedback("Only Super Admin can authorize payment approvals.");
      return;
    }
    setApprovingPayment(payment);
  };

  const handleConfirmApprovePayment = async () => {
    if (!approvingPayment) return;
    const payment = approvingPayment;
    const payId = payment.payment_id;
    const payNum = payment.payment_number || `PAY-${payId}`;
    const invNum = payment.invoice_number || `INV-${payment.invoice_id}`;

    try {
      setActionLoading(true);
      setFeedback("");
      await approvePaymentService(payId);

      try {
        await addNotification({
          title: `Payment Approved: ${payNum}`,
          message: `Payment ${payNum} (${formatCurrency(payment.amount, payment.currency)}) for Invoice ${invNum} was approved by Super Admin. Invoice balance updated automatically.`,
          type: "success",
          reference_type: "payment",
          reference_id: payId,
          target_role: "admin",
          target_user_id: payment.received_by,
          created_by: user?.user_id || user?.id,
          created_by_name: user?.name || "Super Admin",
        });
      } catch (err) {
        console.warn("Could not dispatch payment approval notification:", err);
      }

      setApprovingPayment(null);
      setFeedback(`Payment ${payNum} approved and invoice ${invNum} updated!`);
      await loadData();
    } catch (err) {
      setFeedback(err.message || "Failed to approve payment.");
      setApprovingPayment(null);
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectPaymentModal = (payment) => {
    setRejectingPayment(payment);
    setPaymentRejectionReason("");
    setPaymentRejectionError("");
  };

  const handleConfirmRejectPayment = async () => {
    if (!paymentRejectionReason.trim()) {
      setPaymentRejectionError("Please provide a rejection reason for the admin.");
      return;
    }

    const payment = rejectingPayment;
    const payId = payment.payment_id;
    const payNum = payment.payment_number || `PAY-${payId}`;
    const invNum = payment.invoice_number || `INV-${payment.invoice_id}`;
    const cleanReason = paymentRejectionReason.trim();

    try {
      setActionLoading(true);
      setPaymentRejectionError("");
      await rejectPaymentService(payId, cleanReason);

      try {
        await addNotification({
          title: `Payment Rejected: ${payNum}`,
          message: `Payment ${payNum} for Invoice ${invNum} was rejected. Reason: "${cleanReason}".`,
          type: "error",
          reference_type: "payment",
          reference_id: payId,
          target_role: "admin",
          target_user_id: payment.received_by,
          created_by: user?.user_id || user?.id,
          created_by_name: user?.name || "Super Admin",
        });
      } catch (err) {
        console.warn("Could not dispatch payment rejection notification:", err);
      }

      setRejectingPayment(null);
      setFeedback(`Payment ${payNum} has been rejected.`);
      await loadData();
    } catch (err) {
      setPaymentRejectionError(err.message || "Failed to reject payment.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveInvoice = (invoice) => {
    if (!isSuperAdmin) {
      setFeedback("Only Super Admin can authorize invoice approvals.");
      return;
    }
    setApprovingInvoice(invoice);
  };

  const handleConfirmApproveInvoice = async () => {
    if (!approvingInvoice) return;
    const invoice = approvingInvoice;
    const invId = invoice.invoice_id || invoice.id;
    const invNum = invoice.invoice_number || `ID #${invId}`;
    const clientName =
      invoice.customer_name || invoice.client_name || "client";

    try {
      setActionLoading(true);
      setFeedback("");
      await approveInvoiceService(invId);

      // Dispatch real-time notification to the creator admin
      try {
        await addNotification({
          title: `Invoice Approved: ${invNum}`,
          message: `Your invoice ${invNum} for ${clientName} has been approved and issued by Super Admin.`,
          type: "success",
          reference_type: "invoice",
          reference_id: invId,
          target_role: "admin",
          target_user_id: invoice.created_by,
          created_by: user?.user_id || user?.id,
          created_by_name: user?.name || "Super Admin",
        });
      } catch (err) {
        console.warn("Could not dispatch approval notification:", err);
      }

      setApprovingInvoice(null);
      setFeedback(`Invoice ${invNum} has been approved successfully!`);
      await loadData();
    } catch (err) {
      setFeedback(err.message || "Failed to approve invoice.");
      setApprovingInvoice(null);
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Invoice handler
  const openRejectInvoiceModal = (invoice) => {
    setRejectingInvoice(invoice);
    setInvoiceRejectionReason("");
    setInvoiceRejectionError("");
  };

  const handleConfirmRejectInvoice = async () => {
    if (!invoiceRejectionReason.trim()) {
      setInvoiceRejectionError("Please provide a rejection reason / feedback for the admin.");
      return;
    }

    const invoice = rejectingInvoice;
    const invId = invoice.invoice_id || invoice.id;
    const invNum = invoice.invoice_number || `ID #${invId}`;
    const clientName =
      invoice.customer_name || invoice.client_name || "client";
    const cleanReason = invoiceRejectionReason.trim();

    try {
      setActionLoading(true);
      setInvoiceRejectionError("");
      await rejectInvoiceService(invId, cleanReason);

      // Dispatch real-time notification to creator admin
      try {
        await addNotification({
          title: `Invoice Rejected: ${invNum}`,
          message: `Your invoice ${invNum} for ${clientName} was rejected. Reason: "${cleanReason}".`,
          type: "error",
          reference_type: "invoice",
          reference_id: invId,
          target_role: "admin",
          target_user_id: invoice.created_by,
          created_by: user?.user_id || user?.id,
          created_by_name: user?.name || "Super Admin",
        });
      } catch (err) {
        console.warn("Could not dispatch rejection notification:", err);
      }

      setRejectingInvoice(null);
      setFeedback(`Invoice ${invNum} has been rejected.`);
      await loadData();
    } catch (err) {
      setInvoiceRejectionError(err.message || "Failed to reject invoice.");
    } finally {
      setActionLoading(false);
    }
  };


  // View Quotation PDF directly
  const handleViewPdf = async (quotation) => {
    const rawId = quotation.quotation_id || quotation.id;
    const previewWindow = window.open("about:blank", "_blank");
    if (previewWindow) {
      previewWindow.document.write(
        `<!DOCTYPE html><html><head><title>Loading Quotation PDF...</title><style>body{background:#0b1932;color:#ffffff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;} .spinner{width:36px;height:36px;border:3px solid rgba(255,255,255,0.2);border-top-color:#38bdf8;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;} @keyframes spin{to{transform:rotate(360deg);}}</style></head><body><div style="text-align:center"><div class="spinner"></div><p style="font-size:16px;font-weight:600;margin:0 0 6px;">Opening Quotation PDF...</p><p style="color:#94a3b8;font-size:13px;margin:0;">Please wait while the PDF is prepared.</p></div></body></html>`
      );
    }

    try {
      setViewingPdfId(rawId);

      let targetQuotation = quotation;
      try {
        const full = await getQuotationById(rawId);
        if (full) targetQuotation = full;
      } catch (e) {
        console.warn("Could not fetch full quotation details, using row data:", e);
      }

      let company = {};
      try {
        company = (await getCompanyDetails()) || {};
      } catch {
        // ignore
      }

      let customer = {};
      try {
        const customersList = await getCustomers();
        if (Array.isArray(customersList)) {
          customer =
            customersList.find(
              (c) => String(c.customer_id) === String(targetQuotation.customer_id)
            ) || {};
        }
      } catch {
        // ignore
      }

      const customerData = {
        customer_name:
          targetQuotation.customer_name ||
          targetQuotation.clientName ||
          customer.customer_name ||
          "",
        company_name:
          targetQuotation.customer_company ||
          targetQuotation.company_name ||
          customer.company_name ||
          "",
        email:
          targetQuotation.customer_email ||
          targetQuotation.email ||
          customer.email ||
          "",
        phone:
          targetQuotation.customer_phone ||
          targetQuotation.phone ||
          customer.phone ||
          "",
        address:
          targetQuotation.customer_address ||
          targetQuotation.address ||
          customer.address ||
          "",
      };

      const blobUrl = await openQuotationPdf(
        targetQuotation,
        company,
        customerData
      );

      if (previewWindow && !previewWindow.closed) {
        previewWindow.location.href = blobUrl;
      } else {
        window.open(blobUrl, "_blank");
      }
    } catch (err) {
      console.error("Failed to open quotation PDF:", err);
      if (previewWindow && !previewWindow.closed) {
        previewWindow.document.body.innerHTML = `<div style="text-align:center;padding:50px;color:#ef4444;font-family:sans-serif;"><h3>Failed to generate Quotation PDF</h3><p>${err?.message || "Please try again."}</p></div>`;
      }
      setFeedback("Failed to generate Quotation PDF. Please try again.");
    } finally {
      setViewingPdfId(null);
    }
  };

  // Open approve confirmation modal
  const handleApprove = (quotation) => {
    if (!isSuperAdmin) {
      setFeedback("Only Super Admin can authorize quotation approvals.");
      return;
    }
    setApprovingQuotation(quotation);
  };

  // Submit approve action
  const handleConfirmApprove = async () => {
    if (!approvingQuotation) return;
    const quotation = approvingQuotation;
    const qNum = quotation.quotation_number || `ID #${quotation.quotation_id}`;
    const clientName =
      quotation.customer_name || quotation.client_name || "client";

    try {
      setActionLoading(true);
      setFeedback("");
      const res = await approveQuotation(quotation.quotation_id);

      // Dispatch real-time notification to the creator admin
      try {
        await addNotification({
          title: `Quotation Approved: ${qNum}`,
          message: `Your quotation ${qNum} for ${clientName} has been approved by Super Admin.`,
          type: "success",
          reference_type: "quotation",
          reference_id: quotation.quotation_id,
          target_role: "admin",
          target_user_id: quotation.created_by,
          created_by: user?.user_id || user?.id,
          created_by_name: user?.name || "Super Admin",
        });
      } catch (err) {
        console.warn("Could not dispatch approval notification:", err);
      }

      setApprovingQuotation(null);
      setFeedback(
        res?.message || `Quotation ${qNum} has been approved successfully!`
      );
      await loadData();
    } catch (err) {
      setFeedback(err.message || "Failed to approve quotation.");
      setApprovingQuotation(null);
    } finally {
      setActionLoading(false);
    }
  };

  // Open reject modal
  const openRejectModal = (quotation) => {
    setRejectingQuotation(quotation);
    setRejectionReason("");
    setRejectionError("");
  };

  // Submit reject action
  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      setRejectionError("Please provide a rejection reason / feedback for the admin.");
      return;
    }

    const quotation = rejectingQuotation;
    const qNum = quotation.quotation_number || `ID #${quotation.quotation_id}`;
    const clientName =
      quotation.customer_name || quotation.client_name || "client";

    try {
      setActionLoading(true);
      setRejectionError("");
      const cleanReason = rejectionReason.trim();
      const res = await rejectQuotation(
        quotation.quotation_id,
        cleanReason
      );

      // Persist in localStorage so it instantly reflects in both Super Admin and Admin views
      try {
        const storedReasons = JSON.parse(
          localStorage.getItem("iq_quotation_rejection_reasons") || "{}"
        );
        storedReasons[quotation.quotation_id] = cleanReason;
        if (quotation.quotation_number) {
          storedReasons[quotation.quotation_number] = cleanReason;
        }
        localStorage.setItem(
          "iq_quotation_rejection_reasons",
          JSON.stringify(storedReasons)
        );
      } catch {
        // ignore storage errors
      }

      // Dispatch real-time notification to the creator admin
      try {
        await addNotification({
          title: `Quotation Rejected: ${qNum}`,
          message: `Your quotation ${qNum} for ${clientName} was rejected. Reason: "${cleanReason}".`,
          type: "error",
          reference_type: "quotation",
          reference_id: quotation.quotation_id,
          target_role: "admin",
          target_user_id: quotation.created_by,
          created_by: user?.user_id || user?.id,
          created_by_name: user?.name || "Super Admin",
        });
      } catch (err) {
        console.warn("Could not dispatch rejection notification:", err);
      }

      setRejectingQuotation(null);
      setFeedback(
        res?.message || `Quotation ${qNum} has been rejected.`
      );
      await loadData();
    } catch (err) {
      setRejectionError(err.message || "Failed to reject quotation.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main className="approvals-page">
      {/* Header bar */}
      <div className="approvals-header">
        <div className="approvals-header-left">
          {openSidebar && (
            <button
              type="button"
              className="approval-menu-button"
              aria-label="Open navigation menu"
              onClick={openSidebar}
            >
              <Menu size={20} />
            </button>
          )}
          <div>
            <p className="approvals-eyebrow">Administration / Approvals</p>
            <h1>Review &amp; Approvals</h1>
            <p className="approvals-subtitle">
              Authorize or reject admin submissions, verify project scope and pricing before clients receive documents.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ThemeToggle />
          <NotificationBell filter="all" />
          <button
            type="button"
            className="approval-btn-action approval-btn-refresh"
            onClick={loadData}
            disabled={loading}
            title="Refresh approvals queue"
            aria-label="Refresh approvals queue"
          >
            <RefreshCw size={17} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className="approval-feedback">
          <CheckCircle2 size={16} />
          <span>{feedback}</span>
          <button
            type="button"
            className="approval-btn-action"
            style={{ marginLeft: "auto", border: "none", background: "none" }}
            onClick={() => setFeedback("")}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="approval-error">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button
            type="button"
            onClick={loadData}
            style={{ marginLeft: "auto" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Modern Approvals Switcher Tabs */}
      <div className="approval-tabs-wrapper">
        <div className="approval-tabs-container" role="tablist" aria-label="Approval categories">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "quotations"}
            className={`approval-tab-card ${activeTab === "quotations" ? "active" : ""}`}
            onClick={() => setActiveTab("quotations")}
          >
            <div className="approval-tab-icon-box">
              <FileText size={16} />
            </div>
            <div className="approval-tab-info">
              <div className="approval-tab-label-group">
                <span className="approval-tab-label">Quotation Approvals</span>
                {stats.pending > 0 && (
                  <span className="approval-tab-count highlight">
                    <span className="approval-tab-dot" />
                    {stats.pending} Pending
                  </span>
                )}
              </div>
            </div>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "invoices"}
            className={`approval-tab-card ${activeTab === "invoices" ? "active" : ""}`}
            onClick={() => setActiveTab("invoices")}
          >
            <div className="approval-tab-icon-box">
              <Receipt size={16} />
            </div>
            <div className="approval-tab-info">
              <div className="approval-tab-label-group">
                <span className="approval-tab-label">Invoice Approvals</span>
                {invoiceStats.pending > 0 && (
                  <span className="approval-tab-count highlight">
                    <span className="approval-tab-dot" />
                    {invoiceStats.pending} Pending
                  </span>
                )}
              </div>
            </div>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "payments"}
            className={`approval-tab-card ${activeTab === "payments" ? "active" : ""}`}
            onClick={() => setActiveTab("payments")}
          >
            <div className="approval-tab-icon-box">
              <Wallet size={16} />
            </div>
            <div className="approval-tab-info">
              <div className="approval-tab-label-group">
                <span className="approval-tab-label">Payment Approvals</span>
                {paymentStats.pending > 0 && (
                  <span className="approval-tab-count highlight">
                    <span className="approval-tab-dot" />
                    {paymentStats.pending} Pending
                  </span>
                )}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Tab 1: Quotation Approvals */}
      {activeTab === "quotations" && (
        <>
          {/* Quotations Table Panel */}
          <section className="approval-panel">
            <div className="approval-toolbar">
              <label className="approval-search">
                <Search size={16} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by quotation #, client, project, or reason..."
                />
              </label>

              <div className="approval-filter-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11.5px", fontWeight: "650", color: "#64748b" }}>Status Filter:</span>
                <div className="approval-dropdown-wrap" ref={statusDropdownRef}>
                  <button
                    type="button"
                    className={`approval-dropdown-btn ${statusDropdownOpen ? "active" : ""}`}
                    onClick={() => setStatusDropdownOpen((prev) => !prev)}
                    aria-expanded={statusDropdownOpen}
                    aria-label="Filter quotations by approval status"
                  >
                    <span className="approval-dropdown-label">
                      {statusFilter === "approved"
                        ? `Approved Quotations (${stats.approved})`
                        : statusFilter === "rejected"
                          ? `Rejected Quotations (${stats.rejected})`
                          : statusFilter === "all"
                            ? `Total Requests (${stats.total})`
                            : `Pending Approvals (${stats.pending})`}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`approval-dropdown-chevron ${statusDropdownOpen ? "open" : ""}`}
                    />
                  </button>

                  {statusDropdownOpen && (
                    <div className="approval-dropdown-menu" role="listbox">
                      <div className="approval-dropdown-header">
                        <span>Filter by Approval Status</span>
                      </div>
                      <div className="approval-dropdown-list">
                        {[
                          { value: "pending", label: "Pending Approvals", count: stats.pending, color: "#f59e0b" },
                          { value: "approved", label: "Approved Quotations", count: stats.approved, color: "#16a34a" },
                          { value: "rejected", label: "Rejected Quotations", count: stats.rejected, color: "#dc2626" },
                          { value: "all", label: "Total Requests", count: stats.total, color: "#2563eb" },
                        ].map((opt) => {
                          const isSelected = statusFilter === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              className={`approval-dropdown-item ${isSelected ? "selected" : ""}`}
                              onClick={() => {
                                setStatusFilter(opt.value);
                                setStatusDropdownOpen(false);
                              }}
                            >
                              <div className="approval-dropdown-item-left">
                                <span
                                  className="approval-dropdown-dot"
                                  style={{ backgroundColor: opt.color }}
                                />
                                <span className="approval-dropdown-item-text">{opt.label}</span>
                              </div>
                              <div className="approval-dropdown-item-right">
                                <span className="approval-dropdown-badge">{opt.count}</span>
                                {isSelected && <Check size={14} className="approval-dropdown-check" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="approval-table-wrap">
              <table className="approval-table">
                <thead>
                  <tr>
                    <th>Quotation Number</th>
                    <th>Client Name</th>
                    <th>Project / Service</th>
                    <th>Amount</th>
                    <th>Created By</th>
                    <th>Date</th>
                    <th>Approval Status</th>
                    {(statusFilter === "rejected" || statusFilter === "all") && (
                      <th>Rejection Reason / Feedback</th>
                    )}
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={statusFilter === "rejected" || statusFilter === "all" ? 9 : 8} style={{ textAlign: "center", padding: "35px" }}>
                        Loading quotation records...
                      </td>
                    </tr>
                  ) : filteredQuotations.length === 0 ? (
                    <tr>
                      <td colSpan={statusFilter === "rejected" || statusFilter === "all" ? 9 : 8} style={{ textAlign: "center", padding: "40px" }}>
                        <div style={{ color: "#64748b", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                          {statusFilter === "approved" ? (
                            <>
                              <CheckCircle2 size={32} color="#15803d" />
                              <strong style={{ color: "#0f172a" }}>No Approved Quotations Found</strong>
                              <span>{search ? "No approved quotations match your search." : "No quotations have been approved yet."}</span>
                            </>
                          ) : statusFilter === "rejected" ? (
                            <>
                              <XCircle size={32} color="#dc2626" />
                              <strong style={{ color: "#0f172a" }}>No Rejected Quotations Found</strong>
                              <span>{search ? "No rejected quotations match your search." : "No quotations have been rejected yet."}</span>
                            </>
                          ) : statusFilter === "pending" ? (
                            <>
                              <CheckCircle2 size={32} color="#15803d" />
                              <strong style={{ color: "#0f172a" }}>No Pending Approvals</strong>
                              <span>{search ? "No pending quotations match your search." : "All quotation submissions have been reviewed."}</span>
                            </>
                          ) : (
                            <>
                              <FileText size={32} color="#64748b" />
                              <strong style={{ color: "#0f172a" }}>No Quotations Found</strong>
                              <span>No quotations match your selected filter or search term.</span>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredQuotations.map((q) => {
                      const amount = q.total_amount ?? q.grand_total ?? 0;
                      const websiteType =
                        q.items?.[0]?.website_type ||
                        q.items?.[0]?.item_name ||
                        "Software Project";
                      const client =
                        q.customer_name || q.client_name || "Client";
                      const createdBy =
                        q.created_by_role ||
                        (q.created_by === 2
                          ? "Super Admin"
                          : q.created_by === 1
                            ? "Admin"
                            : q.created_by_name || `User #${q.created_by || "—"}`);
                      const recordDate = formatDate(
                        q.updated_at || q.created_at || q.quotation_date
                      );
                      const cat = getQuotationStatusCategory(q);

                      return (
                        <tr key={q.quotation_id}>
                          <td style={{ fontWeight: 700, color: "#0f172a" }}>
                            {q.quotation_number}
                          </td>
                          <td>{client}</td>
                          <td>{websiteType}</td>
                          <td style={{ fontWeight: 700, color: "#1d4ed8" }}>
                            {formatCurrency(amount, q.currency)}
                          </td>
                          <td>{createdBy}</td>
                          <td>{recordDate}</td>
                          <td>
                            {cat === "pending" && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "#fef3c7",
                                  color: "#b45309",
                                  padding: "3px 8px",
                                  borderRadius: "7px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                }}
                              >
                                <Clock3 size={12} /> Pending Approval
                              </span>
                            )}
                            {cat === "approved" && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "#dcfce7",
                                  color: "#15803d",
                                  padding: "3px 8px",
                                  borderRadius: "7px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                }}
                              >
                                <Check size={12} /> Approved
                              </span>
                            )}
                            {cat === "rejected" && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                  padding: "3px 8px",
                                  borderRadius: "7px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                }}
                              >
                                <XCircle size={12} /> Rejected
                              </span>
                            )}
                            {cat === "draft" && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "#f1f5f9",
                                  color: "#475569",
                                  padding: "3px 8px",
                                  borderRadius: "7px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                }}
                              >
                                <FileText size={12} /> Draft
                              </span>
                            )}
                          </td>

                          {(statusFilter === "rejected" || statusFilter === "all") && (
                            <td style={{ maxWidth: "230px", fontSize: "11.5px", color: q.rejection_reason ? "#991b1b" : "#94a3b8" }}>
                              {q.rejection_reason ? (
                                <span title={q.rejection_reason} style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                  {q.rejection_reason}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          )}

                          <td style={{ textAlign: "right" }}>
                            <div className="approval-table-actions" style={{ justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                className="approval-btn-action approval-btn-view"
                                onClick={() => setViewingQuotation(q)}
                                title="View Quotation Details"
                              >
                                <Eye size={13} />
                                <span>View</span>
                              </button>

                              {cat === "pending" && (
                                <>
                                  <button
                                    type="button"
                                    className="approval-btn-action approval-btn-approve"
                                    onClick={() => handleApprove(q)}
                                    disabled={actionLoading}
                                    title="Approve quotation"
                                  >
                                    <Check size={13} />
                                    <span>Approve</span>
                                  </button>

                                  <button
                                    type="button"
                                    className="approval-btn-action approval-btn-reject"
                                    onClick={() => openRejectModal(q)}
                                    disabled={actionLoading}
                                    title="Reject quotation with reason"
                                  >
                                    <X size={13} />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Tab 2: Invoice Approvals */}
      {activeTab === "invoices" && (
        <>
          {/* Invoices Table Panel */}
          <section className="approval-panel">
            <div className="approval-toolbar">
              <label className="approval-search">
                <Search size={16} />
                <input
                  type="search"
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  placeholder="Search by invoice #, client, project, or reason..."
                />
              </label>

              <div className="approval-filter-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11.5px", fontWeight: "650", color: "#64748b" }}>Status Filter:</span>
                <div className="approval-dropdown-wrap" ref={invoiceDropdownRef}>
                  <button
                    type="button"
                    className={`approval-dropdown-btn ${invoiceDropdownOpen ? "active" : ""}`}
                    onClick={() => setInvoiceDropdownOpen((prev) => !prev)}
                    aria-expanded={invoiceDropdownOpen}
                    aria-label="Filter invoices by approval status"
                  >
                    <span className="approval-dropdown-label">
                      {invoiceStatusFilter === "approved"
                        ? `Approved Invoices (${invoiceStats.approved})`
                        : invoiceStatusFilter === "rejected"
                          ? `Rejected Invoices (${invoiceStats.rejected})`
                          : invoiceStatusFilter === "all"
                            ? `Total Requests (${invoiceStats.total})`
                            : `Pending Approvals (${invoiceStats.pending})`}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`approval-dropdown-chevron ${invoiceDropdownOpen ? "open" : ""}`}
                    />
                  </button>

                  {invoiceDropdownOpen && (
                    <div className="approval-dropdown-menu" role="listbox">
                      <div className="approval-dropdown-header">
                        <span>Filter by Approval Status</span>
                      </div>
                      <div className="approval-dropdown-list">
                        {[
                          { value: "pending", label: "Pending Approvals", count: invoiceStats.pending, color: "#f59e0b" },
                          { value: "approved", label: "Approved Invoices", count: invoiceStats.approved, color: "#16a34a" },
                          { value: "rejected", label: "Rejected Invoices", count: invoiceStats.rejected, color: "#dc2626" },
                          { value: "all", label: "Total Requests", count: invoiceStats.total, color: "#2563eb" },
                        ].map((opt) => {
                          const isSelected = invoiceStatusFilter === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              className={`approval-dropdown-item ${isSelected ? "selected" : ""}`}
                              onClick={() => {
                                setInvoiceStatusFilter(opt.value);
                                setInvoiceDropdownOpen(false);
                              }}
                            >
                              <div className="approval-dropdown-item-left">
                                <span
                                  className="approval-dropdown-dot"
                                  style={{ backgroundColor: opt.color }}
                                />
                                <span className="approval-dropdown-item-text">{opt.label}</span>
                              </div>
                              <div className="approval-dropdown-item-right">
                                <span className="approval-dropdown-badge">{opt.count}</span>
                                {isSelected && <Check size={14} className="approval-dropdown-check" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="approval-table-wrap">
              <table className="approval-table">
                <thead>
                  <tr>
                    <th>Invoice Number</th>
                    <th>Client Name</th>
                    <th>Project / Service</th>
                    <th>Amount</th>
                    <th>Created By</th>
                    <th>Date</th>
                    <th>Approval Status</th>
                    {(invoiceStatusFilter === "rejected" || invoiceStatusFilter === "all") && (
                      <th>Rejection Reason / Feedback</th>
                    )}
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={invoiceStatusFilter === "rejected" || invoiceStatusFilter === "all" ? 9 : 8} style={{ textAlign: "center", padding: "35px" }}>
                        Loading invoice records...
                      </td>
                    </tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={invoiceStatusFilter === "rejected" || invoiceStatusFilter === "all" ? 9 : 8} style={{ textAlign: "center", padding: "40px" }}>
                        <div style={{ color: "#64748b", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                          {invoiceStatusFilter === "approved" ? (
                            <>
                              <CheckCircle2 size={32} color="#15803d" />
                              <strong style={{ color: "#0f172a" }}>No Approved Invoices Found</strong>
                              <span>{invoiceSearch ? "No approved invoices match your search." : "No invoices have been approved yet."}</span>
                            </>
                          ) : invoiceStatusFilter === "rejected" ? (
                            <>
                              <XCircle size={32} color="#dc2626" />
                              <strong style={{ color: "#0f172a" }}>No Rejected Invoices Found</strong>
                              <span>{invoiceSearch ? "No rejected invoices match your search." : "No invoices have been rejected yet."}</span>
                            </>
                          ) : invoiceStatusFilter === "pending" ? (
                            <>
                              <CheckCircle2 size={32} color="#15803d" />
                              <strong style={{ color: "#0f172a" }}>No Pending Approvals</strong>
                              <span>{invoiceSearch ? "No pending invoices match your search." : "All invoice submissions have been reviewed."}</span>
                            </>
                          ) : (
                            <>
                              <Receipt size={32} color="#64748b" />
                              <strong style={{ color: "#0f172a" }}>No Invoices Found</strong>
                              <span>No invoices match your selected filter or search term.</span>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const amount = inv.total_amount ?? inv.grand_total ?? 0;
                      const serviceName =
                        inv.items?.[0]?.website_type ||
                        inv.items?.[0]?.item_name ||
                        inv.project_name ||
                        "Software Project";
                      const client =
                        inv.customer_name || inv.client_name || "Client";
                      const createdBy =
                        inv.created_by_role ||
                        (inv.created_by === 2
                          ? "Super Admin"
                          : inv.created_by === 1
                            ? "Admin"
                            : inv.created_by_name || `User #${inv.created_by || "—"}`);
                      const recordDate = formatDate(
                        inv.updated_at || inv.created_at || inv.invoice_date
                      );
                      const cat = getInvoiceStatusCategory(inv);

                      return (
                        <tr key={inv.invoice_id || inv.id}>
                          <td style={{ fontWeight: 700, color: "#0f172a" }}>
                            {inv.invoice_number || `INV-${inv.invoice_id || inv.id}`}
                          </td>
                          <td>{client}</td>
                          <td>{serviceName}</td>
                          <td style={{ fontWeight: 700, color: "#1d4ed8" }}>
                            {formatCurrency(amount, inv.currency)}
                          </td>
                          <td>{createdBy}</td>
                          <td>{recordDate}</td>
                          <td>
                            {cat === "pending" && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "#fef3c7",
                                  color: "#b45309",
                                  padding: "3px 8px",
                                  borderRadius: "7px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                }}
                              >
                                <Clock3 size={12} /> Pending Approval
                              </span>
                            )}
                            {cat === "approved" && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "#dcfce7",
                                  color: "#15803d",
                                  padding: "3px 8px",
                                  borderRadius: "7px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                }}
                              >
                                <Check size={12} /> Approved
                              </span>
                            )}
                            {cat === "rejected" && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                  padding: "3px 8px",
                                  borderRadius: "7px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                }}
                              >
                                <XCircle size={12} /> Rejected
                              </span>
                            )}
                            {cat === "draft" && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "#f1f5f9",
                                  color: "#475569",
                                  padding: "3px 8px",
                                  borderRadius: "7px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                }}
                              >
                                <FileText size={12} /> Draft
                              </span>
                            )}
                          </td>

                          {(invoiceStatusFilter === "rejected" || invoiceStatusFilter === "all") && (
                            <td style={{ maxWidth: "230px", fontSize: "11.5px", color: inv.rejection_reason ? "#991b1b" : "#94a3b8" }}>
                              {inv.rejection_reason ? (
                                <span title={inv.rejection_reason} style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                  {inv.rejection_reason}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          )}

                          <td style={{ textAlign: "right" }}>
                            <div className="approval-table-actions" style={{ justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                className="approval-btn-action approval-btn-view"
                                onClick={() => setViewingInvoice(inv)}
                                title="View Invoice Details"
                              >
                                <Eye size={13} />
                                <span>View</span>
                              </button>

                              {cat === "pending" && (
                                <>
                                  <button
                                    type="button"
                                    className="approval-btn-action approval-btn-approve"
                                    onClick={() => handleApproveInvoice(inv)}
                                    disabled={actionLoading}
                                    title="Approve invoice"
                                  >
                                    <Check size={13} />
                                    <span>Approve</span>
                                  </button>

                                  <button
                                    type="button"
                                    className="approval-btn-action approval-btn-reject"
                                    onClick={() => openRejectInvoiceModal(inv)}
                                    disabled={actionLoading}
                                    title="Reject invoice with reason"
                                  >
                                    <X size={13} />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Tab 3: Payment Approvals */}
      {activeTab === "payments" && (
        <>
          <section className="approval-panel">
            <div className="approval-toolbar">
              <label className="approval-search">
                <Search size={16} />
                <input
                  type="search"
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  placeholder="Search by payment #, invoice #, client, method..."
                />
              </label>

              <div className="approval-filter-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11.5px", fontWeight: "650", color: "#64748b" }}>Status Filter:</span>
                <div className="approval-dropdown-wrap" ref={paymentDropdownRef}>
                  <button
                    type="button"
                    className={`approval-dropdown-btn ${paymentDropdownOpen ? "active" : ""}`}
                    onClick={() => setPaymentDropdownOpen((prev) => !prev)}
                    aria-expanded={paymentDropdownOpen}
                    aria-label="Filter payments by approval status"
                  >
                    <span className="approval-dropdown-label">
                      {paymentStatusFilter === "approved"
                        ? `Approved Payments (${paymentStats.approved})`
                        : paymentStatusFilter === "rejected"
                          ? `Rejected Payments (${paymentStats.rejected})`
                          : paymentStatusFilter === "all"
                            ? `Total Requests (${paymentStats.total})`
                            : `Pending Approvals (${paymentStats.pending})`}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`approval-dropdown-chevron ${paymentDropdownOpen ? "open" : ""}`}
                    />
                  </button>

                  {paymentDropdownOpen && (
                    <div className="approval-dropdown-menu" role="listbox">
                      <div className="approval-dropdown-header">
                        <span>Filter by Approval Status</span>
                      </div>
                      <div className="approval-dropdown-list">
                        {[
                          { value: "pending", label: "Pending Approvals", count: paymentStats.pending, color: "#f59e0b" },
                          { value: "approved", label: "Approved Payments", count: paymentStats.approved, color: "#16a34a" },
                          { value: "rejected", label: "Rejected Payments", count: paymentStats.rejected, color: "#dc2626" },
                          { value: "all", label: "Total Requests", count: paymentStats.total, color: "#2563eb" },
                        ].map((opt) => {
                          const isSelected = paymentStatusFilter === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              className={`approval-dropdown-item ${isSelected ? "selected" : ""}`}
                              onClick={() => {
                                setPaymentStatusFilter(opt.value);
                                setPaymentDropdownOpen(false);
                              }}
                            >
                              <div className="approval-dropdown-item-left">
                                <span
                                  className="approval-dropdown-dot"
                                  style={{ backgroundColor: opt.color }}
                                />
                                <span className="approval-dropdown-item-text">{opt.label}</span>
                              </div>
                              <div className="approval-dropdown-item-right">
                                <span className="approval-dropdown-badge">{opt.count}</span>
                                {isSelected && <Check size={14} className="approval-dropdown-check" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="approval-table-wrap">
              <table className="approval-table">
                <thead>
                  <tr>
                    <th>Payment #</th>
                    <th>Invoice #</th>
                    <th>Client Name</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Recorded By</th>
                    <th>Date</th>
                    <th>Status</th>
                    {(paymentStatusFilter === "rejected" || paymentStatusFilter === "all") && (
                      <th>Rejection Reason</th>
                    )}
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={paymentStatusFilter === "rejected" || paymentStatusFilter === "all" ? 10 : 9} className="approval-empty">
                        Loading payment approvals...
                      </td>
                    </tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={paymentStatusFilter === "rejected" || paymentStatusFilter === "all" ? 10 : 9} className="approval-empty">
                        No {paymentStatusFilter === "all" ? "" : paymentStatusFilter} payment approval requests found.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => {
                      const s = String(p.status || "").trim().toLowerCase();
                      const cat = s === "approved" ? "approved" : s === "rejected" ? "rejected" : "pending";
                      const payNum = p.payment_number || `PAY-${p.payment_id}`;
                      const invNum = p.invoice_number || `INV-${p.invoice_id}`;

                      return (
                        <tr key={p.payment_id}>
                          <td>
                            <span className="approval-q-num">{payNum}</span>
                          </td>
                          <td>{invNum}</td>
                          <td>{p.customer_name || "—"}</td>
                          <td>{p.payment_method || "Bank Transfer"}</td>
                          <td>
                            <span className="approval-amount">
                              {formatCurrency(p.amount, p.currency || "LKR")}
                            </span>
                          </td>
                          <td>
                            <div className="approval-creator">
                              <User size={12} />
                              <span>{p.recorded_by_name || "Admin"}</span>
                            </div>
                          </td>
                          <td>{formatDate(p.payment_date || p.created_at)}</td>
                          <td>
                            <span className={`approval-status-badge ${cat}`}>
                              {cat === "approved"
                                ? "Approved"
                                : cat === "rejected"
                                  ? "Rejected"
                                  : "Pending Approval"}
                            </span>
                          </td>
                          {(paymentStatusFilter === "rejected" || paymentStatusFilter === "all") && (
                            <td style={{ maxWidth: "230px", fontSize: "11.5px", color: p.rejection_reason ? "#991b1b" : "#94a3b8" }}>
                              {p.rejection_reason ? (
                                <span title={p.rejection_reason}>{p.rejection_reason}</span>
                              ) : (
                                "—"
                              )}
                            </td>
                          )}
                          <td style={{ textAlign: "right" }}>
                            <div className="approval-table-actions" style={{ justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                className="approval-btn-action approval-btn-view"
                                onClick={() => setViewingPayment(p)}
                                title="View Payment Details"
                              >
                                <Eye size={13} />
                                <span>View</span>
                              </button>

                              {cat === "pending" && (
                                <>
                                  <button
                                    type="button"
                                    className="approval-btn-action approval-btn-approve"
                                    onClick={() => handleApprovePayment(p)}
                                    disabled={actionLoading}
                                    title="Approve payment & update invoice"
                                  >
                                    <Check size={13} />
                                    <span>Approve</span>
                                  </button>

                                  <button
                                    type="button"
                                    className="approval-btn-action approval-btn-reject"
                                    onClick={() => openRejectPaymentModal(p)}
                                    disabled={actionLoading}
                                    title="Reject payment with reason"
                                  >
                                    <X size={13} />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}


      {/* Invoice Details Modal */}
      {viewingInvoice && (
        <InvoiceDetails
          isOpen={Boolean(viewingInvoice)}
          onClose={() => setViewingInvoice(null)}
          invoice={viewingInvoice}
        />
      )}

      {/* Approve Invoice Confirmation Modal */}
      {approvingInvoice && (
        <div className="approval-confirm-overlay">
          <div className="approval-confirm-card">
            <div className="approval-confirm-header">
              <div className="approval-confirm-header-title">
                <CheckCircle2 size={18} color="#22c55e" />
                <h3>
                  Approve Invoice: {approvingInvoice.invoice_number || `ID #${approvingInvoice.invoice_id || approvingInvoice.id}`}
                </h3>
              </div>
              <button
                type="button"
                className="approval-modal-close-btn"
                onClick={() => setApprovingInvoice(null)}
                disabled={actionLoading}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="approval-confirm-body">
              <p className="approval-confirm-prompt">
                Are you sure you want to approve invoice{" "}
                <strong>{approvingInvoice.invoice_number || `ID #${approvingInvoice.invoice_id || approvingInvoice.id}`}</strong>?
              </p>

              <div className="approval-confirm-details">
                {approvingInvoice.customer_name && (
                  <div className="approval-confirm-row">
                    <span>Customer:</span>
                    <strong>{approvingInvoice.customer_name}</strong>
                  </div>
                )}
                {(approvingInvoice.grand_total || approvingInvoice.total_amount) && (
                  <div className="approval-confirm-row">
                    <span>Total Amount:</span>
                    <strong>
                      {formatCurrency(approvingInvoice.grand_total || approvingInvoice.total_amount)}
                    </strong>
                  </div>
                )}
              </div>

              <p className="approval-confirm-note">
                Once approved, this invoice will be officially authorized and marked as approved.
              </p>
            </div>

            <div className="approval-confirm-footer">
              <button
                type="button"
                className="approval-btn-action approval-btn-view"
                onClick={() => setApprovingInvoice(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="approval-btn-action approval-btn-approve"
                onClick={handleConfirmApproveInvoice}
                disabled={actionLoading}
              >
                <Check size={14} />
                <span>{actionLoading ? "Approving..." : "Approve"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Invoice Modal */}
      {rejectingInvoice && (
        <div className="approval-rejection-overlay">
          <div className="approval-rejection-card">
            <div className="approval-rejection-header">
              <h3>
                Reject Invoice: {rejectingInvoice.invoice_number || `ID #${rejectingInvoice.invoice_id || rejectingInvoice.id}`}
              </h3>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}
                onClick={() => setRejectingInvoice(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="approval-rejection-body">
              <p>
                Please state the specific reason or feedback for rejecting this invoice. The administrator will see this message and be able to revise and resubmit.
              </p>

              {invoiceRejectionError && (
                <div style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "#b91c1c", padding: "8px 12px", fontSize: "12px", marginBottom: "10px" }}>
                  {invoiceRejectionError}
                </div>
              )}

              <textarea
                rows={4}
                className="approval-rejection-textarea"
                placeholder="e.g. Please verify billing item details or tax amount..."
                value={invoiceRejectionReason}
                onChange={(e) => setInvoiceRejectionReason(e.target.value)}
                autoFocus
              />
            </div>

            <div className="approval-rejection-footer">
              <button
                type="button"
                className="approval-btn-action approval-btn-view"
                onClick={() => setRejectingInvoice(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="approval-btn-action approval-btn-reject"
                onClick={handleConfirmRejectInvoice}
                disabled={actionLoading}
              >
                {actionLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {viewingPayment && (
        <div
          className="approval-confirm-overlay"
          onClick={() => setViewingPayment(null)}
        >
          <div
            className="approval-confirm-card"
            style={{ maxWidth: "560px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="approval-confirm-header">
              <div className="approval-confirm-header-title">
                <Wallet size={18} color="#3b82f6" />
                <h3>
                  Payment Details:{" "}
                  {viewingPayment.payment_number || `PAY-${viewingPayment.payment_id}`}
                </h3>
              </div>
              <button
                type="button"
                className="approval-modal-close-btn"
                onClick={() => setViewingPayment(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="approval-confirm-body">
              <div className="approval-confirm-details">
                <div className="approval-confirm-row">
                  <span>Invoice Number:</span>
                  <strong>
                    {viewingPayment.invoice_number || `INV-${viewingPayment.invoice_id}`}
                  </strong>
                </div>
                <div className="approval-confirm-row">
                  <span>Client Name:</span>
                  <strong>{viewingPayment.customer_name || "—"}</strong>
                </div>
                <div className="approval-confirm-row">
                  <span>Payment Amount:</span>
                  <strong>
                    {formatCurrency(viewingPayment.amount, viewingPayment.currency || "LKR")}
                  </strong>
                </div>
                <div className="approval-confirm-row">
                  <span>Payment Method:</span>
                  <strong>{viewingPayment.payment_method || "—"}</strong>
                </div>
                <div className="approval-confirm-row">
                  <span>Payment Date:</span>
                  <strong>{formatDate(viewingPayment.payment_date)}</strong>
                </div>
                {viewingPayment.reference_number && (
                  <div className="approval-confirm-row">
                    <span>Reference #:</span>
                    <strong>{viewingPayment.reference_number}</strong>
                  </div>
                )}
                {viewingPayment.description && (
                  <div className="approval-confirm-row">
                    <span>Notes:</span>
                    <strong>{viewingPayment.description}</strong>
                  </div>
                )}
                {viewingPayment.payment_slip && (
                  <div className="approval-confirm-row">
                    <span>Payment Slip:</span>
                    <a
                      href={
                        /^https?:\/\//i.test(viewingPayment.payment_slip)
                          ? viewingPayment.payment_slip
                          : `${API_BASE_URL}${viewingPayment.payment_slip.startsWith("/") ? "" : "/"}${viewingPayment.payment_slip}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#2563eb", fontWeight: 700 }}
                    >
                      <span>View Slip</span>
                      <ExternalLink size={13} />
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="approval-confirm-footer">
              <button
                type="button"
                className="approval-btn-action approval-btn-view"
                onClick={() => setViewingPayment(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Payment Confirmation Modal */}
      {approvingPayment && (
        <div className="approval-confirm-overlay">
          <div className="approval-confirm-card">
            <div className="approval-confirm-header">
              <div className="approval-confirm-header-title">
                <CheckCircle2 size={18} color="#22c55e" />
                <h3>
                  Approve Payment:{" "}
                  {approvingPayment.payment_number || `PAY-${approvingPayment.payment_id}`}
                </h3>
              </div>
              <button
                type="button"
                className="approval-modal-close-btn"
                onClick={() => setApprovingPayment(null)}
                disabled={actionLoading}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="approval-confirm-body">
              <p className="approval-confirm-prompt">
                Are you sure you want to approve payment{" "}
                <strong>
                  {approvingPayment.payment_number || `PAY-${approvingPayment.payment_id}`}
                </strong>
                ?
              </p>

              <div className="approval-confirm-details">
                <div className="approval-confirm-row">
                  <span>Invoice:</span>
                  <strong>
                    {approvingPayment.invoice_number || `INV-${approvingPayment.invoice_id}`}
                  </strong>
                </div>
                <div className="approval-confirm-row">
                  <span>Customer:</span>
                  <strong>{approvingPayment.customer_name || "—"}</strong>
                </div>
                <div className="approval-confirm-row">
                  <span>Amount:</span>
                  <strong>
                    {formatCurrency(approvingPayment.amount, approvingPayment.currency || "LKR")}
                  </strong>
                </div>
              </div>

              <p className="approval-confirm-note">
                Once approved, the invoice paid amount, balance due, and status will be updated automatically.
              </p>
            </div>

            <div className="approval-confirm-footer">
              <button
                type="button"
                className="approval-btn-action approval-btn-view"
                onClick={() => setApprovingPayment(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="approval-btn-action approval-btn-approve"
                onClick={handleConfirmApprovePayment}
                disabled={actionLoading}
              >
                <Check size={14} />
                <span>{actionLoading ? "Approving..." : "Approve"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Payment Modal */}
      {rejectingPayment && (
        <div className="approval-rejection-overlay">
          <div className="approval-rejection-card">
            <div className="approval-rejection-header">
              <h3>
                Reject Payment:{" "}
                {rejectingPayment.payment_number || `PAY-${rejectingPayment.payment_id}`}
              </h3>
              <button
                type="button"
                className="approval-modal-close-btn"
                onClick={() => setRejectingPayment(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="approval-rejection-body">
              <p>
                Please state the reason for rejecting this payment so the administrator can review it.
              </p>

              {paymentRejectionError && (
                <div className="approval-rejection-error">
                  {paymentRejectionError}
                </div>
              )}

              <textarea
                className="approval-rejection-textarea"
                rows={4}
                placeholder="Enter rejection reason..."
                value={paymentRejectionReason}
                onChange={(e) => setPaymentRejectionReason(e.target.value)}
              />
            </div>

            <div className="approval-rejection-footer">
              <button
                type="button"
                className="approval-btn-action approval-btn-view"
                onClick={() => setRejectingPayment(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="approval-btn-action approval-btn-reject"
                onClick={handleConfirmRejectPayment}
                disabled={actionLoading}
              >
                {actionLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quotation Details Modal */}
      {viewingQuotation && (
        <QuotationDetails
          quotation={viewingQuotation}
          quotationId={viewingQuotation.quotation_id || viewingQuotation.id}
          onClose={() => setViewingQuotation(null)}
        />
      )}

      {/* Approve Confirmation Modal */}
      {approvingQuotation && (
        <div className="approval-confirm-overlay">
          <div className="approval-confirm-card">
            <div className="approval-confirm-header">
              <div className="approval-confirm-header-title">
                <CheckCircle2 size={18} color="#22c55e" />
                <h3>
                  Approve Quotation: {approvingQuotation.quotation_number || `ID #${approvingQuotation.quotation_id}`}
                </h3>
              </div>
              <button
                type="button"
                className="approval-modal-close-btn"
                onClick={() => setApprovingQuotation(null)}
                disabled={actionLoading}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="approval-confirm-body">
              <p className="approval-confirm-prompt">
                Are you sure you want to approve quotation{" "}
                <strong>{approvingQuotation.quotation_number || `ID #${approvingQuotation.quotation_id}`}</strong>?
              </p>

              <div className="approval-confirm-details">
                {approvingQuotation.customer_name && (
                  <div className="approval-confirm-row">
                    <span>Customer:</span>
                    <strong>{approvingQuotation.customer_name}</strong>
                  </div>
                )}
                {(approvingQuotation.grand_total || approvingQuotation.total_amount) && (
                  <div className="approval-confirm-row">
                    <span>Total Amount:</span>
                    <strong>
                      {formatCurrency(approvingQuotation.grand_total || approvingQuotation.total_amount)}
                    </strong>
                  </div>
                )}
              </div>

              <p className="approval-confirm-note">
                Once approved, this quotation will be officially authorized and marked as approved.
              </p>
            </div>

            <div className="approval-confirm-footer">
              <button
                type="button"
                className="approval-btn-action approval-btn-view"
                onClick={() => setApprovingQuotation(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="approval-btn-action approval-btn-approve"
                onClick={handleConfirmApprove}
                disabled={actionLoading}
              >
                <Check size={14} />
                <span>{actionLoading ? "Approving..." : "Approve"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingQuotation && (
        <div className="approval-rejection-overlay">
          <div className="approval-rejection-card">
            <div className="approval-rejection-header">
              <h3>
                Reject Quotation: {rejectingQuotation.quotation_number}
              </h3>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}
                onClick={() => setRejectingQuotation(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="approval-rejection-body">
              <p>
                Please state the specific reason or feedback for rejecting this quotation. The administrator will see this message and be able to revise and resubmit.
              </p>

              {rejectionError && (
                <div style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "#b91c1c", padding: "8px 12px", fontSize: "12px", marginBottom: "10px" }}>
                  {rejectionError}
                </div>
              )}

              <textarea
                rows={4}
                className="approval-rejection-textarea"
                placeholder="e.g. Scope item 2 requires clarification on hosting. Please update price..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                autoFocus
              />
            </div>

            <div className="approval-rejection-footer">
              <button
                type="button"
                className="approval-btn-action approval-btn-view"
                onClick={() => setRejectingQuotation(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="approval-btn-action approval-btn-reject"
                onClick={handleConfirmReject}
                disabled={actionLoading}
              >
                {actionLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
