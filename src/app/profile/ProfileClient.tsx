"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Shield, Target, CalendarClock, Bell } from "lucide-react";
import AppHeader from "@/components/AppHeader";

interface ProfileUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  avatarUrl: string | null;
  country: string | null;
  nativeLanguage: string | null;
  phone: string | null;
  targetScore: number | null;
  targetMathScore: number | null;
  targetRWScore: number | null;
  examDate: string | null;
  emailNotifications: boolean;
  plan: string;
}

type Msg = { ok: boolean; text: string } | null;

function Banner({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-600" : "text-red-500"}`}>
      {msg.text}
    </p>
  );
}

export default function ProfileClient({ user }: { user: ProfileUser }) {
  const router = useRouter();

  const [phone, setPhone] = useState(user.phone ?? "");
  const [country, setCountry] = useState(user.country ?? "");
  const [nativeLanguage, setNativeLanguage] = useState(user.nativeLanguage ?? "");
  const [targetScore, setTargetScore] = useState(user.targetScore?.toString() ?? "");
  const [examDate, setExamDate] = useState(user.examDate ? user.examDate.slice(0, 10) : "");
  const [emailNotifications, setEmailNotifications] = useState(user.emailNotifications);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const input =
    "rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600/20";
  const btn =
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60";
  const card = "rounded-2xl border border-[#EAEAEA] bg-white p-6";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone || null,
          country: country || null,
          nativeLanguage: nativeLanguage || null,
          targetScore: targetScore ? Number(targetScore) : null,
          examDate: examDate || null,
          emailNotifications,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setMsg({ ok: true, text: "Saved." });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFDFB]">
      <AppHeader name={user.name} role={user.role} />

      <main className="mx-auto max-w-xl px-6 pt-6 pb-10">
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your account settings and study goals.</p>

        <form onSubmit={save} className={`mt-6 ${card}`}>
          <div className="grid gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-600">Name</span>
              <input
                type="text"
                value={user.name}
                disabled
                className={`${input} bg-slate-50 text-slate-400 cursor-not-allowed`}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-600">Email</span>
              <input
                type="email"
                value={user.email}
                disabled
                className={`${input} bg-slate-50 text-slate-400 cursor-not-allowed`}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-600">Phone</span>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={input}
                placeholder="+998 …"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-600">Country</span>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={input}
                placeholder="Uzbekistan"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-600">Native language</span>
              <input
                type="text"
                value={nativeLanguage}
                onChange={(e) => setNativeLanguage(e.target.value)}
                className={input}
                placeholder="Uzbek"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                  <Target className="h-4 w-4 text-brand-600" /> Target score
                </span>
                <input
                  type="number"
                  min={400}
                  max={1600}
                  step={10}
                  value={targetScore}
                  onChange={(e) => setTargetScore(e.target.value)}
                  className={input}
                  placeholder="1400"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                  <CalendarClock className="h-4 w-4 text-accent-600" /> Exam date
                </span>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className={input}
                />
              </label>
            </div>

            <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="h-4 w-4 accent-brand-600"
              />
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <Bell className="h-4 w-4" /> Email notifications
              </span>
            </label>
          </div>

          <div className="mt-5">
            <button type="submit" disabled={saving} className={btn}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
            </button>
          </div>
          <Banner msg={msg} />
        </form>
      </main>
    </div>
  );
}
