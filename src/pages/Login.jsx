import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Mail,
    LockKeyhole,
    Eye,
    EyeOff,
    AlertCircle,
    Info,
} from "lucide-react";

import { loginUser } from "../services/authService";
import "./login.css";

export default function Login() {
    const navigate = useNavigate();

    // Form inputs state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // UI state controls
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [googleNotice, setGoogleNotice] = useState("");

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setGoogleNotice("");

        // Basic client validation
        if (!email.trim() || !password) {
            setError("Please enter your email and password.");
            return;
        }

        setLoading(true);

        try {
            // Real backend login request
            const data = await loginUser(email.trim(), password);
            const user = data?.user;

            if (!user || !data.token) {
                throw new Error("Server returned an incomplete authentication response.");
            }

            // Role identification from real backend payload
            const role = String(user.role || "").trim().toLowerCase();

            if (role !== "admin" && role !== "super admin") {
                throw new Error("Your account does not have an authorized portal role.");
            }

            // Save JWT and user details for the active session
            sessionStorage.setItem("authToken", data.token);
            sessionStorage.setItem("authUser", JSON.stringify(user));

            // Role-based destination redirect
            if (role === "super admin") {
                navigate("/super-admin-dashboard", { replace: true });
            } else {
                navigate("/admin-dashboard", { replace: true });
            }
        } catch (err) {
            setError(err.message || "Invalid credentials. Please verify your email and password.");
        } finally {
            setLoading(false);
        }
    }

    // Google Sign-In click handler
    function handleGoogleSignIn() {
        setError("");
        setGoogleNotice(
            "Google Sign-In requires OAuth 2.0 configuration with a Google Client ID in the system environment. Please sign in with your email and password."
        );
    }

    return (
        <main className="min-h-screen w-full bg-slate-100/80 flex items-center justify-center p-3 sm:p-5">
            {/* Centered login card */}
            <div className="w-full max-w-4xl lg:min-h-[600px] bg-white rounded-2xl shadow-xl shadow-slate-200/70 border border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12">

                {/* Product introduction */}
                <section className="login-intro relative hidden lg:flex lg:col-span-6 flex-col items-center justify-center p-7 xl:p-9 text-center text-white overflow-hidden select-none">
                    <div className="pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full bg-blue-400/20 blur-2xl" />
                    <div className="pointer-events-none absolute -bottom-16 -left-12 h-64 w-64 rounded-full bg-indigo-600/20 blur-2xl" />

                    <div className="relative z-10 flex flex-col items-center">
                        <img
                            src="/logo.jpg"
                            alt="NetIT Technology logo"
                            className="h-14 w-14 rounded-xl object-cover"
                        />
                        <h1 className="mt-5 text-2xl xl:text-3xl font-bold leading-tight text-white">
                            Invoice &amp; Quotation Management System
                        </h1>
                        <p className="mt-3 text-sm text-blue-100 leading-relaxed">
                            Simplify your business finances
                        </p>
                    </div>
                </section>

                {/* Login form */}
                <section className="col-span-1 lg:col-span-6 flex flex-col justify-center px-6 py-7 sm:px-9 sm:py-8">
                    <div className="w-full max-w-[360px] mx-auto">

                        {/* Welcome heading at the top of the form */}
                        <div className="mb-5 text-center">
                            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                                Welcome back
                            </h2>
                            <p className="text-xs text-slate-500 mt-0">
                                Sign in to your account
                            </p>
                        </div>

                        {/* Form Area */}
                        <form onSubmit={handleSubmit} className="space-y-3">

                            {/* 3. Email Address Field */}
                            <div>
                                <label
                                    htmlFor="email"
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
                                        id="email"
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

                            {/* 4. Password Field with Show/Hide Password */}
                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-xs font-medium text-slate-700 mb-1"
                                >
                                    Password
                                </label>
                                <div className="relative">
                                    <LockKeyhole
                                        size={15}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                    />
                                    <input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        placeholder="••••••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
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

                                {/* 5. Forgot Password Link IMMEDIATELY BELOW Password field, aligned to right */}
                                <div className="mt-1 flex justify-end">
                                    <Link
                                        to="/forgot-password"
                                        className="text-[11px] font-medium text-blue-700 hover:text-blue-900 transition-colors"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                            </div>

                            {/* Error Alert Message */}
                            {error && (
                                <div
                                    role="alert"
                                    className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 leading-tight flex items-start gap-1.5"
                                >
                                    <AlertCircle size={14} className="text-red-600 shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Google Config Info Message */}
                            {googleNotice && (
                                <div
                                    role="status"
                                    className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-800 leading-tight flex items-start gap-1.5"
                                >
                                    <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                                    <span>{googleNotice}</span>
                                </div>
                            )}

                            {/* 6. Compact, Professional Sign In Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 py-2 px-4 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-blue-800 transition focus:outline-none focus:ring-2 focus:ring-blue-600/25 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? "Signing in..." : "Sign In"}
                            </button>
                        </form>

                        {/* 7. Subtle "OR CONTINUE WITH" Divider */}
                        <div className="my-3.5 flex items-center gap-2">
                            <div className="h-px flex-1 bg-slate-200" />
                            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                                OR CONTINUE WITH
                            </span>
                            <div className="h-px flex-1 bg-slate-200" />
                        </div>

                        {/* 8. Google Sign-In Button with Official "G" Icon */}
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
                        >
                            {/* Official Google 4-Color Icon */}
                            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                />
                            </svg>
                            <span>Continue with Google</span>
                        </button>
                    </div>
                </section>

            </div>
        </main>
    );
}