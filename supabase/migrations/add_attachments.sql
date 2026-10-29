-- maPoche — Migration : justificatifs (pièces jointes aux transactions)

-- ==========================================
-- ATTACHMENTS (métadonnées)
-- ==========================================
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att_select" ON attachments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "att_insert" ON attachments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "att_delete" ON attachments FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_attachments_transaction ON attachments(transaction_id);

-- ==========================================
-- STORAGE : bucket privé "receipts"
-- Fichiers rangés par user : <user_id>/<transaction_id>/<fichier>
-- ==========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "receipts_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "receipts_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "receipts_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
