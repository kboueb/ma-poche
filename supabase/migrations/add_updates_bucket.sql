-- maPoche — Migration : bucket public pour les mises à jour de l'app desktop

INSERT INTO storage.buckets (id, name, public)
VALUES ('updates', 'updates', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'updates_public_read'
  ) THEN
    CREATE POLICY "updates_public_read" ON storage.objects FOR SELECT
      USING (bucket_id = 'updates');
  END IF;
END $$;
