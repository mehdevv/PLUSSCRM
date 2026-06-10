-- Meeting prep briefs when a deal enters MEETING_PENDING

CREATE TABLE IF NOT EXISTS meeting_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL UNIQUE REFERENCES deals(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  rep_id UUID NOT NULL REFERENCES profiles(id),
  contact_role TEXT,
  meeting_scheduled_at TIMESTAMPTZ,
  meeting_format TEXT NOT NULL DEFAULT 'VIDEO' CHECK (meeting_format IN ('IN_PERSON', 'VIDEO', 'PHONE')),
  attendees TEXT,
  lead_needs TEXT NOT NULL DEFAULT '',
  pain_points TEXT,
  budget_notes TEXT,
  talking_points TEXT,
  additional_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_briefs_lead ON meeting_briefs(lead_id);
CREATE INDEX IF NOT EXISTS idx_meeting_briefs_rep ON meeting_briefs(rep_id);

ALTER TABLE meeting_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY meeting_briefs_admin ON meeting_briefs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY meeting_briefs_rep ON meeting_briefs
  FOR ALL USING (rep_id = auth.uid());
