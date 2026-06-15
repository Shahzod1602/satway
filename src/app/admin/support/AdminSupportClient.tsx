"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Loader2, ChevronRight, User } from "lucide-react";

interface SupportUser {
  id: string;
  name: string;
  email: string;
  _count: { supportMessages: number };
}

interface Message {
  id: string;
  userId: string;
  body: string;
  fromAdmin: boolean;
  createdAt: string;
  readByAdmin: boolean;
}

export default function AdminSupportClient({
  adminId,
  users,
}: {
  adminId: string;
  users: SupportUser[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedUser = users.find((u) => u.id === selectedId);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    fetch(`/api/admin/support/${selectedId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMessages(data);
          fetch(`/api/admin/support/${selectedId}`, { method: "POST" });
        } else {
          setMessages(data.messages ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleReply = async () => {
    if (!reply.trim() || !selectedId) return;
    setSending(true);
    const res = await fetch(`/api/admin/support/${selectedId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply }),
    });
    if (res.ok) {
      const newMsg = await res.json();
      setMessages((prev) => [...prev, newMsg]);
      setReply("");
    }
    setSending(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Support tickets</h1>
      <p className="mt-1 text-sm text-slate-500">
        {users.length} user{users.length !== 1 ? "s" : ""} with messages
      </p>

      <div className="mt-6 grid gap-0 rounded-2xl border border-[#EAEAEA] bg-white overflow-hidden lg:grid-cols-[320px_1fr]">
        {/* User list */}
        <div className="border-b lg:border-b-0 lg:border-r border-[#EAEAEA]">
          <div className="p-4 font-semibold text-sm text-slate-500 border-b border-[#EAEAEA]">
            Users with messages
          </div>
          <div className="divide-y divide-[#EAEAEA]">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedId(u.id)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                  selectedId === u.id
                    ? "bg-brand-50 border-l-2 border-brand-600"
                    : "hover:bg-slate-50"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-medium text-slate-900 truncate">{u.name}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400 truncate pl-9">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400">{u._count.supportMessages}</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>
              </button>
            ))}
            {users.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-slate-400">
                No support messages yet.
              </div>
            )}
          </div>
        </div>

        {/* Chat thread */}
        <div className="flex flex-col min-h-[500px]">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
              Select a user to view messages
            </div>
          ) : (
            <>
              <div className="p-4 font-semibold text-sm text-slate-900 border-b border-[#EAEAEA]">
                Chat with {selectedUser?.name ?? selectedId}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-8">No messages yet.</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.fromAdmin ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                          m.fromAdmin
                            ? "bg-brand-600 text-white rounded-br-md"
                            : "bg-slate-100 text-slate-900 rounded-bl-md"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p
                          className={`mt-1 text-[11px] ${
                            m.fromAdmin ? "text-brand-200" : "text-slate-400"
                          }`}
                        >
                          {new Date(m.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-[#EAEAEA] p-4">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleReply()}
                    placeholder="Reply as admin..."
                    className="flex-1 rounded-xl border border-[#EAEAEA] px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    onClick={handleReply}
                    disabled={sending || !reply.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
