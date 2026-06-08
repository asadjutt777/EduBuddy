/**
 * Server functions for the AI chat feature.
 * Uses Gemini 1.5 Flash + RAG context retrieval from Supabase.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chatWithGemini } from "../gemini";
import { retrieveContext, buildSystemPromptWithContext } from "../rag";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

/**
 * Send a chat message and get a Gemini response.
 * Retrieves RAG context from uploaded documents if useRAG is true.
 */
export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      messages: z.array(MessageSchema).min(1),
      useRAG: z.boolean().default(true),
    })
  )
  .handler(async ({ data }) => {
    const { messages, useRAG } = data;

    // Get the last user message for context retrieval
    const lastUserMessage = messages
      .filter((m) => m.role === "user")
      .at(-1)?.content ?? "";

    let systemPrompt: string | undefined;

    if (useRAG && lastUserMessage) {
      try {
        const chunks = await retrieveContext(lastUserMessage, 5);
        systemPrompt = buildSystemPromptWithContext(chunks);
      } catch (err: any) {
        console.error("RAG retrieval failed:", err.message);
        // Fall back to answering without document context
        systemPrompt = "You are EduAssist, an AI study assistant. Help students understand their course materials clearly and concisely. Note: document context retrieval is currently unavailable.";
      }
    }

    try {
      const response = await chatWithGemini(messages, systemPrompt);
      return { success: true, message: response };
    } catch (err: any) {
      console.error("Gemini chat error:", err.message);
      return {
        success: false,
        message: `Error: ${err.message}. Please check your GEMINI_API_KEY in .env.`,
      };
    }
  });
