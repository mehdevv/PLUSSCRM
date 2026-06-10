-- Payments belong to leads: deal delete must not block on payment rows.
-- Reps need DELETE on their lead's payments when reverting won / returning to board.

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_deal_id_fkey;

ALTER TABLE payments
  ADD CONSTRAINT payments_deal_id_fkey
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS payments_rep ON payments;
CREATE POLICY payments_rep ON payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = payments.lead_id AND l.assigned_to = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM deals d
    WHERE d.id = payments.deal_id AND d.rep_id = auth.uid()
  )
);

DROP POLICY IF EXISTS payments_rep_delete ON payments;
CREATE POLICY payments_rep_delete ON payments FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = payments.lead_id AND l.assigned_to = auth.uid()
  )
);

DROP POLICY IF EXISTS payments_rep_insert ON payments;
CREATE POLICY payments_rep_insert ON payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_id AND l.assigned_to = auth.uid()
    )
  );

-- Unwind won-deal effects when payments are keyed by lead
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
