"use client";

import { useEffect, useRef } from "react";

// Payload delivered by the Telegram Login Widget callback.
export type TelegramWidgetUser = {
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
    onSatwayTgLink?: (user: TelegramWidgetUser) => void;
  }
}

/**
 * Renders Telegram's official widget for LINKING (not signing in) — the signed
 * payload is handed to `onAuth`, which the gate posts to /api/onboarding/telegram
 * to attach this Telegram identity to the already-signed-in account.
 *
 * Same domain caveat as sign-in: the widget only authorizes on the bot's
 * configured domain (satway.online), never on localhost.
 */
export default function TelegramLinkWidget({
  botUsername,
  onAuth,
}: {
  botUsername: string;
  onAuth: (user: TelegramWidgetUser) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!botUsername || !el) return;

    window.onSatwayTgLink = onAuth;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-onauth", "onSatwayTgLink(user)");
    script.setAttribute("data-request-access", "write");
    el.appendChild(script);

    return () => {
      el.innerHTML = "";
      if (window.onSatwayTgLink === onAuth) delete window.onSatwayTgLink;
    };
  }, [botUsername, onAuth]);

  if (!botUsername) return null;
  return <div ref={containerRef} className="flex justify-center" />;
}
