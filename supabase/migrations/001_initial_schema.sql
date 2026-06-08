-- PLUSS CRM — Initial Schema, RLS, Functions
-- Run this in Supabase SQL Editor

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'sales_rep');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rep_tier AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'DIAMOND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('NEW', 'ASSIGNED', 'CONTACTED', 'QUALIFYING', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST', 'DORMANT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE split_mode AS ENUM ('ROUND_ROBIN', 'WEIGHTED', 'PERFORMANCE', 'SOURCE', 'GEOGRAPHY', 'INDUSTRY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE activity_type AS ENUM ('CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'STAGE_CHANGE', 'WHATSAPP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('RECEIVED', 'PENDING', 'PARTIAL', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE commission_status AS ENUM ('PAID', 'PENDING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE import_job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'sales_rep',
  avatar_url TEXT,
  initials TEXT NOT NULL DEFAULT '??',
  tier rep_tier NOT NULL DEFAULT 'BRONZE',
  points INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  vacation_mode BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT '#1A1AFF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Platform settings (singleton)
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'PLUSS Agency',
  timezone TEXT NOT NULL DEFAULT 'UTC+0',
  currency TEXT NOT NULL DEFAULT 'USD',
  date_format TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
  notification_prefs JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO platform_settings (company_name) SELECT 'PLUSS Agency' WHERE NOT EXISTS (SELECT 1 FROM platform_settings);

-- Lead splits
CREATE TABLE IF NOT EXISTS lead_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mode split_mode NOT NULL DEFAULT 'ROUND_ROBIN',
  rep_pool UUID[] NOT NULL DEFAULT '{}',
  weights_json JSONB NOT NULL DEFAULT '{}',
  rule_conditions JSONB NOT NULL DEFAULT '[]',
  fallback_mode TEXT NOT NULL DEFAULT 'round_robin',
  max_per_rep INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  leads_assigned INTEGER NOT NULL DEFAULT 0,
  win_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS split_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES lead_splits(id) ON DELETE CASCADE,
  last_rep_index INTEGER NOT NULL DEFAULT 0,
  daily_counts JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rule_id)
);

-- Leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  status lead_status NOT NULL DEFAULT 'NEW',
  source TEXT,
  assigned_to UUID REFERENCES profiles(id),
  split_rule_id UUID REFERENCES lead_splits(id),
  country TEXT,
  industry TEXT,
  notes TEXT,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_activity TEXT,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Import jobs
CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status import_job_status NOT NULL DEFAULT 'pending',
  file_path TEXT,
  mapping JSONB NOT NULL DEFAULT '{}',
  error_report JSONB NOT NULL DEFAULT '[]',
  split_summary JSONB,
  split_rule_id UUID REFERENCES lead_splits(id),
  total_rows INTEGER NOT NULL DEFAULT 0,
  success_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS assignment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT 'overflow',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assignment_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES lead_splits(id),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  rep_id UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL DEFAULT 'auto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deals
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  stage lead_status NOT NULL DEFAULT 'CONTACTED',
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  rep_id UUID NOT NULL REFERENCES profiles(id),
  close_date DATE,
  won_at TIMESTAMPTZ,
  stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company TEXT NOT NULL,
  contact TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  ltv NUMERIC(12,2) NOT NULL DEFAULT 0,
  deals_count INTEGER NOT NULL DEFAULT 0,
  last_activity TEXT,
  manager_id UUID NOT NULL REFERENCES profiles(id),
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activities
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  deal_id UUID REFERENCES deals(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  type activity_type NOT NULL,
  note TEXT NOT NULL,
  outcome TEXT,
  scheduled_at TIMESTAMPTZ,
  due_date DATE,
  priority TEXT,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  invoice_ref TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'Bank Transfer',
  status payment_status NOT NULL DEFAULT 'PENDING',
  received_at TIMESTAMPTZ,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compensation
CREATE TABLE IF NOT EXISTS compensation_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  base_rate NUMERIC(5,2) NOT NULL DEFAULT 10,
  tier_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1,
  accelerator NUMERIC(5,2) NOT NULL DEFAULT 1,
  cap NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rep_compensation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES compensation_plans(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, plan_id)
);

CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  deal_id UUID NOT NULL REFERENCES deals(id),
  rate NUMERIC(5,2) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status commission_status NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  period TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL DEFAULT 0,
  badges_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_deals_rep_id ON deals(rep_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_manager_id ON clients(manager_id);

-- Helper: is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_val public.user_role := 'sales_rep';
BEGIN
  IF NEW.raw_user_meta_data ? 'role' THEN
    BEGIN
      role_val := (NEW.raw_user_meta_data->>'role')::public.user_role;
    EXCEPTION WHEN OTHERS THEN
      role_val := 'sales_rep';
    END;
  END IF;

  INSERT INTO public.profiles (id, name, email, initials, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, 'user'), '@', 1)),
    COALESCE(NEW.email, ''),
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'name', COALESCE(NEW.email, 'xx')), 2)),
    role_val
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    updated_at = now();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Tier from points
CREATE OR REPLACE FUNCTION update_tier_from_points()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tier := CASE
    WHEN NEW.points >= 4000 THEN 'DIAMOND'::rep_tier
    WHEN NEW.points >= 1500 THEN 'GOLD'::rep_tier
    WHEN NEW.points >= 500 THEN 'SILVER'::rep_tier
    ELSE 'BRONZE'::rep_tier
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profile_tier ON profiles;
CREATE TRIGGER trg_profile_tier
  BEFORE UPDATE OF points ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_tier_from_points();

