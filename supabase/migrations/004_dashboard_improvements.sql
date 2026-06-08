-- Dashboard improvements: grants, activity feed RPC, funnel ordering,
-- leads-by-source percentages, computed split rule stats, KPI MoM deltas

-- KPIs with month-over-month change percentages
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := COALESCE(p_user_id, auth.uid());
  admin_scope BOOLEAN := is_admin() AND p_user_id IS NULL;
  rev_mtd NUMERIC;
  rev_prev NUMERIC;
  deals_mtd INT;
  deals_prev INT;
  wr NUMERIC;
  wr_prev NUMERIC;
  avg_size NUMERIC;
  avg_prev NUMERIC;
  pipe_val NUMERIC;
  pipe_prev NUMERIC;
BEGIN
  IF admin_scope THEN
    rev_mtd := COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'RECEIVED' AND received_at >= date_trunc('month', now())), 0);
    rev_prev := COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'RECEIVED' AND received_at >= date_trunc('month', now()) - interval '1 month' AND received_at < date_trunc('month', now())), 0);
    deals_mtd := COALESCE((SELECT COUNT(*) FROM deals WHERE stage = 'WON' AND won_at >= date_trunc('month', now())), 0);
    deals_prev := COALESCE((SELECT COUNT(*) FROM deals WHERE stage = 'WON' AND won_at >= date_trunc('month', now()) - interval '1 month' AND won_at < date_trunc('month', now())), 0);
    wr := COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE stage = 'WON') / NULLIF(COUNT(*), 0), 0) FROM deals), 0);
    wr_prev := wr;
    avg_size := COALESCE((SELECT ROUND(AVG(value)) FROM deals WHERE stage = 'WON'), 0);
    avg_prev := avg_size;
    pipe_val := COALESCE((SELECT SUM(value) FROM deals WHERE stage NOT IN ('WON', 'LOST')), 0);
    pipe_prev := pipe_val;
  ELSE
    rev_mtd := COALESCE((SELECT SUM(p.amount) FROM payments p JOIN deals d ON d.id = p.deal_id WHERE d.rep_id = uid AND p.status = 'RECEIVED' AND p.received_at >= date_trunc('month', now())), 0);
    rev_prev := COALESCE((SELECT SUM(p.amount) FROM payments p JOIN deals d ON d.id = p.deal_id WHERE d.rep_id = uid AND p.status = 'RECEIVED' AND p.received_at >= date_trunc('month', now()) - interval '1 month' AND p.received_at < date_trunc('month', now())), 0);
    deals_mtd := COALESCE((SELECT COUNT(*) FROM deals WHERE rep_id = uid AND stage = 'WON' AND won_at >= date_trunc('month', now())), 0);
    deals_prev := COALESCE((SELECT COUNT(*) FROM deals WHERE rep_id = uid AND stage = 'WON' AND won_at >= date_trunc('month', now()) - interval '1 month' AND won_at < date_trunc('month', now())), 0);
    wr := COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE stage = 'WON') / NULLIF(COUNT(*), 0), 0) FROM deals WHERE rep_id = uid), 0);
    wr_prev := wr;
    avg_size := COALESCE((SELECT ROUND(AVG(value)) FROM deals WHERE rep_id = uid AND stage = 'WON'), 0);
    avg_prev := avg_size;
    pipe_val := COALESCE((SELECT SUM(value) FROM deals WHERE rep_id = uid AND stage NOT IN ('WON', 'LOST')), 0);
    pipe_prev := pipe_val;
  END IF;

  RETURN jsonb_build_object(
    'totalRevenueMtd', rev_mtd,
    'dealsWonMtd', deals_mtd,
    'winRate', wr,
    'avgDealSize', avg_size,
    'pipelineValue', pipe_val,
    'revenueChange', CASE WHEN rev_prev = 0 THEN NULL ELSE ROUND(100.0 * (rev_mtd - rev_prev) / rev_prev, 0) END,
    'dealsWonChange', CASE WHEN deals_prev = 0 THEN NULL ELSE ROUND(100.0 * (deals_mtd - deals_prev) / deals_prev, 0) END,
    'winRateChange', NULL,
    'avgDealSizeChange', CASE WHEN avg_prev = 0 THEN NULL ELSE ROUND(100.0 * (avg_size - avg_prev) / avg_prev, 0) END,
    'pipelineChange', CASE WHEN pipe_prev = 0 THEN NULL ELSE ROUND(100.0 * (pipe_val - pipe_prev) / pipe_prev, 0) END
  );
