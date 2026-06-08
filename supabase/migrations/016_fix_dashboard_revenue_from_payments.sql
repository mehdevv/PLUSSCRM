-- Dashboard revenue: sum raw payment amounts (no double conversion when already in display currency)

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
    rev_mtd := COALESCE((
      SELECT SUM(p.amount)
      FROM payments p
      WHERE p.status IN ('RECEIVED', 'PARTIAL')
        AND p.received_at >= date_trunc('month', now())
    ), 0);
    rev_prev := COALESCE((
      SELECT SUM(p.amount)
      FROM payments p
      WHERE p.status IN ('RECEIVED', 'PARTIAL')
        AND p.received_at >= date_trunc('month', now()) - interval '1 month'
        AND p.received_at < date_trunc('month', now())
    ), 0);
    deals_mtd := COALESCE((SELECT COUNT(*) FROM deals WHERE stage = 'WON' AND won_at >= date_trunc('month', now())), 0);
    deals_prev := COALESCE((SELECT COUNT(*) FROM deals WHERE stage = 'WON' AND won_at >= date_trunc('month', now()) - interval '1 month' AND won_at < date_trunc('month', now())), 0);
    wr := COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE stage = 'WON') / NULLIF(COUNT(*), 0), 0) FROM deals), 0);
    wr_prev := wr;
    avg_size := COALESCE((
      SELECT ROUND(AVG(p.amount))
      FROM payments p
      JOIN deals d ON d.id = p.deal_id
      WHERE d.stage = 'WON' AND p.status IN ('RECEIVED', 'PARTIAL')
    ), 0);
    avg_prev := avg_size;
    pipe_val := COALESCE((SELECT SUM(value) FROM deals WHERE stage NOT IN ('WON', 'LOST')), 0);
    pipe_prev := pipe_val;
  ELSE
    rev_mtd := COALESCE((
      SELECT SUM(p.amount)
      FROM payments p
      JOIN deals d ON d.id = p.deal_id
      WHERE d.rep_id = uid
        AND p.status IN ('RECEIVED', 'PARTIAL')
        AND p.received_at >= date_trunc('month', now())
    ), 0);
    rev_prev := COALESCE((
      SELECT SUM(p.amount)
      FROM payments p
      JOIN deals d ON d.id = p.deal_id
      WHERE d.rep_id = uid
        AND p.status IN ('RECEIVED', 'PARTIAL')
        AND p.received_at >= date_trunc('month', now()) - interval '1 month'
        AND p.received_at < date_trunc('month', now())
    ), 0);
    deals_mtd := COALESCE((SELECT COUNT(*) FROM deals WHERE rep_id = uid AND stage = 'WON' AND won_at >= date_trunc('month', now())), 0);
    deals_prev := COALESCE((SELECT COUNT(*) FROM deals WHERE rep_id = uid AND stage = 'WON' AND won_at >= date_trunc('month', now()) - interval '1 month' AND won_at < date_trunc('month', now())), 0);
    wr := COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE stage = 'WON') / NULLIF(COUNT(*), 0), 0) FROM deals WHERE rep_id = uid), 0);
    wr_prev := wr;
    avg_size := COALESCE((
      SELECT ROUND(AVG(p.amount))
      FROM payments p
      JOIN deals d ON d.id = p.deal_id
      WHERE d.rep_id = uid AND d.stage = 'WON' AND p.status IN ('RECEIVED', 'PARTIAL')
    ), 0);
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
