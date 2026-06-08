/**
 * Server function for generating study notes from documents.
 * Uses Google Gemini 1.5 Flash with JSON mode.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDocumentText } from "../rag";
import { GoogleGenerativeAI } from "@google/generative-ai";

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error("GEMINI_API_KEY is not configured. Configure it in .env file.");
  }
  return new GoogleGenerativeAI(apiKey);
}

export const generateNotesFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      documentId: z.string().uuid(),
      style: z.enum(["revision", "cornell", "outline", "cheatsheet"]),
    })
  )
  .handler(async ({ data }) => {
    const { documentId, style } = data;
    try {
      const docText = await getDocumentText(documentId);
      const genAI = getGemini();

      const model = genAI.getGenerativeModel({
        model: "gemini-flash-lite-latest",
        generationConfig: { responseMimeType: "application/json" },
      });

      const styleDescriptions = {
        revision: "structured, condensed revision summary notes highlighting key equations and concepts.",
        cornell: "notes formatted using the Cornell method (cue columns/questions, main notes, and a concluding summary).",
        outline: "a logical hierarchical outline using nested list blocks and bullet points.",
        cheatsheet: "ultra-dense, high-impact cheat sheet summarizing all formulas, facts, and definitions.",
      };

      const response = await model.generateContent(
        `You are an AI study assistant. Read the provided document text and generate structured study notes. Respond ONLY with a valid JSON object matching the requested schema.

Document text:
${docText}

Generate study notes in the following style: ${styleDescriptions[style]}.
The JSON object must have exactly these properties:
- 'title' (string): A short, clear title for the notes.
- 'sections' (array): List of sections (aim for 3-6 sections). Each section is an object with:
  - 'heading' (string): The title/heading of this section.
  - 'text' (string, optional): A brief summary paragraph or explanation for this section.
  - 'bullets' (array of strings, optional): 2-5 bullet points containing specific details, formulas, or cue questions.
  - 'callout' (string, optional): A critical takeaway, memory tip, formula, or cue summary to display in a focused box.`
      );

      const jsonText = response.response.text();
      const parsed = JSON.parse(jsonText);
      return { success: true, data: parsed };
    } catch (err: any) {
      console.error("Notes generation failed:", err.message);
      return { success: false, error: err.message };
    }
  });
