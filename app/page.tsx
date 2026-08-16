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
    <div className="flex flex-col gap-10 items-center justify-center min-h-screen py-10">
      <button onClick={handleLogout} className="absolute top-4 right-4 text-sm underline">Log out</button>

      {rooms.length > 0 && (
        <div className="w-full max-w-md">
          <h2 className="font-bold mb-2">Your Rooms</h2>
          <ul className="flex flex-col gap-2">
            {rooms.map((r) => (
              <li key={r.id}>
                <a href={`/room/${r.id}`} className="block border p-3 rounded hover:bg-gray-50">{r.name}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="font-bold mb-2">Create a Room</h2>
        <form action={createRoom} className="flex gap-2">
          <input name="name" placeholder="Room name" required className="border p-2 rounded" />
          <button className="bg-black text-white px-4 py-2 rounded">Create</button>
        </form>
      </div>

      <div>
        <h2 className="font-bold mb-2">Join a Room</h2>
        <form action={joinRoom} className="flex gap-2">
          <input name="code" placeholder="Invite code" required className="border p-2 rounded" />
          <button className="bg-black text-white px-4 py-2 rounded">Join</button>
        </form>
      </div>
    </div>
  );
}