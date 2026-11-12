import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Search,
  UserPlus,
  Star,
  CheckCircle2,
  Send,
  XCircle,
  Eye,
  Menu,
  Phone,
  Mail,
  X,
  Pencil,
  Trash2,
  FileText,
  Receipt,
  Calendar,
  Building2,
  MapPin,
  ChevronDown,
  Check,
} from "lucide-react";
import API_BASE_URL from "../services/api";
import ThemeToggle from "../components/ThemeToggle";
import {
  getCustomers,
  createCustomer,
  getQuotations,
  updateQuotationCustomerStatus,
  getSuperAdminCustomers,
  checkDuplicateCustomer,
} from "../services/quotationService";
import QuotationDetails from "./QuotationDetails";
import { getAuthenticatedUser } from "../utils/authStorage";
import "./Customers.css";

const PINNED_STORAGE_KEY = "iq_pinned_daily_customers";
const UNPINNED_STORAGE_KEY = "iq_unpinned_regular_customers";
const CUSTOMER_EDITS_STORAGE_KEY = "iq_customer_edits_v1";
const DELETED_CUSTOMERS_STORAGE_KEY = "iq_deleted_customer_ids_v1";
const LEGACY_DELETED_CUSTOMERS_STORAGE_KEY = "deletedCustomerIds";
const INVOICE_STATUS_STORAGE_KEY = "iq_customer_invoice_statuses_v1";

function normalizePhoneNumber(phone) {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "");
}

function isPhoneMatch(phone1, phone2) {
  const p1 = String(phone1 || "").trim();
  const p2 = String(phone2 || "").trim();
  if (!p1 || !p2) return false;
  if (p1.toLowerCase() === p2.toLowerCase()) return true;

  const d1 = normalizePhoneNumber(p1);
  const d2 = normalizePhoneNumber(p2);
  if (!d1 || !d2) return false;
  if (d1 === d2) return true;

  const minLen = Math.min(d1.length, d2.length);
  if (minLen >= 7) {
    const compareLen = Math.min(minLen, 9);
    return d1.slice(-compareLen) === d2.slice(-compareLen);
  }

  return false;
}

function isEmailMatch(email1, email2) {
  const e1 = String(email1 || "").trim().toLowerCase();
  const e2 = String(email2 || "").trim().toLowerCase();
  if (!e1 || !e2) return false;
  return e1 === e2;
}

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

function getPinnedCustomerIds() {
  return readJsonStorage(PINNED_STORAGE_KEY, []);
}

function savePinnedCustomerIds(ids) {
  writeJsonStorage(PINNED_STORAGE_KEY, ids);
}

function getAuthToken() {
  return (
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    ""
  );
}

function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `Rs. ${num.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const str = String(dateStr).trim();
    const d = str.includes("T") ? new Date(str) : new Date(`${str.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return str.slice(0, 10);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateStr);
  }
}

// Normalize Quotation status into Accepted, Sent, or Rejected
function classifyQuotationStatus(q) {
  const custStatus = String(q?.customer_status || "").trim().toLowerCase();

  if (
    custStatus === "customer accepted" ||
    custStatus === "accepted"
  ) {
    return "accepted";
  }
  if (
    custStatus === "customer rejected" ||
    custStatus === "rejected"
  ) {
    return "rejected";
  }
  if (
    custStatus === "sent to customer" ||
    custStatus === "sent"
  ) {
    return "sent";
  }
  return "not_sent";
}

// Normalize Invoice status into Paid, Partial, or Unpaid
function classifyInvoiceStatus(inv) {
  const raw = String(inv?.payment_status || inv?.status || "Unpaid")
    .trim()
    .toLowerCase();
  if (raw === "paid" || raw === "completed" || raw === "settled") {
    return "paid";
  }
  if (raw.includes("partial") || raw === "partly paid") {
    return "partial";
  }
  return "unpaid";
}

function getInvoiceApprovalStatus(inv) {
  const s = String(inv?.raw_status ?? inv?.status ?? "").trim().toLowerCase();
  const a = String(inv?.approval_status ?? "").trim().toLowerCase();
  if (s === "pending approval" || a === "pending") {
    return "Pending Approval";
  }
  if (s === "rejected" || a === "rejected") {
    return "Rejected";
  }
  if (s === "draft" || a === "draft") {
    return "Draft";
  }
  return "Approved";
}

