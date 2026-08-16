"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createRoom, joinRoom } from "./actions";

export default function Home() {
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).single();
      if (!profile) { router.push("/set-username"); return; }

      const { data } = await supabase
        .from("room_members")
        .select("room_id, rooms(id, name)")
        .eq("user_id", user.id);

      if (data) setRooms(data.map((r: any) => r.rooms));
    };
    load();
  }, []);

  return (
    <div className="nx-bg min-h-screen text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grad-btn grid h-8 w-8 place-items-center rounded-lg text-sm font-black">N</span>
            <span className="font-display text-lg">NexusLearn Lite</span>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 transition hover:border-white/30 hover:text-white"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="nx-fade mb-12">
          <h1 className="font-display text-4xl sm:text-5xl leading-tight">
            Let&apos;s learn <span className="grad-text">something</span> together.
          </h1>
          <p className="mt-3 text-gray-400">
            Create a room, generate a roadmap, and let the AI tutor guide your group.
          </p>
        </div>

        {rooms.length > 0 && (
          <section className="nx-fade nx-fade-1 mb-12">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-gray-500">
              Your Rooms
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-gray-400">
                {rooms.length}
              </span>
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rooms.map((r, i) => (
                <li
                  key={r.id}
                  className="nx-glass group rounded-2xl transition hover:-translate-y-0.5 hover:border-white/25"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <a href={`/room/${r.id}`} className="flex items-center justify-between px-5 py-4">
                    <span className="font-display text-lg">{r.name}</span>
                    <span className="text-gray-500 transition group-hover:translate-x-1 group-hover:text-white">→</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <section className="nx-glass nx-fade nx-fade-2 rounded-2xl p-6">
            <h2 className="font-display text-xl mb-1">Create a room</h2>
            <p className="text-xs text-gray-500 mb-4">Start fresh with your own invite code.</p>
            <form action={createRoom} className="flex gap-2">
              <input
                name="name"
                placeholder="Room name"
                required
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm outline-none transition placeholder:text-gray-600 focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/20"
              />
              <button className="grad-btn rounded-xl px-4 py-2.5 text-sm font-bold transition hover:opacity-90">
                Create
              </button>
            </form>
          </section>

          <section className="nx-glass nx-fade nx-fade-3 rounded-2xl p-6">
            <h2 className="font-display text-xl mb-1">Join a room</h2>
            <p className="text-xs text-gray-500 mb-4">Got a 6-character invite code?</p>
            <form action={joinRoom} className="flex gap-2">
              <input
                name="code"
                placeholder="Invite code"
                required
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm uppercase outline-none transition placeholder:normal-case placeholder:text-gray-600 focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/20"
              />
              <button className="grad-btn rounded-xl px-4 py-2.5 text-sm font-bold transition hover:opacity-90">
                Join
              </button>
            </form>
          </section>
        </div>

        {rooms.length === 0 && (
          <div className="nx-glass nx-fade nx-fade-1 mt-10 rounded-2xl p-8 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-2xl">🌱</div>
            <p className="font-display text-lg">No rooms yet</p>
            <p className="text-sm text-gray-500">Create your first study room above — it takes 10 seconds.</p>
          </div>
        )}
      </main>
    </div>
  );
}
