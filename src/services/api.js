// Central API configuration.
// The URL can be changed in the frontend .env file.

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default API_BASE_URL;