-- Automatically delete any client with zero LTV (no received payments).

CREATE OR REPLACE FUNCTION public.client_payment_ltv(p_client_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(p.amount), 0)
  FROM clients c
  JOIN leads l ON l.assigned_to = c.manager_id
  JOIN payments p ON p.lead_id = l.id
  WHERE c.id = p_client_id
    AND p.status IN ('RECEIVED', 'PARTIAL')
    AND p.amount > 0
    AND (
      l.company ILIKE c.company
      OR (c.email NOT LIKE 'lead-%@clients.pluss' AND l.email = c.email)
    );
$$;

CREATE OR REPLACE FUNCTION public.delete_zero_ltv_client(p_client_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM clients c
  WHERE c.id = p_client_id
    AND c.ltv <= 0
    AND client_payment_ltv(c.id) <= 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_zero_ltv_clients()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM clients c
  WHERE c.ltv <= 0
    AND client_payment_ltv(c.id) <= 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_prune_client_after_ltv_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ltv <= 0 THEN
    PERFORM delete_zero_ltv_client(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_prune_clients_after_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id UUID;
  v_rep_id UUID;
  r RECORD;
BEGIN
  v_lead_id := COALESCE(NEW.lead_id, OLD.lead_id);
  SELECT assigned_to INTO v_rep_id FROM leads WHERE id = v_lead_id;
  IF v_rep_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  FOR r IN
    SELECT c.id
    FROM clients c
    WHERE c.manager_id = v_rep_id
      AND c.ltv <= 0
      AND EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = v_lead_id
          AND (
            l.company ILIKE c.company
            OR (c.email NOT LIKE 'lead-%@clients.pluss' AND l.email = c.email)
          )
      )
  LOOP
    PERFORM delete_zero_ltv_client(r.id);
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prune_client_zero_ltv ON clients;
CREATE TRIGGER trg_prune_client_zero_ltv
  AFTER INSERT OR UPDATE OF ltv ON clients
  FOR EACH ROW
  WHEN (NEW.ltv <= 0)
  EXECUTE FUNCTION trg_prune_client_after_ltv_change();

DROP TRIGGER IF EXISTS trg_prune_clients_on_payment ON payments;
CREATE TRIGGER trg_prune_clients_on_payment
  AFTER INSERT OR UPDATE OF amount, status, lead_id OR DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION trg_prune_clients_after_payment();

SELECT public.prune_zero_ltv_clients();

GRANT EXECUTE ON FUNCTION public.client_payment_ltv(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_zero_ltv_client(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prune_zero_ltv_clients() TO authenticated, service_role;
