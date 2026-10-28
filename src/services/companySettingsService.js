import API_BASE_URL from "./api";
import { resolveCompanyMediaUrl } from "../hooks/useCompanyBranding";

/**
 * Helper to retrieve stored auth token for requests.
 */
function getAuthToken() {
  return (
    localStorage.getItem("authToken") || sessionStorage.getItem("authToken")
  );
}

/**
 * Handle API JSON response or throw error.
 */
async function handleResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const errorMsg =
      data?.message ||
      data?.error ||
      `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

/**
 * Retrieve current company settings.
 */
export async function getCompanySettings() {
  const token = getAuthToken();
  const headers = token
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    : { "Content-Type": "application/json" };

  const endpoint = token
    ? `${API_BASE_URL}/api/company-settings`
    : `${API_BASE_URL}/api/company-settings/public`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers,
  });

  const data = await handleResponse(response);
  const settings = data?.companySettings || data?.company || {};

  return {
    ...settings,
    logo_url: resolveCompanyMediaUrl(settings.company_logo),
    signature_url: resolveCompanyMediaUrl(settings.company_signature),
  };
}

/**
 * Update company profile, bank, and quotation settings.
 */
export async function updateCompanySettings(settingsData) {
  const token = getAuthToken();
  if (!token) throw new Error("Authentication required to update company settings.");

  const response = await fetch(`${API_BASE_URL}/api/company-settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(settingsData),
  });

  const data = await handleResponse(response);

  // Notify listeners to update sidebar, login, and header branding
  window.dispatchEvent(new Event("company-settings-updated"));

  return data;
}

/**
 * Upload official company logo image.
 */
export async function uploadCompanyLogo(file) {
  const token = getAuthToken();
  if (!token) throw new Error("Authentication required to upload company logo.");

  const formData = new FormData();
  formData.append("company_logo", file);

  const response = await fetch(`${API_BASE_URL}/api/company-settings/logo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await handleResponse(response);

  // Notify listeners to update logo across the whole app
  window.dispatchEvent(new Event("company-settings-updated"));

  return data;
}

/**
 * Upload authorized digital signature image.
 */
export async function uploadCompanySignature(file) {
  const token = getAuthToken();
  if (!token) throw new Error("Authentication required to upload digital signature.");

  const formData = new FormData();
  formData.append("company_signature", file);

  const response = await fetch(
    `${API_BASE_URL}/api/company-settings/signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  const data = await handleResponse(response);

  // Notify listeners to update signature
  window.dispatchEvent(new Event("company-settings-updated"));

  return data;
}

/**
 * Remove company logo.
 */
export async function removeCompanyLogo() {
  const result = await updateCompanySettings({ company_logo: null });
  window.dispatchEvent(new Event("company-settings-updated"));
  return result;
}

/**
 * Remove company digital signature.
 */
export async function removeCompanySignature() {
  const result = await updateCompanySettings({ company_signature: null });
  window.dispatchEvent(new Event("company-settings-updated"));
  return result;
}
