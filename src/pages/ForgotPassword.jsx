import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, ShieldCheck, Send } from "lucide-react";
import { requestPasswordReset } from "../services/authService";
import "./ForgotPassword.css";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    async function handleSubmit(event) {
        event.preventDefault();

        setMessage("");
        setError("");

        if (!email.trim()) {
            setError("Please enter your email address.");
            return;
        }

        setLoading(true);

        try {
            const response = await requestPasswordReset(email.trim());

            setMessage(
                response?.message ||
                    "If an account exists with this email, a password reset link will be sent."
            );

            setEmail("");
        } catch (err) {
            setError(
                err.message ||
                    "Unable to send the reset link. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="forgot-page">
            <section className="forgot-card">
                <div className="forgot-brand">
                    <div className="forgot-brand-icon">
                        <Mail size={27} />
                    </div>

                    <div className="forgot-brand-text">
                        <span>Invoice &amp; Quotation</span>
                        <span>Management System</span>
                    </div>
                </div>

                <div className="forgot-heading">
                    <h1>Forgot Password?</h1>

                    <p>
                        No worries! Enter your registered email address
                        and we will send you a link to reset your password.
                    </p>
                </div>

                <form
                    className="forgot-form"
                    onSubmit={handleSubmit}
                >
                    <div className="forgot-field">
                        <label htmlFor="reset-email">
                            Email Address
                        </label>

                        <div className="forgot-input-wrapper">
                            <Mail
                                size={19}
                                className="forgot-input-icon"
                            />

                            <input
                                id="reset-email"
                                type="email"
                                autoComplete="email"
                                placeholder="Enter your email address"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div
                            className="forgot-message error"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}

                    {message && (
                        <div
                            className="forgot-message success"
                            role="status"
                        >
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="forgot-submit-button"
                        disabled={loading}
                    >
                        <Send size={18} />

                        <span>
                            {loading
                                ? "Sending Reset Link..."
                                : "Send Reset Link"}
                        </span>
                    </button>
                </form>

                <div className="forgot-security-note">
                    <ShieldCheck size={19} />

                    <p>
                        Your account security is important to us.
                        Never share your password or reset link with anyone.
                    </p>
                </div>

                <Link
                    to="/"
                    className="forgot-back-link"
                >
                    <ArrowLeft size={18} />

                    <span>Back to Sign In</span>
                </Link>

                <div className="forgot-footer">
                    INVOICE &amp; QUOTATION MANAGEMENT SYSTEM
                </div>
            </section>
        </main>
    );
}
