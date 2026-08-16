import { describe, expect, it } from "vitest";
import { buildTutorPrompt } from "./tutor-prompt";

describe("buildTutorPrompt", () => {
  const steps = [
    {
      id: 1,
      day: 1,
      title: "Basics",
      description: "syntax",
      estimated_minutes: 30,
    },
  ];

  it("includes the topic and roadmap steps", () => {
    const prompt = buildTutorPrompt("Python", steps, []);

    expect(prompt).toContain("Python");
    expect(prompt).toContain("Basics");
  });

  it("includes recent conversation history", () => {
    const prompt = buildTutorPrompt(
      "Python",
      steps,
      [
        { username: "Aki", content: "how do loops work?" },
        { username: "AI Tutor", content: "Good question, buddy." },
      ]
    );

    expect(prompt).toContain("Aki: how do loops work?");
    expect(prompt).toContain("AI Tutor: Good question, buddy.");
  });

  it("handles an empty history", () => {
    const prompt = buildTutorPrompt("Python", [], []);
    expect(prompt).toContain("Python");
  });
});
