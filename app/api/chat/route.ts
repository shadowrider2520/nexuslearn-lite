import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildTutorPrompt } from "@/lib/ai/tutor-prompt";
import type { Step } from "@/lib/types";

export async function POST(req: Request) {
  let body: { roomId?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { roomId, content } = body;
  if (!roomId || typeof content !== "string" || !content.trim()) {
    return NextResponse.json(
      { error: "roomId and content are required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "You are not a member of this room" },
      { status: 403 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const username = profile?.username ?? "Unknown";

  const { error: userMessageError } = await supabase
    .from("messages")
    .insert({
      room_id: roomId,
      user_id: user.id,
      username,
      content,
      is_ai: false,
    });

  if (userMessageError) {
    return NextResponse.json(
      { error: "Failed to save your message" },
      { status: 500 }
    );
  }

  const { data: roadmapData } = await supabase
    .from("roadmaps")
    .select("topic, steps")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { data: recentMsgs } = await supabase
    .from("messages")
    .select("username, content")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(15);

  const tutorPrompt = buildTutorPrompt(
    roadmapData?.topic ?? "not set",
    (roadmapData?.steps ?? []) as Step[],
    (recentMsgs ?? []).reverse()
  );

  let res: Response;
  try {
    res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
          messages: [
            { role: "system", content: tutorPrompt },
            {
              role: "user",
              content: recentMsgs?.[recentMsgs.length - 1]?.content ?? content,
            },
          ],
          temperature: 0.6,
        }),
      }
    );
  } catch {
    return NextResponse.json(
      { error: "AI service is unreachable, try again" },
      { status: 502 }
    );
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const errBody = await res.json();
      detail = errBody?.error?.message ?? res.statusText;
    } catch {}
    return NextResponse.json(
      { error: `AI service error (${res.status}): ${detail}` },
      { status: 502 }
    );
  }

  const data = await res.json();

  const aiReply =
    data.choices?.[0]?.message?.content ??
    "I couldn't respond right now, try again.";

  const { error: aiMessageError } = await supabase
    .from("messages")
    .insert({
      room_id: roomId,
      username: "AI Tutor",
      content: aiReply,
      is_ai: true,
    });

  if (aiMessageError) {
    return NextResponse.json(
      { error: "Failed to save the AI reply" },
      { status: 500 }
    );
  }

  return NextResponse.json({ reply: aiReply });
}
