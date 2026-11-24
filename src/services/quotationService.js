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
    const errorDetails =
      Array.isArray(data?.errors) && data.errors.length > 0
        ? `: ${data.errors.join(", ")}`
        : "";
    const errorMessage =
      (data?.message ? `${data.message}${errorDetails}` : null) ||
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

// Fetch next global sequential quotation number (QUO-YYMM-NNN)
export async function getNextQuotationNumberApi(dateStr = "") {
  const qs = dateStr ? `?date=${encodeURIComponent(dateStr)}` : "";
  const response = await fetch(`${API_BASE_URL}/api/quotations/next-number${qs}`, {
    method: "GET",
    headers: getHeaders(),
  });
  const data = await handleResponse(response);
  return data?.quotation_number || "";
}

// Fetch all quotations with items
export async function getQuotations(params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `${API_BASE_URL}/api/quotations${query ? `?${query}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await handleResponse(response);
  const quotations = data?.quotations || [];
  if (!params.for_invoice) {
    writeLocalJson("iq_quotations", quotations);
  }
  return quotations;
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
const SUPER_ADMIN_CUSTOMERS_STORAGE_KEY = "iq_super_admin_customers_v1";
const ALL_CUSTOMERS_STORAGE_KEY = "iq_all_existing_customers_v1";
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

  if (Array.isArray(data?.super_admin_customers)) {
    writeLocalJson(SUPER_ADMIN_CUSTOMERS_STORAGE_KEY, data.super_admin_customers);
  }
  if (Array.isArray(data?.all_customers)) {
    writeLocalJson(ALL_CUSTOMERS_STORAGE_KEY, data.all_customers);
  }

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

  // Admin sees customers created by that specific Admin OR customers they have quotations/invoices for
  const backendCustomerIds = new Set(backendCustomers.map((c) => Number(c.customer_id)));

  if (currentUserId !== undefined && currentUserId !== null) {
    return activeList.filter(
      (c) =>
        (c.created_by != null && Number(c.created_by) === Number(currentUserId)) ||
        (creatorsMap[c.customer_id]?.created_by != null &&
          Number(creatorsMap[c.customer_id]?.created_by) === Number(currentUserId)) ||
        backendCustomerIds.has(Number(c.customer_id))
    );
  }

  return deletedIdSet.size > 0
    ? backendCustomers.filter((c) => !deletedIdSet.has(String(c.customer_id)))
    : backendCustomers;
}

