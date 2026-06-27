"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import AuthShell from "@/components/AuthShell";

type Step = "email" | "verify" | "reset";

function Stepper({ step }: { step: Step }) {
  const order: Record<Step, number> = { email: 0, verify: 1, reset: 2 };
  return (
    <div className="mb-1 flex items-center gap-2">
      {(["email", "verify", "reset"] as Step[]).map((s, i) => (
        <span key={s} className={`h-1.5 flex-1 rounded-full ${order[step] >= i ? "bg-brand-600" : "bg-slate-200"}`} />
      ))}
    </div>
  );
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1 — email → send reset code
  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "Could not send the code");
      else setStep("verify");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify code (reuses the shared OTP verify endpoint)
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "Verification failed");
      else setStep("reset");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setError("");
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      setError("Could not resend the code. Please try again.");
    }
  };

  // Step 3 — set new password → auto sign-in
  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not reset your password");
        return;
      }
      const signInRes = await signIn("credentials", { email, password, redirect: false });
      if (signInRes?.error) router.push("/login");
      else router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1: email ──
  if (step === "email") {
    return (
      <AuthShell>
        <form onSubmit={sendCode} className="space-y-4">
          <Stepper step={step} />
          <h1 className="text-2xl font-bold text-slate-900">Forgot your password?</h1>
          <p className="text-sm text-slate-500">Enter your email — we&rsquo;ll send a 6-digit code to reset it.</p>
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20"
              placeholder="you@example.com"
              required
              autoFocus
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send code"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <p className="text-center text-sm text-slate-500">
            Remembered it?{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">Back to sign in</Link>
          </p>
        </form>
      </AuthShell>
    );
  }

  // ── Step 2: verify code ──
  if (step === "verify") {
    return (
      <AuthShell>
        <form onSubmit={verify} className="space-y-4">
          <Stepper step={step} />
          <h1 className="text-2xl font-bold text-slate-900">Check your email</h1>
          <p className="text-sm text-slate-500">
            If <strong>{email}</strong> has an account, a 6-digit code is on its way.
          </p>
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <label className="block text-sm font-medium text-slate-700">
            Reset code
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-lg tracking-[0.4em] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20"
              placeholder="000000"
              maxLength={6}
              required
              autoFocus
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Verifying…" : "Verify & continue"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <button type="button" onClick={() => { setStep("email"); setError(""); }} className="inline-flex items-center gap-1 hover:text-slate-700">
              <ArrowLeft className="h-3.5 w-3.5" /> Change email
            </button>
            <button type="button" onClick={resendCode} className="font-medium text-brand-600 hover:underline">
              Resend code
            </button>
          </div>
        </form>
      </AuthShell>
    );
  }

  // ── Step 3: new password ──
  return (
    <AuthShell>
      <form onSubmit={reset} className="space-y-4">
        <Stepper step={step} />
        <h1 className="text-2xl font-bold text-slate-900">Set a new password</h1>
        <p className="text-sm text-slate-500">
          Code confirmed for <strong>{email}</strong>. Choose a new password.
        </p>
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <label className="block text-sm font-medium text-slate-700">
          New password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20"
            placeholder="At least 8 characters"
            minLength={8}
            required
            autoFocus
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Reset password & sign in"}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </form>
    </AuthShell>
  );
}