-- Activity points
CREATE OR REPLACE FUNCTION award_activity_points()
RETURNS TRIGGER AS $$
DECLARE pts INTEGER := 0;
BEGIN
  pts := CASE NEW.type
    WHEN 'CALL' THEN 3
    WHEN 'EMAIL' THEN 2
    WHEN 'MEETING' THEN 15
    WHEN 'TASK' THEN CASE WHEN NEW.done THEN 10 ELSE 0 END
    WHEN 'STAGE_CHANGE' THEN 5
    ELSE 1
  END;
  IF pts > 0 THEN
    UPDATE profiles SET points = points + pts WHERE id = NEW.user_id;
  END IF;
  IF NEW.lead_id IS NOT NULL THEN
    UPDATE leads SET last_activity = NEW.type::text, last_activity_at = now(), updated_at = now()
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_activity_points ON activities;
CREATE TRIGGER trg_activity_points
  AFTER INSERT OR UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION award_activity_points();

-- Deal won: commission + client + lead status
CREATE OR REPLACE FUNCTION handle_deal_won()
RETURNS TRIGGER AS $$
DECLARE
  l RECORD;
  plan_rate NUMERIC := 10;
  comm_amount NUMERIC;
BEGIN
  IF NEW.stage = 'WON' AND (OLD.stage IS DISTINCT FROM 'WON') THEN
    NEW.won_at := COALESCE(NEW.won_at, now());
    UPDATE leads SET status = 'WON', updated_at = now() WHERE id = NEW.lead_id;

    SELECT * INTO l FROM leads WHERE id = NEW.lead_id;

    SELECT COALESCE(cp.base_rate, 10) INTO plan_rate
    FROM rep_compensation rc
    JOIN compensation_plans cp ON cp.id = rc.plan_id
    WHERE rc.user_id = NEW.rep_id LIMIT 1;

    comm_amount := NEW.value * plan_rate / 100;
    INSERT INTO commissions (user_id, deal_id, rate, amount, status)
    VALUES (NEW.rep_id, NEW.id, plan_rate, comm_amount, 'PENDING');

    UPDATE profiles SET points = points + 100 WHERE id = NEW.rep_id;

    INSERT INTO clients (company, contact, email, phone, ltv, deals_count, manager_id, country, last_activity)
    VALUES (l.company, l.first_name || ' ' || l.last_name, l.email, l.phone, NEW.value, 1, NEW.rep_id, l.country, 'Deal won')
    ON CONFLICT DO NOTHING;

    INSERT INTO notifications (user_id, title, message)
    SELECT id, 'Deal Won', l.first_name || ' ' || l.last_name || ' — $' || NEW.value::text
    FROM profiles WHERE role = 'admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_deal_won ON deals;
CREATE TRIGGER trg_deal_won
  BEFORE UPDATE OF stage ON deals
  FOR EACH ROW EXECUTE FUNCTION handle_deal_won();

-- Split engine (simplified but functional)
CREATE OR REPLACE FUNCTION run_split_engine(p_lead_ids UUID[], p_rule_id UUID)
RETURNS JSONB AS $$
DECLARE
  rule RECORD;
  lead_id UUID;
  pool UUID[];
  rep_id UUID;
  idx INTEGER;
  counts JSONB;
  today_key TEXT := to_char(now(), 'YYYY-MM-DD');
  assigned_count INTEGER := 0;
  overflow_count INTEGER := 0;
