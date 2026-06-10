-- Fix: handle_deal_won (022) calls deal_commission_base — create it if 017 was not applied

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

GRANT EXECUTE ON FUNCTION public.deal_commission_base(UUID) TO authenticated, service_role;
