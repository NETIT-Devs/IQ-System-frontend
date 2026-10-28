import { useState, useEffect, useCallback } from "react";
import API_BASE_URL from "../services/api";

/**
 * Retrieve cached company branding for instant UI rendering without flicker.
 */
function getCachedBranding() {
  try {
    const cached = localStorage.getItem("company_branding");
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

/**
 * Resolve relative uploads path to absolute server URL.
 */
export function resolveCompanyMediaUrl(path) {
  if (!path) return "";
  if (
    path.startsWith("data:") ||
    path.startsWith("http://") ||
    path.startsWith("https://")
  ) {
    return path;
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Custom React hook for dynamic company branding across sidebar, headers, and login page.
 */
export function useCompanyBranding() {
  const cached = getCachedBranding();
  const [branding, setBranding] = useState({
    companyName: cached?.company_name || "Invoice & Quotation",
    logoUrl: cached?.company_logo
      ? resolveCompanyMediaUrl(cached.company_logo)
      : "/logo.jpg",
    signatureUrl: cached?.company_signature
      ? resolveCompanyMediaUrl(cached.company_signature)
      : "",
    email: cached?.email_address || "",
    phone: cached?.contact_number || "",
    address: cached?.company_address || "",
    loading: false,
  });

  const fetchBranding = useCallback(async () => {
    try {
      const token =
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken");

      const headers = token
        ? {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          }
        : { "Content-Type": "application/json" };

      // Use authenticated endpoint if user is logged in, or public endpoint on login page
      const endpoint = token
        ? `${API_BASE_URL}/api/company-settings`
        : `${API_BASE_URL}/api/company-settings/public`;

      const res = await fetch(endpoint, { headers });
      if (!res.ok) return;

      const data = await res.json();
      const c = data?.companySettings || data?.company;

      if (c) {
        localStorage.setItem("company_branding", JSON.stringify(c));
        setBranding({
          companyName: c.company_name || "Invoice & Quotation",
          logoUrl: c.company_logo
            ? resolveCompanyMediaUrl(c.company_logo)
            : "/logo.jpg",
          signatureUrl: c.company_signature
            ? resolveCompanyMediaUrl(c.company_signature)
            : "",
          email: c.email_address || "",
          phone: c.contact_number || "",
          address: c.company_address || "",
          loading: false,
        });
      }
    } catch (err) {
      console.warn("Could not fetch company branding:", err);
    }
  }, []);

  useEffect(() => {
    fetchBranding();

    const handleUpdate = () => {
      fetchBranding();
    };

    window.addEventListener("company-settings-updated", handleUpdate);
    return () => {
      window.removeEventListener("company-settings-updated", handleUpdate);
    };
  }, [fetchBranding]);

  return branding;
}
