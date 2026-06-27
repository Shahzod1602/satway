import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of SATway.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
        &larr; Back to home
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Terms of Service</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: June 2026</p>

      <div className="prose prose-slate mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">The service</h2>
          <p>
            SATway provides Digital SAT practice tests and study tools. Content is for practice and
            preparation only; SATway is not affiliated with or endorsed by the College Board, and SAT
            is a trademark of its respective owner.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Your account</h2>
          <p>
            You are responsible for keeping your login credentials secure and for activity under your
            account. Don&rsquo;t share accounts, attempt to access other users&rsquo; data, or abuse
            the service.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Premium &amp; payments</h2>
          <p>
            New accounts include a short free Premium trial. Premium is sold as fixed-length plans
            (1, 3, or 6 months) paid manually by card transfer and activated after we confirm
            payment. Plans do <strong>not</strong> auto-renew. Because access is digital and granted
            immediately on activation, payments are generally non-refundable except where required by
            law.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Acceptable use</h2>
          <p>
            Don&rsquo;t copy, scrape, or redistribute test content, attempt to break the scoring or
            time limits, or disrupt the service for others.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Disclaimer</h2>
          <p>
            SATway is provided &ldquo;as is.&rdquo; We don&rsquo;t guarantee any particular score
            outcome. We may update or discontinue features.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
          <p>Questions? Reach us through the in-app Support page.</p>
        </section>
      </div>
    </main>
  );
}
