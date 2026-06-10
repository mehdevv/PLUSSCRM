-- Do not keep client records for won deals with zero revenue

-- Required by handle_deal_won (defined in 017; inlined here for databases that skipped 017)
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
          JOIN deals d ON d.id = p.deal_id
          WHERE d.rep_id = NEW.rep_id
            AND d.stage = 'WON'
            AND p.status IN ('RECEIVED', 'PARTIAL')
            AND p.amount > 0
            AND (
              d.lead_id = NEW.lead_id
              OR EXISTS (
                SELECT 1 FROM leads dl
                WHERE dl.id = d.lead_id
                  AND (
                    dl.company ILIKE v_company
                    OR (v_email NOT LIKE 'lead-%@clients.pluss' AND dl.email = v_email)
                  )
              )
            )
        );
    ELSIF client_value > 0 THEN
      INSERT INTO clients (company, contact, email, phone, ltv, deals_count, manager_id, country, last_activity, currency)
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
        deal_currency
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

-- Remove existing zero-value won-deal clients with no received payments
DELETE FROM clients c
WHERE c.deals_count > 0
  AND c.ltv <= 0
  AND NOT EXISTS (
    SELECT 1
    FROM payments p
    JOIN deals d ON d.id = p.deal_id
    WHERE d.rep_id = c.manager_id
      AND d.stage = 'WON'
      AND p.status IN ('RECEIVED', 'PARTIAL')
      AND p.amount > 0
      AND EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = d.lead_id
          AND (
            l.company ILIKE c.company
            OR (c.email NOT LIKE 'lead-%@clients.pluss' AND l.email = c.email)
          )
      )
  );

GRANT EXECUTE ON FUNCTION public.deal_commission_base(UUID) TO authenticated, service_role;
