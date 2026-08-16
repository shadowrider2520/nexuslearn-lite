import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function buildSystemPrompt(minutesPerDay: number, detailLevel: string) {
  return `You are a study roadmap generator. Given a topic or notes, create a DAY-WISE learning plan.

Constraints:
- The student can study ${minutesPerDay} minutes per day
- Detail level requested: ${detailLevel} (quick = major topics only, detailed = topics + subtopics, thorough = topics + subtopics + specific concepts)
- Break the topic into as many days as needed so each day's total time fits within ${minutesPerDay} minutes
- Each day should have 1-4 focused items depending on detail level
- Order days from foundational to advanced

Respond ONLY with valid JSON, no markdown, no preamble:
{
  "topic": "string",
  "days": [
    { "day": 1, "items": [ { "id": 1, "title": "string", "description": "string", "estimated_minutes": number } ] }
  ]
}`;
}

export async function POST(req: Request) {
  const { topic, roomId, minutesPerDay, detailLevel } = await req.json();

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: buildSystemPrompt(minutesPerDay, detailLevel) },
        { role: "user", content: topic },
      ],
      temperature: 0.4,
    }),
  });

  const data = await res.json();
  let roadmap;
  try {
    roadmap = JSON.parse(data.choices[0].message.content);
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
  }

  let globalId = 1;
  const flatSteps = roadmap.days.flatMap((d: any) =>
    d.items.map((item: any) => ({
      id: globalId++,
      day: d.day,
      title: item.title,
      description: item.description,
      estimated_minutes: item.estimated_minutes,
    }))
  );

  const supabase = await createClient();
  const { data: saved, error } = await supabase
  .from("roadmaps")
  .insert({ room_id: roomId, topic: roadmap.topic, steps: flatSteps })
  .select()
  .single();

if (error) return NextResponse.json({ error: error.message }, { status: 500 });

return NextResponse.json({ id: saved.id, topic: roadmap.topic, steps: flatSteps });
}