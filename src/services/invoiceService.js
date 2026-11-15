// Invoice Management Service
// Connected directly to Backend Invoices API (MySQL) with real-time CRUD and payments.

import API_BASE_URL from "./api";
import { getNextInvoiceNumber } from "../utils/formatters";

const INVOICE_STORAGE_KEY = "iq_invoices_data_v2";
// Clean up any legacy dummy seed data from v1
try {
  localStorage.removeItem("iq_invoices_data_v1");
} catch {
  // ignore
}

function getAuthToken() {
  return (
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    ""
  );
}

function getHeaders() {
  const token = getAuthToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function readStorageInvoices() {
  try {
    const raw = localStorage.getItem(INVOICE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function writeStorageInvoices(invoices) {
  try {
    localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(invoices));
  } catch {
    // ignore
  }
}

// Fetch all real invoices from the backend API
export async function getInvoices(params = {}) {
  try {
    const qs =
      params && typeof params === "object"
        ? new URLSearchParams(params).toString()
        : "";
    const url = qs
      ? `${API_BASE_URL}/api/invoices?${qs}`
      : `${API_BASE_URL}/api/invoices`;
    const res = await fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.invoices)
        ? data.invoices
        : Array.isArray(data?.data)
        ? data.data
        : [];

      writeStorageInvoices(list);
      return list;
    }
  } catch (err) {
    console.warn("Backend invoices API unreachable, checking local cache:", err);
  }

  // Fallback to locally cached real invoices (if offline) - NO dummy seed data
  return readStorageInvoices();
}

// Fetch single invoice by ID
export async function getInvoiceById(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/invoices/${id}`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.invoice || data?.data) return data.invoice || data.data;
    }
  } catch (err) {
    console.warn("Backend getInvoiceById error, checking local cache:", err);
  }

  const list = readStorageInvoices();
  return list.find((inv) => String(inv.invoice_id || inv.id) === String(id)) || null;
}

// Create new invoice in the backend
export async function createInvoice(invoiceData) {
  const currentUser = (() => {
    try {
      const u = localStorage.getItem("authUser") || sessionStorage.getItem("authUser");
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  })();

  const isQuotationConversion =
    Boolean(invoiceData?.quotation_id) &&
    !invoiceData?.status &&
    (!Array.isArray(invoiceData?.items) || invoiceData.items.length === 0);
  let payload;

  if (isQuotationConversion) {
    payload = {
      quotation_id: Number(invoiceData.quotation_id),
      invoice_date: invoiceData.invoice_date,
    };
  } else {
    const subtotal = Number(invoiceData.subtotal) || 0;
    const discountAmount = Number(invoiceData.discount_amount) || 0;
    const taxAmount = Number(invoiceData.tax_amount) || 0;
    const totalAmount = Number(invoiceData.total_amount) || (subtotal - discountAmount + taxAmount);
    const amountPaid = Number(invoiceData.amount_paid) || 0;
    const balanceDue = Number(invoiceData.balance_due ?? (totalAmount - amountPaid));

    let finalStatus = invoiceData.status || "Draft";
    if (
      finalStatus !== "Draft" &&
      finalStatus !== "Pending Approval" &&
      finalStatus !== "Rejected" &&
      finalStatus !== "Cancelled"
    ) {
      if (balanceDue <= 0 && totalAmount > 0) finalStatus = "Paid";
      else if (amountPaid > 0) finalStatus = "Partial";
      else finalStatus = "Unpaid";
    }

    payload = {
      ...invoiceData,
      created_by: currentUser?.user_id || invoiceData.created_by || null,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      amount_paid: amountPaid,
      balance_due: balanceDue,
      status: finalStatus,
      items: Array.isArray(invoiceData.items) ? invoiceData.items : [],
    };
  }

  const res = await fetch(`${API_BASE_URL}/api/invoices`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const fallbackMessage =
      data?.code === "VERIFIED_PAYMENT_REQUIRED"
        ? "At least one verified payment is required for this quotation before creating an invoice."
        : `Failed to create invoice (Status ${res.status})`;
    const err = new Error(data?.message || fallbackMessage);
    if (data?.code) err.code = data.code;
    throw err;
  }

  let created = data?.invoice || data?.data || null;
  if (!created && data?.invoice_id) {
    created = await getInvoiceById(data.invoice_id);
  }
  if (!created) {
    created = {
      ...payload,
      invoice_id: data?.invoice_id,
      invoice_number: data?.invoice_number,
    };
  }
  if (created) {
    const existing = readStorageInvoices();
    const next = [created, ...existing.filter((i) => i.invoice_id !== created.invoice_id)];
    writeStorageInvoices(next);
    return created;
  }
  return payload;
}

// Update existing invoice
export async function updateInvoice(id, invoiceData) {
  const subtotal = Number(invoiceData.subtotal) || 0;
  const discountAmount = Number(invoiceData.discount_amount) || 0;
  const taxAmount = Number(invoiceData.tax_amount) || 0;
  const totalAmount = Number(invoiceData.total_amount) || (subtotal - discountAmount + taxAmount);
  const amountPaid = Number(invoiceData.amount_paid) || 0;
  const balanceDue = Number(invoiceData.balance_due ?? (totalAmount - amountPaid));

  let finalStatus = invoiceData.status || "Draft";
  if (
    finalStatus !== "Draft" &&
    finalStatus !== "Pending Approval" &&
    finalStatus !== "Rejected" &&
    finalStatus !== "Cancelled"
  ) {
    if (balanceDue <= 0 && totalAmount > 0) finalStatus = "Paid";
    else if (amountPaid > 0) finalStatus = "Partial";
    else finalStatus = "Unpaid";
  }

  const payload = {
    ...invoiceData,
    subtotal,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    amount_paid: amountPaid,
    balance_due: balanceDue,
    status: finalStatus,
    items: Array.isArray(invoiceData.items) ? invoiceData.items : [],
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/invoices/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(
        data?.message || `Failed to update invoice (Status ${res.status})`
      );
    }

    const updated = data?.invoice || data?.data;
    if (updated) {
      const existing = readStorageInvoices();
      const next = existing.map((i) =>
        String(i.invoice_id) === String(id) ? updated : i
      );
      writeStorageInvoices(next);
      return updated;
    }
  } catch (err) {
    if (err instanceof Error && !err.message.includes("Failed to fetch")) {
      throw err;
    }
    console.warn("Backend updateInvoice error:", err);
  }

  // Update local storage
  const existing = readStorageInvoices();
  const next = existing.map((i) => (String(i.invoice_id) === String(id) ? { ...i, ...payload } : i));
  writeStorageInvoices(next);
  return { ...payload, invoice_id: id };
}

// Delete invoice
export async function deleteInvoice(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/invoices/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });

    if (res.ok) {
      const existing = readStorageInvoices();
      const filtered = existing.filter((inv) => String(inv.invoice_id || inv.id) !== String(id));
      writeStorageInvoices(filtered);
      return { success: true };
    }
  } catch (err) {
    console.warn("Backend deleteInvoice error:", err);
  }

  const existing = readStorageInvoices();
  const filtered = existing.filter((inv) => String(inv.invoice_id || inv.id) !== String(id));
  writeStorageInvoices(filtered);
  return { success: true };
}

// Record a payment against an invoice via the backend API
export async function recordInvoicePayment(id, paymentData) {
  const paymentAmount = Number(paymentData.amount) || 0;
  if (paymentAmount <= 0) throw new Error("Payment amount must be greater than zero.");

  const res = await fetch(`${API_BASE_URL}/api/invoices/${id}/payments`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      ...paymentData,
      reference_number: paymentData.reference_number ?? paymentData.reference ?? "",
      description: paymentData.description ?? paymentData.notes ?? "",
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || `Failed to record payment (Status ${res.status})`);
  }

  const updated = data?.invoice || data?.data;
  if (updated) {
    const existing = readStorageInvoices();
    const next = existing.map((i) => (String(i.invoice_id) === String(id) ? updated : i));
    writeStorageInvoices(next);
  }
  return data;
}

// Alias for recordInvoicePayment
export { recordInvoicePayment as recordPayment };

// Duplicate invoice into a new draft invoice
export async function duplicateInvoice(id) {
  const invoice = await getInvoiceById(id);
  if (!invoice) throw new Error("Invoice not found.");

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const dueDate = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  const existingInvoices = await getInvoices().catch(() => readStorageInvoices());

  const duplicatedData = {
    ...invoice,
    invoice_id: undefined,
    invoice_number: getNextInvoiceNumber(existingInvoices, todayStr),
    status: "Draft",
    amount_paid: 0,
    balance_due: Number(invoice.total_amount) || 0,
    invoice_date: todayStr,
    due_date: dueDate,
    payments: [],
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  return await createInvoice(duplicatedData);
}

// Re-export customer and quotation helpers for invoice workflows
export { getCustomers, getQuotations, getAllRegisteredCustomers } from "./quotationService";

// Submit an invoice for Super Admin approval
export async function submitInvoiceForApproval(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/invoices/${id}/submit-approval`, {
      method: "POST",
      headers: getHeaders(),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      const existing = readStorageInvoices();
      const next = existing.map((i) =>
        String(i.invoice_id) === String(id)
          ? { ...i, status: "Pending Approval", approval_status: "Pending" }
          : i
      );
      writeStorageInvoices(next);
      return data || { success: true };
    }
  } catch (err) {
    console.warn("Backend submitInvoiceForApproval error:", err);
  }

  // Fallback to local storage update
  const existing = readStorageInvoices();
  const next = existing.map((i) =>
    String(i.invoice_id) === String(id)
      ? { ...i, status: "Pending Approval", approval_status: "Pending" }
      : i
  );
  writeStorageInvoices(next);
  return { success: true };
}

