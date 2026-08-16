"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const supabase = createClient();
  const router = useRouter();

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setErrorMsg(error.message); return; }

    const { data: profile } = await supabase.from("profiles").select("id").eq("id", data.user.id).single();
    router.push(profile ? "/" : "/set-username");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4 items-center justify-center h-screen">
      <input type="email" placeholder="you@email.com" value={email}
        onChange={(e) => setEmail(e.target.value)} className="border p-2 rounded" />
      <input type="password" placeholder="password" value={password}
        onChange={(e) => setPassword(e.target.value)} className="border p-2 rounded" />
      <button onClick={handleLogin} className="bg-black text-white px-4 py-2 rounded">Log in</button>
      {errorMsg && <p className="text-red-500">{errorMsg}</p>}
      <a href="/signup" className="text-sm underline">No account? Sign up</a>
    </div>
  );
}