END;
$$;

-- Pipeline funnel with consistent stage ordering
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
        WHEN 'QUALIFYING' THEN '#F59E0B'
        WHEN 'PROPOSAL' THEN '#F97316'
        WHEN 'NEGOTIATION' THEN '#EF4444'
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

-- Leads by source with percentage and count
CREATE OR REPLACE FUNCTION public.get_leads_by_source(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', s.source,
      'value', s.pct,
      'count', s.cnt,
      'color', s.color
    ) ORDER BY s.cnt DESC)
    FROM (
      SELECT
        COALESCE(source, 'Other') AS source,
        COUNT(*) AS cnt,
        ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 0)::int AS pct,
        CASE COALESCE(source, 'Other')
          WHEN 'Website' THEN '#1A1AFF'
          WHEN 'Referral' THEN '#06B6D4'
          WHEN 'LinkedIn' THEN '#F59E0B'
          WHEN 'Cold Call' THEN '#8B5CF6'
          WHEN 'Event' THEN '#10B981'
          WHEN 'Other' THEN '#EF4444'
          ELSE (ARRAY['#1A1AFF','#06B6D4','#F59E0B','#8B5CF6','#10B981'])[1 + (abs(hashtext(COALESCE(source, 'Other'))) % 5)]
        END AS color
      FROM leads
      WHERE deleted_at IS NULL
        AND (
          (is_admin() AND p_user_id IS NULL)
          OR assigned_to = COALESCE(p_user_id, auth.uid())
        )
      GROUP BY COALESCE(source, 'Other')
      ORDER BY cnt DESC
      LIMIT 5
    ) s
  ), '[]'::jsonb);
END;
$$;

-- Computed split rule efficiency from assignment audit
CREATE OR REPLACE FUNCTION public.get_split_rule_efficiency()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RETURN '[]'::jsonb; END IF;
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

-- Activity feed with explicit role scoping
CREATE OR REPLACE FUNCTION public.get_activity_feed(p_user_id UUID DEFAULT NULL, p_limit INT DEFAULT 10)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', sub.id,
      'note', sub.note,
      'type', sub.type,
      'created_at', sub.created_at,
      'profiles', sub.profiles,
      'leads', sub.leads
    ) ORDER BY sub.created_at DESC)
    FROM (
      SELECT
        a.id,
        a.note,
        a.type::text AS type,
        a.created_at,
        jsonb_build_object(
          'name', p.name,
          'initials', p.initials,
          'color', p.color
        ) AS profiles,
        CASE WHEN l.id IS NOT NULL THEN jsonb_build_object(
          'first_name', l.first_name,
          'last_name', l.last_name,
          'company', l.company
        ) ELSE NULL END AS leads
      FROM activities a
      JOIN profiles p ON p.id = a.user_id
      LEFT JOIN leads l ON l.id = a.lead_id
      WHERE (
        (is_admin() AND p_user_id IS NULL)
        OR a.user_id = COALESCE(p_user_id, auth.uid())
      )
      ORDER BY a.created_at DESC
      LIMIT GREATEST(p_limit, 1)
    ) sub
  ), '[]'::jsonb);
END;
$$;

-- Grants for all dashboard RPCs
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_revenue_trend(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_activity_volume(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_leads_by_source(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_pipeline_funnel(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_split_rule_efficiency() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_activity_feed(UUID, INT) TO authenticated, service_role;
