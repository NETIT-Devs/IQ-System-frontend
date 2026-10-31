// Quotation API and Customer API integration service.
// Communicates with backend endpoints under /api/quotations and /api/customers.

import API_BASE_URL from "./api";

// Retrieve authentication token from localStorage or sessionStorage
function getAuthToken() {
  return (
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    ""
  );
}

// Prepare standard JSON headers with Bearer token authentication
function getHeaders() {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

// Handle fetch response errors uniformly
async function handleResponse(response) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      data?.message ||
      (response.status === 401
        ? "Unauthorized request."
        : response.status === 404
          ? "Requested resource was not found."
          : `Request failed with status ${response.status}`);
    throw new Error(errorMessage);
  }

  return data;
}

// Fetch the active service catalogue from the backend.
export async function getQuotationItemOptions() {
  const response = await fetch(`${API_BASE_URL}/api/quotations/item-options`, {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await handleResponse(response);
  return data?.services || data?.items || [];
}

// Fetch all quotations with items
export async function getQuotations() {
  const response = await fetch(`${API_BASE_URL}/api/quotations`, {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await handleResponse(response);
  return data?.quotations || [];
}

// Fetch single quotation by ID
export async function getQuotationById(id) {
  const response = await fetch(`${API_BASE_URL}/api/quotations/${id}`, {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await handleResponse(response);
  return data?.quotation || null;
}

// Create a new quotation
export async function createQuotation(payload) {
  const response = await fetch(`${API_BASE_URL}/api/quotations`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  return await handleResponse(response);
}

// Update an existing quotation by ID
export async function updateQuotation(id, payload) {
  const response = await fetch(`${API_BASE_URL}/api/quotations/${id}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  return await handleResponse(response);
}

// Delete quotation by ID
export async function deleteQuotation(id) {
  const response = await fetch(`${API_BASE_URL}/api/quotations/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  return await handleResponse(response);
}

// Manually update quotation customer response status (Not Sent, Sent to Customer, Customer Accepted, Customer Rejected)
export async function updateQuotationCustomerStatus(id, customer_status) {
  const response = await fetch(`${API_BASE_URL}/api/quotations/${id}/customer-status`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ customer_status }),
  });

  return await handleResponse(response);
}

// Fetch customers list for customer selection dropdown
export async function getCustomers() {
  const response = await fetch(`${API_BASE_URL}/api/customers`, {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await handleResponse(response);
  return data?.customers || [];
}

// Create a customer record
export async function createCustomer(customerData) {
  const response = await fetch(`${API_BASE_URL}/api/customers`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(customerData),
  });

  return await handleResponse(response);
}

// Helper to ensure media URLs (logos, signatures) point to backend when served from /uploads
function resolveMediaUrl(url) {
  if (!url) return "";
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  return `${API_BASE_URL}${cleanPath}`;
}

// Fetch company details and logo for Quotation header and PDF
export async function getCompanyDetails() {
  // Retrieve logged in user for "Prepared by"
  let currentUser = null;
  try {
    const rawUser =
      localStorage.getItem("authUser") || sessionStorage.getItem("authUser");
    if (rawUser) {
      currentUser = JSON.parse(rawUser);
    }
  } catch (err) {
    console.warn("Could not parse auth user:", err);
  }

  const defaultDetails = {
    setting_id: null,
    company_name: "",
    company_logo: "",
    company_signature: "",
    company_address: "",
    contact_number: "",
    email_address: "",
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_branch: "",
    bank_swift_code: "",
    default_terms_and_conditions: "",
    pdf_custom_sections: "",
    updated_by: currentUser?.full_name || currentUser?.email || "Admin",
    created_at: null,
    updated_at: null,
    logo_url: "",
    signature_url: "",
    address: "",
    phone: "",
    email: "",
    prepared_by: currentUser?.full_name || currentUser?.email || "Admin",
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/company-settings`, {
      method: "GET",
      headers: getHeaders(),
    });

    const data = await handleResponse(response);
    const c = data?.companySettings || data?.company;

    if (c) {
      const resolvedLogo = resolveMediaUrl(c.company_logo);
      const resolvedSignature = resolveMediaUrl(c.company_signature);

      return {
        ...defaultDetails,
        setting_id: c.setting_id,
        company_name: c.company_name || "",
        company_logo: resolvedLogo,
        logo_url: resolvedLogo,
        company_signature: resolvedSignature,
        signature_url: resolvedSignature,
        company_address: c.company_address || "",
        contact_number: c.contact_number || "",
        email_address: c.email_address || "",
        bank_name: c.bank_name || "",
        bank_account_name: c.bank_account_name || "",
        bank_account_number: c.bank_account_number || "",
        bank_branch: c.bank_branch || "",
        bank_swift_code: c.bank_swift_code || "",
        default_terms_and_conditions: c.default_terms_and_conditions || "",
        pdf_heading: c.pdf_heading || "QUOTATION",
        pdf_subheading: c.pdf_subheading || "PROFESSIONAL SERVICES PROPOSAL",
        pdf_custom_lines: c.pdf_custom_lines || "",
        pdf_footer_note: c.pdf_footer_note || "",
        pdf_custom_sections: c.pdf_custom_sections || "",
        updated_by: c.updated_by || defaultDetails.updated_by,
        created_at: c.created_at,
        updated_at: c.updated_at,
        prepared_by: defaultDetails.prepared_by,
        address: c.company_address || "",
        phone: c.contact_number || "",
        email: c.email_address || "",
      };
    }
  } catch (err) {
    console.error("Failed to fetch company details from backend:", err);
    throw err;
  }

  return defaultDetails;
}

// Submit a quotation for approval
export async function submitQuotationForApproval(id) {
  const response = await fetch(
    `${API_BASE_URL}/api/quotations/${id}/submit-approval`,
    {
      method: "POST",
      headers: getHeaders(),
    }
  );

  return await handleResponse(response);
}

// Approve quotation (Super Admin)
export async function approveQuotation(id) {
  const response = await fetch(`${API_BASE_URL}/api/quotations/${id}/approve`, {
    method: "POST",
    headers: getHeaders(),
  });

  return await handleResponse(response);
}

// Reject quotation with reason (Super Admin)
export async function rejectQuotation(id, reason) {
  const response = await fetch(`${API_BASE_URL}/api/quotations/${id}/reject`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ reason }),
  });

  return await handleResponse(response);
}

// Fetch user notifications
export async function getNotifications() {
  const response = await fetch(`${API_BASE_URL}/api/notifications`, {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await handleResponse(response);
  return data?.notifications || [];
}

// Mark single notification as read
export async function markNotificationRead(id) {
  const response = await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
    method: "PUT",
    headers: getHeaders(),
  });

  return await handleResponse(response);
}

// Mark all notifications as read
export async function markAllNotificationsRead() {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/read-all`,
    {
      method: "PUT",
      headers: getHeaders(),
    }
  );

  return await handleResponse(response);
}

// Fetch audit logs (Super Admin only)
export async function getAuditLogs() {
  const response = await fetch(`${API_BASE_URL}/api/audit-logs`, {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await handleResponse(response);
  return data?.auditLogs || data?.logs || [];
}

// ----------------------------------------------------
// Quotation Template & Service Settings (Super Admin)
// ----------------------------------------------------

// Update PDF template settings in company_settings
export async function updateCompanyTemplateSettings(settingsData) {
  // First fetch current settings to merge
  let current = {};
  try {
    const res = await fetch(`${API_BASE_URL}/api/company-settings`, {
      method: "GET",
      headers: getHeaders(),
    });
    const data = await handleResponse(res);
    current = data?.companySettings || data?.company || {};
  } catch (err) {
    console.warn("Could not pre-fetch current company settings:", err);
  }

  const merged = {
    ...current,
    ...settingsData,
    company_name: current.company_name || settingsData.company_name || "Company",
  };

  const response = await fetch(`${API_BASE_URL}/api/company-settings`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(merged),
  });

  return await handleResponse(response);
}

// Fetch all services for management modal
export async function getCatalogServices() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/quotations/services`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (response.ok) {
      const data = await response.json();
      return data?.services || [];
    }
  } catch (err) {
    console.warn("Could not load /services, falling back to /item-options:", err);
  }

  return await getQuotationItemOptions();
}

// Add a new service option (Super Admin)
export async function createCatalogService(serviceData) {
  const response = await fetch(`${API_BASE_URL}/api/quotations/services`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(serviceData),
  });

  return await handleResponse(response);
}

// Update an existing service option (Super Admin)
export async function updateCatalogService(id, serviceData) {
  const response = await fetch(`${API_BASE_URL}/api/quotations/services/${id}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(serviceData),
  });

  return await handleResponse(response);
}

// Delete a service option (Super Admin)
export async function deleteCatalogService(id) {
  const response = await fetch(`${API_BASE_URL}/api/quotations/services/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  return await handleResponse(response);
}
