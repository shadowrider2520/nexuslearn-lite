import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CHAT_COMMAND_HELP, parseChatCommand } from "@/lib/ai/chat-command";
import { buildTutorPrompt } from "@/lib/ai/tutor-prompt";
import {
  extractTextFromBuffer,
  isImageFile,
  MAX_EXTRACT_BYTES,
} from "@/lib/ai/document-extractor";
import type { Step } from "@/lib/types";

/**
 * Calls the Groq vision model to describe an image at a given URL.
 * Uses meta-llama/llama-4-scout-17b-16e-instruct which supports image_url inputs.
 */
async function describeImageWithGroq(imageUrl: string): Promise<string> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Describe this image in full detail. Include any text, diagrams, charts, tables, code, or visual information you can see. Be thorough and specific.",
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        max_tokens: 1024,
      }),
    });

    if (!res.ok) return "[Image could not be described — vision API error]";
    const data = await res.json();
    return (
      data.choices?.[0]?.message?.content ??
      "[Image could not be described]"
    );
  } catch {
    return "[Image could not be described — network error]";
  }
}

export async function POST(req: Request) {
  let body: { roomId?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { roomId, content } = body;
  if (!roomId || typeof content !== "string" || !content.trim()) {
    return NextResponse.json(
      { error: "roomId and content are required" },
      { status: 400 }
    );
  }

  if (content.length > 2_000) {
    return NextResponse.json(
      { error: "Messages must be 2,000 characters or fewer" },
      { status: 400 }
    );
  }

  const command = parseChatCommand(content);
  if (!command) {
    return NextResponse.json({ error: CHAT_COMMAND_HELP }, { status: 400 });
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const username = profile?.username ?? "Unknown";

  const { error: userMessageError } = await supabase
    .from("messages")
    .insert({
      room_id: roomId,
      user_id: user.id,
      username,
      content,
      is_ai: false,
    });

  if (userMessageError) {
    return NextResponse.json(
      { error: "Failed to save your message" },
      { status: 500 }
    );
  }

  if (command.type === "note") {
    return NextResponse.json({ reply: null });
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "The AI service is not configured" },
      { status: 503 }
    );
  }

  const { data: rateLimitAllowed, error: rateLimitError } = await supabase.rpc(
    "can_request_ai_reply",
    { room_id_input: roomId }
  );

  if (rateLimitError || !rateLimitAllowed) {
    return NextResponse.json(
      {
        error:
          "The AI tutor is taking a short breather. Please wait a moment before asking again.",
      },
      { status: 429 }
    );
  }

  /*
   * FETCH ROADMAP + RECENT MESSAGES (existing behaviour, unchanged)
   */

  const { data: roadmapData } = await supabase
    .from("roadmaps")
    .select("topic, steps")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { data: recentMsgs } = await supabase
    .from("messages")
    .select("username, content")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(15);

  /*
   * FETCH UPLOADED DOCUMENTS + EXTRACT TEXT
   *
   * We fetch up to 8 most-recent documents for this room.
   * For each document:
   *   - Text files / PDF / DOCX / XLSX / PPTX → extract text content.
   *   - Images → create a signed URL and call Groq vision to describe them.
   *   - Files over MAX_EXTRACT_BYTES are skipped with a note.
   * The combined context is injected into the tutor system prompt.
   */

  let documentContext = "";

  const { data: roomDocuments } = await supabase
    .from("documents")
    .select("id, file_name, file_path, file_type, file_size")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(8);

  if (roomDocuments && roomDocuments.length > 0) {
    const contextParts: string[] = [];

    for (const doc of roomDocuments) {
      // Skip files that are too large to reasonably extract
      if (doc.file_size > MAX_EXTRACT_BYTES) {
        contextParts.push(
          `- ${doc.file_name} (${Math.round(doc.file_size / 1024)} KB — too large to extract, skipped)`
        );
        continue;
      }

      if (isImageFile(doc.file_name, doc.file_type)) {
        /*
         * IMAGE — get a signed URL and ask Groq vision to describe it.
         * Signed URL lasts 5 minutes, which is enough for the immediate API call.
         */
        const { data: signedUrlData } = await supabase.storage
          .from("room-documents")
          .createSignedUrl(doc.file_path, 300);

        if (signedUrlData?.signedUrl) {
          const description = await describeImageWithGroq(
            signedUrlData.signedUrl
          );
          contextParts.push(
            `- ${doc.file_name} [IMAGE]\n  Description: ${description}`
          );
        } else {
          contextParts.push(
            `- ${doc.file_name} [IMAGE — signed URL could not be generated]`
          );
        }
      } else {
        /*
         * TEXT / BINARY DOCUMENT — download and extract text.
         */
        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from("room-documents")
          .download(doc.file_path);

        if (downloadError || !fileBlob) {
          contextParts.push(`- ${doc.file_name} [download failed]`);
          continue;
        }

        const arrayBuffer = await fileBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const text = await extractTextFromBuffer(
          buffer,
          doc.file_name,
          doc.file_type
        );

        if (text !== null) {
          contextParts.push(`- ${doc.file_name}:\n${text}`);
        } else {
          // null means image — shouldn't reach here, but handle gracefully
          contextParts.push(`- ${doc.file_name} [binary file — no text extracted]`);
        }
      }
    }

    documentContext = contextParts.join("\n\n");
  }

  /*
   * BUILD TUTOR PROMPT WITH DOCUMENT CONTEXT
   */

  const tutorPrompt = buildTutorPrompt(
    roadmapData?.topic ?? "not set",
    (roadmapData?.steps ?? []) as Step[],
    (recentMsgs ?? []).reverse(),
    documentContext
  );

  /*
   * CALL GROQ
   */

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
          { role: "system", content: tutorPrompt },
          {
            role: "user",
            content: command.prompt,
          },
        ],
        temperature: 0.6,
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

  const aiReply =
    data.choices?.[0]?.message?.content ??
    "I couldn't respond right now, try again.";

  const { error: aiMessageError } = await supabase.from("messages").insert({
    room_id: roomId,
    username: "AI Tutor",
    content: aiReply,
    is_ai: true,
  });

  if (aiMessageError) {
    return NextResponse.json(
      { error: "Failed to save the AI reply" },
      { status: 500 }
    );
  }

  return NextResponse.json({ reply: aiReply });
}
