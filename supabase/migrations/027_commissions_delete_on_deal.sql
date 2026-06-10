-- Reps must remove their commission rows when returning a deal to the leads board.
-- CASCADE ensures deal delete is never blocked by leftover commission rows.

ALTER TABLE commissions
  DROP CONSTRAINT IF EXISTS commissions_deal_id_fkey;

ALTER TABLE commissions
  ADD CONSTRAINT commissions_deal_id_fkey
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS commissions_rep_delete ON commissions;
CREATE POLICY commissions_rep_delete ON commissions FOR DELETE USING (user_id = auth.uid());
