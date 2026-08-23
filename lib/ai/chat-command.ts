export type ChatCommand =
  | { type: "ask"; prompt: string }
  | { type: "summary"; prompt: string }
  | { type: "note"; prompt: string }
  | { type: "explain"; prompt: string };

export function parseChatCommand(content: string): ChatCommand | null {
  const value = content.trim();
  const match = /^#(ask|summary|note|explain)\b\s*([\s\S]*)$/i.exec(value);
  if (!match) return null;

  const command = match[1].toLowerCase();
  const prompt = match[2].trim();

  if (command === "summary") {
    return {
      type: "summary",
      prompt:
        prompt ||
        "Summarize the group's recent study discussion and give the next best action.",
    };
  }

  if (command === "explain") {
    return {
      type: "explain",
      prompt:
        prompt ||
        "Explain the uploaded documents in detail. Summarize what they contain and how they relate to our study topic.",
    };
  }

  if (!prompt) return null;
  return command === "ask" ? { type: "ask", prompt } : { type: "note", prompt };
}

export const CHAT_COMMAND_HELP =
  "Use #ask <question>, #summary [focus], #note <update>, or #explain [question about documents].";