// Fetch all registered customers across all creators (Super Admin and all Admins) specifically for Quotation Form dropdown
export async function getAllRegisteredCustomers() {
  let list = [];
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers?all=true`, {
      method: "GET",
      headers: getHeaders(),
    });

    const data = await handleResponse(response);
    if (Array.isArray(data?.all_customers) && data.all_customers.length > 0) {
      list = data.all_customers;
      writeLocalJson(ALL_CUSTOMERS_STORAGE_KEY, list);
    } else if (Array.isArray(data?.customers)) {
      list = data.customers;
      writeLocalJson(ALL_CUSTOMERS_STORAGE_KEY, list);
    }

    if (Array.isArray(data?.super_admin_customers)) {
      writeLocalJson(SUPER_ADMIN_CUSTOMERS_STORAGE_KEY, data.super_admin_customers);
    } else if (Array.isArray(list)) {
      const superList = list.filter((c) => {
        const role = String(c.created_by_role || "").trim().toLowerCase();
        return role === "super admin" || !c.created_by;
      });
      writeLocalJson(SUPER_ADMIN_CUSTOMERS_STORAGE_KEY, superList);
    }
  } catch (err) {
    console.error("Failed to fetch all registered customers:", err);
    list = readLocalJson(ALL_CUSTOMERS_STORAGE_KEY, []);
  }

  const localAdded = readLocalJson(ADDED_CUSTOMERS_STORAGE_KEY, []);
  const deletedIdsV1 = readLocalJson(DELETED_CUSTOMERS_STORAGE_KEY, []);
  const deletedIdsLegacy = readLocalJson(LEGACY_DELETED_CUSTOMERS_STORAGE_KEY, []);
  const deletedIdSet = new Set(
    [
      ...(Array.isArray(deletedIdsV1) ? deletedIdsV1 : []),
      ...(Array.isArray(deletedIdsLegacy) ? deletedIdsLegacy : []),
    ].map((id) => String(id))
  );

  const existingIds = new Set(list.map((c) => String(c.customer_id)));
  if (Array.isArray(localAdded)) {
    for (const item of localAdded) {
      if (item && item.customer_id && !existingIds.has(String(item.customer_id))) {
        list.unshift(item);
        existingIds.add(String(item.customer_id));
      }
    }
  }

  return deletedIdSet.size > 0
    ? list.filter((c) => !deletedIdSet.has(String(c.customer_id)))
    : list;
}

// Retrieve customers registered by Super Admin (used for Admin validation)
export function getSuperAdminCustomers() {
  const serverList = readLocalJson(SUPER_ADMIN_CUSTOMERS_STORAGE_KEY, []);
  const localAdded = readLocalJson(ADDED_CUSTOMERS_STORAGE_KEY, []);
  const creatorsMap = readLocalJson(CUSTOMER_CREATORS_STORAGE_KEY, {});

  const localSuperAdmin = (Array.isArray(localAdded) ? localAdded : []).filter((c) => {
    const role = c.created_by_role || creatorsMap[c.customer_id]?.role;
    return String(role || "").trim().toLowerCase() === "super admin";
  });

  const combined = [...(Array.isArray(serverList) ? serverList : []), ...localSuperAdmin];
  const seen = new Set();
  const result = [];

  for (const c of combined) {
    if (!c) continue;
    const nameKey = String(c.customer_name || "").trim().toLowerCase();
    const emailKey = String(c.email || "").trim().toLowerCase();
    const phoneKey = String(c.phone || "").trim();
    const key = `${nameKey}|${emailKey}|${phoneKey}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(c);
    }
  }

  return result;
}

// Check if a customer with the given name, email, or phone is already registered by Super Admin or another Admin
export function checkDuplicateCustomer(name, email, phone, currentCustomerId = null) {
  const normName = String(name || "").trim().toLowerCase();
  const normEmail = String(email || "").trim().toLowerCase();
  const normPhone = String(phone || "").trim();

  if (!normName && !normEmail && !normPhone) return null;

  const serverAll = readLocalJson(ALL_CUSTOMERS_STORAGE_KEY, []);
  const serverSuper = readLocalJson(SUPER_ADMIN_CUSTOMERS_STORAGE_KEY, []);
  const localAdded = readLocalJson(ADDED_CUSTOMERS_STORAGE_KEY, []);
  const creatorsMap = readLocalJson(CUSTOMER_CREATORS_STORAGE_KEY, {});

  const allKnown = [
    ...(Array.isArray(serverAll) ? serverAll : []),
    ...(Array.isArray(serverSuper) ? serverSuper : []),
    ...(Array.isArray(localAdded) ? localAdded : []),
  ];

  for (const c of allKnown) {
    if (!c) continue;
    if (currentCustomerId && Number(c.customer_id) === Number(currentCustomerId)) {
      continue;
    }

    const cName = String(c.customer_name || "").trim().toLowerCase();
    const cEmail = String(c.email || "").trim().toLowerCase();
    const cPhone = String(c.phone || "").trim();

    const nameMatch = normName && cName && normName === cName;
    const emailMatch = normEmail && cEmail && normEmail === cEmail;
    const phoneMatch = normPhone && cPhone && normPhone === cPhone;

    if (nameMatch || emailMatch || phoneMatch) {
      const role = String(
        c.creator_role ||
        c.created_by_role ||
        creatorsMap[c.customer_id]?.role ||
        ""
      )
        .trim()
        .toLowerCase();

      if (role === "super admin" || !c.created_by) {
        return "Super Admin already added this customer.";
      }
      return "This customer has already been added by an Admin.";
    }
  }

  return null;
}

