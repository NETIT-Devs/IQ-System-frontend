import { useState } from "react";
import { Link } from "react-router-dom";
import {
    FileText,
    Mail,
    ArrowRight,
    ArrowLeft,
    CheckCircle2,
    FileCheck,
    CreditCard,
    Receipt,
    AlertCircle,
    Info,
} from "lucide-react";

import { requestPasswordReset } from "../services/authService";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setNotice("");

        if (!email.trim()) {
            setError("Please enter your registered email address.");
            return;
        }

        setLoading(true);

        try {
            const data = await requestPasswordReset(email.trim());
            setNotice(
                data.message ||
                "If an eligible account exists, password reset instructions will be sent."
            );
        } catch (err) {
            setError(err.message || "Unable to send reset instructions. Please try again later.");
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
                                        Access Recovery
                                    </span>
                                </div>
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[9px] font-medium text-blue-300">
                                    Encrypted
                                </span>
                            </div>

                            <p className="mt-2 text-[11px] text-slate-300 leading-relaxed">
                                Enter your verified email address to receive secure instructions to recover your portal access.
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

                {/* Right Side: Compact Forgot Password Card */}
                <section className="col-span-1 lg:col-span-7 flex flex-col justify-center px-6 py-7 sm:px-9 sm:py-8">
                    <div className="w-full max-w-[360px] mx-auto">
                        
                        {/* Logo */}
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-700 text-white shadow-xs">
                                <FileText size={15} />
                            </div>
                            <span className="text-sm font-bold text-slate-900 tracking-tight">InvoiceFlow</span>
                        </div>

                        {/* Heading & Subtitle */}
                        <div className="mb-4">
                            <h2 className="text-xl font-bold tracking-tight text-slate-900">
                                Forgot your password?
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Enter your email address to receive password reset instructions.
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div>
                                <label
                                    htmlFor="resetEmail"
                                    className="block text-xs font-medium text-slate-700 mb-1"
                                >
                                    Email address
                                </label>
                                <div className="relative">
                                    <Mail
                                        size={15}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                    />
                                    <input
                                        id="resetEmail"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="name@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8.5 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                                        required
                                    />
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

                            {notice && (
                                <div
                                    role="status"
                                    className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-800 leading-tight flex items-start gap-1.5"
                                >
                                    <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                                    <span>{notice}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 py-2 px-4 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-blue-800 transition focus:outline-none focus:ring-2 focus:ring-blue-600/25 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? "Sending link..." : "Send Reset Link"}
                                {!loading && <ArrowRight size={14} />}
                            </button>
                        </form>

                        {/* Back to Login */}
                        <div className="mt-5 text-center">
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors"
                            >
                                <ArrowLeft size={13} /> Back to Login
                            </Link>
                        </div>
                    </div>
                </section>

            </div>
        </main>
    );
}
