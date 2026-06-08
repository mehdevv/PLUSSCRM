-- Store client LTV in deal/payment currency (not default USD)

CREATE OR REPLACE FUNCTION handle_deal_won()
RETURNS TRIGGER AS $$
DECLARE
  l RECORD;
  plan_rate NUMERIC;
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

    comm_amount := COALESCE(NEW.value, 0) * plan_rate / 100;

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
        ltv = ltv + COALESCE(NEW.value, 0),
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
        COALESCE(NEW.value, 0),
        1,
        NEW.rep_id,
        l.country,
        'Deal won',
        deal_currency
      );
    END IF;

    INSERT INTO notifications (user_id, title, message)
    SELECT id, 'Deal Won', v_contact || ' — ' || COALESCE(NEW.value, 0)::text
    FROM profiles
    WHERE role = 'admin';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill client currency from latest won deal
UPDATE clients c
SET currency = COALESCE(
  (
    SELECT d.currency
    FROM deals d
    JOIN leads l ON l.id = d.lead_id
    WHERE d.stage = 'WON'
      AND d.rep_id = c.manager_id
      AND l.company = c.company
    ORDER BY d.won_at DESC NULLS LAST, d.updated_at DESC
    LIMIT 1
  ),
  'DZD'
);
