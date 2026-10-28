import API_BASE_URL from "./api";

function getAuthToken() {
  return (
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    ""
  );
}

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

async function handleResponse(response) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg =
      data?.message ||
      (response.status === 401
        ? "Session expired. Please log in again."
        : response.status === 403
        ? "Access denied. Super Admin privileges required."
        : `Request failed with status ${response.status}`);
    throw new Error(errorMsg);
  }

  return data;
}

export async function fetchUsers() {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: "GET",
    headers: getHeaders(),
  });
  const data = await handleResponse(response);
  return data?.users || [];
}

export async function createAdminUser({ username, email, password, role = "Admin" }) {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      username: username.trim(),
      full_name: username.trim(),
      email: email.trim().toLowerCase(),
      password,
      role,
    }),
  });
  return await handleResponse(response);
}

export async function updateUserAccount(userId, payload) {
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return await handleResponse(response);
}

export async function toggleUserAccountStatus(userId) {
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}/status`, {
    method: "PATCH",
    headers: getHeaders(),
  });
  return await handleResponse(response);
}

export async function deleteUserAccount(userId) {
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  return await handleResponse(response);
}
