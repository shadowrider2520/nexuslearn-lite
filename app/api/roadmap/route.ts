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
  if (!topic || !topic.trim() || !roomId) {
    return NextResponse.json(
      { error: "topic and roomId are required" },
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

  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: buildRoadmapSystemPrompt(
              minutesPerDay ?? 30,
              detailLevel ?? "detailed"
            ),
          },
          { role: "user", content: topic },
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
    return NextResponse.json(
      { error: "AI service returned an error, try again" },
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

  const { data: saved, error } = await supabase
    .from("roadmaps")
    .insert({ room_id: roomId, topic: roadmap.topic, steps: flatSteps })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: saved.id, topic: roadmap.topic, steps: flatSteps });
}
