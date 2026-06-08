-- Dual currency support: USD + DZD with configurable exchange rate

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS usd_to_dzd_rate NUMERIC(12, 4) NOT NULL DEFAULT 134.0;

UPDATE platform_settings
SET currency = 'USD'
WHERE currency NOT IN ('USD', 'DZD');

CREATE OR REPLACE FUNCTION public.convert_to_display(amount NUMERIC, from_currency TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  display_currency TEXT;
  rate NUMERIC;
  src TEXT := COALESCE(NULLIF(from_currency, ''), 'USD');
BEGIN
  SELECT ps.currency, ps.usd_to_dzd_rate
  INTO display_currency, rate
  FROM platform_settings ps
  LIMIT 1;

  display_currency := COALESCE(display_currency, 'USD');
  rate := COALESCE(NULLIF(rate, 0), 134.0);

  IF src = display_currency THEN
    RETURN amount;
  END IF;
  IF src = 'USD' AND display_currency = 'DZD' THEN
    RETURN amount * rate;
  END IF;
  IF src = 'DZD' AND display_currency = 'USD' THEN
    RETURN amount / rate;
  END IF;
  RETURN amount;
END;
$$;

-- Dashboard KPIs with currency-normalized amounts
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
    rev_mtd := COALESCE((SELECT SUM(convert_to_display(p.amount, p.currency)) FROM payments p WHERE p.status = 'RECEIVED' AND p.received_at >= date_trunc('month', now())), 0);
    rev_prev := COALESCE((SELECT SUM(convert_to_display(p.amount, p.currency)) FROM payments p WHERE p.status = 'RECEIVED' AND p.received_at >= date_trunc('month', now()) - interval '1 month' AND p.received_at < date_trunc('month', now())), 0);
    deals_mtd := COALESCE((SELECT COUNT(*) FROM deals WHERE stage = 'WON' AND won_at >= date_trunc('month', now())), 0);
    deals_prev := COALESCE((SELECT COUNT(*) FROM deals WHERE stage = 'WON' AND won_at >= date_trunc('month', now()) - interval '1 month' AND won_at < date_trunc('month', now())), 0);
    wr := COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE stage = 'WON') / NULLIF(COUNT(*), 0), 0) FROM deals), 0);
    wr_prev := wr;
    avg_size := COALESCE((SELECT ROUND(AVG(convert_to_display(value, currency))) FROM deals WHERE stage = 'WON'), 0);
    avg_prev := avg_size;
    pipe_val := COALESCE((SELECT SUM(convert_to_display(value, currency)) FROM deals WHERE stage NOT IN ('WON', 'LOST')), 0);
    pipe_prev := pipe_val;
  ELSE
    rev_mtd := COALESCE((SELECT SUM(convert_to_display(p.amount, p.currency)) FROM payments p JOIN deals d ON d.id = p.deal_id WHERE d.rep_id = uid AND p.status = 'RECEIVED' AND p.received_at >= date_trunc('month', now())), 0);
    rev_prev := COALESCE((SELECT SUM(convert_to_display(p.amount, p.currency)) FROM payments p JOIN deals d ON d.id = p.deal_id WHERE d.rep_id = uid AND p.status = 'RECEIVED' AND p.received_at >= date_trunc('month', now()) - interval '1 month' AND p.received_at < date_trunc('month', now())), 0);
    deals_mtd := COALESCE((SELECT COUNT(*) FROM deals WHERE rep_id = uid AND stage = 'WON' AND won_at >= date_trunc('month', now())), 0);
    deals_prev := COALESCE((SELECT COUNT(*) FROM deals WHERE rep_id = uid AND stage = 'WON' AND won_at >= date_trunc('month', now()) - interval '1 month' AND won_at < date_trunc('month', now())), 0);
    wr := COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE stage = 'WON') / NULLIF(COUNT(*), 0), 0) FROM deals WHERE rep_id = uid), 0);
    wr_prev := wr;
    avg_size := COALESCE((SELECT ROUND(AVG(convert_to_display(value, currency))) FROM deals WHERE rep_id = uid AND stage = 'WON'), 0);
    avg_prev := avg_size;
    pipe_val := COALESCE((SELECT SUM(convert_to_display(value, currency)) FROM deals WHERE rep_id = uid AND stage NOT IN ('WON', 'LOST')), 0);
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

CREATE OR REPLACE FUNCTION public.get_revenue_trend(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('month', to_char(m, 'Mon ''YY'), 'revenue', COALESCE(rev, 0)) ORDER BY m)
    FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), '1 month') m
    LEFT JOIN LATERAL (
      SELECT SUM(convert_to_display(p.amount, p.currency)) rev
      FROM payments p
      JOIN deals d ON d.id = p.deal_id
      WHERE p.status = 'RECEIVED' AND date_trunc('month', p.received_at) = m
        AND (is_admin() AND p_user_id IS NULL OR d.rep_id = COALESCE(p_user_id, auth.uid()))
    ) x ON true
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
        SELECT SUM(convert_to_display(pay.amount, pay.currency)) AS rev
        FROM payments pay
        JOIN deals dl ON dl.id = pay.deal_id
        WHERE dl.rep_id = p.id AND pay.status = 'RECEIVED'
      ) r ON true
      WHERE p.role = 'sales_rep' AND p.is_active
    ) ranked
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_to_display(NUMERIC, TEXT) TO authenticated, service_role;
