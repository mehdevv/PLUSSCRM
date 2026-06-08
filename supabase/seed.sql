-- PLUSS CRM Seed Data
-- STEP 1: Create users in Supabase Dashboard → Authentication → Users:
--   admin@pluss.agency / Admin123!  (set user metadata: {"name":"Agency Admin","role":"admin"})
--   rep@pluss.agency / Rep123!      (set user metadata: {"name":"Demo Rep","role":"sales_rep"})
--
-- STEP 2: Run this SQL after users exist (replace UUIDs below with actual auth.users IDs)

-- Update admin profile
-- UPDATE profiles SET name = 'Agency Admin', initials = 'AA', role = 'admin', color = '#1A1AFF', points = 5420, tier = 'DIAMOND'
-- WHERE email = 'admin@pluss.agency';

-- Update rep profile
-- UPDATE profiles SET name = 'Demo Rep', initials = 'DR', role = 'sales_rep', color = '#8B5CF6', points = 1200, tier = 'SILVER'
-- WHERE email = 'rep@pluss.agency';

-- Default compensation plan
INSERT INTO compensation_plans (name, base_rate, tier_multiplier, accelerator)
SELECT 'Standard Plan', 10, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM compensation_plans WHERE name = 'Standard Plan');

INSERT INTO compensation_plans (name, base_rate, tier_multiplier, accelerator)
SELECT 'Senior Plan', 12, 1.2, 1.1
WHERE NOT EXISTS (SELECT 1 FROM compensation_plans WHERE name = 'Senior Plan');

-- Sample split rule (update rep_pool with real rep UUID after seeding)
INSERT INTO lead_splits (name, mode, is_active, priority, rep_pool, leads_assigned, win_rate)
SELECT 'General Round Robin', 'ROUND_ROBIN', true, 0, ARRAY[]::uuid[], 0, 0
WHERE NOT EXISTS (SELECT 1 FROM lead_splits WHERE name = 'General Round Robin');

-- Sample expenses for accounting
INSERT INTO expenses (category, amount, description, expense_date)
SELECT 'Software', 299, 'CRM subscription', CURRENT_DATE - 5
WHERE NOT EXISTS (SELECT 1 FROM expenses LIMIT 1);

INSERT INTO expenses (category, amount, description, expense_date)
SELECT 'Marketing', 1500, 'Google Ads spend', CURRENT_DATE - 10
WHERE (SELECT COUNT(*) FROM expenses) < 2;
