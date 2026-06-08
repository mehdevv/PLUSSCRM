-- Client currency for correct LTV display + storage bucket policies for receipt uploads

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

UPDATE clients c
SET currency = COALESCE(
  (
    SELECT d.currency
    FROM deals d
    JOIN leads l ON l.id = d.lead_id
    WHERE d.stage = 'WON'
      AND (l.company = c.company OR l.email = c.email)
    ORDER BY d.won_at DESC NULLS LAST, d.updated_at DESC
    LIMIT 1
  ),
  'USD'
)
WHERE c.currency IS NULL OR c.currency = 'USD';

INSERT INTO storage.buckets (id, name, public)
VALUES ('client-files', 'client-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS client_files_storage_insert ON storage.objects;
DROP POLICY IF EXISTS client_files_storage_select ON storage.objects;
DROP POLICY IF EXISTS client_files_storage_update ON storage.objects;
DROP POLICY IF EXISTS client_files_storage_delete ON storage.objects;

CREATE POLICY client_files_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-files'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id::text = (storage.foldername(name))[1]
          AND c.manager_id = auth.uid()
      )
    )
  );

CREATE POLICY client_files_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-files'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id::text = (storage.foldername(name))[1]
          AND c.manager_id = auth.uid()
      )
    )
  );

CREATE POLICY client_files_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client-files'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id::text = (storage.foldername(name))[1]
          AND c.manager_id = auth.uid()
      )
    )
  );

CREATE POLICY client_files_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-files'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id::text = (storage.foldername(name))[1]
          AND c.manager_id = auth.uid()
      )
    )
  );
