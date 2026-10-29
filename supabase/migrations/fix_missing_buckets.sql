-- maPoche — Fix : (re)crée les buckets manquants (idempotent, ré-exécutable sans risque)

-- ==========================================
-- BUCKET receipts (justificatifs, privé)
-- ==========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'receipts_select') THEN
    CREATE POLICY "receipts_select" ON storage.objects FOR SELECT
      USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'receipts_insert') THEN
    CREATE POLICY "receipts_insert" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'receipts_delete') THEN
    CREATE POLICY "receipts_delete" ON storage.objects FOR DELETE
      USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;

-- ==========================================
-- BUCKET updates (MAJ app desktop, public)
-- ==========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('updates', 'updates', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'updates_public_read') THEN
    CREATE POLICY "updates_public_read" ON storage.objects FOR SELECT
      USING (bucket_id = 'updates');
  END IF;
END $$;
