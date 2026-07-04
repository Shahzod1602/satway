"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, Loader2, Users, GraduationCap } from "lucide-react";

export default function LobbyClient({
  code,
  testTitle,
  initialStatus,
}: {
  code: string;
  testTitle: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [count, setCount] = useState(1);
  const redirected = useRef(false);

  useEffect(() => {
    let stopped = false;
    fetch(`/api/live/${code}/join`, { method: "POST" }).catch(() => {});

    const poll = async () => {
      try {
        const res = await fetch(`/api/live/${code}`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const d = await res.json();
        setStatus(d.status);
        setCount(d.count);
        if (d.status === "LIVE" && !redirected.current) {
          redirected.current = true;
          router.push(`/test/${d.testSlug}`);
        }
      } catch {
        /* transient — keep polling */
      }
    };
    poll();
    const id = setInterval(poll, 2500);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [code, router]);

  const live = status === "LIVE";

  return (
    <div className="grid min-h-screen place-items-center bg-[#FBFAF7] px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5">
        <span className="mb-4 inline-flex items-center gap-1.5 text-lg font-extrabold tracking-tight text-slate-900">
          <GraduationCap className="h-5 w-5 text-brand-600" /> SAT<span className="rounded bg-brand-600 px-1 text-white">way</span>
        </span>

        {status === "ENDED" ? (
          <>
            <h1 className="mt-2 text-xl font-bold text-slate-900">Session ended</h1>
            <p className="mt-2 text-sm text-slate-500">This live session has closed.</p>
          </>
        ) : (
          <>
            <div className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${live ? "bg-emerald-50 text-emerald-600" : "bg-brand-50 text-brand-600"}`}>
              {live ? <Loader2 className="h-7 w-7 animate-spin" /> : <Radio className="h-7 w-7" />}
            </div>
            <h1 className="mt-4 text-xl font-bold text-slate-900">
              {live ? "Starting…" : "You're in!"}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {live ? "The host started the test." : "Waiting for the host to start"}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">{testTitle}</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
              <Users className="h-3.5 w-3.5" /> {count} in the room · code {code}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
