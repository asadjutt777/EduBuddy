/**
 * Server function for indexing uploaded documents into the RAG pipeline.
 * Called after a successful document upload.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { indexDocument } from "../rag";

/**
 * Index a document: extract text, chunk it, embed each chunk, store in Supabase.
 * This may take several seconds for large documents.
 */
export const indexDocumentFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      documentId: z.string().uuid(),
    })
  )
  .handler(async ({ data }) => {
    try {
      const result = await indexDocument(data.documentId);
      if (result.error) {
        console.error("Indexing error:", result.error);
        return { success: false, chunks: 0, error: result.error };
      }
      return { success: true, chunks: result.chunks };
    } catch (err: any) {
      console.error("Indexing failed:", err.message);
      return { success: false, chunks: 0, error: err.message };
    }
  });
