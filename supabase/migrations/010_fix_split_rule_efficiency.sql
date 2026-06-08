-- Fix get_split_rule_efficiency 400 (nested aggregate in jsonb_agg + GROUP BY)
-- Run in Supabase SQL Editor if not applied via CLI

CREATE OR REPLACE FUNCTION public.get_split_rule_efficiency()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(sub.row_data ORDER BY sub.row_priority, sub.row_name)
    FROM (
      SELECT
        ls.priority AS row_priority,
        ls.name AS row_name,
        jsonb_build_object(
          'name', ls.name,
          'winRate', COALESCE(
            ROUND(
              100.0 * COUNT(*) FILTER (WHERE l.status = 'WON')
              / NULLIF(COUNT(aa.id), 0)
            )::int,
            0
          ),
          'deals', COALESCE(COUNT(aa.id), 0)::int
        ) AS row_data
      FROM lead_splits ls
      LEFT JOIN assignment_audit aa ON aa.rule_id = ls.id
      LEFT JOIN leads l ON l.id = aa.lead_id AND l.deleted_at IS NULL
      WHERE ls.is_active
      GROUP BY ls.id, ls.name, ls.priority
    ) sub
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_split_rule_efficiency() TO authenticated, service_role;
