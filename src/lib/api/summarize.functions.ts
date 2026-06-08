/**
 * Server function for document summarization.
 * Uses HuggingFace Inference API (free tier) via shared chatWithGemini wrapper.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDocumentText } from "../rag";
import { chatWithGemini } from "../gemini";

export const generateSummaryFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      documentId: z.string().uuid(),
    })
  )
  .handler(async ({ data }) => {
    const { documentId } = data;
    try {
      const docText = await getDocumentText(documentId);

      const prompt = `You are an AI academic assistant. Read the provided document text and generate a concise summary, key points, and core concepts.
Respond ONLY with a valid JSON object — no markdown, no extra text, just raw JSON.

Document text:
${docText}

The JSON object must have exactly these properties:
- "summary" (string): A short, clear paragraph summarizing the document.
- "keyPoints" (array of strings): A list of 4-6 bullet points containing key takeaways.
- "concepts" (array of strings): A list of 3-5 key academic terminology/concepts introduced.`;

      const responseText = await chatWithGemini(
        [{ role: "user", content: prompt }]
      );

      // Extract JSON from response (model may wrap it in markdown code fences)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in AI response");
      const parsed = JSON.parse(jsonMatch[0]);
      return { success: true, data: parsed };
    } catch (err: any) {
      console.error("Summarization failed:", err.message);
      return { success: false, error: err.message };
    }
  });
