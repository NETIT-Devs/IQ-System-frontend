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

const ADDED_CUSTOMERS_STORAGE_KEY = "iq_added_customers";
const CUSTOMER_CREATORS_STORAGE_KEY = "iq_customer_creators";
const DELETED_CUSTOMERS_STORAGE_KEY = "iq_deleted_customer_ids_v1";
const LEGACY_DELETED_CUSTOMERS_STORAGE_KEY = "iq_deleted_customer_ids";

function readLocalJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

function getCurrentUserInfo() {
  let user = null;
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const raw = storage.getItem("authUser");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          user = parsed;
          break;
        }
      }
    } catch {
      // ignore
    }
  }

  const token = getAuthToken();
  if (token) {
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        user = {
          ...(user || {}),
          user_id: user?.user_id ?? payload?.user_id ?? null,
          role: user?.role || payload?.role || "",
        };
      }
    } catch {
      // ignore
    }
  }

  return user;
}

// Fetch customers list for customer selection dropdown & dashboard counts
export async function getCustomers() {
  const response = await fetch(`${API_BASE_URL}/api/customers`, {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await handleResponse(response);
  const backendCustomers = Array.isArray(data?.customers) ? data.customers : [];

  const creatorsMap = readLocalJson(CUSTOMER_CREATORS_STORAGE_KEY, {});
  const localAdded = readLocalJson(ADDED_CUSTOMERS_STORAGE_KEY, []);
  const deletedIdsV1 = readLocalJson(DELETED_CUSTOMERS_STORAGE_KEY, []);
  const deletedIdsLegacy = readLocalJson(LEGACY_DELETED_CUSTOMERS_STORAGE_KEY, []);
  const deletedIdSet = new Set(
    [
      ...(Array.isArray(deletedIdsV1) ? deletedIdsV1 : []),
      ...(Array.isArray(deletedIdsLegacy) ? deletedIdsLegacy : []),
    ].map((id) => String(id))
  );

  // Merge backend customers with creator overrides
  const merged = backendCustomers.map((c) => {
    const cId = c.customer_id;
    const creatorInfo = creatorsMap[cId];
    return {
      ...c,
      created_by: c.created_by ?? creatorInfo?.created_by ?? null,
    };
  });

  // Append any locally persisted added customers whose IDs aren't already in merged
  const existingIds = new Set(merged.map((c) => String(c.customer_id)));
  if (Array.isArray(localAdded)) {
    for (const item of localAdded) {
      if (item && item.customer_id && !existingIds.has(String(item.customer_id))) {
        merged.unshift(item);
        existingIds.add(String(item.customer_id));
      }
    }
  }

  // Filter out deleted customer IDs so dashboard and Customers page counts match
  const activeList =
    deletedIdSet.size > 0
      ? merged.filter((c) => !deletedIdSet.has(String(c.customer_id)))
      : merged;

  const currentUser = getCurrentUserInfo();
  const role = String(currentUser?.role || "").trim().toLowerCase();
  const isSuperAdmin = role === "super admin" || role === "super_admin";
  const currentUserId = currentUser?.user_id;

  // Super Admin sees all customers (both Super Admin's and all Admins' customers)
  if (isSuperAdmin) {
    return activeList;
  }

  // Admin only sees customers created by that specific Admin
  if (currentUserId !== undefined && currentUserId !== null) {
    return activeList.filter(
      (c) => Number(c.created_by) === Number(currentUserId)
    );
  }

  return activeList;
}

// Create a customer record
export async function createCustomer(customerData) {
  const currentUser = getCurrentUserInfo();
  const currentUserId = currentUser?.user_id ?? null;
  const currentRole = currentUser?.role || "";

  // Snapshot existing backend customer IDs before POST to detect if backend reused an old ID
  let existingBackendIds = new Set();
  try {
    const preRes = await fetch(`${API_BASE_URL}/api/customers`, {
      method: "GET",
      headers: getHeaders(),
    });
    const preData = await preRes.json().catch(() => null);
    if (Array.isArray(preData?.customers)) {
      existingBackendIds = new Set(
        preData.customers.map((c) => Number(c.customer_id))
      );
    }
  } catch {
    // ignore pre-check error
  }

  const response = await fetch(`${API_BASE_URL}/api/customers`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(customerData),
  });

  const result = await handleResponse(response);
  const returnedId = Number(result?.customer_id);

  if (returnedId && !existingBackendIds.has(returnedId)) {
    // Brand new database row was inserted
    const creatorsMap = readLocalJson(CUSTOMER_CREATORS_STORAGE_KEY, {});
    creatorsMap[returnedId] = {
      created_by: currentUserId,
      role: currentRole,
    };
    writeLocalJson(CUSTOMER_CREATORS_STORAGE_KEY, creatorsMap);
  } else {
    // Backend reused an existing customer_id (e.g. if backend wasn't restarted yet):
    // Persist a distinct customer entry so both this Admin's dashboard & Super Admin's dashboard update
    const localAdded = readLocalJson(ADDED_CUSTOMERS_STORAGE_KEY, []);
    const syntheticId = Date.now();
    const newRecord = {
      customer_id: syntheticId,
      customer_name: String(customerData?.customer_name || "").trim(),
      company_name: customerData?.company_name?.trim() || null,
      email: customerData?.email?.trim() || null,
      phone: customerData?.phone?.trim() || null,
      address: customerData?.address?.trim() || null,
      city: customerData?.city?.trim() || null,
      country: customerData?.country?.trim() || null,
      tax_number: customerData?.tax_number?.trim() || null,
      notes: customerData?.notes?.trim() || null,
      created_by: currentUserId,
      created_by_role: currentRole,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    writeLocalJson(ADDED_CUSTOMERS_STORAGE_KEY, [
      newRecord,
      ...(Array.isArray(localAdded) ? localAdded : []),
    ]);
  }

  return result;
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

// Delete single notification
export async function deleteNotification(id) {
  const response = await fetch(`${API_BASE_URL}/api/notifications/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  return await handleResponse(response);
}

// Clear all notifications
export async function clearAllNotifications() {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/clear-all`,
    {
      method: "DELETE",
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
