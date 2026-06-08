/**
 * Create a sales rep without the Edge Function (local admin fallback).
 *
 * Usage:
 *   npm run invite:rep -- --name "Kernou Mehdi" --email kernou@example.com --password "TempPass123!"
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env.mjs";
import { ensureSalesRepAccount } from "./rep-account.mjs";

loadEnv();

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const name = arg("name");
const email = arg("email")?.trim().toLowerCase();
const password = arg("password");
const initials = arg("initials");
const color = arg("color") ?? "#8B5CF6";

if (!url || !serviceKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
if (!name || !email || !password) {
  console.error(`
Usage:
  npm run invite:rep -- --name "Full Name" --email user@example.com --password "Min8chars!"
Optional: --initials KM --color "#8B5CF6"
`);
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

try {
  const { userId } = await ensureSalesRepAccount(admin, { email, password, name, initials, color });
  console.log(`\nRep created: ${email}`);
  console.log(`  User ID: ${userId}`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  console.error("Tip: run migration 002_fix_signup_trigger.sql if profile trigger fails.");
  process.exit(1);
}
console.log(`  Login:   /login`);
console.log(`\nDeploy invite-rep Edge Function for in-app "Add Rep": npm run deploy:functions\n`);
