-- 017: Commissions, win rate, payments, and rep-plan data fixes
-- Run in Supabase SQL Editor (paste entire file) or via: supabase db push
--
-- What this migration does:
--   1. Removes duplicate / zero-value payment rows per deal
--   2. Win rate = WON / (WON + LOST) only (excludes open pipeline deals)
--   3. Commissions based on actual payment amounts (not inflated deal.value)
--   4. Backfills commission amounts + assigns Standard Plan to reps without one
--   5. Re-syncs client LTV from payments

-- ---------------------------------------------------------------------------
-- 1. Deduplicate payments (keep best row per deal_id)
-- ---------------------------------------------------------------------------
DELETE FROM payments p
USING (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY deal_id
        ORDER BY
          CASE WHEN amount > 0 THEN 0 ELSE 1 END,
          CASE status WHEN 'RECEIVED' THEN 0 WHEN 'PARTIAL' THEN 1 ELSE 2 END,
          received_at DESC NULLS LAST,
          created_at DESC
      ) AS rn
    FROM payments
  ) ranked
  WHERE rn > 1
) dup
WHERE p.id = dup.id;

-- Remove zero-amount rows when the same deal already has a positive payment
DELETE FROM payments z
WHERE z.amount = 0
  AND EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.deal_id = z.deal_id
      AND p.amount > 0
      AND p.id <> z.id
  );

-- ---------------------------------------------------------------------------
-- 2. Helper: commission base = sum of received payments, else deal.value
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deal_commission_base(p_deal_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF((
      SELECT SUM(p.amount)
      FROM payments p
      WHERE p.deal_id = p_deal_id
        AND p.status IN ('RECEIVED', 'PARTIAL')
    ), 0),
    (SELECT d.value FROM deals d WHERE d.id = p_deal_id),
    0
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Deal-won trigger: commission from payment amounts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_deal_won()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l RECORD;
  plan_rate NUMERIC;
  comm_base NUMERIC;
  comm_amount NUMERIC;
  v_email TEXT;
  v_company TEXT;
  v_contact TEXT;
  existing_client_id UUID;
  deal_currency TEXT := COALESCE(NULLIF(TRIM(NEW.currency), ''), 'DZD');
BEGIN
  IF NEW.stage = 'WON' AND (OLD.stage IS DISTINCT FROM 'WON') THEN
    NEW.won_at := COALESCE(NEW.won_at, now());

    UPDATE leads SET status = 'WON', updated_at = now() WHERE id = NEW.lead_id;

    SELECT * INTO l FROM leads WHERE id = NEW.lead_id;

    plan_rate := COALESCE(
      (
        SELECT COALESCE(cp.base_rate, 10)
        FROM rep_compensation rc
        JOIN compensation_plans cp ON cp.id = rc.plan_id
        WHERE rc.user_id = NEW.rep_id
        ORDER BY rc.created_at DESC
        LIMIT 1
      ),
      10
    );

    comm_base := deal_commission_base(NEW.id);
    comm_amount := ROUND(comm_base * plan_rate / 100, 2);

    IF NOT EXISTS (SELECT 1 FROM commissions WHERE deal_id = NEW.id) THEN
      INSERT INTO commissions (user_id, deal_id, rate, amount, status)
      VALUES (
        NEW.rep_id,
        NEW.id,
        COALESCE(plan_rate, 10),
        COALESCE(comm_amount, 0),
        'PENDING'
      );
    END IF;

    UPDATE profiles SET points = points + 100 WHERE id = NEW.rep_id;

    v_email := NULLIF(TRIM(l.email), '');
    IF v_email IS NULL THEN
      v_email := 'lead-' || l.id::text || '@clients.pluss';
    END IF;
    v_company := COALESCE(NULLIF(TRIM(l.company), ''), 'Unknown company');
    v_contact := TRIM(COALESCE(l.first_name, '') || ' ' || COALESCE(l.last_name, ''));
    IF v_contact = '' THEN
      v_contact := 'Contact';
    END IF;

    SELECT c.id INTO existing_client_id
    FROM clients c
    WHERE c.manager_id = NEW.rep_id
      AND (
        (v_email NOT LIKE 'lead-%@clients.pluss' AND c.email = v_email)
        OR c.company ILIKE v_company
      )
    ORDER BY c.created_at DESC
    LIMIT 1;

    IF existing_client_id IS NOT NULL THEN
      UPDATE clients
      SET
        ltv = ltv + COALESCE(comm_base, NEW.value, 0),
        deals_count = deals_count + 1,
        last_activity = 'Deal won',
        phone = COALESCE(l.phone, phone),
        country = COALESCE(l.country, country),
        currency = deal_currency,
        updated_at = now()
      WHERE id = existing_client_id;
    ELSE
      INSERT INTO clients (company, contact, email, phone, ltv, deals_count, manager_id, country, last_activity, currency)
      VALUES (
        v_company,
        v_contact,
        v_email,
        l.phone,
        COALESCE(comm_base, NEW.value, 0),
        1,
        NEW.rep_id,
        l.country,
        'Deal won',
        deal_currency
      );
    END IF;

    INSERT INTO notifications (user_id, title, message)
    SELECT id, 'Deal Won', v_contact || ' — ' || COALESCE(comm_base, NEW.value, 0)::text
    FROM profiles
    WHERE role = 'admin';
  END IF;

  RETURN NEW;
END;
$$;

-- Keep pending commissions in sync when a payment is recorded on a won deal
CREATE OR REPLACE FUNCTION public.sync_commission_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base NUMERIC;
BEGIN
  IF NEW.status NOT IN ('RECEIVED', 'PARTIAL') THEN
    RETURN NEW;
  END IF;

  base := deal_commission_base(NEW.deal_id);

  UPDATE commissions c
  SET amount = ROUND(base * c.rate / 100, 2)
  WHERE c.deal_id = NEW.deal_id
    AND c.status = 'PENDING';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_commission_on_payment ON payments;
CREATE TRIGGER trg_sync_commission_on_payment
  AFTER INSERT OR UPDATE OF amount, status ON payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_commission_on_payment();

-- ---------------------------------------------------------------------------
-- 4. Backfill existing commission amounts from payments
-- ---------------------------------------------------------------------------
UPDATE commissions c
SET amount = ROUND(deal_commission_base(c.deal_id) * c.rate / 100, 2)
FROM deals d
WHERE d.id = c.deal_id
  AND d.stage = 'WON';

-- ---------------------------------------------------------------------------
-- 5. Assign Standard Plan to sales reps missing a compensation plan
-- ---------------------------------------------------------------------------
INSERT INTO rep_compensation (user_id, plan_id)
SELECT p.id, cp.id
FROM profiles p
JOIN compensation_plans cp ON cp.name = 'Standard Plan'
WHERE p.role = 'sales_rep'
  AND NOT EXISTS (
    SELECT 1 FROM rep_compensation rc WHERE rc.user_id = p.id
  );

-- Fallback if seed plan name differs
INSERT INTO rep_compensation (user_id, plan_id)
SELECT p.id, (
  SELECT id FROM compensation_plans ORDER BY created_at ASC LIMIT 1
)
FROM profiles p
WHERE p.role = 'sales_rep'
  AND NOT EXISTS (
    SELECT 1 FROM rep_compensation rc WHERE rc.user_id = p.id
  )
  AND EXISTS (SELECT 1 FROM compensation_plans);

-- ---------------------------------------------------------------------------
-- 6. Win rate: closed deals only (WON / (WON + LOST))
-- ---------------------------------------------------------------------------
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
    wr := COALESCE((
      SELECT ROUND(
        100.0 * COUNT(*) FILTER (WHERE stage = 'WON')
        / NULLIF(COUNT(*) FILTER (WHERE stage IN ('WON', 'LOST')), 0),
        0
      )
      FROM deals
    ), 0);
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
    wr := COALESCE((
      SELECT ROUND(
        100.0 * COUNT(*) FILTER (WHERE stage = 'WON')
        / NULLIF(COUNT(*) FILTER (WHERE stage IN ('WON', 'LOST')), 0),
        0
      )
      FROM deals
      WHERE rep_id = uid
    ), 0);
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
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE d.stage = 'WON')
            / NULLIF(COUNT(*) FILTER (WHERE d.stage IN ('WON', 'LOST')), 0)
          ) AS wr
        FROM deals d
        WHERE d.rep_id = p.id
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT SUM(pay.amount) AS rev
        FROM payments pay
        JOIN deals dl ON dl.id = pay.deal_id
        WHERE dl.rep_id = p.id
          AND pay.status IN ('RECEIVED', 'PARTIAL')
      ) r ON true
      WHERE p.role = 'sales_rep' AND p.is_active
    ) ranked
  ), '[]'::jsonb);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Re-sync client LTV from payment totals (idempotent)
