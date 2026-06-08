-- Fix get_activity_volume and get_leaderboard SQL errors (400 Bad Request)
-- Run in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.get_activity_volume(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'day', to_char(d.day, 'Dy'),
      'calls', d.calls,
      'emails', d.emails,
      'meetings', d.meetings
    ) ORDER BY d.day)
    FROM (
      SELECT
        gs.d AS day,
        COALESCE(SUM(CASE WHEN a.type::text = 'CALL' THEN 1 END), 0)::int AS calls,
        COALESCE(SUM(CASE WHEN a.type::text = 'EMAIL' THEN 1 END), 0)::int AS emails,
        COALESCE(SUM(CASE WHEN a.type::text = 'MEETING' THEN 1 END), 0)::int AS meetings
      FROM generate_series(
        date_trunc('week', now()),
        date_trunc('week', now()) + interval '6 days',
        interval '1 day'
      ) AS gs(d)
      LEFT JOIN activities a
        ON date_trunc('day', a.created_at) = gs.d
        AND (
          (is_admin() AND p_user_id IS NULL)
          OR a.user_id = COALESCE(p_user_id, auth.uid())
        )
      GROUP BY gs.d
    ) d
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_period TEXT DEFAULT 'monthly')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'user_id', ranked.user_id,
      'name', ranked.name,
      'initials', ranked.initials,
      'tier', ranked.tier,
      'points', ranked.points,
      'deals_mtd', ranked.deals_mtd,
      'win_rate', ranked.win_rate,
      'revenue', ranked.revenue,
      'rank', ranked.rank,
      'color', ranked.color
    ) ORDER BY ranked.rank)
    FROM (
      SELECT
        p.id AS user_id,
        p.name,
        p.initials,
        p.tier,
        p.points,
        p.color,
        COALESCE(d.cnt, 0)::int AS deals_mtd,
        COALESCE(d.wr, 0)::int AS win_rate,
        COALESCE(r.rev, 0)::numeric AS revenue,
        ROW_NUMBER() OVER (ORDER BY p.points DESC)::int AS rank
      FROM profiles p
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (
            WHERE CASE p_period
              WHEN 'daily' THEN d.won_at >= date_trunc('day', now())
              WHEN 'weekly' THEN d.won_at >= date_trunc('week', now())
              ELSE d.won_at >= date_trunc('month', now())
            END
          ) AS cnt,
          ROUND(100.0 * COUNT(*) FILTER (WHERE d.stage = 'WON') / NULLIF(COUNT(*), 0)) AS wr
        FROM deals d
        WHERE d.rep_id = p.id
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT SUM(pay.amount) AS rev
        FROM payments pay
        JOIN deals dl ON dl.id = pay.deal_id
        WHERE dl.rep_id = p.id AND pay.status = 'RECEIVED'
      ) r ON true
      WHERE p.role = 'sales_rep' AND p.is_active
    ) ranked
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_activity_volume(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(TEXT) TO authenticated, service_role;
