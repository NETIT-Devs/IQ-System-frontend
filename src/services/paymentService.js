// Payment Management Service
// Connected directly to Backend Payments API (MySQL). No dummy data or local fallbacks.

import API_BASE_URL from "./api";

function getAuthToken() {
  return (
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    ""
  );
}

function getHeaders(isFormData = false) {
  const token = getAuthToken();
  const headers = {};
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(response) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.message ||
      (response.status === 401
        ? "Session expired. Please sign in again."
        : response.status === 403
          ? "You do not have permission to perform this action."
          : `Request failed with status ${response.status}`);
    throw new Error(message);
  }

  return data;
}

export async function getPaymentSummary() {
  const res = await fetch(`${API_BASE_URL}/api/payments/summary`, {
    method: "GET",
    headers: getHeaders(),
  });
  const data = await handleResponse(res);
  return data?.summary || {
    totalPayments: 0,
    approvedCount: 0,
    totalPaidAmount: 0,
    pendingVerificationCount: 0,
    pendingVerificationAmount: 0,
    rejectedCount: 0,
    outstandingBalance: 0,
    unpaidInvoiceCount: 0,
  };
}

export async function getEligibleQuotations() {
  const res = await fetch(`${API_BASE_URL}/api/payments/eligible-quotations`, {
    method: "GET",
    headers: getHeaders(),
  });
  const data = await handleResponse(res);
  return Array.isArray(data?.quotations) ? data.quotations : [];
}

export async function getPayments(params = {}) {
  const query = new URLSearchParams();
  if (params.status && params.status !== "All") {
    query.set("status", params.status);
  }
  if (params.search) {
    query.set("search", params.search);
  }
  if (params.approval_queue) {
    query.set("approval_queue", "true");
  }
  if (params.invoice_id) {
    query.set("invoice_id", String(params.invoice_id));
  }

  const qs = query.toString();
  const url = `${API_BASE_URL}/api/payments${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });
  const data = await handleResponse(res);
  return Array.isArray(data?.payments) ? data.payments : [];
}

export async function getPaymentById(id) {
  const res = await fetch(`${API_BASE_URL}/api/payments/${id}`, {
    method: "GET",
    headers: getHeaders(),
  });
  const data = await handleResponse(res);
  return data?.payment || null;
}

export async function createPayment(formData) {
  const isFormData = formData instanceof FormData;
  const res = await fetch(`${API_BASE_URL}/api/payments`, {
    method: "POST",
    headers: getHeaders(isFormData),
    body: isFormData ? formData : JSON.stringify(formData),
  });
  const data = await handleResponse(res);
  return data;
}

export async function updatePayment(id, formData) {
  const isFormData = formData instanceof FormData;
  const res = await fetch(`${API_BASE_URL}/api/payments/${id}`, {
    method: "PUT",
    headers: getHeaders(isFormData),
    body: isFormData ? formData : JSON.stringify(formData),
  });
  const data = await handleResponse(res);
  return data;
}

export async function deletePayment(id) {
  const res = await fetch(`${API_BASE_URL}/api/payments/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  return await handleResponse(res);
}

export async function approvePayment(id) {
  const res = await fetch(`${API_BASE_URL}/api/payments/${id}/approve`, {
    method: "POST",
    headers: getHeaders(),
  });
  return await handleResponse(res);
}

export async function rejectPayment(id, rejection_reason) {
  const res = await fetch(`${API_BASE_URL}/api/payments/${id}/reject`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ rejection_reason }),
  });
  return await handleResponse(res);
}

