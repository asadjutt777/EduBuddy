/**
 * AI client — handles embeddings via Google Gemini API
 * and text completions via Hugging Face Router API.
 */

import { loadDotEnv } from "./env-loader.server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const CHAT_MODEL = "meta-llama/Llama-3.1-8B-Instruct";

function getHFToken(): string {
  loadDotEnv();
  const token =
    (typeof process !== "undefined" ? process.env.HF_TOKEN : undefined) ??
    (typeof import.meta !== "undefined"
      ? (import.meta as any).env?.VITE_HF_TOKEN
      : undefined);

  if (!token || token === "your_hf_token_here") {
    throw new Error(
      "HF_TOKEN is not configured. Add it to your .env file. Get a free token at https://huggingface.co/settings/tokens"
    );
  }
  return token;
}

function getGeminiApiKey(): string {
  loadDotEnv();
  const apiKey =
    (typeof process !== "undefined" ? process.env.GEMINI_API_KEY : undefined) ??
    (typeof import.meta !== "undefined"
      ? (import.meta as any).env?.VITE_GEMINI_API_KEY
      : undefined);

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error("GEMINI_API_KEY is not configured. Configure it in .env file.");
  }
  return apiKey;
}

/**
 * Generate a 768-dimensional embedding using Google Gemini's gemini-embedding-001 model.
 * Matches the vector(768) column in Supabase.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = getGeminiApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

  const result = await model.embedContent({
    content: { parts: [{ text }] },
    outputDimensionality: 768,
  });

  if (result?.embedding?.values) {
    return result.embedding.values;
  }
  throw new Error("Failed to generate embedding from Gemini API");
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Generate a chat response using Llama 3.1 via Hugging Face Router API.
 * Optionally prepend a system prompt with RAG context.
 */
export async function chatWithGemini(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<string> {
  const token = getHFToken();

  const systemMsg = systemPrompt ??
    "You are EduAssist, an AI study assistant. Help students understand their course materials clearly and concisely.";

  // Build messages array in OpenAI chat format
  const hfMessages = [
    { role: "system", content: systemMsg },
    ...messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
  ];

  const response = await fetch(
    "https://router.huggingface.co/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: hfMessages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HF Chat error (${response.status}): ${err}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content ?? "";
}