// Identify existing customer strictly by matching BOTH name and email (used in QuotationForm new client mode)
export function checkDuplicateCustomerByNameAndEmail(
  name,
  email,
  knownCustomers = []
) {
  const normName = String(name || "").trim().toLowerCase();
  const normEmail = String(email || "").trim().toLowerCase();

  if (!normName || !normEmail) return null;

  const serverAll = readLocalJson(ALL_CUSTOMERS_STORAGE_KEY, []);
  const serverSuper = readLocalJson(SUPER_ADMIN_CUSTOMERS_STORAGE_KEY, []);
  const localAdded = readLocalJson(ADDED_CUSTOMERS_STORAGE_KEY, []);
  const creatorsMap = readLocalJson(CUSTOMER_CREATORS_STORAGE_KEY, {});

  const allKnown = [
    ...(Array.isArray(knownCustomers) ? knownCustomers : []),
    ...(Array.isArray(serverAll) ? serverAll : []),
    ...(Array.isArray(serverSuper) ? serverSuper : []),
    ...(Array.isArray(localAdded) ? localAdded : []),
  ];

  for (const c of allKnown) {
    if (!c) continue;

    const cName = String(c.customer_name || "").trim().toLowerCase();
    const cEmail = String(c.email || "").trim().toLowerCase();

    if (cName && cEmail && normName === cName && normEmail === cEmail) {
      const role = String(
        c.creator_role ||
          c.created_by_role ||
          creatorsMap[c.customer_id]?.role ||
          ""
      )
        .trim()
        .toLowerCase();

      if (role === "super admin" || !c.created_by) {
        return "Super Admin already added this customer.";
      }
      return "This customer has already been added by an Admin.";
    }
  }

  return null;
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

  let localTemplate = {};
  try {
    const rawTpl =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("iq_quotation_template_settings")
        : null;
    if (rawTpl) localTemplate = JSON.parse(rawTpl);
  } catch {
    // ignore
  }

  let localBranding = {};
  try {
    const rawBrand =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("company_branding")
        : null;
    if (rawBrand) localBranding = JSON.parse(rawBrand);
  } catch {
    // ignore
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/company-settings`, {
      method: "GET",
      headers: getHeaders(),
    });

    const data = await handleResponse(response);
    const c = data?.companySettings || data?.company;

    if (c) {
      const rawLogo = c.company_logo || localBranding.company_logo || localBranding.logo_url;
      const rawSig = c.company_signature || localBranding.company_signature || localBranding.signature_url;
      const resolvedLogo = resolveMediaUrl(rawLogo);
      const resolvedSignature = resolveMediaUrl(rawSig);

      return {
        ...defaultDetails,
        setting_id: c.setting_id,
        company_name: c.company_name || localBranding.company_name || "",
        company_logo: resolvedLogo,
        logo_url: resolvedLogo,
        company_signature: resolvedSignature,
        signature_url: resolvedSignature,
        company_address: c.company_address || localBranding.company_address || "",
        contact_number: c.contact_number || localBranding.contact_number || "",
        email_address: c.email_address || localBranding.email_address || "",
        bank_name: c.bank_name || localBranding.bank_name || "",
        bank_account_name: c.bank_account_name || localBranding.bank_account_name || "",
        bank_account_number: c.bank_account_number || localBranding.bank_account_number || "",
        bank_branch: c.bank_branch || localBranding.bank_branch || "",
        bank_swift_code: c.bank_swift_code || localBranding.bank_swift_code || "",
        default_terms_and_conditions:
          c.default_terms_and_conditions || localTemplate.default_terms_and_conditions || "",
        pdf_heading: c.pdf_heading || localTemplate.pdf_heading || "QUOTATION",
        pdf_subheading:
          c.pdf_subheading || localTemplate.pdf_subheading || "PROFESSIONAL SERVICES PROPOSAL",
        pdf_custom_lines: c.pdf_custom_lines || localTemplate.pdf_custom_lines || "",
        pdf_footer_note: c.pdf_footer_note || localTemplate.pdf_footer_note || "",
        pdf_custom_sections: c.pdf_custom_sections || localTemplate.pdf_custom_sections || "",
        quotation_thank_you_title:
          c.quotation_thank_you_title || localTemplate.quotation_thank_you_title || "Thank You",
        quotation_thank_you_message:
          c.quotation_thank_you_message || localTemplate.quotation_thank_you_message || "",
        quotation_prepared_by:
          c.quotation_prepared_by || localTemplate.quotation_prepared_by || "NetIT Technology",
        quotation_prepared_by_services:
          c.quotation_prepared_by_services ||
          localTemplate.quotation_prepared_by_services ||
          "Web Development • Software Solutions • Digital Marketing",
        quotation_ceo_name:
          c.quotation_ceo_name || localTemplate.quotation_ceo_name || "D M N K DISSANAYAKA",
        quotation_ceo_designation:
          c.quotation_ceo_designation || localTemplate.quotation_ceo_designation || "CEO (NetIT Technology)",
        updated_by: c.updated_by || defaultDetails.updated_by,
        created_at: c.created_at,
        updated_at: c.updated_at,
        prepared_by:
          c.quotation_prepared_by || localTemplate.quotation_prepared_by || defaultDetails.prepared_by,
        address: c.company_address || localBranding.company_address || "",
        phone: c.contact_number || localBranding.contact_number || "",
        email: c.email_address || localBranding.email_address || "",
      };
    }
  } catch (err) {
    console.error("Failed to fetch company details from backend:", err);
    if (localBranding.company_name || localTemplate.pdf_heading) {
      const rawLogo = localBranding.company_logo || localBranding.logo_url;
      const rawSig = localBranding.company_signature || localBranding.signature_url;
      const resolvedLogo = resolveMediaUrl(rawLogo);
      const resolvedSignature = resolveMediaUrl(rawSig);

      return {
        ...defaultDetails,
        company_name: localBranding.company_name || "",
        company_logo: resolvedLogo,
        logo_url: resolvedLogo,
        company_signature: resolvedSignature,
        signature_url: resolvedSignature,
        company_address: localBranding.company_address || "",
        contact_number: localBranding.contact_number || "",
        email_address: localBranding.email_address || "",
        bank_name: localBranding.bank_name || "",
        bank_account_name: localBranding.bank_account_name || "",
        bank_account_number: localBranding.bank_account_number || "",
        bank_branch: localBranding.bank_branch || "",
        bank_swift_code: localBranding.bank_swift_code || "",
        default_terms_and_conditions: localTemplate.default_terms_and_conditions || "",
        pdf_heading: localTemplate.pdf_heading || "QUOTATION",
        pdf_subheading: localTemplate.pdf_subheading || "PROFESSIONAL SERVICES PROPOSAL",
        pdf_custom_lines: localTemplate.pdf_custom_lines || "",
        pdf_footer_note: localTemplate.pdf_footer_note || "",
        pdf_custom_sections: localTemplate.pdf_custom_sections || "",
        quotation_thank_you_title: localTemplate.quotation_thank_you_title || "Thank You",
        quotation_thank_you_message: localTemplate.quotation_thank_you_message || "",
        quotation_prepared_by: localTemplate.quotation_prepared_by || "NetIT Technology",
        quotation_prepared_by_services: localTemplate.quotation_prepared_by_services || "Web Development • Software Solutions • Digital Marketing",
        quotation_ceo_name: localTemplate.quotation_ceo_name || "D M N K DISSANAYAKA",
        quotation_ceo_designation: localTemplate.quotation_ceo_designation || "CEO (NetIT Technology)",
        address: localBranding.company_address || "",
        phone: localBranding.contact_number || "",
        email: localBranding.email_address || "",
      };
    }
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

// ----------------------------------------------------
// System Notifications (Real-time & Persistent)
// ----------------------------------------------------

const NOTIFICATIONS_STORAGE_KEY = "iq_system_notifications_v2";

export function readStorageNotifications() {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeStorageNotifications(notifications) {
  try {
    localStorage.setItem(
      NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify(Array.isArray(notifications) ? notifications : [])
    );
  } catch {
    // ignore storage quota errors
  }
}

export function notifyNotificationsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("iq-notifications-updated"));
  }
}

// Add a notification with persistent storage and broadcast
export async function addNotification(notif) {
  const notifId =
    notif.notification_id ||
    `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const fullNotif = {
    notification_id: notifId,
    title: notif.title || "Notification",
    message: notif.message || "",
    type: notif.type || "info", // "warning" | "success" | "error" | "info"
    reference_type: notif.reference_type || notif.referenceType || "quotation", // "quotation" | "invoice"
    reference_id: notif.reference_id ?? notif.referenceId ?? null,
    target_role: notif.target_role || notif.targetRole || "all", // "super_admin" | "admin" | "all"
    target_user_id: notif.target_user_id ?? notif.targetUserId ?? null,
    created_by: notif.created_by ?? notif.createdBy ?? null,
    created_by_name: notif.created_by_name || notif.createdByName || null,
    created_at: notif.created_at || new Date().toISOString(),
    is_read: notif.is_read ? 1 : 0,
  };

  const current = readStorageNotifications();
  const next = [
    fullNotif,
    ...current.filter((n) => n.notification_id !== notifId),
  ].slice(0, 100);

  writeStorageNotifications(next);
  notifyNotificationsChanged();

  // Try optional backend sync silently
  try {
    await fetch(`${API_BASE_URL}/api/notifications`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(fullNotif),
    });
  } catch {
    // backend silent fallback
  }

  return fullNotif;
}

