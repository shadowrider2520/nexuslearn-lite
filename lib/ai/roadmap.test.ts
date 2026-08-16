import { describe, expect, it } from "vitest";
import {
  buildRoadmapSystemPrompt,
  flattenRoadmap,
  type GeneratedRoadmap,
} from "./roadmap";

describe("flattenRoadmap", () => {
  it("assigns global sequential ids across days", () => {
    const roadmap: GeneratedRoadmap = {
      topic: "Python",
      days: [
        {
          day: 1,
          items: [
            { id: 1, title: "Basics", description: "syntax", estimated_minutes: 30 },
          ],
        },
        {
          day: 2,
          items: [
            { id: 1, title: "Loops", description: "for/while", estimated_minutes: 20 },
          ],
        },
      ],
    };

    const steps = flattenRoadmap(roadmap);

    expect(steps).toHaveLength(2);
    expect(steps.map((s) => s.id)).toEqual([1, 2]);
    expect(steps.map((s) => s.day)).toEqual([1, 2]);
  });

  it("preserves item fields", () => {
    const roadmap: GeneratedRoadmap = {
      topic: "Python",
      days: [
        {
          day: 1,
          items: [
            { id: 1, title: "Basics", description: "syntax", estimated_minutes: 30 },
          ],
        },
      ],
    };

    const [step] = flattenRoadmap(roadmap);

    expect(step.title).toBe("Basics");
    expect(step.description).toBe("syntax");
    expect(step.estimated_minutes).toBe(30);
  });

  it("handles empty days", () => {
    const roadmap: GeneratedRoadmap = { topic: "Python", days: [] };
    expect(flattenRoadmap(roadmap)).toEqual([]);
  });
});

describe("buildRoadmapSystemPrompt", () => {
  it("includes minutes per day and detail level", () => {
    const prompt = buildRoadmapSystemPrompt(45, "thorough");

    expect(prompt).toContain("45 minutes per day");
    expect(prompt).toContain("thorough");
  });
});
