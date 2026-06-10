-- Pipeline workflow: Contacted → Qualified → Follow up → Meeting pending

ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'QUALIFIED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'FOLLOW_UP';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'MEETING_PENDING';

-- Migrate legacy stages to the new workflow
UPDATE leads SET status = 'QUALIFIED' WHERE status = 'QUALIFYING';
UPDATE deals SET stage = 'QUALIFIED' WHERE stage = 'QUALIFYING';

UPDATE leads SET status = 'FOLLOW_UP' WHERE status = 'PROPOSAL';
UPDATE deals SET stage = 'FOLLOW_UP' WHERE stage = 'PROPOSAL';

UPDATE leads SET status = 'MEETING_PENDING' WHERE status = 'NEGOTIATION';
UPDATE deals SET stage = 'MEETING_PENDING' WHERE stage = 'NEGOTIATION';

-- Pipeline funnel with updated stage ordering
CREATE OR REPLACE FUNCTION public.get_pipeline_funnel(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'stage', f.status::text,
      'count', f.cnt,
      'value', f.val,
      'color', CASE f.status::text
        WHEN 'NEW' THEN '#3B82F6'
        WHEN 'ASSIGNED' THEN '#8B5CF6'
        WHEN 'CONTACTED' THEN '#06B6D4'
        WHEN 'QUALIFIED' THEN '#F59E0B'
        WHEN 'FOLLOW_UP' THEN '#F97316'
        WHEN 'MEETING_PENDING' THEN '#8B5CF6'
        WHEN 'QUALIFYING' THEN '#F59E0B'
        WHEN 'PROPOSAL' THEN '#F97316'
        WHEN 'NEGOTIATION' THEN '#8B5CF6'
        WHEN 'DORMANT' THEN '#94A3B8'
        ELSE '#6B7280'
      END
    ) ORDER BY f.stage_order)
    FROM (
      SELECT
        l.status,
        COUNT(*) AS cnt,
        SUM(l.value) AS val,
        CASE l.status::text
          WHEN 'NEW' THEN 1
          WHEN 'ASSIGNED' THEN 2
          WHEN 'CONTACTED' THEN 3
          WHEN 'QUALIFIED' THEN 4
          WHEN 'FOLLOW_UP' THEN 5
          WHEN 'MEETING_PENDING' THEN 6
          WHEN 'QUALIFYING' THEN 4
          WHEN 'PROPOSAL' THEN 5
          WHEN 'NEGOTIATION' THEN 6
          WHEN 'DORMANT' THEN 7
          ELSE 99
        END AS stage_order
      FROM leads l
      WHERE l.deleted_at IS NULL
        AND l.status NOT IN ('WON', 'LOST')
        AND (
          (is_admin() AND p_user_id IS NULL)
          OR l.assigned_to = COALESCE(p_user_id, auth.uid())
        )
      GROUP BY l.status
    ) f
  ), '[]'::jsonb);
END;
$$;
