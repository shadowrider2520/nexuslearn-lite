"use client";

import type { ChatMessage } from "@/lib/types";

export function ChatPanel({
  messages,
  input,
  onInputChange,
  onSend,
  loading,
  error,
}: {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* MESSAGE AREA */}

      <div className="nx-glass mb-4 flex-1 overflow-auto rounded-2xl p-5">
        <div className="flex flex-col gap-3">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="pulse-dot mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-purple-400/30 bg-purple-500/10 text-2xl">
                ✦
              </div>
              <p className="font-display text-xl">Start a conversation</p>
              <p className="mt-1 text-sm text-gray-500">
                Ask the AI tutor something or start discussing with your group.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.is_ai ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    m.is_ai
                      ? "border border-purple-400/20 bg-purple-500/10"
                      : "bg-white text-black shadow-lg"
                  }`}
                >
                  <div
                    className={`mb-1 flex items-center gap-1.5 text-xs font-bold tracking-wide ${
                      m.is_ai ? "text-purple-300" : "text-black"
                    }`}
                  >
                    {m.is_ai && (
                      <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-purple-400" />
                    )}
                    {m.is_ai ? "AI Tutor" : m.username}
                  </div>

                  <p
                    className={`whitespace-pre-wrap text-sm leading-6 ${
                      m.is_ai ? "text-gray-200" : "text-black"
                    }`}
                  >
                    {m.content}
                  </p>

                  <p className="mt-2 text-[10px] text-gray-500">
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {error && (
        <p className="mb-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {/* CHAT INPUT */}

      <div className="flex items-center gap-3 pb-2">
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Ask the tutor or chat with your group…"
          className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/20"
        />

        <button
          onClick={onSend}
          disabled={loading || !input.trim()}
          className="grad-btn rounded-xl px-5 py-3 text-sm font-bold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Thinking…" : "Send"}
        </button>
      </div>
    </div>
  );
}
