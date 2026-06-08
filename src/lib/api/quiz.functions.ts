/**
 * Server function for generating quizzes from documents.
 * Supports MCQ, True/False, Short Answer, or all three types.
 * Uses HuggingFace Inference API via shared chatWithGemini wrapper.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDocumentText } from "../rag";
import { chatWithGemini } from "../gemini";

const quizTypeEnum = z.enum(["all", "mcq", "tf", "sa"]).default("all");

export const generateQuizFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      documentId: z.string().uuid(),
      count: z.number().min(1).max(20).default(5),
      quizType: quizTypeEnum,
    })
  )
  .handler(async ({ data }) => {
    const { documentId, count, quizType } = data;
    try {
      const docText = await getDocumentText(documentId);

      let prompt: string;

      if (quizType === "mcq") {
        prompt = `You are an AI study assistant. Read the provided document text and generate multiple-choice questions for active recall.
Respond ONLY with a valid JSON object — no markdown, no extra text, just raw JSON.

Document text:
${docText}

Generate exactly ${count} MCQs. The JSON object must have exactly this property:
- "mcqs" (array): List of ${count} MCQs. Each item is an object with:
  - "q" (string): The question.
  - "choices" (array of strings): Exactly 4 choices.
  - "answer" (number): Index of the correct choice (0 to 3).`;
      } else if (quizType === "tf") {
        prompt = `You are an AI study assistant. Read the provided document text and generate true/false statements for active recall.
Respond ONLY with a valid JSON object — no markdown, no extra text, just raw JSON.

Document text:
${docText}

Generate exactly ${count} True/False statements. The JSON object must have exactly this property:
- "tf" (array): List of ${count} True/False statements. Each item is an object with:
  - "q" (string): The statement.
  - "answer" (boolean): True if statement is correct, False otherwise.`;
      } else if (quizType === "sa") {
        prompt = `You are an AI study assistant. Read the provided document text and generate short-answer questions for active recall.
Respond ONLY with a valid JSON object — no markdown, no extra text, just raw JSON.

Document text:
${docText}

Generate exactly ${count} Short Answer questions. The JSON object must have exactly this property:
- "sa" (array): List of ${count} Short Answer questions. Each item is an object with:
  - "q" (string): The question.
  - "sample" (string): A brief model/sample answer.`;
      } else {
        // "all" — generate all three types
        prompt = `You are an AI study assistant. Read the provided document text and generate three types of questions for active recall.
Respond ONLY with a valid JSON object — no markdown, no extra text, just raw JSON.

Document text:
${docText}

Generate exactly ${count} questions for each of the three formats. The JSON object must have exactly these properties:
- "mcqs" (array): List of ${count} MCQs. Each item is an object with:
  - "q" (string): The question.
  - "choices" (array of strings): Exactly 4 choices.
  - "answer" (number): Index of the correct choice (0 to 3).
- "tf" (array): List of ${count} True/False statements. Each item is an object with:
  - "q" (string): The statement.
  - "answer" (boolean): True if statement is correct, False otherwise.
- "sa" (array): List of ${count} Short Answer questions. Each item is an object with:
  - "q" (string): The question.
  - "sample" (string): A brief model/sample answer.`;
      }

      const responseText = await chatWithGemini(
        [{ role: "user", content: prompt }]
      );

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in AI response");
      const parsed = JSON.parse(jsonMatch[0]);
      return { success: true, data: parsed, quizType };
    } catch (err: any) {
      console.error("Quiz generation failed:", err.message);
      return { success: false, error: err.message };
    }
  });
