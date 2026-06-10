-- Payments belong to pipeline leads directly (not derived through deals)

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE CASCADE;

UPDATE payments p
SET lead_id = d.lead_id
FROM deals d
WHERE p.deal_id = d.id
  AND p.lead_id IS NULL;

-- Remove payments not tied to a pipeline lead
DELETE FROM payments
WHERE lead_id IS NULL;

DELETE FROM payments p
WHERE NOT EXISTS (
  SELECT 1 FROM deals d WHERE d.lead_id = p.lead_id
);

ALTER TABLE payments
  ALTER COLUMN lead_id SET NOT NULL;

ALTER TABLE payments
  ALTER COLUMN deal_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_lead_id ON payments(lead_id);

-- Commission / revenue base from lead payments (source of truth)
CREATE OR REPLACE FUNCTION public.lead_commission_base(p_lead_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF((
      SELECT SUM(p.amount)
      FROM payments p
      WHERE p.lead_id = p_lead_id
        AND p.status IN ('RECEIVED', 'PARTIAL')
    ), 0),
    (
      SELECT d.value
      FROM deals d
      WHERE d.lead_id = p_lead_id
        AND d.stage = 'WON'
      ORDER BY d.won_at DESC NULLS LAST, d.updated_at DESC
      LIMIT 1
    ),
    0
  );
$$;

CREATE OR REPLACE FUNCTION public.deal_commission_base(p_deal_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lead_commission_base(
    (SELECT d.lead_id FROM deals d WHERE d.id = p_deal_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.sync_commission_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base NUMERIC;
  v_deal_id UUID;
BEGIN
  IF NEW.status NOT IN ('RECEIVED', 'PARTIAL') OR NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  base := lead_commission_base(NEW.lead_id);

  FOR v_deal_id IN
    SELECT d.id FROM deals d WHERE d.lead_id = NEW.lead_id
  LOOP
    UPDATE commissions c
    SET amount = ROUND(base * c.rate / 100, 2)
    WHERE c.deal_id = v_deal_id
      AND c.status = 'PENDING';
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.revert_deal_won_effects(
  p_deal_id UUID,
  p_lead_id UUID,
  p_rep_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l RECORD;
  v_email TEXT;
  v_company TEXT;
  client_id UUID;
BEGIN
  DELETE FROM payments WHERE lead_id = p_lead_id;

  IF EXISTS (SELECT 1 FROM commissions WHERE deal_id = p_deal_id) THEN
    DELETE FROM commissions WHERE deal_id = p_deal_id;
    UPDATE profiles
    SET points = GREATEST(points - 100, 0)
    WHERE id = p_rep_id;
  END IF;

  SELECT * INTO l FROM leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_email := NULLIF(TRIM(l.email), '');
  IF v_email IS NULL THEN
    v_email := 'lead-' || l.id::text || '@clients.pluss';
  END IF;
  v_company := COALESCE(NULLIF(TRIM(l.company), ''), 'Unknown company');

  SELECT c.id INTO client_id
  FROM clients c
  WHERE c.manager_id = p_rep_id
    AND (
      (v_email NOT LIKE 'lead-%@clients.pluss' AND c.email = v_email)
      OR c.company ILIKE v_company
    )
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF client_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE clients
  SET
    deals_count = GREATEST(deals_count - 1, 0),
    last_activity = 'Deal reopened',
    updated_at = now()
  WHERE id = client_id;

  UPDATE clients c
  SET
    ltv = COALESCE(totals.amount, 0),
    currency = COALESCE(totals.currency, c.currency),
    updated_at = now()
  FROM (
    SELECT
      SUM(p.amount) AS amount,
      MAX(p.currency) AS currency
    FROM payments p
    JOIN leads dl ON dl.id = p.lead_id
    WHERE dl.assigned_to = p_rep_id
      AND p.status IN ('RECEIVED', 'PARTIAL')
      AND (
        dl.company ILIKE v_company
        OR (v_email NOT LIKE 'lead-%@clients.pluss' AND dl.email = v_email)
      )
  ) totals
  WHERE c.id = client_id;

  DELETE FROM clients
  WHERE id = client_id
    AND deals_count > 0
    AND ltv <= 0
    AND NOT EXISTS (
      SELECT 1
      FROM payments p
      JOIN leads dl ON dl.id = p.lead_id
      WHERE dl.assigned_to = p_rep_id
        AND p.status IN ('RECEIVED', 'PARTIAL')
        AND p.amount > 0
        AND (
          dl.company ILIKE v_company
          OR (v_email NOT LIKE 'lead-%@clients.pluss' AND dl.email = v_email)
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lead_commission_base(UUID) TO authenticated, service_role;
