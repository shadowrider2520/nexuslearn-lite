import { describe, expect, it } from "vitest";
import { parseChatCommand } from "./chat-command";

describe("parseChatCommand", () => {
  it("parses an AI question", () => {
    expect(parseChatCommand("#ask What is a closure?")).toEqual({
      type: "ask",
      prompt: "What is a closure?",
    });
  });

  it("allows a summary without extra text", () => {
    expect(parseChatCommand("#summary")).toEqual({
      type: "summary",
      prompt: "Summarize the group’s recent study discussion and give the next best action.",
    });
  });

  it("rejects casual and incomplete commands", () => {
    expect(parseChatCommand("hello everyone")).toBeNull();
    expect(parseChatCommand("#note")).toBeNull();
  });
});
