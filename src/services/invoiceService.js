// Invoice Management Service
// Connected directly to Backend Invoices API (MySQL) with real-time CRUD and payments.

import API_BASE_URL from "./api";

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
export async function getInvoices() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/invoices`, {
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

  const subtotal = Number(invoiceData.subtotal) || 0;
  const discountAmount = Number(invoiceData.discount_amount) || 0;
  const taxAmount = Number(invoiceData.tax_amount) || 0;
  const totalAmount = Number(invoiceData.total_amount) || (subtotal - discountAmount + taxAmount);
  const amountPaid = Number(invoiceData.amount_paid) || 0;
  const balanceDue = Number(invoiceData.balance_due ?? (totalAmount - amountPaid));

  let finalStatus = invoiceData.status || "Draft";
  if (finalStatus !== "Draft" && finalStatus !== "Cancelled") {
    if (balanceDue <= 0 && totalAmount > 0) finalStatus = "Paid";
    else if (amountPaid > 0) finalStatus = "Partial";
    else finalStatus = "Unpaid";
  }

  const payload = {
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

  try {
    const res = await fetch(`${API_BASE_URL}/api/invoices`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      const created = data?.invoice || data?.data;
      if (created) {
        const existing = readStorageInvoices();
        const next = [created, ...existing.filter((i) => i.invoice_id !== created.invoice_id)];
        writeStorageInvoices(next);
        return created;
      }
    } else {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.message || `Failed to create invoice (Status ${res.status})`);
    }
  } catch (err) {
    console.error("Backend invoice creation error:", err);
    // If backend is down, save locally with temporary ID
    const tempId = Date.now();
    const fallbackRecord = {
      ...payload,
      invoice_id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const existing = readStorageInvoices();
    const next = [fallbackRecord, ...existing];
    writeStorageInvoices(next);
    return fallbackRecord;
  }
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
  if (finalStatus !== "Draft" && finalStatus !== "Cancelled") {
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

    if (res.ok) {
      const data = await res.json().catch(() => null);
      const updated = data?.invoice || data?.data;
      if (updated) {
        const existing = readStorageInvoices();
        const next = existing.map((i) => (String(i.invoice_id) === String(id) ? updated : i));
        writeStorageInvoices(next);
        return updated;
      }
    }
  } catch (err) {
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

// Record a payment against an invoice
export async function recordInvoicePayment(id, paymentData) {
  const paymentAmount = Number(paymentData.amount) || 0;
  if (paymentAmount <= 0) throw new Error("Payment amount must be greater than zero.");

  try {
    const res = await fetch(`${API_BASE_URL}/api/invoices/${id}/payments`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(paymentData),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      const updated = data?.invoice || data?.data;
      if (updated) {
        const existing = readStorageInvoices();
        const next = existing.map((i) => (String(i.invoice_id) === String(id) ? updated : i));
        writeStorageInvoices(next);
        return updated;
      }
    }
  } catch (err) {
    console.warn("Backend recordPayment error:", err);
  }

  // Local fallback if offline
  const invoice = await getInvoiceById(id);
  if (!invoice) throw new Error("Invoice not found.");

  const currentPaid = Number(invoice.amount_paid) || 0;
  const newAmountPaid = Number((currentPaid + paymentAmount).toFixed(2));
  const totalAmount = Number(invoice.total_amount) || 0;
  const newBalanceDue = Math.max(0, Number((totalAmount - newAmountPaid).toFixed(2)));

  let newStatus = "Partial";
  if (newBalanceDue <= 0) newStatus = "Paid";
  else if (newAmountPaid === 0) newStatus = "Unpaid";

  const newPayment = {
    payment_id: `PAY-${Date.now()}`,
    amount: paymentAmount,
    payment_date: paymentData.payment_date || new Date().toISOString().slice(0, 10),
    payment_method: paymentData.payment_method || "Bank Transfer",
    reference: paymentData.reference?.trim() || "",
    notes: paymentData.notes?.trim() || "",
    recorded_at: new Date().toISOString(),
  };

  const updatedPayments = [...(Array.isArray(invoice.payments) ? invoice.payments : []), newPayment];

  return await updateInvoice(id, {
    ...invoice,
    amount_paid: newAmountPaid,
    balance_due: newBalanceDue,
    status: newStatus,
    payments: updatedPayments,
  });
}

// Alias for recordInvoicePayment
export { recordInvoicePayment as recordPayment };

// Duplicate invoice into a new draft invoice
export async function duplicateInvoice(id) {
  const invoice = await getInvoiceById(id);
  if (!invoice) throw new Error("Invoice not found.");

  const now = new Date();
  const dueDate = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);

  const duplicatedData = {
    ...invoice,
    invoice_id: undefined,
    invoice_number: `INV-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    status: "Draft",
    amount_paid: 0,
    balance_due: Number(invoice.total_amount) || 0,
    invoice_date: now.toISOString().slice(0, 10),
    due_date: dueDate,
    payments: [],
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  return await createInvoice(duplicatedData);
}

// Re-export customer and quotation helpers for invoice workflows
export { getCustomers, getQuotations } from "./quotationService";
