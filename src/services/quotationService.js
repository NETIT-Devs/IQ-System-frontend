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
        ? "Session expired. Please log in again."
        : response.status === 404
        ? "Requested resource was not found."
        : `Request failed with status ${response.status}`);
    throw new Error(errorMessage);
  }

  return data;
}

// Fetch active service catalog options (WordPress Website, React Website, Custom Website, Website Maintenance)
export async function getQuotationItemOptions() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/quotations/item-options`, {
      method: "GET",
      headers: getHeaders(),
    });

    const data = await handleResponse(response);
    return data?.items || [];
  } catch (error) {
    console.error("Failed to load service options:", error);
    // Fallback default software services if backend service catalog is temporarily unreachable
    return [
      {
        service_id: 1,
        item_name: "WordPress Website",
        description: "WordPress website design and development.",
        hosting_domain: "Domain and hosting setup assistance.",
        core_features: "WordPress CMS, responsive design, page layouts and contact forms.",
        maintenance_support: "Bug fixes and maintenance as agreed.",
        content_seo: "Basic SEO setup and content structure.",
        default_price: "0.00",
      },
      {
        service_id: 2,
        item_name: "React Website",
        description: "Modern responsive website built with React.",
        hosting_domain: "Hosting and domain setup assistance.",
        core_features: "React components, responsive layouts and interactive UI.",
        maintenance_support: "Technical support and bug fixes as agreed.",
        content_seo: "Basic on-page SEO and metadata setup.",
        default_price: "0.00",
      },
      {
        service_id: 4,
        item_name: "Custom Website",
        description: "Website designed according to customer requirements.",
        hosting_domain: "Hosting and domain setup assistance.",
        core_features: "Custom pages, layouts and agreed business features.",
        maintenance_support: "Maintenance according to the agreed service scope.",
        content_seo: "Content structure and basic SEO setup.",
        default_price: "0.00",
      },
      {
        service_id: 5,
        item_name: "Website Maintenance",
        description: "Website maintenance and technical support service.",
        hosting_domain: "Existing hosting and domain configuration support.",
        core_features: "Updates, backups and website health checks as agreed.",
        maintenance_support: "Bug fixes and ongoing support according to the selected plan.",
        content_seo: "Content updates and basic SEO checks as agreed.",
        default_price: "0.00",
      },
    ];
  }
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
  if (url.startsWith("/uploads/")) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
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
    company_name: "IQ Management & Software Solutions",
    company_logo: "/logo.jpg",
    company_signature: "",
    company_address: "Colombo, Sri Lanka",
    contact_number: "",
    email_address: "",
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_branch: "",
    bank_swift_code: "",
    default_terms_and_conditions: "",
    updated_by: currentUser?.full_name || currentUser?.email || "Admin",
    created_at: null,
    updated_at: null,
    logo_url: "/logo.jpg",
    prepared_by: currentUser?.full_name || currentUser?.email || "Admin",
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/company-settings`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.company) {
        const c = data.company;
        const resolvedLogo = resolveMediaUrl(c.company_logo) || "/logo.jpg";
        const resolvedSignature = resolveMediaUrl(c.company_signature) || "";

        return {
          setting_id: c.setting_id,
          company_name: c.company_name || defaultDetails.company_name,
          company_logo: resolvedLogo,
          logo_url: resolvedLogo,
          company_signature: resolvedSignature,
          company_address: c.company_address || "",
          contact_number: c.contact_number || "",
          email_address: c.email_address || "",
          bank_name: c.bank_name || "",
          bank_account_name: c.bank_account_name || "",
          bank_account_number: c.bank_account_number || "",
          bank_branch: c.bank_branch || "",
          bank_swift_code: c.bank_swift_code || "",
          default_terms_and_conditions: c.default_terms_and_conditions || "",
          updated_by: c.updated_by || defaultDetails.updated_by,
          created_at: c.created_at,
          updated_at: c.updated_at,
          prepared_by: defaultDetails.prepared_by,
          // Field aliases for backward compatibility with different components
          address: c.company_address || "",
          phone: c.contact_number || "",
          email: c.email_address || "",
        };
      }
    }
  } catch (err) {
    console.error("Failed to fetch company details from backend:", err);
  }

  return defaultDetails;
}