// Approve a pending invoice (Super Admin only)
export async function approveInvoice(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/invoices/${id}/approve`, {
      method: "POST",
      headers: getHeaders(),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      const existing = readStorageInvoices();
      const next = existing.map((i) =>
        String(i.invoice_id) === String(id)
          ? { ...i, status: "Unpaid", approval_status: "Approved" }
          : i
      );
      writeStorageInvoices(next);
      return data || { success: true };
    }
  } catch (err) {
    console.warn("Backend approveInvoice error:", err);
  }

  const existing = readStorageInvoices();
  const next = existing.map((i) =>
    String(i.invoice_id) === String(id)
      ? { ...i, status: "Unpaid", approval_status: "Approved" }
      : i
  );
  writeStorageInvoices(next);
  return { success: true };
}

// Reject a pending invoice (Super Admin only)
export async function rejectInvoice(id, rejection_reason = "") {
  try {
    const res = await fetch(`${API_BASE_URL}/api/invoices/${id}/reject`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ rejection_reason }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      const existing = readStorageInvoices();
      const next = existing.map((i) =>
        String(i.invoice_id) === String(id)
          ? { ...i, status: "Rejected", approval_status: "Rejected", rejection_reason }
          : i
      );
      writeStorageInvoices(next);
      return data || { success: true };
    }
  } catch (err) {
    console.warn("Backend rejectInvoice error:", err);
  }

  const existing = readStorageInvoices();
  const next = existing.map((i) =>
    String(i.invoice_id) === String(id)
      ? { ...i, status: "Rejected", approval_status: "Rejected", rejection_reason }
      : i
  );
  writeStorageInvoices(next);
  return { success: true };
}

// Update invoice status directly
export async function updateInvoiceStatus(id, status) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/invoices/${id}/status`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      const existing = readStorageInvoices();
      const next = existing.map((i) =>
        String(i.invoice_id) === String(id) ? { ...i, status } : i
      );
      writeStorageInvoices(next);
      return data || { success: true };
    }
  } catch (err) {
    console.warn("Backend updateInvoiceStatus error:", err);
  }

  const existing = readStorageInvoices();
  const next = existing.map((i) =>
    String(i.invoice_id) === String(id) ? { ...i, status } : i
  );
  writeStorageInvoices(next);
  return { success: true };
}
