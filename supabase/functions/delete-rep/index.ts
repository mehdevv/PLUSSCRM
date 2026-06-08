import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";

async function cleanupRepBeforeDelete(
  admin: ReturnType<typeof createClient>,
  repId: string,
  fallbackAdminId: string,
) {
  const { data: rep, error: repErr } = await admin
    .from("profiles")
    .select("id, role, name")
    .eq("id", repId)
    .single();

  if (repErr || !rep) throw new Error("Sales rep not found");
  if (rep.role !== "sales_rep") throw new Error("Only sales rep accounts can be deleted here");

  const now = new Date().toISOString();

  const { error: leadsErr } = await admin
    .from("leads")
    .update({
      assigned_to: null,
      split_rule_id: null,
      status: "NEW",
      updated_at: now,
    })
    .eq("assigned_to", repId);
  if (leadsErr) throw new Error(leadsErr.message);

  const { count: remainingLeads, error: checkErr } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("assigned_to", repId);
  if (checkErr) throw new Error(checkErr.message);
  if ((remainingLeads ?? 0) > 0) {
    throw new Error(`Could not unassign ${remainingLeads} lead(s) from this rep`);
  }

  const tables = [
    { table: "deals", column: "rep_id" },
    { table: "clients", column: "manager_id" },
    { table: "commissions", column: "user_id" },
    { table: "activities", column: "user_id" },
    { table: "import_jobs", column: "created_by" },
  ] as const;

  for (const { table, column } of tables) {
    const { error } = await admin.from(table).update({ [column]: fallbackAdminId }).eq(column, repId);
    if (error) throw new Error(error.message);
  }

  await admin.from("assignment_audit").delete().eq("rep_id", repId);
  await admin.from("leaderboard_snapshots").delete().eq("user_id", repId);

  const { error: profileErr } = await admin.from("profiles").delete().eq("id", repId);
  if (profileErr) throw new Error(profileErr.message);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse("ok");
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return jsonResponse({ error: "Admin access required" }, 403);

    const body = await req.json() as { repId?: string };
    const repId = body.repId?.trim();
    if (!repId) return jsonResponse({ error: "repId is required" }, 400);
    if (repId === user.id) return jsonResponse({ error: "Cannot delete your own account" }, 400);

    await cleanupRepBeforeDelete(admin, repId, user.id);

    const { error: deleteError } = await admin.auth.admin.deleteUser(repId);
    if (deleteError) return jsonResponse({ error: deleteError.message }, 400);

    return jsonResponse({ repId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return jsonResponse({ error: message }, 400);
  }
});
