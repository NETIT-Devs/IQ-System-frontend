import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
    FileText,
    LockKeyhole,
    Eye,
    EyeOff,
    ArrowRight,
    ArrowLeft,
    CheckCircle2,
    FileCheck,
    CreditCard,
    Receipt,
    AlertCircle,
    Info,
} from "lucide-react";

import { resetPassword } from "../services/authService";

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token") || "";

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");

        if (!token) {
            setError("Reset token is missing. Please use the complete link sent to your email.");
            return;
        }

        if (!newPassword || !confirmPassword) {
            setError("Both password fields are required.");
            return;
        }

        if (newPassword.length < 8) {
            setError("New password must be at least 8 characters long.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match. Please verify both fields.");
            return;
        }

        setLoading(true);

        try {
            await resetPassword({
                token,
                newPassword,
                confirmPassword,
            });
            setSuccess(true);
        } catch (err) {
            setError(err.message || "Failed to reset password. The link may have expired.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen w-full bg-slate-100/80 flex items-center justify-center p-3 sm:p-5">
            {/* Unified Centered Modern SaaS Card */}
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl shadow-slate-200/70 border border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
                
                {/* Left Side: Consistent Enterprise Branding */}
                <section className="relative hidden lg:flex lg:col-span-5 flex-col justify-between bg-[#081836] p-7 text-white overflow-hidden select-none">
                    <div className="pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full bg-blue-500/15 blur-2xl" />
                    <div className="pointer-events-none absolute -bottom-16 -left-12 h-64 w-64 rounded-full bg-indigo-600/15 blur-2xl" />

                    <div className="relative z-10 flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-sm">
                            <FileText size={17} className="text-white" />
                        </div>
                        <div>
                            <span className="text-sm font-bold tracking-tight text-white">InvoiceFlow</span>
                            <span className="ml-1.5 rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-blue-200">
                                SaaS
                            </span>
                        </div>
                    </div>

                    <div className="relative z-10 my-auto py-3">
                        <h1 className="text-xl xl:text-2xl font-bold leading-tight text-white">
                            Simplify Your Business Finances
                        </h1>
                        <p className="mt-1.5 text-xs text-slate-300 leading-relaxed max-w-xs">
                            Manage invoices, quotations, and payments in one organized workspace.
                        </p>

                        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm shadow-md">
                            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-md bg-blue-500/20 flex items-center justify-center text-blue-300">
                                        <Receipt size={13} />
                                    </div>
                                    <span className="text-[11px] font-semibold text-white tracking-wide">
                                        Password Security
                                    </span>
                                </div>
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[9px] font-medium text-blue-300">
                                    256-Bit
                                </span>
                            </div>

                            <p className="mt-2 text-[11px] text-slate-300 leading-relaxed">
                                Enter your new portal password to restore secure access to your invoices and quotations.
                            </p>

                            <div className="mt-3 pt-2.5 border-t border-white/10 grid grid-cols-3 gap-1.5 text-[10px] text-slate-300">
                                <div className="flex items-center gap-1">
                                    <FileCheck size={11} className="text-blue-400 shrink-0" />
                                    <span className="truncate">Invoices</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <CheckCircle2 size={11} className="text-blue-400 shrink-0" />
                                    <span className="truncate">Quotations</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <CreditCard size={11} className="text-blue-400 shrink-0" />
                                    <span className="truncate">Payments</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 text-[10px] text-slate-400 flex items-center justify-between border-t border-white/10 pt-2.5">
                        <span>© 2026 InvoiceFlow System</span>
                        <span className="text-slate-500">v2.4 Enterprise</span>
                    </div>
                </section>

                {/* Right Side: Reset Password Card */}
                <section className="col-span-1 lg:col-span-7 flex flex-col justify-center px-6 py-7 sm:px-9 sm:py-8">
                    <div className="w-full max-w-[360px] mx-auto">
                        
                        {/* Logo */}
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-700 text-white shadow-xs">
                                <FileText size={15} />
                            </div>
                            <span className="text-sm font-bold text-slate-900 tracking-tight">InvoiceFlow</span>
                        </div>

                        {/* Heading */}
                        <div className="mb-4">
                            <h2 className="text-xl font-bold tracking-tight text-slate-900">
                                Set New Password
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Enter and confirm your new password below.
                            </p>
                        </div>

                        {!token && !success && (
                            <div
                                role="alert"
                                className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 leading-tight flex items-start gap-1.5"
                            >
                                <Info size={14} className="text-amber-700 shrink-0 mt-0.5" />
                                <span>
                                    No reset token found in URL. Please click the exact link from your email.
                                </span>
                            </div>
                        )}

                        {success ? (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                                <CheckCircle2 size={32} className="text-emerald-600 mx-auto mb-2" />
                                <h3 className="text-sm font-bold text-emerald-950">Password Updated</h3>
                                <p className="mt-1 text-xs text-emerald-800">
                                    Your password has been reset successfully. You can now sign in with your new credentials.
                                </p>
                                <Link
                                    to="/login"
                                    className="mt-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition"
                                >
                                    Sign In Now <ArrowRight size={13} />
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-3">
                                {/* New Password */}
                                <div>
                                    <label
                                        htmlFor="newPass"
                                        className="block text-xs font-medium text-slate-700 mb-1"
                                    >
                                        New Password
                                    </label>
                                    <div className="relative">
                                        <LockKeyhole
                                            size={15}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                        />
                                        <input
                                            id="newPass"
                                            type={showPassword ? "text" : "password"}
                                            autoComplete="new-password"
                                            placeholder="•••••••••••• (min. 8 characters)"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8.5 pr-8.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((prev) => !prev)}
                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 focus:outline-none"
                                        >
                                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Confirm Password */}
                                <div>
                                    <label
                                        htmlFor="confirmPass"
                                        className="block text-xs font-medium text-slate-700 mb-1"
                                    >
                                        Confirm Password
                                    </label>
                                    <div className="relative">
                                        <LockKeyhole
                                            size={15}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                        />
                                        <input
                                            id="confirmPass"
                                            type={showConfirmPassword ? "text" : "password"}
                                            autoComplete="new-password"
                                            placeholder="Repeat your new password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8.5 pr-8.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword((prev) => !prev)}
                                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 focus:outline-none"
                                        >
                                            {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </div>
                                </div>

                                {error && (
                                    <div
                                        role="alert"
                                        className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 leading-tight flex items-start gap-1.5"
                                    >
                                        <AlertCircle size={14} className="text-red-600 shrink-0 mt-0.5" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 py-2 px-4 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-blue-800 transition focus:outline-none focus:ring-2 focus:ring-blue-600/25 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {loading ? "Updating..." : "Reset Password"}
                                    {!loading && <ArrowRight size={14} />}
                                </button>
                            </form>
                        )}

                        <div className="mt-4 text-center">
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors"
                            >
                                <ArrowLeft size={13} /> Back to Sign In
                            </Link>
                        </div>
                    </div>
                </section>

            </div>
        </main>
    );
}
