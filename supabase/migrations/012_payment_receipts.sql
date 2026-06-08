-- Payment notes + receipt files linked to payments at deal-won time

ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE client_files
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_client_files_payment_id ON client_files(payment_id);

-- Reps can record payments on their own deals when marking won
DROP POLICY IF EXISTS payments_rep_insert ON payments;
CREATE POLICY payments_rep_insert ON payments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_id AND d.rep_id = auth.uid())
  );