BEGIN
  SELECT * INTO rule FROM lead_splits WHERE id = p_rule_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Rule not found or inactive');
  END IF;

  SELECT COALESCE(rep_pool, '{}') INTO pool FROM lead_splits WHERE id = p_rule_id;
  pool := ARRAY(SELECT unnest(pool) INTERSECT SELECT id FROM profiles WHERE is_active AND NOT vacation_mode AND role = 'sales_rep');

  IF array_length(pool, 1) IS NULL THEN
    RETURN jsonb_build_object('error', 'No eligible reps in pool');
  END IF;

  SELECT COALESCE(daily_counts, '{}'), last_rep_index INTO counts, idx FROM split_state WHERE rule_id = p_rule_id;
  IF NOT FOUND THEN
    INSERT INTO split_state (rule_id, last_rep_index, daily_counts) VALUES (p_rule_id, 0, '{}');
    idx := 0;
    counts := '{}';
  END IF;

  FOREACH lead_id IN ARRAY p_lead_ids LOOP
    idx := (idx % array_length(pool, 1)) + 1;
    rep_id := pool[idx];

    IF rule.max_per_rep IS NOT NULL AND COALESCE((counts->>rep_id::text)::int, 0) >= rule.max_per_rep THEN
      INSERT INTO assignment_queue (lead_id, reason) VALUES (lead_id, 'max_per_rep reached');
      overflow_count := overflow_count + 1;
      CONTINUE;
    END IF;

    UPDATE leads SET assigned_to = rep_id, status = 'ASSIGNED', split_rule_id = p_rule_id, updated_at = now()
    WHERE id = lead_id;

    INSERT INTO assignment_audit (rule_id, lead_id, rep_id, reason) VALUES (p_rule_id, lead_id, rep_id, rule.mode::text);

    INSERT INTO notifications (user_id, title, message)
    VALUES (rep_id, 'New Lead Assigned', 'A lead has been assigned to you');

    counts := jsonb_set(counts, ARRAY[rep_id::text], to_jsonb(COALESCE((counts->>rep_id::text)::int, 0) + 1));
    assigned_count := assigned_count + 1;
  END LOOP;

  UPDATE split_state SET last_rep_index = idx, daily_counts = counts, updated_at = now() WHERE rule_id = p_rule_id;
  UPDATE lead_splits SET leads_assigned = leads_assigned + assigned_count WHERE id = p_rule_id;

  RETURN jsonb_build_object('assigned', assigned_count, 'overflow', overflow_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION rebalance_new_leads(p_rule_id UUID)
RETURNS JSONB AS $$
DECLARE ids UUID[];
BEGIN
  SELECT array_agg(id) INTO ids FROM leads WHERE status = 'NEW' AND assigned_to IS NULL AND deleted_at IS NULL;
  IF ids IS NULL THEN RETURN jsonb_build_object('assigned', 0); END IF;
  RETURN run_split_engine(ids, p_rule_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Analytics RPCs
CREATE OR REPLACE FUNCTION get_dashboard_kpis(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE uid UUID := COALESCE(p_user_id, auth.uid());
BEGIN
  IF is_admin() AND p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'totalRevenueMtd', COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'RECEIVED' AND received_at >= date_trunc('month', now())), 0),
      'dealsWonMtd', COALESCE((SELECT COUNT(*) FROM deals WHERE stage = 'WON' AND won_at >= date_trunc('month', now())), 0),
      'winRate', COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE stage = 'WON') / NULLIF(COUNT(*), 0), 0) FROM deals), 0),
      'avgDealSize', COALESCE((SELECT ROUND(AVG(value)) FROM deals WHERE stage = 'WON'), 0),
      'pipelineValue', COALESCE((SELECT SUM(value) FROM deals WHERE stage NOT IN ('WON', 'LOST')), 0)
    );
  END IF;
  RETURN jsonb_build_object(
    'totalRevenueMtd', COALESCE((SELECT SUM(p.amount) FROM payments p JOIN deals d ON d.id = p.deal_id WHERE d.rep_id = uid AND p.status = 'RECEIVED' AND p.received_at >= date_trunc('month', now())), 0),
    'dealsWonMtd', COALESCE((SELECT COUNT(*) FROM deals WHERE rep_id = uid AND stage = 'WON' AND won_at >= date_trunc('month', now())), 0),
    'winRate', COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE stage = 'WON') / NULLIF(COUNT(*), 0), 0) FROM deals WHERE rep_id = uid), 0),
    'avgDealSize', COALESCE((SELECT ROUND(AVG(value)) FROM deals WHERE rep_id = uid AND stage = 'WON'), 0),
    'pipelineValue', COALESCE((SELECT SUM(value) FROM deals WHERE rep_id = uid AND stage NOT IN ('WON', 'LOST')), 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_revenue_trend(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('month', to_char(m, 'Mon ''YY'), 'revenue', COALESCE(rev, 0)) ORDER BY m)
    FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), '1 month') m
    LEFT JOIN LATERAL (
      SELECT SUM(p.amount) rev FROM payments p
      JOIN deals d ON d.id = p.deal_id
      WHERE p.status = 'RECEIVED' AND date_trunc('month', p.received_at) = m
        AND (is_admin() AND p_user_id IS NULL OR d.rep_id = COALESCE(p_user_id, auth.uid()))
    ) x ON true
  ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_activity_volume(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'day', to_char(d.day, 'Dy'),
      'calls', d.calls,
      'emails', d.emails,
      'meetings', d.meetings
    ) ORDER BY d.day)
    FROM (
      SELECT
        gs.d AS day,
        COALESCE(SUM(CASE WHEN a.type::text = 'CALL' THEN 1 END), 0)::int AS calls,
        COALESCE(SUM(CASE WHEN a.type::text = 'EMAIL' THEN 1 END), 0)::int AS emails,
        COALESCE(SUM(CASE WHEN a.type::text = 'MEETING' THEN 1 END), 0)::int AS meetings
      FROM generate_series(date_trunc('week', now()), date_trunc('week', now()) + interval '6 days', interval '1 day') gs(d)
      LEFT JOIN activities a ON date_trunc('day', a.created_at) = gs.d
        AND (is_admin() AND p_user_id IS NULL OR a.user_id = COALESCE(p_user_id, auth.uid()))
      GROUP BY gs.d
    ) d
  ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_leads_by_source(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('name', source, 'value', cnt, 'color', '#1A1AFF'))
    FROM (
      SELECT COALESCE(source, 'Other') source, COUNT(*) cnt
      FROM leads
      WHERE deleted_at IS NULL
        AND (is_admin() AND p_user_id IS NULL OR assigned_to = COALESCE(p_user_id, auth.uid()))
      GROUP BY 1 ORDER BY 2 DESC LIMIT 5
    ) s
  ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_pipeline_funnel(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('stage', status::text, 'count', cnt, 'value', val, 'color', '#3B82F6'))
    FROM (
      SELECT status, COUNT(*) cnt, SUM(value) val FROM leads
      WHERE deleted_at IS NULL AND status NOT IN ('WON', 'LOST')
        AND (is_admin() AND p_user_id IS NULL OR assigned_to = COALESCE(p_user_id, auth.uid()))
      GROUP BY status
    ) f
  ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_split_rule_efficiency()
