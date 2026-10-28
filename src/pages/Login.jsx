
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
    Mail,
    LockKeyhole,
    Eye,
    EyeOff,
    ShieldCheck,
    FileText,
    Receipt,
    CreditCard,
    TrendingUp,
    AlertCircle,
} from "lucide-react";

import { loginUser } from "../services/authService";
import { useCompanyBranding } from "../hooks/useCompanyBranding";
import "./login.css";

export default function Login() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { logoUrl, companyName } = useCompanyBranding();

    // Store the login form values.
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);

    // Control the password visibility and submission state.
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(() =>
        searchParams.get("session") === "expired"
            ? "Your session expired. Please sign in again to continue."
            : ""
    );

    // Handle form submission and authenticate the user.
    async function handleSubmit(event) {
        event.preventDefault();
        setError("");

        if (!email.trim() || !password) {
            setError("Please enter your email address and password.");
            return;
        }

        setLoading(true);

        try {
            // Send the login credentials to the backend.
            const data = await loginUser(email.trim(), password);
            const user = data?.user;

            if (!user || !data.token) {
                throw new Error(
                    "The server returned an incomplete authentication response."
                );
            }

            // Allow access only to authorized administrative roles.
            const role = String(user.role || "")
                .trim()
                .toLowerCase();

            if (role !== "admin" && role !== "super admin") {
                throw new Error(
                    "Your account does not have an authorized portal role."
                );
            }

            // Remove stale credentials so requests cannot reuse a previous session token.
            for (const storage of [localStorage, sessionStorage]) {
                storage.removeItem("authToken");
                storage.removeItem("authUser");
            }

            const storage = rememberMe ? localStorage : sessionStorage;

            storage.setItem("authToken", data.token);
            storage.setItem("authUser", JSON.stringify(user));

            // Navigate the user to the dashboard assigned to their role.
            if (role === "super admin") {
                navigate("/super-admin-dashboard", { replace: true });
            } else {
                navigate("/admin-dashboard", { replace: true });
            }
        } catch (err) {
            setError(
                err.message ||
                    "Unable to sign in. Please check your email and password."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="login-page">
            <div className="login-layout">
                {/* Left panel: Product branding and finance features. */}
                <section className="login-intro">
                    <div className="intro-background" aria-hidden="true" />
                    <div className="intro-shade" aria-hidden="true" />

                    <div className="intro-content">
                        <header className="brand-header">
                            <img
                                src={logoUrl || "/logo.jpg"}
                                alt={companyName || "Company logo"}
                                className="brand-logo"
                                onError={(e) => {
                                    if (e.currentTarget.src !== window.location.origin + "/logo.jpg") {
                                        e.currentTarget.src = "/logo.jpg";
                                    }
                                }}
                            />

                            <div className="brand-name">
                                <span>{companyName || "Invoice & Quotation"}</span>
                                <span>Management System</span>
                            </div>
                        </header>

                        <div className="intro-copy">
                            <span className="intro-eyebrow">
                                FINANCE WORKSPACE
                            </span>

                            <h1>
                                Simplify Your
                                <br />
                                Business Finance
                            </h1>

                            <p className="intro-description">
                                From the first quotation to the final payment,
                                manage your business documents in one place.
                            </p>

                            <div className="intro-accent" />
                        </div>

                        <div className="feature-list">
                            <div className="feature-item">
                                <FileText className="feature-icon" />
                                <span>Create Invoices</span>
                            </div>

                            <div className="feature-item">
                                <Receipt className="feature-icon" />
                                <span>Manage Quotations</span>
                            </div>

                            <div className="feature-item">
                                <CreditCard className="feature-icon" />
                                <span>Track Payments</span>
                            </div>

                            <div className="feature-item">
                                <TrendingUp className="feature-icon" />
                                <span>Business Insights</span>
                            </div>
                        </div>

                        <footer className="intro-footer">
                            <span>SMARTER DOCUMENTS.</span>
                            <span>SIMPLER FINANCES.</span>
                        </footer>
                    </div>
                </section>

                {/* Right panel: Secure sign-in form. */}
                <section className="login-panel">
                    <div className="secure-label">
                        <ShieldCheck size={16} />
                        <span>Secure Staff Access</span>
                    </div>

                    <div className="login-form-container">
                        {/* Center the welcome heading and supporting text. */}
                        <div className="login-heading">
                            <h2>Welcome Back</h2>
                            <p>Sign in to your account to continue</p>
                        </div>

                        <form
                            onSubmit={handleSubmit}
                            className="login-form"
                        >
                            {/* Collect the user's email address. */}
                            <div className="form-field">
                                <label htmlFor="email">Email</label>

                                <div className="input-wrapper">
                                    <Mail className="input-icon" size={19} />

                                    <input
                                        id="email"
                                        type="email"
                                        autoComplete="username"
                                        placeholder="Enter your email address"
                                        value={email}
                                        onChange={(event) =>
                                            setEmail(event.target.value)
                                        }
                                        required
                                    />
                                </div>
                            </div>

                            {/* Collect the user's password. */}
                            <div className="form-field">
                                <label htmlFor="password">Password</label>

                                <div className="input-wrapper">
                                    <LockKeyhole
                                        className="input-icon"
                                        size={19}
                                    />

                                    <input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(event) =>
                                            setPassword(event.target.value)
                                        }
                                        required
                                    />

                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() =>
                                            setShowPassword((previous) => !previous)
                                        }
                                        aria-label={
                                            showPassword
                                                ? "Hide password"
                                                : "Show password"
                                        }
                                    >
                                        {showPassword ? (
                                            <EyeOff size={19} />
                                        ) : (
                                            <Eye size={19} />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Display authentication errors when necessary. */}
                            {error && (
                                <div className="login-error" role="alert">
                                    <AlertCircle size={17} />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Provide remember-me and password-recovery options. */}
                            <div className="login-options">
                                <label className="remember-option">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(event) =>
                                            setRememberMe(event.target.checked)
                                        }
                                    />
                                    <span>Remember me</span>
                                </label>

                                <Link
                                    to="/forgot-password"
                                    className="forgot-link"
                                >
                                    Forgot password?
                                </Link>
                            </div>

                            {/* Submit the login credentials. */}
                            <button
                                type="submit"
                                className="sign-in-button"
                                disabled={loading}
                            >
                                {loading ? "Signing in..." : "Sign In"}
                            </button>

                            {/* Explain who is authorized to use the system. */}
                            <div className="access-notice">
                                <div className="notice-icon">
                                    <LockKeyhole size={22} />
                                </div>

                                <div className="notice-content">
                                    <p>
                                        Authorized Admin and Super Admin users
                                        only.
                                    </p>
                                    <span>
                                        Contact your Super Admin to request
                                        access.
                                    </span>
                                </div>
                            </div>
                        </form>

                        <div className="login-bottom-label">
                            <span />
                            <p>INVOICE &amp; QUOTATION MANAGEMENT SYSTEM</p>
                            <span />
                        </div>
                    </div>

                    <footer className="login-panel-footer">
                        Authorized personnel only
                    </footer>
                </section>
            </div>
        </main>
    );
}
