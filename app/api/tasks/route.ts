import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const { roomId, roadmapId, stepId, stepTitle, stepDescription } = await req.json();

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Step: ${stepTitle}\nDescription: ${stepDescription}` },
      ],
      temperature: 0.5,
    }),
  });

  const data = await res.json();
  let parsed;
  try {
    parsed = JSON.parse(data.choices[0].message.content);
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .upsert(
      { room_id: roomId, roadmap_id: roadmapId, step_id: stepId, items: parsed.items },
      { onConflict: "roadmap_id,step_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: parsed.items });
}

// upsert: insert if not duplicate exists else update that row
