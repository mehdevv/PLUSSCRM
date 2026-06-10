-- Track which won deal created a client row; delete that client when the deal leaves Won.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS won_deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_won_deal_id
  ON clients(won_deal_id)
  WHERE won_deal_id IS NOT NULL;

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

  -- Client created solely from this win: remove it entirely.
  IF EXISTS (SELECT 1 FROM clients WHERE won_deal_id = p_deal_id) THEN
    DELETE FROM clients WHERE won_deal_id = p_deal_id;
    RETURN;
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
    AND won_deal_id IS NULL
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
  client_value NUMERIC;
BEGIN
  IF OLD.stage = 'WON' AND NEW.stage IS DISTINCT FROM 'WON' THEN
    IF EXISTS (SELECT 1 FROM payments WHERE lead_id = NEW.lead_id)
       OR EXISTS (SELECT 1 FROM commissions WHERE deal_id = NEW.id) THEN
      PERFORM revert_deal_won_effects(NEW.id, NEW.lead_id, NEW.rep_id);
    END IF;
    NEW.won_at := NULL;
    RETURN NEW;
  END IF;

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

    comm_base := lead_commission_base(NEW.lead_id);
    comm_amount := ROUND(comm_base * plan_rate / 100, 2);
    client_value := COALESCE(comm_base, NEW.value, 0);

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
      AND won_deal_id IS NULL
      AND (
        (v_email NOT LIKE 'lead-%@clients.pluss' AND c.email = v_email)
        OR c.company ILIKE v_company
      )
    ORDER BY c.created_at DESC
    LIMIT 1;

    IF existing_client_id IS NOT NULL THEN
      UPDATE clients
      SET
        ltv = ltv + client_value,
        deals_count = deals_count + 1,
        last_activity = 'Deal won',
        phone = COALESCE(l.phone, phone),
        country = COALESCE(l.country, country),
        currency = deal_currency,
        updated_at = now()
      WHERE id = existing_client_id;

      DELETE FROM clients
      WHERE id = existing_client_id
        AND ltv <= 0
        AND NOT EXISTS (
          SELECT 1
          FROM payments p
          WHERE p.lead_id = NEW.lead_id
            AND p.status IN ('RECEIVED', 'PARTIAL')
            AND p.amount > 0
        );
    ELSIF client_value > 0 THEN
      INSERT INTO clients (
        company, contact, email, phone, ltv, deals_count, manager_id,
        country, last_activity, currency, won_deal_id
      )
      VALUES (
        v_company,
        v_contact,
        v_email,
        l.phone,
        client_value,
        1,
        NEW.rep_id,
        l.country,
        'Deal won',
        deal_currency,
        NEW.id
      );
    END IF;

    INSERT INTO notifications (user_id, title, message)
    SELECT id, 'Deal Won', v_contact || ' — ' || COALESCE(client_value, 0)::text
    FROM profiles
    WHERE role = 'admin';
  END IF;

  RETURN NEW;
END;
$$;
