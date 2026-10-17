"use client";

import { MessageCircle, SendHorizontal, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatResponse } from "@/lib/contract/schemas";

type Entry = ChatMessage & { links?: ChatResponse["links"] };

const SUGGESTIONS = [
  "Where should I go first today?",
  "Which fields have disease problems?",
  "What should I do on F01?",
  "What do the lamp colours mean?",
];

const WELCOME: Entry = {
  role: "assistant",
  content: "Hi Felix! Ask me about your fields: what is urgent, what to do on a field, or what a lamp colour means.",
};

/** Assistente della dashboard (spec §8.1). Risponde Claude se collegato, altrimenti il placeholder. */
export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ChatResponse["mode"] | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [entries, loading]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || loading) return;
    const history: Entry[] = [...entries, { role: "user", content: text }];
    setEntries(history);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // il messaggio di benvenuto è solo UI: non fa parte della conversazione
        body: JSON.stringify({ messages: history.slice(1).map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ChatResponse;
      setMode(data.mode);
      setEntries((e) => [...e, { role: "assistant", content: data.reply, links: data.links }]);
    } catch {
      setEntries((e) => [...e, { role: "assistant", content: "Sorry, I couldn't answer right now. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(input);
  };

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label="Field assistant"
          className="fixed right-4 bottom-24 z-[1200] flex h-[min(560px,70dvh)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <h2 className="flex items-center gap-1.5 font-semibold text-ink">
                <Sparkles size={16} className="text-disease" aria-hidden /> Field assistant
              </h2>
              <p className="text-xs text-muted">
                {mode === "claude"
                  ? "Powered by Claude · check advice in the field"
                  : mode === "placeholder"
                    ? "Preview · Claude not connected"
                    : "Ask about urgent fields, actions or lamp colours"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-surface"
              aria-label="Close assistant"
            >
              <X size={18} />
            </button>
          </header>

          <ol ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
            {entries.map((entry, i) => (
              <li key={i} className={entry.role === "user" ? "flex justify-end" : "flex"}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-line ${
                    entry.role === "user" ? "bg-ink text-white" : "bg-surface text-ink"
                  }`}
                >
                  {entry.content}
                  {entry.links && entry.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {entry.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-xs font-semibold text-fertilizer"
                        >
                          {link.label} →
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
            {loading && (
              <li className="flex">
                <span className="rounded-2xl bg-surface px-3 py-2 text-sm text-muted">Thinking…</span>
              </li>
            )}
          </ol>

          {entries.length === 1 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  className="min-h-9 rounded-full border border-line px-3 text-left text-xs text-ink hover:bg-surface"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-line p-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your fields…"
              maxLength={2000}
              className="min-h-11 flex-1 rounded-full border border-line px-4 text-base text-ink outline-none focus:border-ink"
              aria-label="Your question"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="grid h-11 w-11 place-items-center rounded-full bg-ink text-white disabled:opacity-40"
              aria-label="Send"
            >
              <SendHorizontal size={18} />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="fixed right-4 bottom-6 z-[1200] inline-flex min-h-14 items-center gap-2 rounded-full bg-ink px-5 font-semibold text-white shadow-lg transition hover:shadow-xl"
      >
        {open ? <X size={20} aria-hidden /> : <MessageCircle size={20} aria-hidden />}
        {open ? "Close" : "Ask the assistant"}
      </button>
    </>
  );
}
