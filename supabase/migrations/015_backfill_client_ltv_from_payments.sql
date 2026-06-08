-- Backfill client LTV from sum of payments.amount (received / partial)

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
