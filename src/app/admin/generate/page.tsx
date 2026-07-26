import GenerateClient from "./GenerateClient";

export const dynamic = "force-dynamic";

export default async function AdminGeneratePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">Generate questions</h1>
      <p className="mt-1 text-sm text-slate-600">
        Paste a passage, get SAT-style questions with worked explanations. Review every
        one before it goes near a student — the model gets answer keys wrong, and a wrong
        key is worse than no question.
      </p>
      <GenerateClient />
    </div>
  );
}
