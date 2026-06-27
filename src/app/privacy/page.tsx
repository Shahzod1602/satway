import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How SATway collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
        &larr; Back to home
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: June 2026</p>

      <div className="prose prose-slate mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">What we collect</h2>
          <p>
            When you create a SATway account we store your name, email address, and a securely
            hashed password. If you sign in with Telegram we store your Telegram ID and username.
            Optionally you may add a phone number, country, target score, and exam date. We record
            your practice attempts, answers, and scores so we can show your progress.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900">How we use it</h2>
          <p>
            We use your data to operate the service: authenticate you, grade and score your tests,
            show your results and leaderboard ranking, and send account emails (verification,
            password reset) and — if you keep notifications on — occasional product updates. We do
            not sell your personal data.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Third parties</h2>
          <p>
            We share the minimum necessary with service providers that help us run SATway: email
            delivery (Resend / Gmail), Telegram (for Telegram login and notifications), and Google
            Cloud (AI features). These providers process data on our behalf.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Your choices</h2>
          <p>
            You can turn off product-update notifications anytime in your Profile. You can request a
            copy of your data or delete your account from your Profile; deleting your account removes
            your personal data and attempts.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
          <p>
            Questions about privacy? Reach us through the in-app Support page.
          </p>
        </section>
      </div>
    </main>
  );
}
