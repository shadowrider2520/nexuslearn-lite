"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const supabase = createClient();
  const router = useRouter();

  const handleSignup = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setErrorMsg(error.message);
    } else {
      router.push("/set-username");
    }
  };

  return (
    <div className="flex flex-col gap-4 items-center justify-center h-screen">
      <h1 className="text-xl font-bold">Create Account</h1>
      <input type="email" placeholder="you@email.com" value={email}
        onChange={(e) => setEmail(e.target.value)} className="border p-2 rounded" />
      <input type="password" placeholder="password" value={password}
        onChange={(e) => setPassword(e.target.value)} className="border p-2 rounded" />
      <button onClick={handleSignup} className="bg-black text-white px-4 py-2 rounded">Sign up</button>
      {errorMsg && <p className="text-red-500">{errorMsg}</p>}
      <a href="/login" className="text-sm underline">Already have an account? Log in</a>
    </div>
  );
}