export default function Customers() {
  const { openSidebar } = useOutletContext() || {};

  const authUser = getAuthenticatedUser();
  const isSuperAdmin =
    String(authUser?.role || "").trim().toLowerCase() === "super admin" ||
    authUser?.role === "super_admin";
  const userInitials = isSuperAdmin ? "SA" : "A";
  const userRoleTitle = isSuperAdmin ? "Super Admin" : "Admin";

  const [customers, setCustomers] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & 4 Filter Dropdowns
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all | regular | new
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive
  const [quoteStatusFilter, setQuoteStatusFilter] = useState("all"); // all | accepted | sent | rejected
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all"); // all | paid | partial | unpaid
  const [openFilterMenu, setOpenFilterMenu] = useState(null); // null | "type" | "status" | "quote" | "invoice"
  const filtersContainerRef = useRef(null);
  const [openBreakdown, setOpenBreakdown] = useState(null); // null | { customerId, type: "quotations" | "invoices", pinned, placement, top, bottom, left }
  const breakdownPopoverRef = useRef(null);
  const breakdownCloseTimerRef = useRef(null);

  function clearBreakdownCloseTimer() {
    if (breakdownCloseTimerRef.current) {
      clearTimeout(breakdownCloseTimerRef.current);
      breakdownCloseTimerRef.current = null;
    }
  }

  function scheduleBreakdownClose() {
    clearBreakdownCloseTimer();
    breakdownCloseTimerRef.current = setTimeout(() => {
      setOpenBreakdown((prev) => (prev && !prev.pinned ? null : prev));
    }, 120);
  }

  useEffect(() => {
    function handleOutsideClick(e) {
      if (
        filtersContainerRef.current &&
        !filtersContainerRef.current.contains(e.target)
      ) {
        setOpenFilterMenu(null);
      }
      if (
        breakdownPopoverRef.current &&
        !breakdownPopoverRef.current.contains(e.target) &&
        !e.target.closest('[data-breakdown-trigger="true"]')
      ) {
        clearBreakdownCloseTimer();
        setOpenBreakdown(null);
      }
    }
    function handleEscape(e) {
      if (e.key === "Escape") {
        clearBreakdownCloseTimer();
        setOpenBreakdown(null);
      }
    }
    function handleViewportChange() {
      clearBreakdownCloseTimer();
      setOpenBreakdown(null);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      clearBreakdownCloseTimer();
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, []);

  function showBreakdown(targetEl, customerId, type, pinned) {
    clearBreakdownCloseTimer();
    const rect = targetEl.getBoundingClientRect();
    const popoverWidth = 220;
    const estimatedHeight = 165;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement =
      spaceBelow < estimatedHeight + 16 && rect.top > estimatedHeight + 16
        ? "top"
        : "bottom";
    const left = Math.min(
      Math.max(12, rect.left),
      Math.max(12, window.innerWidth - popoverWidth - 12)
    );

    setOpenBreakdown({
      customerId,
      type,
      pinned,
      placement,
      top: placement === "bottom" ? rect.bottom + 6 : undefined,
      bottom: placement === "top" ? window.innerHeight - rect.top + 6 : undefined,
      left,
    });
  }

  function handleHoverBreakdown(e, customerId, type) {
    const keepPinned =
      Boolean(openBreakdown?.pinned) &&
      openBreakdown.customerId === customerId &&
      openBreakdown.type === type;
    showBreakdown(e.currentTarget, customerId, type, keepPinned);
  }

  function handleToggleBreakdown(e, customerId, type) {
    if (
      openBreakdown &&
      openBreakdown.customerId === customerId &&
      openBreakdown.type === type &&
      openBreakdown.pinned
    ) {
      clearBreakdownCloseTimer();
      setOpenBreakdown(null);
      return;
    }
    showBreakdown(e.currentTarget, customerId, type, true);
  }

  // Pinned / Starred Regular Customers & Local Persisted Overrides
  const [pinnedIds, setPinnedIds] = useState(getPinnedCustomerIds);
  const [unpinnedIds, setUnpinnedIds] = useState(() =>
    readJsonStorage(UNPINNED_STORAGE_KEY, [])
  );
  const [customerEdits, setCustomerEdits] = useState(() =>
    readJsonStorage(CUSTOMER_EDITS_STORAGE_KEY, {})
  );
  const [deletedCustomerIds, setDeletedCustomerIds] = useState(() =>
    readJsonStorage(DELETED_CUSTOMERS_STORAGE_KEY, [])
  );
  const [invoiceStatusOverrides, setInvoiceStatusOverrides] = useState(() =>
    readJsonStorage(INVOICE_STATUS_STORAGE_KEY, {})
  );

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // View Specific Quotation or Invoice from Customer View Modal
  const [viewingQuotation, setViewingQuotation] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);

  // Edit & Delete Customer Modals
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [customerToDelete, setCustomerToDelete] = useState(null);

  // New Customer Form State (unchanged)
  const [newCustomer, setNewCustomer] = useState({
    customer_name: "",
    company_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    notes: "",
  });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [formError, setFormError] = useState("");

  function handleCloseAddModal() {
    setShowAddModal(false);
    setFormError("");
    setNewCustomer({
      customer_name: "",
      company_name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      notes: "",
    });
  }

  // Fetch invoices safely if backend endpoint exists or local storage has records
  async function fetchInvoicesSafe() {
    try {
      const token = getAuthToken();
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/invoices`, {
        method: "GET",
        headers,
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const list =
          data?.invoices ||
          data?.data ||
          (Array.isArray(data) ? data : []);
        if (Array.isArray(list)) {
          return list;
        }
      }
    } catch {
      // Fallback silently if /api/invoices is not active yet
    }

    const localInv = readJsonStorage("iq_invoices", null) || readJsonStorage("invoices", []);
    return Array.isArray(localInv) ? localInv : [];
  }

  // Load Customers, Quotations & Invoices
  async function loadData() {
    try {
      setLoading(true);
      const [custList, quoteList, invList] = await Promise.all([
        getCustomers(),
        getQuotations(),
        fetchInvoicesSafe(),
      ]);
      const safeQuotes = Array.isArray(quoteList) ? quoteList : [];
      const safeInvoices = Array.isArray(invList) ? invList : [];
      const uid = authUser?.user_id;
      setCustomers(Array.isArray(custList) ? custList : []);
      setQuotations(
        isSuperAdmin || uid == null
          ? safeQuotes
          : safeQuotes.filter(
              (q) => q.created_by == null || Number(q.created_by) === Number(uid)
            )
      );
      setInvoices(
        isSuperAdmin || uid == null
          ? safeInvoices
          : safeInvoices.filter(
              (inv) =>
                inv.created_by == null || Number(inv.created_by) === Number(uid)
            )
      );
    } catch (err) {
      console.error("Failed to load customer records:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Toggle Star Mark for Regular Customer (supports both manual pin & unpinning auto-regular)
  function togglePin(customerId, currentlyRegular) {
    if (currentlyRegular) {
      const nextPinned = pinnedIds.filter((id) => id !== customerId);
      const nextUnpinned = unpinnedIds.includes(customerId)
        ? unpinnedIds
        : [...unpinnedIds, customerId];
      setPinnedIds(nextPinned);
      setUnpinnedIds(nextUnpinned);
      savePinnedCustomerIds(nextPinned);
      writeJsonStorage(UNPINNED_STORAGE_KEY, nextUnpinned);
    } else {
      const nextPinned = pinnedIds.includes(customerId)
        ? pinnedIds
        : [...pinnedIds, customerId];
      const nextUnpinned = unpinnedIds.filter((id) => id !== customerId);
      setPinnedIds(nextPinned);
      setUnpinnedIds(nextUnpinned);
      savePinnedCustomerIds(nextPinned);
      writeJsonStorage(UNPINNED_STORAGE_KEY, nextUnpinned);
    }
  }

  // Toggle Active / Inactive customer status directly or via Edit
  function toggleCustomerActiveStatus(customerId, currentStatus) {
    const nextStatus = currentStatus === "Inactive" ? "Active" : "Inactive";
    const nextEdits = {
      ...customerEdits,
      [customerId]: {
        ...(customerEdits[customerId] || {}),
        status: nextStatus,
      },
    };
    setCustomerEdits(nextEdits);
    writeJsonStorage(CUSTOMER_EDITS_STORAGE_KEY, nextEdits);
  }

  // Handle Manual Quotation Customer Status Update (from View modal)
  async function handleStatusChange(quotationId, newCustomerStatus) {
    try {
      setUpdatingStatusId(quotationId);
      await updateQuotationCustomerStatus(quotationId, newCustomerStatus);
      await loadData();
    } catch (err) {
      alert(err?.message || "Failed to update quotation customer status.");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  // Handle Manual Invoice Status Update (Paid / Partial / Unpaid)
  async function handleInvoiceStatusChange(invoiceKey, newStatus) {
    const next = {
      ...invoiceStatusOverrides,
      [invoiceKey]: newStatus,
    };
    setInvoiceStatusOverrides(next);
    writeJsonStorage(INVOICE_STATUS_STORAGE_KEY, next);

    // Also try updating backend if endpoint exists
    try {
      const token = getAuthToken();
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch(`${API_BASE_URL}/api/invoices/${invoiceKey}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: newStatus, payment_status: newStatus }),
      });
    } catch {
      // Persisted locally via invoiceStatusOverrides
    }
  }

  // Handle Add Customer Form Submit
  async function handleAddCustomer(e) {
    e.preventDefault();
    setFormError("");

    const nameTrimmed = String(newCustomer.customer_name || "").trim();
    if (!nameTrimmed) {
      setFormError("Customer name is required.");
      return;
    }

    const inputEmail = String(newCustomer.email || "").trim().toLowerCase();
    const inputPhone = String(newCustomer.phone || "").trim();

    // Prevent re-adding a customer already added by Super Admin or another Admin
    const duplicateError = checkDuplicateCustomer(nameTrimmed, inputEmail, inputPhone);
    if (duplicateError) {
      setFormError(duplicateError);
      return;
    }

    // Check if an active (non-deleted) customer already exists with this email or phone number
    if (inputEmail || inputPhone) {
      const existingCustomer = enrichedCustomers.find((c) => {
        const cEmail = String(c.email || "").trim().toLowerCase();
        const cPhone = String(c.phone || "").trim();
        const emailMatch = inputEmail && cEmail && isEmailMatch(cEmail, inputEmail);
        const phoneMatch = inputPhone && cPhone && isPhoneMatch(cPhone, inputPhone);
        return emailMatch || phoneMatch;
      });

      if (existingCustomer) {
        const cEmail = String(existingCustomer.email || "").trim().toLowerCase();
        const cPhone = String(existingCustomer.phone || "").trim();
        const emailMatched = Boolean(inputEmail && cEmail && isEmailMatch(cEmail, inputEmail));
        const phoneMatched = Boolean(inputPhone && cPhone && isPhoneMatch(cPhone, inputPhone));

        if (emailMatched && phoneMatched) {
          setFormError(
            `A customer with this email (${inputEmail}) and phone number (${inputPhone}) already exists (${existingCustomer.customer_name}).`
          );
        } else if (emailMatched) {
          setFormError(
            `A customer with this email (${inputEmail}) already exists (${existingCustomer.customer_name}).`
          );
        } else if (phoneMatched) {
          setFormError(
            `A customer with this phone number (${inputPhone}) already exists (${existingCustomer.customer_name}).`
          );
        }
        return;
      }
    }

    try {
      setSavingCustomer(true);
      const res = await createCustomer(newCustomer);

      // If this customer was previously deleted or backend reused the ID, remove from deletedCustomerIds
      const createdId = res?.customer_id;
      const currentDeleted = readJsonStorage(
        DELETED_CUSTOMERS_STORAGE_KEY,
        deletedCustomerIds
      );
      let updatedDeleted = Array.isArray(currentDeleted)
        ? [...currentDeleted]
        : [];
      let hadDeletedChange = false;

      if (createdId && updatedDeleted.includes(createdId)) {
        updatedDeleted = updatedDeleted.filter((id) => id !== createdId);
        hadDeletedChange = true;
      }

      if (hadDeletedChange) {
        setDeletedCustomerIds(updatedDeleted);
        writeJsonStorage(DELETED_CUSTOMERS_STORAGE_KEY, updatedDeleted);

        try {
          const legacyRaw = localStorage.getItem(
            LEGACY_DELETED_CUSTOMERS_STORAGE_KEY
          );
          if (legacyRaw) {
            const legacyParsed = JSON.parse(legacyRaw);
            if (
              Array.isArray(legacyParsed) &&
              (legacyParsed.includes(createdId) ||
                legacyParsed.includes(String(createdId)))
            ) {
              const filteredLegacy = legacyParsed.filter(
                (id) => id !== createdId && String(id) !== String(createdId)
              );
              localStorage.setItem(
                LEGACY_DELETED_CUSTOMERS_STORAGE_KEY,
                JSON.stringify(filteredLegacy)
              );
            }
          }
        } catch {
          // ignore
        }
      }

      setShowAddModal(false);
      setNewCustomer({
        customer_name: "",
        company_name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        notes: "",
      });
      await loadData();
    } catch (err) {
      setFormError(err?.message || "Failed to create customer.");
    } finally {
      setSavingCustomer(false);
    }
  }

  // Handle Edit Customer Submit
  async function handleEditCustomerSubmit(e) {
    e.preventDefault();
    if (!editingCustomer) return;
    setEditError("");

    if (!String(editingCustomer.customer_name || "").trim()) {
      setEditError("Customer name is required.");
      return;
    }

    try {
      setSavingEdit(true);
      const cId = editingCustomer.customer_id;

      // Try backend PUT if available
      try {
        const token = getAuthToken();
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        await fetch(`${API_BASE_URL}/api/customers/${cId}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(editingCustomer),
        });
      } catch {
        // Fallback to local persistence
      }

      const nextEdits = {
        ...customerEdits,
        [cId]: {
          customer_name: editingCustomer.customer_name.trim(),
          company_name: editingCustomer.company_name?.trim() || "",
          email: editingCustomer.email?.trim() || "",
          phone: editingCustomer.phone?.trim() || "",
          address: editingCustomer.address?.trim() || "",
          city: editingCustomer.city?.trim() || "",
          notes: editingCustomer.notes?.trim() || "",
          status: editingCustomer.status || "Active",
        },
      };
      setCustomerEdits(nextEdits);
      writeJsonStorage(CUSTOMER_EDITS_STORAGE_KEY, nextEdits);

      // Update Regular / New star state if changed in edit form
      if (editingCustomer.customer_type === "Regular") {
        const nextPinned = pinnedIds.includes(cId) ? pinnedIds : [...pinnedIds, cId];
        const nextUnpinned = unpinnedIds.filter((id) => id !== cId);
        setPinnedIds(nextPinned);
        setUnpinnedIds(nextUnpinned);
        savePinnedCustomerIds(nextPinned);
        writeJsonStorage(UNPINNED_STORAGE_KEY, nextUnpinned);
      } else if (editingCustomer.customer_type === "New") {
        const nextPinned = pinnedIds.filter((id) => id !== cId);
        const nextUnpinned = unpinnedIds.includes(cId) ? unpinnedIds : [...unpinnedIds, cId];
        setPinnedIds(nextPinned);
        setUnpinnedIds(nextUnpinned);
        savePinnedCustomerIds(nextPinned);
        writeJsonStorage(UNPINNED_STORAGE_KEY, nextUnpinned);
      }

      setEditingCustomer(null);
    } catch (err) {
      setEditError(err?.message || "Failed to update customer.");
    } finally {
      setSavingEdit(false);
    }
  }

  // Handle Delete Customer Confirm
  async function handleConfirmDeleteCustomer() {
    if (!customerToDelete) return;
    const cId = customerToDelete.customer_id;

    try {
      const token = getAuthToken();
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch(`${API_BASE_URL}/api/customers/${cId}`, {
        method: "DELETE",
        headers,
      });
    } catch {
      // Fallback to local persistence
    }

    const nextDeleted = deletedCustomerIds.includes(cId)
      ? deletedCustomerIds
      : [...deletedCustomerIds, cId];
    setDeletedCustomerIds(nextDeleted);
    writeJsonStorage(DELETED_CUSTOMERS_STORAGE_KEY, nextDeleted);

    if (selectedCustomerId === cId) {
      setSelectedCustomerId(null);
    }
    setCustomerToDelete(null);
  }

  // Augment Customers with Real-time Quotation & Invoice Stats
  const enrichedCustomers = useMemo(() => {
    return customers
      .filter((rawCust) => !deletedCustomerIds.includes(rawCust.customer_id))
      .map((rawCust) => {
        const cId = rawCust.customer_id;
        const editOverride = customerEdits[cId] || {};
        const c = { ...rawCust, ...editOverride };

        const cName = String(c.customer_name || "").trim().toLowerCase();
        const cEmail = String(c.email || "").trim().toLowerCase();

        // Match customer quotations strictly by customer_id when available, otherwise by name or email
        const clientQuotes = quotations.filter((q) => {
          if (q.customer_id != null && q.customer_id !== "") {
            return Number(q.customer_id) === Number(cId);
          }
          const qName = String(q.customer_name || q.clientName || "")
            .trim()
            .toLowerCase();
          if (cName && qName && qName === cName) return true;
          const qEmail = String(q.customer_email || q.email || "")
            .trim()
            .toLowerCase();
          if (cEmail && qEmail && qEmail === cEmail) return true;
          return false;
        });

        const approvedQuotes = clientQuotes.filter((q) => {
          const s = String(q?.customer_status || "").trim().toLowerCase();
          return s === "customer accepted" || s === "accepted";
        });
        const rejectedQuotes = clientQuotes.filter((q) => {
          const s = String(q?.customer_status || "").trim().toLowerCase();
          return s === "customer rejected" || s === "rejected";
        });
        const sentQuotes = clientQuotes.filter((q) => {
          const s = String(q?.customer_status || "").trim().toLowerCase();
          return s === "sent to customer" || s === "sent";
        });

        const approvedTotal = approvedQuotes.reduce(
          (sum, q) => sum + (Number(q.total_amount) || Number(q.total) || 0),
          0
        );

        // Match customer invoices strictly by customer_id when available, otherwise by name or email
        const directInvoices = invoices.filter((inv) => {
          if (inv.customer_id != null && inv.customer_id !== "") {
            return Number(inv.customer_id) === Number(cId);
          }
          const invName = String(inv.customer_name || inv.clientName || "")
            .trim()
            .toLowerCase();
          if (cName && invName && invName === cName) return true;
          const invEmail = String(inv.customer_email || inv.email || "")
            .trim()
            .toLowerCase();
          if (cEmail && invEmail && invEmail === cEmail) return true;
          return false;
        });

        // Only use actual invoice records (do not link or derive invoices from quotations)
        const clientInvoices = directInvoices.map((inv) => {
          const key = inv.invoice_id || inv.id || inv.invoice_number;
          const overrideStatus = invoiceStatusOverrides[key];
          const finalStatus =
            overrideStatus || inv.payment_status || inv.status || "Unpaid";
          return {
            ...inv,
            invoice_key: key,
            raw_status: inv.status,
            status: finalStatus,
            payment_status: finalStatus,
          };
        });

        const paidInvoices = clientInvoices.filter(
          (inv) => classifyInvoiceStatus(inv) === "paid"
        );
        const partialInvoices = clientInvoices.filter(
          (inv) => classifyInvoiceStatus(inv) === "partial"
        );
        const unpaidInvoices = clientInvoices.filter(
          (inv) => classifyInvoiceStatus(inv) === "unpaid"
        );

        // Count total services across quotations & invoices to auto-detect Regular Customers
        const totalServiceItems = clientQuotes.reduce(
          (sum, q) => sum + (Array.isArray(q.items) ? q.items.length : 0),
          0
        );

        const serviceActivityCount = Math.max(
          clientQuotes.length + directInvoices.length,
          clientQuotes.length,
          clientInvoices.length,
          totalServiceItems,
          Number(c.total_quotations) || 0
        );

        const autoRegular =
          serviceActivityCount >= 2 ||
          (clientQuotes.length >= 1 && clientInvoices.length >= 1) ||
          (c.notes && /daily|frequent|regular/i.test(c.notes));

        const isRegularCustomer = unpinnedIds.includes(cId)
          ? false
          : pinnedIds.includes(cId) || autoRegular;

        // Customer Active / Inactive status
        const normalizedStatus =
          String(c.status || "Active").trim().toLowerCase() === "inactive" ||
            c.is_active === false ||
            c.is_active === 0
            ? "Inactive"
            : "Active";

        return {
          ...c,
          quotes: clientQuotes,
          invoices: clientInvoices,
          total_quotations: clientQuotes.length,
          approved_quotations: approvedQuotes.length,
          sent_quotations: sentQuotes.length,
          rejected_quotations: rejectedQuotes.length,
          total_approved_amount: approvedTotal,
          total_invoices: clientInvoices.length,
          paid_invoices: paidInvoices.length,
          partial_invoices: partialInvoices.length,
          unpaid_invoices: unpaidInvoices.length,
          isRegularCustomer,
          customer_type: isRegularCustomer ? "Regular" : "New",
          status: normalizedStatus,
        };
      });
  }, [
    customers,
    quotations,
    invoices,
    pinnedIds,
    unpinnedIds,
    customerEdits,
    deletedCustomerIds,
    invoiceStatusOverrides,
  ]);

  // Keep selectedCustomer in sync with real-time updates
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return (
      enrichedCustomers.find((c) => c.customer_id === selectedCustomerId) ||
      null
    );
  }, [enrichedCustomers, selectedCustomerId]);

  const activeBreakdownCustomer = useMemo(() => {
    if (!openBreakdown?.customerId) return null;
    return (
      enrichedCustomers.find(
        (c) => c.customer_id === openBreakdown.customerId
      ) || null
    );
  }, [enrichedCustomers, openBreakdown]);

  // 4 Summary Cards Statistics: Total, Active, Inactive, Regular Customers
  const stats = useMemo(() => {
    const totalClients = enrichedCustomers.length;
    const activeClients = enrichedCustomers.filter(
      (c) => c.status === "Active"
    ).length;
    const inactiveClients = enrichedCustomers.filter(
      (c) => c.status === "Inactive"
    ).length;
    const regularClients = enrichedCustomers.filter(
      (c) => c.isRegularCustomer
    ).length;

    return {
      totalClients,
      activeClients,
      inactiveClients,
      regularClients,
    };
  }, [enrichedCustomers]);

  // Filtered Customers for main table
  const filteredCustomers = useMemo(() => {
    return enrichedCustomers.filter((c, index) => {
      const qTerm = searchTerm.trim().toLowerCase();
      const matchSearch =
        !qTerm ||
        c.customer_name?.toLowerCase().includes(qTerm) ||
        c.company_name?.toLowerCase().includes(qTerm) ||
        c.email?.toLowerCase().includes(qTerm) ||
        c.phone?.toLowerCase().includes(qTerm) ||
        String(index + 1) === qTerm ||
        String(c.customer_id) === qTerm;

      if (!matchSearch) return false;

      // 1. Customer Type Filter (All Types / Regular / New)
      if (typeFilter === "regular" && !c.isRegularCustomer) return false;
      if (typeFilter === "new" && c.isRegularCustomer) return false;

      // 2. Customer Status Filter (All Status / Active / Inactive)
      if (statusFilter === "active" && c.status !== "Active") return false;
      if (statusFilter === "inactive" && c.status !== "Inactive") return false;

      // 3. Quotations Status Filter (All Quotations Status / Accepted / Sent / Rejected)
      if (quoteStatusFilter === "accepted" && c.approved_quotations === 0)
        return false;
      if (quoteStatusFilter === "sent" && c.sent_quotations === 0) return false;
      if (quoteStatusFilter === "rejected" && c.rejected_quotations === 0)
        return false;

      // 4. Invoice Status Filter (All Invoice Status / Paid / Partial / Unpaid)
      if (invoiceStatusFilter === "paid" && c.paid_invoices === 0) return false;
      if (invoiceStatusFilter === "partial" && c.partial_invoices === 0)
        return false;
      if (invoiceStatusFilter === "unpaid" && c.unpaid_invoices === 0)
        return false;

      return true;
    });
  }, [
    enrichedCustomers,
    searchTerm,
    typeFilter,
    statusFilter,
    quoteStatusFilter,
    invoiceStatusFilter,
  ]);

  return (
    <div className="cust-page">
      {/* Top Header Bar (Unchanged) */}
      <header className="cust-topbar">
        <div className="cust-topbar-left">
          {openSidebar && (
            <button
              type="button"
              className="cust-menu-button"
              aria-label="Open sidebar"
              onClick={openSidebar}
            >
              <Menu size={20} />
            </button>
          )}

          <div className="cust-breadcrumb-wrap">
            <span className="cust-breadcrumb">Dashboard / Customers</span>
          </div>
        </div>

        <div className="cust-header-actions">
          <ThemeToggle />
          <span className="cust-header-date" title="Today's Date">
            {new Intl.DateTimeFormat("en-US", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date())}
          </span>

          <div className="cust-header-profile" title={userRoleTitle}>
            <span
              className="cust-profile-avatar"
              aria-label={`${userRoleTitle} profile`}
            >
              {userInitials}
            </span>
          </div>
        </div>
      </header>

      <div className="cust-content">
        {/* Welcome / Title Row right below topbar (Unchanged) */}
        <div className="cust-welcome-bar">
          <div className="cust-welcome-text">
            <h1>Customers &amp; Responses</h1>
            <p className="cust-subtitle">
              Monitor customer responses (Sent, Approved, Rejected) and daily
              website clients.
            </p>
          </div>

          <button
            type="button"
            className="cust-add-btn"
            onClick={() => {
              handleCloseAddModal();
              setShowAddModal(true);
            }}
            title="Add new customer"
          >
            <UserPlus size={16} />
            <span>Add Customer</span>
          </button>
        </div>

        {/* Separated Modern Search Bar & 4 Filter Dropdowns */}
        <section className="cust-toolbar" aria-label="Search and filter customers">
          <label className="cust-search-box">
            <Search size={16} color="#64748b" />
            <input
              type="search"
              placeholder="Search by name, company, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search customers"
            />
          </label>

            <div className="cust-filters" ref={filtersContainerRef}>
              {/* 1. Customer Type Dropdown */}
              <div className="cust-dropdown-wrap">
                <button
                  type="button"
                  className={`cust-dropdown-btn ${openFilterMenu === "type" ? "active" : ""}`}
                  onClick={() =>
                    setOpenFilterMenu((prev) => (prev === "type" ? null : "type"))
                  }
                  aria-expanded={openFilterMenu === "type"}
                >
                  <span className="cust-dropdown-label">
                    {typeFilter === "regular"
                      ? "Regular Customers"
                      : typeFilter === "new"
                        ? "New Customers"
                        : "All Types"}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`cust-dropdown-chevron ${openFilterMenu === "type" ? "open" : ""}`}
                  />
                </button>

                {openFilterMenu === "type" && (
                  <div className="cust-dropdown-menu" role="listbox">
                    <div className="cust-dropdown-header">
                      <span>Filter by Customer Type</span>
                    </div>
                    <div className="cust-dropdown-list">
                      {[
                        {
                          value: "all",
                          label: "All Types",
                          color: "#64748b",
                          count: stats.totalClients,
                        },
                        {
                          value: "regular",
                          label: "Regular Customers",
                          color: "#f59e0b",
                          count: stats.regularClients,
                        },
                        {
                          value: "new",
                          label: "New Customers",
                          color: "#2563eb",
                          count: Math.max(0, stats.totalClients - stats.regularClients),
                        },
                      ].map((opt) => {
                        const isSelected = typeFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className={`cust-dropdown-item ${isSelected ? "selected" : ""}`}
                            onClick={() => {
                              setTypeFilter(opt.value);
                              setOpenFilterMenu(null);
                            }}
                          >
                            <div className="cust-dropdown-item-left">
                              <span
                                className="cust-dropdown-dot"
                                style={{ backgroundColor: opt.color }}
                              />
                              <span className="cust-dropdown-item-text">{opt.label}</span>
                            </div>
                            <div className="cust-dropdown-item-right">
                              <span className="cust-dropdown-count">{opt.count}</span>
                              {isSelected && <Check size={14} className="cust-dropdown-check" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Customer Status Dropdown */}
              <div className="cust-dropdown-wrap">
                <button
                  type="button"
                  className={`cust-dropdown-btn ${openFilterMenu === "status" ? "active" : ""}`}
                  onClick={() =>
                    setOpenFilterMenu((prev) => (prev === "status" ? null : "status"))
                  }
                  aria-expanded={openFilterMenu === "status"}
                >
                  <span className="cust-dropdown-label">
                    {statusFilter === "active"
                      ? "Active"
                      : statusFilter === "inactive"
                        ? "Inactive"
                        : "All Status"}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`cust-dropdown-chevron ${openFilterMenu === "status" ? "open" : ""}`}
                  />
                </button>

                {openFilterMenu === "status" && (
                  <div className="cust-dropdown-menu" role="listbox">
                    <div className="cust-dropdown-header">
                      <span>Filter by Customer Status</span>
                    </div>
                    <div className="cust-dropdown-list">
                      {[
                        {
                          value: "all",
                          label: "All Status",
                          color: "#64748b",
                          count: stats.totalClients,
                        },
                        {
                          value: "active",
                          label: "Active",
                          color: "#16a34a",
                          count: stats.activeClients,
                        },
                        {
                          value: "inactive",
                          label: "Inactive",
                          color: "#dc2626",
                          count: stats.inactiveClients,
                        },
                      ].map((opt) => {
                        const isSelected = statusFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className={`cust-dropdown-item ${isSelected ? "selected" : ""}`}
                            onClick={() => {
                              setStatusFilter(opt.value);
                              setOpenFilterMenu(null);
                            }}
                          >
                            <div className="cust-dropdown-item-left">
                              <span
                                className="cust-dropdown-dot"
                                style={{ backgroundColor: opt.color }}
                              />
                              <span className="cust-dropdown-item-text">{opt.label}</span>
                            </div>
                            <div className="cust-dropdown-item-right">
                              <span className="cust-dropdown-count">{opt.count}</span>
                              {isSelected && <Check size={14} className="cust-dropdown-check" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Quotations Status Dropdown */}
              <div className="cust-dropdown-wrap">
                <button
                  type="button"
                  className={`cust-dropdown-btn ${openFilterMenu === "quote" ? "active" : ""}`}
                  onClick={() =>
                    setOpenFilterMenu((prev) => (prev === "quote" ? null : "quote"))
                  }
                  aria-expanded={openFilterMenu === "quote"}
                >
                  <span className="cust-dropdown-label">
                    {quoteStatusFilter === "accepted"
                      ? "Approved / Accepted"
                      : quoteStatusFilter === "sent"
                        ? "Sent"
                        : quoteStatusFilter === "rejected"
                          ? "Rejected"
                          : "All Quotations Status"}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`cust-dropdown-chevron ${openFilterMenu === "quote" ? "open" : ""}`}
                  />
                </button>

                {openFilterMenu === "quote" && (
                  <div className="cust-dropdown-menu" role="listbox">
                    <div className="cust-dropdown-header">
                      <span>Filter by Quotations Status</span>
                    </div>
                    <div className="cust-dropdown-list">
                      {[
                        { value: "all", label: "All Quotations Status", color: "#64748b" },
                        { value: "accepted", label: "Approved / Accepted", color: "#16a34a" },
                        { value: "sent", label: "Sent", color: "#0284c7" },
                        { value: "rejected", label: "Rejected", color: "#dc2626" },
                      ].map((opt) => {
                        const isSelected = quoteStatusFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className={`cust-dropdown-item ${isSelected ? "selected" : ""}`}
                            onClick={() => {
                              setQuoteStatusFilter(opt.value);
                              setOpenFilterMenu(null);
                            }}
                          >
                            <div className="cust-dropdown-item-left">
                              <span
                                className="cust-dropdown-dot"
                                style={{ backgroundColor: opt.color }}
                              />
                              <span className="cust-dropdown-item-text">{opt.label}</span>
                            </div>
                            {isSelected && <Check size={14} className="cust-dropdown-check" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Invoice Status Dropdown */}
              <div className="cust-dropdown-wrap">
                <button
                  type="button"
                  className={`cust-dropdown-btn ${openFilterMenu === "invoice" ? "active" : ""}`}
                  onClick={() =>
                    setOpenFilterMenu((prev) => (prev === "invoice" ? null : "invoice"))
                  }
                  aria-expanded={openFilterMenu === "invoice"}
                >
                  <span className="cust-dropdown-label">
                    {invoiceStatusFilter === "paid"
                      ? "Paid"
                      : invoiceStatusFilter === "partial"
                        ? "Partial"
                        : invoiceStatusFilter === "unpaid"
                          ? "Unpaid"
                          : "All Invoice Status"}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`cust-dropdown-chevron ${openFilterMenu === "invoice" ? "open" : ""}`}
                  />
                </button>

                {openFilterMenu === "invoice" && (
                  <div className="cust-dropdown-menu" role="listbox">
                    <div className="cust-dropdown-header">
                      <span>Filter by Invoice Status</span>
                    </div>
                    <div className="cust-dropdown-list">
                      {[
                        { value: "all", label: "All Invoice Status", color: "#64748b" },
                        { value: "paid", label: "Paid", color: "#16a34a" },
                        { value: "partial", label: "Partial", color: "#f59e0b" },
                        { value: "unpaid", label: "Unpaid", color: "#dc2626" },
                      ].map((opt) => {
                        const isSelected = invoiceStatusFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className={`cust-dropdown-item ${isSelected ? "selected" : ""}`}
                            onClick={() => {
                              setInvoiceStatusFilter(opt.value);
                              setOpenFilterMenu(null);
                            }}
                          >
                            <div className="cust-dropdown-item-left">
                              <span
                                className="cust-dropdown-dot"
                                style={{ backgroundColor: opt.color }}
                              />
                              <span className="cust-dropdown-item-text">{opt.label}</span>
                            </div>
                            {isSelected && <Check size={14} className="cust-dropdown-check" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

        {/* Main Customers Table Panel */}
        <section className="cust-panel" aria-label="Customer list">
          <div className="cust-table-wrap">
            <table className="cust-table">
              <thead>
                <tr>
                  <th>CUSTOMER / COMPANY</th>
                  <th>CONTACT DETAILS</th>
                  <th className="cust-col-center">CUSTOMER TYPE</th>
                  <th className="cust-col-center">STATUS</th>
                  <th className="cust-col-count">QUOTATIONS</th>
                  <th className="cust-col-count">INVOICES</th>
                  <th className="cust-col-center">ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        textAlign: "center",
                        padding: "44px 0",
                        color: "#64748b",
                      }}
                    >
                      Loading customer records from database...
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        textAlign: "center",
                        padding: "44px 0",
                        color: "#64748b",
                      }}
                    >
                      No customers found matching your search or filters.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((client) => {
                    const isRegular = client.isRegularCustomer;
                    const qTotal = client.total_quotations;
                    const invTotal = client.total_invoices;

                    return (
                      <tr key={client.customer_id}>
                        {/* 1. Customer Name / Company Name + Star Mark */}
                        <td>
                          <div className="cust-client-cell">
                            <button
                              type="button"
                              className={`cust-star-btn ${isRegular ? "active" : ""
                                }`}
                              title={
                                isRegular
                                  ? "Regular Customer (Click to unmark)"
                                  : "Mark as Regular Customer"
                              }
                              onClick={() =>
                                togglePin(client.customer_id, isRegular)
                              }
                            >
                              <Star
                                size={16}
                                fill={isRegular ? "#f59e0b" : "none"}
                              />
                            </button>

                            <div className="cust-table-avatar">
                              {(client.customer_name || "C")
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div className="cust-client-meta">
                              <strong title={client.customer_name}>
                                {client.customer_name}
                              </strong>
                              <span title={client.company_name || client.city || ""}>
                                {client.company_name || client.city || "—"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Contact Details (Email / Phone) */}
                        <td>
                          <div className="cust-contact-cell">
                            {client.email ? (
                              <div className="cust-contact-line" title={client.email}>
                                <Mail size={12} color="#2563eb" />
                                <span>{client.email}</span>
                              </div>
                            ) : (
                              <div className="cust-contact-empty">No email</div>
                            )}
                            {client.phone ? (
                              <div className="cust-contact-line" title={client.phone}>
                                <Phone size={12} color="#64748b" />
                                <span>{client.phone}</span>
                              </div>
                            ) : null}
                          </div>
                        </td>

                        {/* 4. Customer Type (Regular / New) */}
                        <td className="cust-col-center">
                          {isRegular ? (
                            <span className="cust-type-badge regular">
                              <Star size={11} fill="currentColor" /> Regular
                            </span>
                          ) : (
                            <span className="cust-type-badge new">New</span>
                          )}
                        </td>

                        {/* 5. Customer Status (Active / Inactive) */}
                        <td className="cust-col-center">
                          <button
                            type="button"
                            className={`cust-status-badge ${client.status === "Active" ? "active" : "inactive"
                              }`}
                            onClick={() =>
                              toggleCustomerActiveStatus(
                                client.customer_id,
                                client.status
                              )
                            }
                            title="Click to toggle Active / Inactive status"
                          >
                            <span className="cust-status-dot" />
                            {client.status}
                          </button>
                        </td>

                        {/* 6. Quotations Count (Hover or click to view breakdown) */}
                        <td className="cust-col-count">
                          <button
                            type="button"
                            data-breakdown-trigger="true"
                            className={`cust-count-trigger ${
                              openBreakdown?.customerId === client.customer_id &&
                              openBreakdown?.type === "quotations"
                                ? "active"
                                : ""
                            }`}
                            onMouseEnter={(e) =>
                              handleHoverBreakdown(
                                e,
                                client.customer_id,
                                "quotations"
                              )
                            }
                            onMouseLeave={scheduleBreakdownClose}
                            onClick={(e) =>
                              handleToggleBreakdown(
                                e,
                                client.customer_id,
                                "quotations"
                              )
                            }
                            aria-expanded={
                              openBreakdown?.customerId === client.customer_id &&
                              openBreakdown?.type === "quotations"
                            }
                            aria-label="View quotation breakdown"
                          >
                            <strong className="cust-count-num">{qTotal}</strong>
                          </button>
                        </td>

                        {/* 7. Invoices Count (Hover or click to view breakdown) */}
                        <td className="cust-col-count">
                          <button
                            type="button"
                            data-breakdown-trigger="true"
                            className={`cust-count-trigger ${
                              openBreakdown?.customerId === client.customer_id &&
                              openBreakdown?.type === "invoices"
                                ? "active"
                                : ""
                            }`}
                            onMouseEnter={(e) =>
                              handleHoverBreakdown(
                                e,
                                client.customer_id,
                                "invoices"
                              )
                            }
                            onMouseLeave={scheduleBreakdownClose}
                            onClick={(e) =>
                              handleToggleBreakdown(
                                e,
                                client.customer_id,
                                "invoices"
                              )
                            }
                            aria-expanded={
                              openBreakdown?.customerId === client.customer_id &&
                              openBreakdown?.type === "invoices"
                            }
                            aria-label="View invoice breakdown"
                          >
                            <strong className="cust-count-num">
                              {invTotal}
                            </strong>
                          </button>
                        </td>

                        {/* 8. Actions: View (Professional Blue), Edit, Delete */}
                        <td className="cust-col-center">
                          <div className="cust-action-group">
                            <button
                              type="button"
                              className="cust-action-btn view-blue"
                              title="View Customer Quotations & Invoices"
                              aria-label={`View ${client.customer_name}`}
                              onClick={() =>
                                setSelectedCustomerId(client.customer_id)
                              }
                            >
                              <Eye size={15} />
                            </button>

                            <button
                              type="button"
                              className="cust-action-btn edit-btn"
                              title="Edit Customer"
                              aria-label={`Edit ${client.customer_name}`}
                              onClick={() =>
                                setEditingCustomer({
                                  customer_id: client.customer_id,
                                  customer_name: client.customer_name || "",
                                  company_name: client.company_name || "",
                                  email: client.email || "",
                                  phone: client.phone || "",
                                  address: client.address || "",
                                  city: client.city || "",
                                  notes: client.notes || "",
                                  customer_type: client.customer_type || "New",
                                  status: client.status || "Active",
                                })
                              }
                            >
                              <Pencil size={14} />
                            </button>

                            <button
                              type="button"
                              className="cust-action-btn delete-btn"
                              title="Delete Customer"
                              aria-label={`Delete ${client.customer_name}`}
                              onClick={() => setCustomerToDelete(client)}
                            >
                              <Trash2 size={14} />
                            </button>
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

        {/* Quotations / Invoices Breakdown Popover Box */}
        {openBreakdown && activeBreakdownCustomer && (() => {
          const isQuotes = openBreakdown.type === "quotations";
          const totalCount = isQuotes
            ? activeBreakdownCustomer.total_quotations
            : activeBreakdownCustomer.total_invoices;
          const items = isQuotes
            ? [
                {
                  key: "accepted",
                  label: "Accepted",
                  count: activeBreakdownCustomer.approved_quotations,
                  tone: "green",
                },
                {
                  key: "sent",
                  label: "Sent",
                  count: activeBreakdownCustomer.sent_quotations,
                  tone: "blue",
                },
                {
                  key: "rejected",
                  label: "Rejected",
                  count: activeBreakdownCustomer.rejected_quotations,
                  tone: "red",
                },
              ]
            : [
                {
                  key: "paid",
                  label: "Paid",
                  count: activeBreakdownCustomer.paid_invoices,
                  tone: "green",
                },
                {
                  key: "partial",
                  label: "Partial",
                  count: activeBreakdownCustomer.partial_invoices,
                  tone: "amber",
                },
                {
                  key: "unpaid",
                  label: "Unpaid",
                  count: activeBreakdownCustomer.unpaid_invoices,
                  tone: "red",
                },
              ];

          return (
            <div
              ref={breakdownPopoverRef}
              className={`cust-breakdown-popover ${
                openBreakdown.placement === "top" ? "place-top" : "place-bottom"
              }`}
              role="dialog"
              aria-label={`${
                isQuotes ? "Quotations" : "Invoices"
              } breakdown for ${activeBreakdownCustomer.customer_name}`}
              onMouseEnter={clearBreakdownCloseTimer}
              onMouseLeave={scheduleBreakdownClose}
              style={{
                top: openBreakdown.top,
                bottom: openBreakdown.bottom,
                left: openBreakdown.left,
              }}
            >
              <div className="cust-breakdown-header">
                <div className="cust-breakdown-title-wrap">
                  <span className="cust-breakdown-title">
                    {isQuotes ? "Quotations" : "Invoices"}
                  </span>
                  <span className="cust-breakdown-customer">
                    {activeBreakdownCustomer.customer_name}
                  </span>
                </div>
                <span className="cust-breakdown-total">{totalCount}</span>
              </div>

              <div className="cust-breakdown-list">
                {items.map((item) => (
                  <div key={item.key} className="cust-breakdown-row">
                    <div className="cust-breakdown-label-group">
                      <span
                        className={`cust-breakdown-dot ${item.tone}`}
                        aria-hidden="true"
                      />
                      <span className="cust-breakdown-label">{item.label}</span>
                    </div>
                    <span className={`cust-breakdown-badge ${item.tone}`}>
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Customer Details, Quotations & Invoices History Modal */}
      {selectedCustomer && (
        <div
          className="cust-modal-overlay"
          onClick={() => setSelectedCustomerId(null)}
        >
          <div
            className="cust-modal cust-modal-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cust-modal-header">
              <div className="cust-modal-title-group">
                <div className="cust-modal-avatar">
                  {(selectedCustomer.customer_name || "C")
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div>
                  <div className="cust-modal-name-row">
                    <h3>{selectedCustomer.customer_name}</h3>
                    <span
                      className={`cust-type-badge ${selectedCustomer.isRegularCustomer ? "regular" : "new"
                        }`}
                    >
                      {selectedCustomer.isRegularCustomer ? (
                        <>
                          <Star size={10} fill="currentColor" /> Regular
                        </>
                      ) : (
                        "New"
                      )}
                    </span>
                    <span
                      className={`cust-status-badge ${selectedCustomer.status === "Active"
                        ? "active"
                        : "inactive"
                        }`}
                    >
                      <span className="cust-status-dot" />
                      {selectedCustomer.status}
                    </span>
                  </div>
                  <span className="cust-modal-sub">
                    {selectedCustomer.company_name
                      ? `${selectedCustomer.company_name} • `
                      : ""}
                    Customer ID #{selectedCustomer.customer_id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="cust-modal-close"
                onClick={() => setSelectedCustomerId(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="cust-modal-body">
              {/* Profile summary */}
              <div className="cust-profile-summary-grid">
                <div>
                  <span>Email</span>
                  <strong>{selectedCustomer.email || "—"}</strong>
                </div>
                <div>
                  <span>Phone</span>
                  <strong>{selectedCustomer.phone || "—"}</strong>
                </div>
                <div>
                  <span>Address</span>
                  <strong>
                    {[
                      selectedCustomer.address,
                      selectedCustomer.city,
                      selectedCustomer.country,
                    ]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </strong>
                </div>
                <div>
                  <span>Total Approved Business</span>
                  <strong className="cust-approved-val">
                    {formatCurrency(selectedCustomer.total_approved_amount)}
                  </strong>
                </div>
              </div>

              {/* Section 1: Quotations for this Customer */}
              <div className="cust-modal-section">
                <div className="cust-modal-section-head">
                  <h4>
                    <FileText size={16} color="#1d4ed8" />
                    Quotations for this Customer (
                    {selectedCustomer.quotes?.length || 0})
                  </h4>
                </div>

                {selectedCustomer.quotes?.length === 0 ? (
                  <div className="cust-empty-subbox">
                    No quotations created for this customer yet.
                  </div>
                ) : (
                  <div className="cust-subtable-wrap">
                    <table className="cust-table cust-subtable">
                      <thead>
                        <tr>
                          <th>QUOTATION ID</th>
                          <th>DATE</th>
                          <th>AMOUNT</th>
                          {isSuperAdmin && <th>CREATED BY</th>}
                          <th>STATUS</th>
                          <th>CUSTOMER RESPONSE</th>
                          <th>VIEW</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCustomer.quotes.map((q) => {
                          const qId = q.quotation_id || q.id;
                          const custStatus = q.customer_status || "Not Sent";
                          const isCustAccepted =
                            custStatus === "Customer Accepted" ||
                            custStatus === "Accepted";
                          const isCustSent =
                            custStatus === "Sent to Customer" ||
                            custStatus === "Sent";
                          const isCustRejected =
                            custStatus === "Customer Rejected" ||
                            custStatus === "Rejected";

                          return (
                            <tr key={qId}>
                              <td>
                                <strong className="cust-doc-id">
                                  {q.quotation_number || `#${qId}`}
                                </strong>
                              </td>
                              <td>
                                {formatDisplayDate(
                                  q.quotation_date ||
                                  q.issuedDate ||
                                  q.created_at
                                )}
                              </td>
                              <td>
                                <strong>
                                  {formatCurrency(q.total_amount || q.total)}
                                </strong>
                              </td>
                              {isSuperAdmin && (
                                <td>
                                  {(() => {
                                    const role = String(q.created_by_role || "").toLowerCase();
                                    const isSuper = role.includes("super") || q.created_by === 2;
                                    const displayRole = isSuper ? "Super Admin" : "Admin";
                                    return (
                                      <span
                                        style={{
                                          display: "inline-block",
                                          padding: "2px 6px",
                                          fontSize: "10px",
                                          fontWeight: "600",
                                          lineHeight: "1.2",
                                          whiteSpace: "nowrap",
                                          borderRadius: "4px",
                                          background: isSuper ? "#f5f3ff" : "#eff6ff",
                                          color: isSuper ? "#6d28d9" : "#1d4ed8",
                                          border: isSuper ? "1px solid #ddd6fe" : "1px solid #bfdbfe",
                                        }}
                                        title={q.created_by_name ? `${displayRole} (${q.created_by_name})` : displayRole}
                                      >
                                        {isSuper ? "Super Admin" : (q.created_by_name ? `Admin: ${q.created_by_name}` : "Admin")}
                                      </span>
                                    );
                                  })()}
                                </td>
                              )}
                              <td>
                                <span
                                  className={`quote-pill ${isCustAccepted
                                    ? "approved"
                                    : isCustRejected
                                      ? "rejected"
                                      : isCustSent
                                        ? "sent"
                                        : "total"
                                    }`}
                                >
                                  {isCustAccepted
                                    ? "Accepted"
                                    : isCustRejected
                                      ? "Rejected"
                                      : isCustSent
                                        ? "Sent"
                                        : q.status || "Draft"}
                                </span>
                              </td>
                              <td>
                                <div className="cust-response-btns">
                                  {isCustAccepted ? (
                                    <span className="cust-resp-btn accepted active">
                                      Accepted
                                    </span>
                                  ) : isCustRejected ? (
                                    <span className="cust-resp-btn rejected active">
                                      Rejected
                                    </span>
                                  ) : isCustSent ? (
                                    <span className="cust-resp-btn sent active">
                                      Sent
                                    </span>
                                  ) : (
                                    <span className="cust-resp-btn not-sent">
                                      Not Sent
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="cust-doc-view-btn"
                                  onClick={() => setViewingQuotation(q)}
                                  title="View Quotation Details"
                                >
                                  <Eye size={14} />
                                  <span>View</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section 2: Invoices for this Customer */}
              <div className="cust-modal-section" style={{ marginTop: "24px" }}>
                <div className="cust-modal-section-head">
                  <h4>
                    <Receipt size={16} color="#1d4ed8" />
                    Invoices for this Customer (
                    {selectedCustomer.invoices?.length || 0})
                  </h4>
                </div>

                {selectedCustomer.invoices?.length === 0 ? (
                  <div className="cust-empty-subbox">
                    No invoices recorded for this customer yet.
                  </div>
                ) : (
                  <div className="cust-subtable-wrap">
                    <table className="cust-table cust-subtable">
                      <thead>
                        <tr>
                          <th>INVOICE ID</th>
                          <th>DATE</th>
                          <th>AMOUNT</th>
                          {isSuperAdmin && <th>CREATED BY</th>}
                          <th>STATUS</th>
                          <th>PAYMENT STATUS</th>
                          <th>VIEW</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCustomer.invoices.map((inv) => {
                          const invKey = inv.invoice_key;
                          const invClass = classifyInvoiceStatus(inv);
                          const isPaid = invClass === "paid";
                          const isPartial = invClass === "partial";
                          const approvalStatus = getInvoiceApprovalStatus(inv);
                          const approvalPillClass =
                            approvalStatus === "Approved"
                              ? "approved"
                              : approvalStatus === "Rejected"
                                ? "rejected"
                                : approvalStatus === "Pending Approval"
                                  ? "partial"
                                  : "total";

                          return (
                            <tr key={invKey}>
                              <td>
                                <strong className="cust-doc-id">
                                  {inv.invoice_number || `#${invKey}`}
                                </strong>
                              </td>
                              <td>
                                {formatDisplayDate(
                                  inv.invoice_date ||
                                  inv.issue_date ||
                                  inv.created_at
                                )}
                              </td>
                              <td>
                                <strong>
                                  {formatCurrency(
                                    inv.total_amount || inv.total || inv.amount
                                  )}
                                </strong>
                              </td>
                              {isSuperAdmin && (
                                <td>
                                  {(() => {
                                    const role = String(inv.created_by_role || "").toLowerCase();
                                    const isSuper = role.includes("super") || inv.created_by === 2;
                                    const displayRole = isSuper ? "Super Admin" : "Admin";
                                    return (
                                      <span
                                        style={{
                                          display: "inline-block",
                                          padding: "2px 6px",
                                          fontSize: "10px",
                                          fontWeight: "600",
                                          lineHeight: "1.2",
                                          whiteSpace: "nowrap",
                                          borderRadius: "4px",
                                          background: isSuper ? "#f5f3ff" : "#eff6ff",
                                          color: isSuper ? "#6d28d9" : "#1d4ed8",
                                          border: isSuper ? "1px solid #ddd6fe" : "1px solid #bfdbfe",
                                        }}
                                        title={
                                          inv.created_by_name
                                            ? `${displayRole} (${inv.created_by_name})`
                                            : displayRole
                                        }
                                      >
                                        {isSuper
                                          ? "Super Admin"
                                          : inv.created_by_name
                                            ? `Admin: ${inv.created_by_name}`
                                            : "Admin"}
                                      </span>
                                    );
                                  })()}
                                </td>
                              )}
                              <td>
                                <span
                                  className={`quote-pill ${approvalPillClass}`}
                                  style={{ whiteSpace: "nowrap" }}
                                >
                                  {approvalStatus}
                                </span>
                              </td>
                              <td>
                                <div className="cust-response-btns">
                                  {isPaid ? (
                                    <span className="cust-resp-btn accepted active">
                                      Paid
                                    </span>
                                  ) : isPartial ? (
                                    <span className="cust-resp-btn partial active">
                                      Partial
                                    </span>
                                  ) : (
                                    <span className="cust-resp-btn rejected active">
                                      Unpaid
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="cust-doc-view-btn"
                                  onClick={() => setViewingInvoice(inv)}
                                  title="View Invoice Details"
                                >
                                  <Eye size={14} />
                                  <span>View</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="cust-modal-footer">
              <button
                type="button"
                className="cust-btn-secondary"
                onClick={() => setSelectedCustomerId(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Quotation Details Preview Modal (opened from Customer View Modal) */}
      {viewingQuotation && (
        <QuotationDetails
          quotation={viewingQuotation}
          quotationId={viewingQuotation.quotation_id || viewingQuotation.id}
          onClose={() => setViewingQuotation(null)}
        />
      )}

      {/* Full Invoice Details Preview Modal (opened from Customer View Modal) */}
      {viewingInvoice && (
        <div
          className="cust-modal-overlay"
          style={{ zIndex: 1100 }}
          onClick={() => setViewingInvoice(null)}
        >
          <div
            className="cust-modal"
            style={{ maxWidth: "660px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cust-modal-header cust-invoice-view-header">
              <div>
                <span className="cust-inv-badge">INVOICE RECORD</span>
                <h3>
                  {viewingInvoice.invoice_number ||
                    `#${viewingInvoice.invoice_key}`}
                </h3>
              </div>
              <button
                type="button"
                className="cust-modal-close"
                onClick={() => setViewingInvoice(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="cust-modal-body">
              <div className="cust-profile-summary-grid">
                <div>
                  <span>Customer</span>
                  <strong>{viewingInvoice.customer_name || "—"}</strong>
                </div>
                <div>
                  <span>Company</span>
                  <strong>{viewingInvoice.company_name || "—"}</strong>
                </div>
                <div>
                  <span>Invoice Date</span>
                  <strong>
                    {formatDisplayDate(
                      viewingInvoice.invoice_date ||
                      viewingInvoice.issue_date ||
                      viewingInvoice.created_at
                    )}
                  </strong>
                </div>
                <div>
                  <span>Payment Status</span>
                  <strong
                    style={{
                      color:
                        classifyInvoiceStatus(viewingInvoice) === "paid"
                          ? "#15803d"
                          : classifyInvoiceStatus(viewingInvoice) === "partial"
                            ? "#b45309"
                            : "#b91c1c",
                    }}
                  >
                    {viewingInvoice.status || "Unpaid"}
                  </strong>
                </div>
              </div>

              {Array.isArray(viewingInvoice.items) &&
                viewingInvoice.items.length > 0 ? (
                <div className="cust-subtable-wrap" style={{ marginTop: "14px" }}>
                  <table className="cust-table cust-subtable">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>SERVICE / DESCRIPTION</th>
                        <th>QTY</th>
                        <th>AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingInvoice.items.map((it, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>
                            <strong>
                              {it.item_name ||
                                it.service_name ||
                                it.description ||
                                "Service Item"}
                            </strong>
                          </td>
                          <td>{it.quantity || 1}</td>
                          <td>
                            <strong>
                              {formatCurrency(
                                it.total_price ||
                                it.line_total ||
                                it.unit_price ||
                                0
                              )}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="cust-invoice-total-bar">
                <span>Total Invoice Amount</span>
                <strong>
                  {formatCurrency(
                    viewingInvoice.total_amount ||
                    viewingInvoice.total ||
                    viewingInvoice.amount
                  )}
                </strong>
              </div>
            </div>

            <div className="cust-modal-footer">
              <button
                type="button"
                className="cust-btn-primary"
                onClick={() => setViewingInvoice(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div
          className="cust-modal-overlay"
          onClick={() => setEditingCustomer(null)}
        >
          <div
            className="cust-modal"
            style={{ maxWidth: "560px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cust-modal-header">
              <h3>Edit Customer Details</h3>
              <button
                type="button"
                className="cust-modal-close"
                onClick={() => setEditingCustomer(null)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditCustomerSubmit}>
              <div className="cust-modal-body">
                {editError && (
                  <div className="cust-form-error">{editError}</div>
                )}

                <div className="cust-form-grid">
                  <div className="cust-field">
                    <label>Customer Name *</label>
                    <input
                      type="text"
                      required
                      value={editingCustomer.customer_name}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          customer_name: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="cust-field">
                    <label>Company Name</label>
                    <input
                      type="text"
                      value={editingCustomer.company_name}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          company_name: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="cust-field">
                    <label>Email Address</label>
                    <input
                      type="email"
                      value={editingCustomer.email}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          email: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="cust-field">
                    <label>Phone Number</label>
                    <input
                      type="text"
                      value={editingCustomer.phone}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          phone: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="cust-field">
                    <label>Customer Type</label>
                    <select
                      value={editingCustomer.customer_type}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          customer_type: e.target.value,
                        })
                      }
                    >
                      <option value="Regular">Regular Customer</option>
                      <option value="New">New Customer</option>
                    </select>
                  </div>

                  <div className="cust-field">
                    <label>Status</label>
                    <select
                      value={editingCustomer.status}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          status: e.target.value,
                        })
                      }
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  <div className="cust-field">
                    <label>City</label>
                    <input
                      type="text"
                      value={editingCustomer.city}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          city: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="cust-field">
                    <label>Address</label>
                    <input
                      type="text"
                      value={editingCustomer.address}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          address: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="cust-field cust-field-full">
                    <label>Notes</label>
                    <textarea
                      rows={2}
                      value={editingCustomer.notes}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          notes: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="cust-modal-footer">
                <button
                  type="button"
                  className="cust-btn-secondary"
                  onClick={() => setEditingCustomer(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cust-btn-primary"
                  disabled={savingEdit}
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {customerToDelete && (
        <div
          className="cust-modal-overlay"
          onClick={() => setCustomerToDelete(null)}
        >
          <div
            className="cust-modal"
            style={{ maxWidth: "420px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cust-modal-header">
              <h3>Delete Customer</h3>
              <button
                type="button"
                className="cust-modal-close"
                onClick={() => setCustomerToDelete(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="cust-modal-body">
              <p style={{ margin: 0, fontSize: "13.5px", color: "#334155", lineHeight: 1.6 }}>
                Are you sure you want to remove{" "}
                <strong style={{ color: "#0b1932" }}>
                  {customerToDelete.customer_name}
                </strong>
                {customerToDelete.company_name
                  ? ` (${customerToDelete.company_name})`
                  : ""}{" "}
                from the customer list?
              </p>
            </div>
            <div className="cust-modal-footer">
              <button
                type="button"
                className="cust-btn-secondary"
                onClick={() => setCustomerToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cust-btn-danger"
                onClick={handleConfirmDeleteCustomer}
              >
                Delete Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Customer Modal (Unchanged) */}
      {showAddModal && (
        <div className="cust-modal-overlay" onClick={handleCloseAddModal}>
          <div
            className="cust-modal"
            style={{ maxWidth: "560px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cust-modal-header">
              <h3>Register New Customer</h3>
              <button
                type="button"
                className="cust-modal-close"
                onClick={handleCloseAddModal}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddCustomer}>
              <div className="cust-modal-body">
                {formError && (
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "#fee2e2",
                      color: "#b91c1c",
                      borderRadius: "6px",
                      marginBottom: "14px",
                      fontSize: "13px",
                    }}
                  >
                    {formError}
                  </div>
                )}

                <div className="cust-form-grid">
                  <div className="cust-field">
                    <label>Customer Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={newCustomer.customer_name}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          customer_name: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="cust-field">
                    <label>Company Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Lanka Ltd"
                      value={newCustomer.company_name}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          company_name: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="cust-field">
                    <label>Email Address</label>
                    <input
                      type="email"
                      placeholder="client@example.com"
                      value={newCustomer.email}
                      onChange={(e) => {
                        if (formError) setFormError("");
                        setNewCustomer({
                          ...newCustomer,
                          email: e.target.value,
                        });
                      }}
                    />
                  </div>

                  <div className="cust-field">
                    <label>Phone Number</label>
                    <input
                      type="text"
                      placeholder="+94 77 123 4567"
                      value={newCustomer.phone}
                      onChange={(e) => {
                        if (formError) setFormError("");
                        setNewCustomer({
                          ...newCustomer,
                          phone: e.target.value,
                        });
                      }}
                    />
                  </div>

                  <div className="cust-field">
                    <label>City</label>
                    <input
                      type="text"
                      placeholder="Colombo"
                      value={newCustomer.city}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          city: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="cust-field">
                    <label>Address</label>
                    <input
                      type="text"
                      placeholder="Street address"
                      value={newCustomer.address}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          address: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="cust-field cust-field-full">
                    <label>Notes (e.g. Website Client, Daily Customer)</label>
                    <textarea
                      rows={2}
                      placeholder="Additional notes about customer requirements..."
                      value={newCustomer.notes}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          notes: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="cust-modal-footer">
                <button
                  type="button"
                  className="cust-btn-secondary"
                  onClick={handleCloseAddModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="cust-btn-primary"
                  disabled={savingCustomer}
                >
                  {savingCustomer ? "Saving..." : "Create Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
