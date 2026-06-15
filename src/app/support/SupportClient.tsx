"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, LifeBuoy, Loader2 } from "lucide-react";
import Sidebar from "@/components/Sidebar";

interface Msg {
  id: string;
  body: string;
  fromAdmin: boolean;
  createdAt: string;
}

export default function SupportClient({
  user,
  plan,
}: {
  user: { name: string; role: string };
  plan?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/support", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setMessages(data.messages ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((m) => [...m, data.message]);
      } else {
        setText(body);
      }
    } catch {
      setText(body);
    } finally {
      setSending(false);
    }
  }

  const fmtTime = (s: string) =>
    new Date(s).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="flex min-h-screen bg-[#FFFDFB]">
      <Sidebar name={user.name} role={user.role} plan={plan} />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <LifeBuoy className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Support</h1>
              <p className="text-sm text-slate-500">
                Chat with our team about any problem. We usually reply within a day.
              </p>
            </div>
          </div>

          <div
            className="exam-scroll mt-5 flex-1 space-y-1.5 overflow-y-auto rounded-2xl border border-[#EAEAEA] p-4"
            style={{
              backgroundColor: "#cdd9e6",
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.45) 0, transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.4) 0, transparent 40%), linear-gradient(180deg, #d3def0, #cdd9e6)",
            }}
          >
            {!loaded ? (
              <div className="grid h-full place-items-center text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="grid h-full place-items-center px-6 text-center">
                <div className="rounded-2xl bg-white/70 px-5 py-3 backdrop-blur">
                  <LifeBuoy className="mx-auto h-7 w-7 text-slate-400" />
                  <p className="mt-2 text-sm text-slate-600">
                    No messages yet. Describe your problem and we&apos;ll help you out.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.fromAdmin ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`relative max-w-[78%] px-3 py-1.5 text-[14px] shadow-sm ${
                      m.fromAdmin
                        ? "rounded-2xl rounded-bl-md bg-white text-slate-800"
                        : "rounded-2xl rounded-br-md bg-[#effdde] text-slate-900"
                    }`}
                  >
                    <span className="whitespace-pre-wrap break-words align-bottom">
                      {m.body}
                    </span>
                    <span className="ml-2 inline-block translate-y-0.5 text-[10px] text-slate-400">
                      {fmtTime(m.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="mt-3 flex items-end gap-2">
            <div className="flex flex-1 items-end rounded-3xl border border-slate-200 bg-white px-4 py-1 shadow-sm focus-within:border-brand-400">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(e);
                  }
                }}
                rows={1}
                placeholder="Message…"
                className="exam-scroll max-h-32 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-sm text-slate-900 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-600 text-white shadow-md transition-transform hover:bg-brand-700 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
