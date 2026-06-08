-- PLUSS CRM Dashboard Demo Data
-- Run AFTER npm run seed:users (requires rep@pluss.agency and admin@pluss.agency profiles)

DO $$
DECLARE
  rep_id UUID;
  admin_id UUID;
  split_id UUID;
  lead1 UUID;
  lead2 UUID;
  lead3 UUID;
  lead4 UUID;
  lead5 UUID;
  lead6 UUID;
  deal1 UUID;
  deal2 UUID;
  deal3 UUID;
  deal4 UUID;
  i INT;
  m TIMESTAMPTZ;
BEGIN
  SELECT id INTO rep_id FROM profiles WHERE email = 'rep@pluss.agency';
  SELECT id INTO admin_id FROM profiles WHERE email = 'admin@pluss.agency';
  SELECT id INTO split_id FROM lead_splits WHERE name = 'General Round Robin' LIMIT 1;

  IF rep_id IS NULL THEN
    RAISE NOTICE 'rep@pluss.agency not found — run npm run seed:users first';
    RETURN;
  END IF;

  IF split_id IS NULL THEN
    INSERT INTO lead_splits (name, mode, is_active, priority, rep_pool, leads_assigned, win_rate)
    VALUES ('General Round Robin', 'ROUND_ROBIN', true, 0, ARRAY[rep_id], 0, 0)
    RETURNING id INTO split_id;
  ELSE
    UPDATE lead_splits SET rep_pool = ARRAY[rep_id] WHERE id = split_id;
  END IF;

  -- Skip if dashboard seed already applied
  IF EXISTS (SELECT 1 FROM leads WHERE email = 'seed.lead1@demo.pluss') THEN
    RAISE NOTICE 'Dashboard seed data already exists — skipping';
    RETURN;
  END IF;

  -- Leads across pipeline stages and sources
  INSERT INTO leads (first_name, last_name, company, email, phone, status, source, assigned_to, split_rule_id, value)
  VALUES
    ('Alice', 'Chen', 'NovaTech', 'seed.lead1@demo.pluss', '+1-555-0101', 'NEW', 'Website', rep_id, split_id, 15000),
    ('Bob', 'Martinez', 'GreenLeaf Co', 'seed.lead2@demo.pluss', '+1-555-0102', 'CONTACTED', 'Referral', rep_id, split_id, 22000),
    ('Carol', 'Singh', 'Apex Digital', 'seed.lead3@demo.pluss', '+1-555-0103', 'QUALIFYING', 'LinkedIn', rep_id, split_id, 35000),
    ('David', 'Kim', 'Summit Labs', 'seed.lead4@demo.pluss', '+1-555-0104', 'PROPOSAL', 'Cold Call', rep_id, split_id, 48000),
    ('Eva', 'Brooks', 'Horizon Media', 'seed.lead5@demo.pluss', '+1-555-0105', 'NEGOTIATION', 'Event', rep_id, split_id, 62000),
    ('Frank', 'Lee', 'Pulse Analytics', 'seed.lead6@demo.pluss', '+1-555-0106', 'ASSIGNED', 'Website', NULL, split_id, 18000)
  RETURNING id INTO lead6;

  SELECT id INTO lead1 FROM leads WHERE email = 'seed.lead1@demo.pluss';
  SELECT id INTO lead2 FROM leads WHERE email = 'seed.lead2@demo.pluss';
  SELECT id INTO lead3 FROM leads WHERE email = 'seed.lead3@demo.pluss';
  SELECT id INTO lead4 FROM leads WHERE email = 'seed.lead4@demo.pluss';
  SELECT id INTO lead5 FROM leads WHERE email = 'seed.lead5@demo.pluss';

  -- Assignment audit for split rule efficiency
  INSERT INTO assignment_audit (rule_id, lead_id, rep_id, reason)
  SELECT split_id, l.id, COALESCE(l.assigned_to, rep_id), 'seed'
  FROM leads l WHERE l.email LIKE 'seed.lead%@demo.pluss';

  -- Deals (won + open)
  INSERT INTO deals (lead_id, stage, value, rep_id, won_at)
  VALUES
    (lead2, 'WON', 22000, rep_id, date_trunc('month', now()) + interval '5 days'),
    (lead3, 'WON', 35000, rep_id, date_trunc('month', now()) - interval '3 days'),
    (lead4, 'PROPOSAL', 48000, rep_id, NULL),
    (lead5, 'NEGOTIATION', 62000, rep_id, NULL)
  RETURNING id INTO deal1;

  SELECT id INTO deal1 FROM deals WHERE lead_id = lead2;
  SELECT id INTO deal2 FROM deals WHERE lead_id = lead3;
  SELECT id INTO deal3 FROM deals WHERE lead_id = lead4;
  SELECT id INTO deal4 FROM deals WHERE lead_id = lead5;

  -- Payments: current month + prior 11 months for revenue trend
  INSERT INTO payments (deal_id, invoice_ref, amount, method, status, received_at)
  VALUES
    (deal1, 'INV-SEED-001', 22000, 'Bank Transfer', 'RECEIVED', date_trunc('month', now()) + interval '5 days'),
    (deal2, 'INV-SEED-002', 35000, 'Bank Transfer', 'RECEIVED', date_trunc('month', now()) - interval '2 days');

  FOR i IN 1..11 LOOP
    m := date_trunc('month', now()) - (i || ' months')::interval + interval '10 days';
    INSERT INTO payments (deal_id, invoice_ref, amount, method, status, received_at)
    VALUES (
      deal2,
      'INV-SEED-HIST-' || i,
      8000 + (i * 1500),
      'Bank Transfer',
      'RECEIVED',
      m
    );
  END LOOP;

  -- Prior month payments for MoM KPI delta
  INSERT INTO payments (deal_id, invoice_ref, amount, method, status, received_at)
  VALUES
    (deal1, 'INV-SEED-PREV', 12000, 'Bank Transfer', 'RECEIVED', date_trunc('month', now()) - interval '1 month' + interval '8 days');

  -- Activities for feed + volume chart (current week)
  INSERT INTO activities (lead_id, user_id, type, note, created_at)
  VALUES
    (lead1, rep_id, 'CALL', 'Initial discovery call with Alice', now() - interval '2 hours'),
    (lead2, rep_id, 'EMAIL', 'Sent proposal follow-up to Bob', now() - interval '5 hours'),
    (lead3, rep_id, 'MEETING', 'Demo session with Carol', now() - interval '1 day'),
    (lead4, rep_id, 'CALL', 'Negotiation call with David', now() - interval '2 days'),
    (lead5, rep_id, 'EMAIL', 'Contract review sent to Eva', now() - interval '3 days'),
    (lead1, rep_id, 'CALL', 'Follow-up call', date_trunc('week', now()) + interval '1 day'),
    (lead2, rep_id, 'MEETING', 'On-site visit', date_trunc('week', now()) + interval '2 days'),
    (lead3, rep_id, 'EMAIL', 'Pricing breakdown', date_trunc('week', now()) + interval '3 days');

  IF admin_id IS NOT NULL THEN
    INSERT INTO activities (lead_id, user_id, type, note, created_at)
    VALUES (lead6, admin_id, 'NOTE', 'Reviewed unassigned lead from queue', now() - interval '4 hours');
  END IF;

  RAISE NOTICE 'Dashboard seed data inserted successfully';
END $$;
