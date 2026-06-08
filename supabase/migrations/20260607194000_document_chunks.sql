-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Document chunks table for RAG pipeline
CREATE TABLE public.document_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_chunks TO anon, authenticated;
GRANT ALL ON public.document_chunks TO service_role;

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read document chunks" ON public.document_chunks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert document chunks" ON public.document_chunks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update document chunks" ON public.document_chunks FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete document chunks" ON public.document_chunks FOR DELETE USING (true);

-- Index for fast vector similarity search (cosine distance)
CREATE INDEX document_chunks_embedding_idx ON public.document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX document_chunks_document_id_idx ON public.document_chunks (document_id);

-- Function to search for similar document chunks
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(768),
  match_count int DEFAULT 5,
  filter_document_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE
    dc.embedding IS NOT NULL
    AND (filter_document_ids IS NULL OR dc.document_id = ANY(filter_document_ids))
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
