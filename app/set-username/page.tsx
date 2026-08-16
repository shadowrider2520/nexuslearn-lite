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
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col gap-4 items-center justify-center h-screen">
      <h1 className="text-xl font-bold">Pick a username</h1>
      <p className="text-sm text-gray-500">Others in your rooms will see this name.</p>
      <input value={username} onChange={(e) => setUsername(e.target.value)}
        placeholder="e.g. mithun_codes" className="border p-2 rounded" />
      <button onClick={handleSubmit} className="bg-black text-white px-4 py-2 rounded">Continue</button>
      {errorMsg && <p className="text-red-500">{errorMsg}</p>}
    </div>
  );
}