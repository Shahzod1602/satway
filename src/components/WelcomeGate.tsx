"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, Send, Check, Loader2, ExternalLink, Lock } from "lucide-react";
import TelegramLinkWidget, { type TelegramWidgetUser } from "./TelegramLinkWidget";

type Cfg = {
  requireInstagram: boolean;
  requireTelegram: boolean;
  instagramUrl: string | null;
  channelUrl: string | null;
  botUsername: string;
};

export default function WelcomeGate({
  cfg,
  initial,
  hasTelegram,
}: {
  cfg: Cfg;
  initial: { ig: boolean; tg: boolean };
  hasTelegram: boolean;
}) {
  const [ig, setIg] = useState(initial.ig);
  const [tg, setTg] = useState(initial.tg);
  const [igBusy, setIgBusy] = useState(false);
  const [tgBusy, setTgBusy] = useState(false);
  const [tgOpened, setTgOpened] = useState(false);
  // True once a Telegram identity is attached — either the account already had
  // one (TG login) or the widget just linked it. Controls widget-vs-verify UI.
  const [linked, setLinked] = useState(hasTelegram);
  const [error, setError] = useState<string | null>(null);

  const passed = ig && tg;

  // Once both steps are cleared, sync sets the cookie and drops us on /home.
  useEffect(() => {
    if (passed) window.location.href = "/api/onboarding/sync";
  }, [passed]);

  const confirmInstagram = useCallback(async () => {
    setError(null);
    setIgBusy(true);
    try {
      const res = await fetch("/api/onboarding/instagram", { method: "POST" });
      if (res.ok) setIg(true);
      else setError("Couldn't save that. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIgBusy(false);
    }
  }, []);

  const verifyTelegram = useCallback(async (data?: string) => {
    setError(null);
    setTgBusy(true);
    try {
      const res = await fetch("/api/onboarding/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data ? { data } : {}),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        joined?: boolean;
        error?: string;
      };
      // A widget payload (data) that wasn't a 409 conflict means the identity is
      // now linked — switch from the widget to a plain "verify" button.
      if (data && res.status !== 409) setLinked(true);
      if (res.ok && json.ok && json.joined) {
        setTg(true);
      } else if (json.joined === false) {
        setError("We couldn't find you in the channel yet. Join it, then tap Verify again.");
      } else {
        setError(json.error || "Verification failed. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setTgBusy(false);
    }
  }, []);

  const onTgWidget = useCallback(
    (u: TelegramWidgetUser) => verifyTelegram(JSON.stringify(u)),
    [verifyTelegram],
  );

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Unlock SATWAY — it&apos;s free</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Follow us to get full access. Two quick steps and you&apos;re in.
          </p>
        </div>

        <div className="space-y-3">
          {cfg.requireInstagram && (
            <Step
              done={ig}
              icon={<Camera className="h-5 w-5" />}
              title="Follow us on Instagram"
              tint="rose"
            >
              {!ig && (
                <div className="mt-3 flex flex-col gap-2">
                  {cfg.instagramUrl && (
                    <a
                      href={cfg.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Open Instagram <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    onClick={confirmInstagram}
                    disabled={igBusy}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                  >
                    {igBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    I&apos;ve followed
                  </button>
                </div>
              )}
            </Step>
          )}

          {cfg.requireTelegram && (
            <Step
              done={tg}
              icon={<Send className="h-5 w-5" />}
              title="Join our Telegram channel"
              tint="sky"
            >
              {!tg && (
                <div className="mt-3 flex flex-col gap-2">
                  {cfg.channelUrl && (
                    <a
                      href={cfg.channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setTgOpened(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Open channel <ExternalLink className="h-4 w-4" />
                    </a>
                  )}

                  {linked ? (
                    <button
                      onClick={() => verifyTelegram()}
                      disabled={tgBusy}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                    >
                      {tgBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      I&apos;ve joined — verify
                    </button>
                  ) : (
                    <div className="mt-1">
                      <p className="mb-2 text-center text-xs text-slate-500">
                        Connect Telegram to verify your membership:
                      </p>
                      {tgBusy ? (
                        <div className="flex justify-center py-1 text-slate-400">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      ) : (
                        <TelegramLinkWidget botUsername={cfg.botUsername} onAuth={onTgWidget} />
                      )}
                      {!tgOpened && (
                        <p className="mt-2 text-center text-xs text-slate-400">
                          Tip: join the channel first, then connect.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Step>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-600">
            {error}
          </p>
        )}

        {passed && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-600">
            <Loader2 className="h-4 w-4 animate-spin" /> All set — taking you in…
          </p>
        )}
      </div>
    </div>
  );
}

function Step({
  done,
  icon,
  title,
  tint,
  children,
}: {
  done: boolean;
  icon: React.ReactNode;
  title: string;
  tint: "rose" | "sky";
  children?: React.ReactNode;
}) {
  const tintClass =
    tint === "rose" ? "bg-rose-50 text-rose-500" : "bg-sky-50 text-sky-500";
  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        done ? "border-emerald-200 bg-emerald-50/40" : "border-[var(--border)] bg-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tintClass}`}>
          {icon}
        </div>
        <p className="flex-1 text-sm font-semibold text-slate-800">{title}</p>
        {done && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-4 w-4" />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
