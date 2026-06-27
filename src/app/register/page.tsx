"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import TelegramLoginButton from "@/components/TelegramLoginButton";

type Step = "email" | "verify" | "details";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  // Capture an invite code from ?ref=CODE
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setReferralCode(ref.trim());
  }, []);

  // Step 1 — email → send code
  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-code", {
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

  // Step 2 — verify code
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
      else setStep("details");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setError("");
    setInfo("");
    try {
      await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setInfo("A new code has been sent.");
    } catch {
      setError("Could not resend the code. Please try again.");
    }
  };

  // Step 3 — name + password → create account → auto sign-in
  const finish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, ...(referralCode ? { referralCode } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Registration failed");
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

  const Stepper = () => (
    <div className="mb-1 flex items-center gap-2">
      {(["email", "verify", "details"] as Step[]).map((s, i) => {
        const order: Record<Step, number> = { email: 0, verify: 1, details: 2 };
        const active = order[step] >= i;
        return <span key={s} className={`h-1.5 flex-1 rounded-full ${active ? "bg-brand-600" : "bg-slate-200"}`} />;
      })}
    </div>
  );

  // ── Step 1: email ──
  if (step === "email") {
    return (
      <AuthShell>
        <form onSubmit={sendCode} className="space-y-4">
          <Stepper />
          <h1 className="text-2xl font-bold text-slate-900">Create your free account</h1>
          <p className="text-sm text-slate-500">Enter your email — we&rsquo;ll send a 6-digit code to confirm it.</p>
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
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link>
          </p>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" /> or sign up with <span className="h-px flex-1 bg-slate-200" />
        </div>
        <TelegramLoginButton
          referralCode={referralCode || undefined}
          onStart={() => { setError(""); setLoading(true); }}
          onError={(m) => { setError(m); setLoading(false); }}
        />
      </AuthShell>
    );
  }

  // ── Step 2: verify code ──
  if (step === "verify") {
    return (
      <AuthShell>
        <form onSubmit={verify} className="space-y-4">
          <Stepper />
          <h1 className="text-2xl font-bold text-slate-900">Check your email</h1>
          <p className="text-sm text-slate-500">
            We sent a 6-digit code to <strong>{email}</strong>.
          </p>
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {info && <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div>}
          <label className="block text-sm font-medium text-slate-700">
            Verification code
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

  // ── Step 3: name + password ──
  return (
    <AuthShell>
      <form onSubmit={finish} className="space-y-4">
        <Stepper />
        <h1 className="text-2xl font-bold text-slate-900">Almost there</h1>
        <p className="text-sm text-slate-500">
          <strong>{email}</strong> confirmed. Set your name and password.
        </p>
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <label className="block text-sm font-medium text-slate-700">
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20"
            required
            autoFocus
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20"
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account"}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </form>
    </AuthShell>
  );
}
