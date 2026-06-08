/**
 * RAG (Retrieval-Augmented Generation) pipeline.
 * Server-side only — uses Supabase admin client.
 *
 * Responsibilities:
 * - Extract text from PDF, DOCX, PPTX files stored in Supabase Storage
 * - Chunk text and generate embeddings
 * - Store chunks in document_chunks table
 * - Retrieve relevant chunks for a given query
 */
import { loadDotEnv } from "./env-loader.server";
import { createClient } from "@supabase/supabase-js";
import { embedText } from "./gemini";


// ─────────────────────────────────────────────────────────────────────────────
// Supabase admin client (bypasses RLS — server only)
// ─────────────────────────────────────────────────────────────────────────────
function getSupabaseAdmin() {
  // Always re-load .env so secrets like SUPABASE_SERVICE_ROLE_KEY are available
  // even in Vite's dev server which only injects VITE_* vars into process.env.
  loadDotEnv();

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey || serviceKey === "your_supabase_service_role_key_here") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Add it to .env from Supabase Dashboard > Project Settings > API."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Text chunking
// ─────────────────────────────────────────────────────────────────────────────
const CHUNK_SIZE = 600;   // characters per chunk
const CHUNK_OVERLAP = 100; // overlap between chunks

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const cleanText = text.replace(/\s+/g, " ").trim();

  if (cleanText.length === 0) return chunks;

  let start = 0;
  while (start < cleanText.length) {
    const end = Math.min(start + CHUNK_SIZE, cleanText.length);
    const chunk = cleanText.slice(start, end).trim();
    if (chunk.length > 50) { // skip very small chunks
      chunks.push(chunk);
    }
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

// ─────────────────────────────────────────────────────────────────────────────
// Text extraction per file type
// ─────────────────────────────────────────────────────────────────────────────
async function extractTextFromBuffer(buffer: Buffer, fileType: string, fileName: string): Promise<string> {
  const ext = (fileType || fileName.split(".").pop() || "").toUpperCase();

  if (ext === "PDF") {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === "DOCX") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === "PPTX") {
    // Basic PPTX text extraction — reads XML slide content
    const AdmZip = (await import("adm-zip")).default;
    const zip = new AdmZip(buffer);
    const slideEntries = zip.getEntries()
      .filter((e) => e.entryName.match(/^ppt\/slides\/slide\d+\.xml$/))
      .sort((a, b) => a.entryName.localeCompare(b.entryName));

    const texts: string[] = [];
    for (const entry of slideEntries) {
      const xml = entry.getData().toString("utf-8");
      // Extract text runs from PPTX XML
      const matches = xml.matchAll(/<a:t[^>]*>([^<]+)<\/a:t>/g);
      for (const match of matches) {
        const t = match[1].trim();
        if (t) texts.push(t);
      }
    }
    return texts.join(" ");
  }

  // Fallback: try as plain text
  return buffer.toString("utf-8");
}

// ─────────────────────────────────────────────────────────────────────────────
// Index a document (extract → chunk → embed → store)
// ─────────────────────────────────────────────────────────────────────────────
export async function indexDocument(documentId: string): Promise<{ chunks: number; error?: string }> {
  const supabase = getSupabaseAdmin();

  // 1. Fetch document metadata
  console.log("[RAG] indexDocument called with ID:", documentId);

  // First check all documents to see what's in the table
  const { data: allDocs, error: allErr } = await supabase.from("documents").select("id, name").limit(10);
  console.log("[RAG] All docs in table:", JSON.stringify(allDocs), "error:", allErr?.message);

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  console.log("[RAG] Query for ID", documentId, "→ error:", docErr?.code, docErr?.message, "data:", doc?.name);

  if (docErr || !doc) {
    return { chunks: 0, error: `Document not found: ${docErr?.message}` };
  }


  // 2. Download file from Supabase Storage
  const { data: fileData, error: dlErr } = await supabase.storage
    .from("documents")
    .download(doc.storage_path);

  if (dlErr || !fileData) {
    return { chunks: 0, error: `Failed to download file: ${dlErr?.message}` };
  }

  // 3. Extract text
  const arrayBuffer = await fileData.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  let text: string;

  try {
    text = await extractTextFromBuffer(buffer, doc.file_type, doc.name);
  } catch (err: any) {
    return { chunks: 0, error: `Text extraction failed: ${err.message}` };
  }

  if (!text.trim()) {
    return { chunks: 0, error: "No text could be extracted from this document." };
  }

  // 4. Delete old chunks for this document
  await supabase.from("document_chunks").delete().eq("document_id", documentId);

  // 5. Chunk and embed
  const chunks = chunkText(text);
  let successCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    try {
      const embedding = await embedText(chunks[i]);
      const { error: insertErr } = await supabase.from("document_chunks").insert({
        document_id: documentId,
        chunk_index: i,
        content: chunks[i],
        embedding,
      });
      if (!insertErr) successCount++;
    } catch (err: any) {
      console.error(`Failed to embed chunk ${i}:`, err.message);
    }
  }

  return { chunks: successCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Retrieve relevant context for a query
// ─────────────────────────────────────────────────────────────────────────────
export interface RetrievedChunk {
  content: string;
  similarity: number;
  documentId: string;
  chunkIndex: number;
}

export async function retrieveContext(
  query: string,
  topK = 5,
  filterDocumentIds?: string[]
): Promise<RetrievedChunk[]> {
  const supabase = getSupabaseAdmin();

  const queryEmbedding = await embedText(query);

  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_count: topK,
    filter_document_ids: filterDocumentIds ?? null,
  });

  if (error) {
    console.error("Context retrieval error:", error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    content: row.content,
    similarity: row.similarity,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Build system prompt with retrieved context
// ─────────────────────────────────────────────────────────────────────────────
export function buildSystemPromptWithContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return `You are EduAssist, an AI study assistant. Help students understand their course materials clearly and concisely. No relevant document context was found for this query — answer from general knowledge and mention this to the user.`;
  }

  const contextText = chunks
    .map((c, i) => `[Context ${i + 1}] (relevance: ${(c.similarity * 100).toFixed(0)}%)\n${c.content}`)
    .join("\n\n---\n\n");

  return `You are EduAssist, an AI study assistant. Answer questions based on the following context from the user's uploaded documents.

RETRIEVED CONTEXT:
${contextText}

INSTRUCTIONS:
- Answer primarily based on the provided context above.
- If the context doesn't fully answer the question, say so and supplement with general knowledge.
- Be concise, clear, and educational.
- When referencing the context, you can say "Based on your documents..." or "According to your materials...".`;
}

/**
 * Retrieve all chunks for a document and join them to get the full document text.
 */
export async function getDocumentText(documentId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("document_chunks")
    .select("content")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true });

  if (error) {
    throw new Error(`Failed to retrieve document text: ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error("This document has not been indexed yet. Please go to the Documents page and click Index first.");
  }
  return data.map((d: any) => d.content).join("\n");
}

