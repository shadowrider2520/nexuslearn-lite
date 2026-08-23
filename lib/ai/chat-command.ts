export type ChatCommand =
  | { type: "ask"; prompt: string }
  | { type: "summary"; prompt: string }
  | { type: "note"; prompt: string };

export function parseChatCommand(content: string): ChatCommand | null {
  const value = content.trim();
  const match = /^#(ask|summary|note)\b\s*([\s\S]*)$/i.exec(value);
  if (!match) return null;

  const command = match[1].toLowerCase();
  const prompt = match[2].trim();

  if (command === "summary") {
    return {
      type: "summary",
      prompt: prompt || "Summarize the group’s recent study discussion and give the next best action.",
    };
  }

  if (!prompt) return null;
  return command === "ask" ? { type: "ask", prompt } : { type: "note", prompt };
}

export const CHAT_COMMAND_HELP =
  "Use #ask <question>, #summary [focus], or #note <update>.";