// Fetch user notifications (local storage with graceful backend sync)
export async function getNotifications() {
  let backendList = [];
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data?.notifications)) {
        backendList = data.notifications;
      } else if (Array.isArray(data)) {
        backendList = data;
      }
    }
  } catch {
    // backend offline or not mounted
  }

  const localList = readStorageNotifications();
  if (backendList.length > 0) {
    const map = new Map();
    localList.forEach((n) => map.set(String(n.notification_id), n));
    backendList.forEach((n) => {
      const key = String(n.notification_id);
      map.set(key, { ...(map.get(key) || {}), ...n });
    });
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );
    writeStorageNotifications(merged);
    return merged;
  }

  return localList;
}

// Mark single notification as read
export async function markNotificationRead(id) {
  const current = readStorageNotifications();
  const updated = current.map((n) =>
    String(n.notification_id) === String(id) ? { ...n, is_read: 1 } : n
  );
  writeStorageNotifications(updated);
  notifyNotificationsChanged();

  try {
    await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
      method: "PUT",
      headers: getHeaders(),
    });
  } catch {
    // ignore
  }

  return { success: true };
}

// Mark all notifications as read (optionally filtered by reference type / user)
export async function markAllNotificationsRead(filterType = "all", userId = null) {
  const current = readStorageNotifications();
  const updated = current.map((n) => {
    let match = true;
    if (filterType === "quotation") {
      match =
        n.reference_type === "quotation" ||
        n.title?.toLowerCase().includes("quotation");
    } else if (filterType === "invoice") {
      match =
        n.reference_type === "invoice" ||
        n.title?.toLowerCase().includes("invoice");
    }
    if (userId && n.target_user_id && String(n.target_user_id) !== String(userId)) {
      match = false;
    }
    return match ? { ...n, is_read: 1 } : n;
  });
  writeStorageNotifications(updated);
  notifyNotificationsChanged();

  try {
    await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
      method: "PUT",
      headers: getHeaders(),
    });
  } catch {
    // ignore
  }

  return { success: true };
}

