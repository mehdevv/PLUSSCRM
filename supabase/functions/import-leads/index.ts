// Deploy with: supabase functions deploy import-leads
// CSV import is handled client-side via services/leads.ts + run_split_engine RPC.
// This edge function can be extended for large-file server-side processing.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const body = await req.json();
  const { leadIds, ruleId } = body as { leadIds: string[]; ruleId: string };

  const { data, error } = await supabase.rpc("run_split_engine", {
    p_lead_ids: leadIds,
    p_rule_id: ruleId,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
});
