import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { gateConfig, gateStatusForUser } from "@/lib/onboarding";
import WelcomeGate from "@/components/WelcomeGate";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const cfg = gateConfig();
  if (!cfg.enabled) redirect("/home");

  const status = await gateStatusForUser(cfg, user.id);
  // Already cleared in the DB — bounce through sync so the cookie gets set.
  if (status.passed) redirect("/api/onboarding/sync");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4 py-10">
      <WelcomeGate
        cfg={{
          requireInstagram: cfg.requireInstagram,
          requireTelegram: cfg.requireTelegram,
          instagramUrl: cfg.instagramUrl,
          channelUrl: cfg.channelUrl,
          botUsername: cfg.botUsername,
        }}
        initial={{ ig: status.ig, tg: status.tg }}
        hasTelegram={!!status.telegramId}
      />
    </main>
  );
}
