-- PLUSS CRM — Fix "Database error creating new user"
-- Run this in Supabase SQL Editor, then: npm run seed:users

-- Drop and recreate the signup trigger with safe error handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

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
    initials = EXCLUDED.initials,
    role = EXCLUDED.role,
    updated_at = now();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't block auth signup if profile insert fails; seed script can upsert later
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RLS: allow new users to insert their own profile on signup
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- RLS: allow service_role full access (seed script + admin API)
DROP POLICY IF EXISTS profiles_service_role ON public.profiles;
CREATE POLICY profiles_service_role ON public.profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