-- ---------------------------------------------------------------------------
UPDATE clients c
SET
  ltv = totals.amount,
  currency = totals.currency,
  updated_at = now()
FROM (
  SELECT
    c2.id AS client_id,
    SUM(p.amount) AS amount,
    COALESCE(
      (
        SELECT p2.currency
        FROM payments p2
        JOIN deals d2 ON d2.id = p2.deal_id
        JOIN leads l2 ON l2.id = d2.lead_id
        WHERE d2.stage = 'WON'
          AND d2.rep_id = c2.manager_id
          AND (
            l2.company ILIKE c2.company
            OR (NULLIF(TRIM(l2.email), '') IS NOT NULL AND l2.email = c2.email)
          )
          AND p2.status IN ('RECEIVED', 'PARTIAL')
        ORDER BY p2.received_at DESC NULLS LAST, p2.created_at DESC
        LIMIT 1
      ),
      'DZD'
    ) AS currency
  FROM clients c2
  JOIN deals d ON d.stage = 'WON' AND d.rep_id = c2.manager_id
  JOIN leads l ON l.id = d.lead_id
  JOIN payments p ON p.deal_id = d.id AND p.status IN ('RECEIVED', 'PARTIAL')
  WHERE l.company ILIKE c2.company
     OR (NULLIF(TRIM(l.email), '') IS NOT NULL AND l.email = c2.email)
  GROUP BY c2.id
) totals
WHERE c.id = totals.client_id;

GRANT EXECUTE ON FUNCTION public.deal_commission_base(UUID) TO authenticated, service_role;
