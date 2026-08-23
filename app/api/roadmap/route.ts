import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildRoadmapSystemPrompt,
  flattenRoadmap,
  type GeneratedRoadmap,
} from "@/lib/ai/roadmap";

export async function POST(req: Request) {
  let body: {
    topic?: string;
    roomId?: string;
    minutesPerDay?: number;
    detailLevel?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { topic, roomId, minutesPerDay, detailLevel } = body;
  const normalizedTopic = typeof topic === "string" ? topic.trim() : "";
  if (!normalizedTopic || !roomId) {
    return NextResponse.json(
      { error: "topic and roomId are required" },
      { status: 400 }
    );
  }

  if (normalizedTopic.length > 5_000) {
    return NextResponse.json({ error: "Topics and notes must be 5,000 characters or fewer" }, { status: 400 });
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "The AI service is not configured" }, { status: 503 });
  }

  const safeMinutesPerDay = Math.min(360, Math.max(15, Number(minutesPerDay) || 30));
  const safeDetailLevel = ["quick", "detailed", "thorough"].includes(detailLevel ?? "")
    ? detailLevel!
    : "detailed";

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

  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: buildRoadmapSystemPrompt(
              safeMinutesPerDay,
              safeDetailLevel
            ),
          },
          { role: "user", content: normalizedTopic },
        ],
        temperature: 0.4,
      }),
    });
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

  let roadmap: GeneratedRoadmap;
  try {
    roadmap = JSON.parse(data.choices[0].message.content);

    if (
      typeof roadmap?.topic !== "string" ||
      !Array.isArray(roadmap?.days)
    ) {
      throw new Error("Unexpected shape");
    }
  } catch {
    return NextResponse.json(
      { error: "AI returned invalid JSON" },
      { status: 500 }
    );
  }

  const flatSteps = flattenRoadmap(roadmap);
  if (flatSteps.length === 0 || flatSteps.length > 60) {
    return NextResponse.json({ error: "AI returned an unusable roadmap. Please try again." }, { status: 500 });
  }

  const { data: saved, error } = await supabase
    .from("roadmaps")
    .insert({ room_id: roomId, topic: roadmap.topic, steps: flatSteps })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: saved.id, topic: roadmap.topic, steps: flatSteps });
}
