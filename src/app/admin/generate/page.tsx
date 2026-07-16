import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/adminGuard";
import AppHeader from "@/components/AppHeader";
import GenerateClient from "./GenerateClient";

export const dynamic = "force-dynamic";

export default async function AdminGeneratePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!(await requireAdmin())) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader name={user.name} role={user.role} />
      <div className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Generate questions</h1>
        <p className="mt-1 text-sm text-slate-600">
          Paste a passage, get SAT-style questions with worked explanations. Review every
          one before it goes near a student — the model gets answer keys wrong, and a wrong
          key is worse than no question.
        </p>
        <GenerateClient />
      </div>
    </div>
  );
}
