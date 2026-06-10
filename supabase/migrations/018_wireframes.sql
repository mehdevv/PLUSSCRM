-- Wireframe whiteboard boards (tldraw JSON snapshots)

CREATE TABLE IF NOT EXISTS wireframes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Untitled wireframe',
  document JSONB NOT NULL DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wireframes_updated ON wireframes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wireframes_published ON wireframes(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_wireframes_created_by ON wireframes(created_by);

ALTER TABLE wireframes ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY wireframes_admin_select ON wireframes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY wireframes_admin_insert ON wireframes
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY wireframes_admin_update ON wireframes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY wireframes_admin_delete ON wireframes
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Sales rep: read published only
CREATE POLICY wireframes_rep_select ON wireframes
  FOR SELECT USING (
    is_published = true
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'sales_rep')
  );
