import type { Step } from "@/lib/types";

export type RoadmapItem = {
  id: number;
  title: string;
  description: string;
  estimated_minutes: number;
};

export type RoadmapDay = {
  day: number;
  items: RoadmapItem[];
};

export type GeneratedRoadmap = {
  topic: string;
  days: RoadmapDay[];
};

/**
 * Flatten a day-wise AI roadmap into a flat, globally-id'd step list.
 * Each step gets a unique sequential id across all days.
 */
export function flattenRoadmap(roadmap: GeneratedRoadmap): Step[] {
  let globalId = 1;

  return roadmap.days.flatMap((day) =>
    day.items.map((item) => ({
      id: globalId++,
      day: day.day,
      title: item.title,
      description: item.description,
      estimated_minutes: item.estimated_minutes,
    }))
  );
}

/** System prompt for the roadmap generator. */
export function buildRoadmapSystemPrompt(
  minutesPerDay: number,
  detailLevel: string
): string {
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
