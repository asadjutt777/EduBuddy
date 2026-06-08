
CREATE TABLE public.documents (
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

CREATE POLICY "Anyone can read documents" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Anyone can insert documents" ON public.documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update documents" ON public.documents FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete documents" ON public.documents FOR DELETE USING (true);

CREATE INDEX documents_name_idx ON public.documents (lower(name));
CREATE INDEX documents_created_at_idx ON public.documents (created_at DESC);

-- Storage policies for the 'documents' bucket
CREATE POLICY "Anyone can read documents bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');

CREATE POLICY "Anyone can upload to documents bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Anyone can update documents bucket"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'documents');

CREATE POLICY "Anyone can delete from documents bucket"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents');