// Delete single notification
export async function deleteNotification(id) {
  const current = readStorageNotifications();
  const updated = current.filter(
    (n) => String(n.notification_id) !== String(id)
  );
  writeStorageNotifications(updated);
  notifyNotificationsChanged();

  try {
    await fetch(`${API_BASE_URL}/api/notifications/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
  } catch {
    // ignore
  }

  return { success: true };
}

// Clear all notifications (optionally filtered by reference type / user)
export async function clearAllNotifications(filterType = "all", userId = null) {
  const current = readStorageNotifications();
  const updated = current.filter((n) => {
    let match = true;
    if (filterType === "quotation") {
      match =
        n.reference_type === "quotation" ||
        n.title?.toLowerCase().includes("quotation");
    } else if (filterType === "invoice") {
      match =
        n.reference_type === "invoice" ||
        n.title?.toLowerCase().includes("invoice");
    }
    if (userId && n.target_user_id && String(n.target_user_id) !== String(userId)) {
      match = false;
    }
    return !match;
  });
  writeStorageNotifications(updated);
  notifyNotificationsChanged();

  try {
    await fetch(`${API_BASE_URL}/api/notifications/clear-all`, {
      method: "DELETE",
      headers: getHeaders(),
    });
  } catch {
    // ignore
  }

  return { success: true };
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