RETURNS JSONB AS $$
BEGIN
  IF NOT is_admin() THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('name', name, 'winRate', win_rate, 'deals', leads_assigned))
    FROM lead_splits WHERE is_active
  ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_leaderboard(p_period TEXT DEFAULT 'monthly')
RETURNS JSONB AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'user_id', ranked.user_id, 'name', ranked.name, 'initials', ranked.initials, 'tier', ranked.tier,
      'points', ranked.points, 'deals_mtd', ranked.deals_mtd, 'win_rate', ranked.win_rate,
      'revenue', ranked.revenue, 'rank', ranked.rank, 'color', ranked.color
    ) ORDER BY ranked.rank)
    FROM (
      SELECT
        p.id AS user_id, p.name, p.initials, p.tier, p.points, p.color,
        COALESCE(d.cnt, 0)::int AS deals_mtd,
        COALESCE(d.wr, 0)::int AS win_rate,
        COALESCE(r.rev, 0)::numeric AS revenue,
        ROW_NUMBER() OVER (ORDER BY p.points DESC)::int AS rank
      FROM profiles p
      LEFT JOIN LATERAL (
        SELECT COUNT(*) FILTER (
          WHERE CASE p_period
            WHEN 'daily' THEN d.won_at >= date_trunc('day', now())
            WHEN 'weekly' THEN d.won_at >= date_trunc('week', now())
            ELSE d.won_at >= date_trunc('month', now())
          END
        ) AS cnt,
        ROUND(100.0 * COUNT(*) FILTER (WHERE d.stage = 'WON') / NULLIF(COUNT(*), 0)) AS wr
        FROM deals d WHERE d.rep_id = p.id
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT SUM(pay.amount) rev FROM payments pay
        JOIN deals dl ON dl.id = pay.deal_id
        WHERE dl.rep_id = p.id AND pay.status = 'RECEIVED'
      ) r ON true
      WHERE p.role = 'sales_rep' AND p.is_active
    ) ranked
  ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE compensation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_compensation ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_state ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_service_role ON public.profiles;

