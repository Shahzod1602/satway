"use client";

import { useCallback, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

// Shape delivered by the Telegram Login Widget callback.
type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

/**
 * Renders Telegram's official "Log in with Telegram" widget. On success it
 * exchanges the signed payload for a NextAuth session via the `telegram`
 * provider, then routes to the dashboard.
 *
 * Requires NEXT_PUBLIC_TELEGRAM_BOT_USERNAME and the bot's domain set to
 * satway.online in @BotFather (/setdomain). The widget only works on the
 * configured domain — it will not authorize on localhost.
 */
export default function TelegramLoginButton({
  referralCode,
  onError,
  onStart,
}: {
  referralCode?: string;
  onError?: (message: string) => void;
  onStart?: () => void;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  // NEXT_PUBLIC_* is inlined at build time; the CI Docker build doesn't set it,
  // so fall back to the (non-secret) bot username to keep the widget working.
  const botUsername =
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "satwayonlinebot";

  const handleAuth = useCallback(
    async (user: TelegramUser) => {
      onStart?.();
      const res = await signIn("telegram", {
        data: JSON.stringify(user),
        ...(referralCode ? { referralCode } : {}),
        redirect: false,
      });
      if (res?.error) {
        onError?.(res.error || "Telegram sign-in failed");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    },
    [referralCode, router, onError, onStart],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!botUsername || !el) return;

    // The widget calls this global by name from its `data-onauth` attribute.
    window.onTelegramAuth = handleAuth;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    el.appendChild(script);

    return () => {
      el.innerHTML = "";
      if (window.onTelegramAuth === handleAuth) delete window.onTelegramAuth;
    };
  }, [botUsername, handleAuth]);

  if (!botUsername) return null;

  return <div ref={containerRef} className="flex justify-center" />;
}
