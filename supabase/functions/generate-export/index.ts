// Deploy with: supabase functions deploy generate-export
// Generates accounting export JSON (extend to XLSX/PDF with additional libraries).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "revenue";

  const { data: payments } = await supabase.from("payments").select("*, deals(leads(company))").eq("status", "RECEIVED");
  const { data: expenses } = await supabase.from("expenses").select("*");
  const { data: commissions } = await supabase.from("commissions").select("*, profiles(name), deals(value, leads(company))");

  const payload = { type, generatedAt: new Date().toISOString(), payments, expenses, commissions };

  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${type}-export.json"` },
  });
});
