/**
 * Creates demo admin + rep users in Supabase Auth.
 *
 * Requires in .env:
 *   VITE_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...  (or SUPABASE_SECRET_KEY=sb_secret_...)
 *
 * Run: npm run seed:users
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env.mjs";

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!url || !serviceKey) {
  console.error(`
Missing credentials. Add to your .env file:

  VITE_SUPABASE_URL=https://lnptkgvuyosabvoqivyg.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=your_secret_or_service_role_key

Get the secret key from Supabase Dashboard → Project Settings → API Keys
(Legacy "service_role" or new "sb_secret_..." key — never expose in VITE_* vars)
`);
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  {
    email: "kernoumehdi17@gmail.com",
    password: "mehdi123",
    name: "Mehdi Kernou",
    initials: "MK",
    role: "admin",
    color: "#1A1AFF",
    tier: "DIAMOND",
    points: 5420,
  },
  {
    email: "rep@pluss.agency",
    password: "Rep123!",
    name: "Demo Rep",
    initials: "DR",
    role: "sales_rep",
    color: "#8B5CF6",
    tier: "SILVER",
    points: 1200,
  },
];

async function upsertUser(u) {
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users?.find((x) => x.email === u.email);

  let userId;
  if (existing) {
    userId = existing.id;
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: u.password,
      email_confirm: true,
      user_metadata: { name: u.name, role: u.role },
    });
    if (error) throw new Error(`Update ${u.email}: ${error.message}`);
    console.log(`Updated user: ${u.email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { name: u.name, role: u.role },
    });
    if (error) {
      throw new Error(
        `Create ${u.email}: ${error.message}\n\n` +
          `Fix: open Supabase SQL Editor and run:\n` +
          `  supabase/migrations/002_fix_signup_trigger.sql\n` +
          `Then run: npm run seed:users`,
      );
    }
    userId = data.user.id;
    console.log(`Created user: ${u.email}`);
  }

  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      email: u.email,
      name: u.name,
      initials: u.initials,
      role: u.role,
      color: u.color,
      tier: u.tier,
      points: u.points,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (profileErr) {
    console.warn(`Profile warning for ${u.email}: ${profileErr.message}`);
    console.warn("  → Run supabase/migrations/001_initial_schema.sql in SQL Editor first.");
  } else {
    console.log(`  Profile synced: ${u.role}`);
  }
}

console.log("Seeding PLUSS CRM demo users...\n");

for (const u of USERS) {
  try {
    await upsertUser(u);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

console.log(`
Done! Sign in at http://localhost:5173

  Admin: kernoumehdi17@gmail.com
  Rep:   rep@pluss.agency / Rep123!
`);
