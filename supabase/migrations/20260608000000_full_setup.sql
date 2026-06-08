-- ============================================================
-- STEP 1: Create the documents table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO anon, authenticated;
GRANT ALL ON public.documents TO service_role;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='Anyone can read documents') THEN
    CREATE POLICY "Anyone can read documents" ON public.documents FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='Anyone can insert documents') THEN
    CREATE POLICY "Anyone can insert documents" ON public.documents FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='Anyone can update documents') THEN
    CREATE POLICY "Anyone can update documents" ON public.documents FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='Anyone can delete documents') THEN
    CREATE POLICY "Anyone can delete documents" ON public.documents FOR DELETE USING (true);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS documents_name_idx ON public.documents (lower(name));
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON public.documents (created_at DESC);

-- ============================================================
-- STEP 2: Create the 'documents' storage bucket (if not exists)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Anyone can read documents bucket') THEN
    CREATE POLICY "Anyone can read documents bucket" ON storage.objects FOR SELECT USING (bucket_id = 'documents');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Anyone can upload to documents bucket') THEN
    CREATE POLICY "Anyone can upload to documents bucket" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Anyone can update documents bucket') THEN
    CREATE POLICY "Anyone can update documents bucket" ON storage.objects FOR UPDATE USING (bucket_id = 'documents');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Anyone can delete from documents bucket') THEN
    CREATE POLICY "Anyone can delete from documents bucket" ON storage.objects FOR DELETE USING (bucket_id = 'documents');
  END IF;
END;
$$;

-- ============================================================
-- STEP 3: Enable pgvector and create document_chunks table
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.document_chunks (
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_chunks' AND policyname='Anyone can read document chunks') THEN
    CREATE POLICY "Anyone can read document chunks" ON public.document_chunks FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_chunks' AND policyname='Anyone can insert document chunks') THEN
    CREATE POLICY "Anyone can insert document chunks" ON public.document_chunks FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_chunks' AND policyname='Anyone can update document chunks') THEN
    CREATE POLICY "Anyone can update document chunks" ON public.document_chunks FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_chunks' AND policyname='Anyone can delete document chunks') THEN
    CREATE POLICY "Anyone can delete document chunks" ON public.document_chunks FOR DELETE USING (true);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON public.document_chunks (document_id);

-- ============================================================
-- STEP 4: Create the match_document_chunks RPC function
-- ============================================================
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
