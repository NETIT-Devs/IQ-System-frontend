import API_BASE_URL from "./api";

// Send login details to the existing backend API.
export async function loginUser(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email,
                password,
            }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Login failed. Please try again.");
        }

        return data;
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error(
                "Cannot connect to the server. Please check that the backend is running at " + API_BASE_URL
            );
        }
        throw error;
    }
}

// Submit registration details.
// Integrates with backend endpoint /api/auth/register if supported,
// or gracefully informs the user if public registration is not enabled.
export async function registerUser({ fullName, email, password, confirmPassword }) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                fullName,
                email,
                password,
                confirmPassword,
            }),
        });

        // If the backend has no registration route (returns 404)
        if (response.status === 404) {
            throw new Error(
                "Public account registration is not supported by this system. Accounts must be provisioned directly by a Super Admin."
            );
        }

        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.success) {
            throw new Error(
                data?.message || "Registration failed. Please check your information and try again."
            );
        }

        return data;
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error(
                "Cannot connect to the server. Please check that the backend is running."
            );
        }
        throw error;
    }
}

// Request a password reset email via the confirmed backend endpoint.
export async function requestPasswordReset(email) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.success) {
            throw new Error(
                data?.message || "Password reset request failed. Please try again later."
            );
        }

        return data;
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error(
                "Cannot connect to the server. Please check that the backend is running."
            );
        }
        throw error;
    }
}

// Submit a new password with the reset token via the confirmed backend endpoint.
export async function resetPassword({ token, newPassword, confirmPassword }) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                token,
                newPassword,
                confirmPassword,
            }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.success) {
            throw new Error(
                data?.message || "Password reset failed. The link may be invalid or expired."
            );
        }

        return data;
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error(
                "Cannot connect to the server. Please check that the backend is running."
            );
        }
        throw error;
    }
}