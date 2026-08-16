"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetUsername() {
  const [username, setUsername] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const supabase = createClient();
  const router = useRouter();

  const handleSubmit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { error } = await supabase.from("profiles").insert({ id: user.id, username });
    if (error) {
      setErrorMsg(error.message);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="nx-bg min-h-screen flex items-center justify-center px-4 py-10">
      <div className="nx-glass nx-fade w-full max-w-sm rounded-3xl p-8 shadow-[0_24px_80px_rgba(0,0,0,.6)]">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="grad-btn grid h-12 w-12 place-items-center rounded-2xl text-xl font-black shadow-lg shadow-purple-500/20 mb-4">N</div>
          <p className="text-[11px] tracking-[.22em] uppercase text-gray-500 mb-1">Almost there</p>
          <h1 className="font-display text-3xl">Pick a username</h1>
          <p className="text-sm text-gray-500 mt-1.5">Others in your rooms will see this name.</p>
        </div>

        <div className="flex flex-col gap-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. mithun_codes"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none transition focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/20"
          />

          {errorMsg && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{errorMsg}</p>
          )}

          <button
            onClick={handleSubmit}
            className="grad-btn mt-1 rounded-xl py-3 text-sm font-bold transition hover:opacity-90 hover:-translate-y-px active:translate-y-0"
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