CREATE POLICY profiles_select ON profiles FOR SELECT USING (is_admin() OR id = auth.uid());
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY profiles_insert_own ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY profiles_admin_all ON profiles FOR ALL USING (is_admin());
CREATE POLICY profiles_service_role ON profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Platform settings
CREATE POLICY settings_select ON platform_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY settings_admin ON platform_settings FOR ALL USING (is_admin());

-- Leads
CREATE POLICY leads_admin ON leads FOR ALL USING (is_admin());
CREATE POLICY leads_rep_select ON leads FOR SELECT USING (assigned_to = auth.uid() AND deleted_at IS NULL);
CREATE POLICY leads_rep_update ON leads FOR UPDATE USING (assigned_to = auth.uid());
CREATE POLICY leads_rep_delete ON leads FOR UPDATE USING (assigned_to = auth.uid());

-- Lead splits (admin only)
CREATE POLICY splits_admin ON lead_splits FOR ALL USING (is_admin());

-- Import jobs (admin only)
CREATE POLICY import_admin ON import_jobs FOR ALL USING (is_admin());

-- Assignment queue (admin only)
CREATE POLICY queue_admin ON assignment_queue FOR ALL USING (is_admin());

-- Assignment audit (admin read, system insert)
CREATE POLICY audit_admin ON assignment_audit FOR SELECT USING (is_admin());

-- Deals
CREATE POLICY deals_admin ON deals FOR ALL USING (is_admin());
CREATE POLICY deals_rep ON deals FOR ALL USING (rep_id = auth.uid());

-- Clients
CREATE POLICY clients_admin ON clients FOR ALL USING (is_admin());
CREATE POLICY clients_rep ON clients FOR ALL USING (manager_id = auth.uid());

-- Client notes/files
CREATE POLICY notes_admin ON client_notes FOR ALL USING (is_admin());
CREATE POLICY notes_rep ON client_notes FOR ALL USING (
  EXISTS (SELECT 1 FROM clients c WHERE c.id = client_id AND c.manager_id = auth.uid())
);
CREATE POLICY files_admin ON client_files FOR ALL USING (is_admin());
CREATE POLICY files_rep ON client_files FOR ALL USING (
  EXISTS (SELECT 1 FROM clients c WHERE c.id = client_id AND c.manager_id = auth.uid())
);

-- Activities
CREATE POLICY activities_admin ON activities FOR ALL USING (is_admin());
CREATE POLICY activities_rep ON activities FOR ALL USING (user_id = auth.uid());

-- Payments
CREATE POLICY payments_admin ON payments FOR ALL USING (is_admin());
CREATE POLICY payments_rep ON payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_id AND d.rep_id = auth.uid())
);

-- Compensation (admin)
CREATE POLICY comp_admin ON compensation_plans FOR ALL USING (is_admin());
CREATE POLICY rep_comp_admin ON rep_compensation FOR ALL USING (is_admin());
CREATE POLICY commissions_admin ON commissions FOR ALL USING (is_admin());
CREATE POLICY commissions_rep ON commissions FOR SELECT USING (user_id = auth.uid());

-- Leaderboard (all authenticated)
CREATE POLICY leaderboard_read ON leaderboard_snapshots FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY leaderboard_admin ON leaderboard_snapshots FOR ALL USING (is_admin());

-- Notifications
CREATE POLICY notif_own ON notifications FOR ALL USING (user_id = auth.uid());

-- Expenses (admin)
CREATE POLICY expenses_admin ON expenses FOR ALL USING (is_admin());

-- Split state (admin)
CREATE POLICY split_state_admin ON split_state FOR ALL USING (is_admin());

-- Storage buckets (run in dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('csv-imports', 'csv-imports', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('client-files', 'client-files', false);
