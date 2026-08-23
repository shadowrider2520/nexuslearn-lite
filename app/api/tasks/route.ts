import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TaskItem } from "@/lib/types";

const SYSTEM_PROMPT = `You generate practical tasks and mini-projects for a single study step.

Given a step's title and description, create 2-4 concrete, actionable items a student can DO to practice this specific step — not more theory, actual hands-on tasks or a small mini-project.

Respond ONLY with valid JSON, no markdown, no preamble:
{
  "items": [
    { "id": 1, "type": "task", "title": "string", "description": "string" }
  ]
}
"type" must be either "task" (a quick practice exercise) or "project" (a slightly bigger mini-project).`;

export async function POST(req: Request) {
  let body: {
    roomId?: string;
    roadmapId?: string;
    stepId?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { roomId, roadmapId, stepId } = body;
  if (!roomId || !roadmapId || typeof stepId !== "number" || !Number.isInteger(stepId) || stepId < 1) {
    return NextResponse.json(
      { error: "roomId, roadmapId, stepId and stepTitle are required" },
      { status: 400 }
    );
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "The AI service is not configured" }, { status: 503 });
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

  const { data: roadmap, error: roadmapError } = await supabase
    .from("roadmaps")
    .select("room_id, steps")
    .eq("id", roadmapId)
    .maybeSingle();

  if (roadmapError || !roadmap || roadmap.room_id !== roomId) {
    return NextResponse.json({ error: "Roadmap not found in this room" }, { status: 404 });
  }

  const storedStep = (roadmap.steps as Array<{ id: number; title: string; description: string }>).find(
    (step) => step.id === stepId
  );
  if (!storedStep) {
    return NextResponse.json({ error: "Step not found in this roadmap" }, { status: 404 });
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
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
              content: `Step: ${storedStep.title}\nDescription: ${storedStep.description ?? ""}`,
          },
        ],
        temperature: 0.5,
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

  let items: TaskItem[];
  try {
    const parsed = JSON.parse(data.choices[0].message.content);
    if (!Array.isArray(parsed?.items)) {
      throw new Error("Unexpected shape");
    }
    items = parsed.items;
  } catch {
    return NextResponse.json(
      { error: "AI returned invalid JSON" },
      { status: 500 }
    );
  }

  const { error } = await supabase.from("tasks").upsert(
    { room_id: roomId, roadmap_id: roadmapId, step_id: stepId, items },
    { onConflict: "roadmap_id,step_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items });
}
