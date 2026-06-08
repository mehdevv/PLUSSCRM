import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const CRM_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_leads",
      description: "Search leads by name, company, email, status, or assignment.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string" },
          status: { type: "string" },
          unassigned_only: { type: "boolean" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "count_leads",
      description: "Get the total number of leads.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          unassigned_only: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_sales_reps",
      description: "List all sales reps with id, name, email, tier, and active status.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dashboard_stats",
      description: "Get company-wide KPIs.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_leaderboard",
      description: "Get monthly sales rep leaderboard.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_queue_leads",
      description: "Get unassigned leads in the assignment queue.",
      parameters: { type: "object", properties: { limit: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_lead",
      description: "Assign a single lead to a sales rep.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          rep_id: { type: "string" },
          rep_name: { type: "string" },
        },
        required: ["lead_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_assign_leads",
      description: "Assign multiple leads to one sales rep.",
      parameters: {
        type: "object",
        properties: {
          lead_ids: { type: "array", items: { type: "string" } },
          rep_id: { type: "string" },
          rep_name: { type: "string" },
        },
        required: ["lead_ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_clients",
      description: "List clients.",
      parameters: {
        type: "object",
        properties: { search: { type: "string" }, limit: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_payments_summary",
      description: "Get payment totals and recent payments.",
      parameters: {
        type: "object",
        properties: { status: { type: "string" }, limit: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_split_rules",
      description: "List lead split/assignment rules.",
      parameters: { type: "object", properties: {} },
    },
  },
];

export const SYSTEM_PROMPT = `You are the PLUSS CRM Admin Assistant — an AI helper for company administrators.

You can query CRM data and perform actions like assigning leads to sales reps.

Rules:
- ALWAYS use the provided tools to fetch real data. Never invent IDs, names, or numbers.
- When assigning leads, use search_leads or get_queue_leads first to find the correct lead_id, and list_sales_reps to find rep_id.
- If a request is ambiguous (multiple matching leads or reps), ask the user to clarify before acting.
- Be concise, professional, and action-oriented.
- Format lists clearly. Summarize numbers with context.
- You only help with CRM tasks: leads, assignments, team, clients, payments, dashboard stats.`;

type RepRow = { id: string; name: string };

function formatLead(row: Record<string, unknown>, repMap: Map<string, RepRow>) {
  const assignedTo = row.assigned_to as string | null;
  const rep = assignedTo ? repMap.get(assignedTo) : null;
  return {
    id: row.id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    company: row.company,
    email: row.email,
    phone: row.phone,
    status: row.status,
    source: row.source,
    value: row.value,
    assigned_to: rep ? rep.name : null,
    assigned_rep_id: assignedTo,
    created_at: row.created_at,
  };
}

async function resolveRepId(
  admin: SupabaseClient,
  args: { rep_id?: string; rep_name?: string },
): Promise<string | { error: string }> {
  if (args.rep_id) return args.rep_id;
  if (!args.rep_name) throw new Error("Provide rep_id or rep_name");

  const { data, error } = await admin
    .from("profiles")
    .select("id, name")
    .eq("role", "sales_rep")
    .ilike("name", `%${args.rep_name}%`)
    .limit(5);
  if (error) throw error;
  if (!data?.length) return { error: `No sales rep found matching "${args.rep_name}"` };
  if (data.length > 1) {
    return { error: `Multiple reps match "${args.rep_name}": ${data.map((r) => r.name).join(", ")}` };
  }
  return data[0].id;
}

async function getRepMap(admin: SupabaseClient) {
  const { data } = await admin.from("profiles").select("id, name").eq("role", "sales_rep");
  return new Map((data ?? []).map((r) => [r.id, r as RepRow]));
}

export async function executeCrmTool(
  admin: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
) {
  const repMap = await getRepMap(admin);

  switch (name) {
    case "search_leads": {
      const limit = Math.min(Number(args.limit ?? 20), 50);
      let q = admin
        .from("leads")
        .select("id, first_name, last_name, company, email, phone, status, source, value, assigned_to, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (args.status) q = q.eq("status", args.status as string);
      if (args.unassigned_only) q = q.is("assigned_to", null);
      if (args.search) {
        const s = String(args.search).replace(/%/g, "");
        q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,company.ilike.%${s}%,email.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return { leads: (data ?? []).map((r) => formatLead(r as Record<string, unknown>, repMap)), count: data?.length ?? 0 };
    }
    case "count_leads": {
      let q = admin.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null);
      if (args.status) q = q.eq("status", args.status as string);
      if (args.unassigned_only) q = q.is("assigned_to", null);
      const { count, error } = await q;
      if (error) throw error;
      return { total: count ?? 0 };
    }
    case "list_sales_reps": {
      const { data, error } = await admin.from("profiles").select("id, name, email, tier, points, is_active, vacation_mode").eq("role", "sales_rep").order("name");
      if (error) throw error;
      return { reps: data ?? [] };
    }
    case "get_dashboard_stats": {
      const { data, error } = await admin.rpc("get_dashboard_kpis", { p_user_id: null });
      if (error) throw error;
      return data;
    }
    case "get_leaderboard": {
      const { data, error } = await admin.rpc("get_leaderboard", { p_period: "monthly" });
      if (error) throw error;
      return { leaderboard: data ?? [] };
    }
    case "get_queue_leads": {
      const limit = Math.min(Number(args.limit ?? 20), 50);
      const { data, error } = await admin.from("leads").select("id, first_name, last_name, company, email, status, source, created_at").is("assigned_to", null).eq("status", "NEW").is("deleted_at", null).order("created_at", { ascending: true }).limit(limit);
      if (error) throw error;
      return {
        queue: (data ?? []).map((r) => ({
          id: r.id,
          name: `${r.first_name} ${r.last_name}`.trim(),
          company: r.company,
          email: r.email,
          status: r.status,
          source: r.source,
        })),
        count: data?.length ?? 0,
      };
    }
    case "assign_lead": {
      const repResult = await resolveRepId(admin, args as { rep_id?: string; rep_name?: string });
      if (typeof repResult === "object" && "error" in repResult) return repResult;
      const repId = repResult;
      const { data: lead, error: leadErr } = await admin.from("leads").select("id, first_name, last_name, company").eq("id", args.lead_id as string).single();
      if (leadErr || !lead) return { error: `Lead not found: ${args.lead_id}` };
      const { error } = await admin.from("leads").update({ assigned_to: repId, status: "ASSIGNED", updated_at: new Date().toISOString() }).eq("id", args.lead_id as string);
      if (error) throw error;
      await admin.from("assignment_audit").insert({ lead_id: args.lead_id, rep_id: repId, reason: "ai_assistant" });
      await admin.from("notifications").insert({ user_id: repId, title: "Lead Assigned", message: `Lead ${lead.company} assigned via AI assistant` });
      const rep = repMap.get(repId);
      return { success: true, action: "assign_lead", lead: `${lead.first_name} ${lead.last_name} @ ${lead.company}`, assigned_to: rep?.name ?? repId };
    }
    case "bulk_assign_leads": {
      const repResult = await resolveRepId(admin, args as { rep_id?: string; rep_name?: string });
      if (typeof repResult === "object" && "error" in repResult) return repResult;
      const repId = repResult;
      const leadIds = (args.lead_ids as string[]) ?? [];
      const results: Record<string, unknown>[] = [];
      for (const leadId of leadIds) {
        const { data: lead } = await admin.from("leads").select("id, first_name, last_name, company").eq("id", leadId).single();
        if (!lead) { results.push({ lead_id: leadId, success: false, error: "Not found" }); continue; }
        const { error } = await admin.from("leads").update({ assigned_to: repId, status: "ASSIGNED", updated_at: new Date().toISOString() }).eq("id", leadId);
        if (error) { results.push({ lead_id: leadId, success: false, error: error.message }); continue; }
        await admin.from("assignment_audit").insert({ lead_id: leadId, rep_id: repId, reason: "ai_assistant" });
        results.push({ lead_id: leadId, success: true, company: lead.company });
      }
      await admin.from("notifications").insert({ user_id: repId, title: "Leads Assigned", message: `${results.filter((r) => r.success).length} lead(s) assigned via AI assistant` });
      const rep = repMap.get(repId);
      return { success: true, action: "bulk_assign_leads", assigned_to: rep?.name ?? repId, results, assigned_count: results.filter((r) => r.success).length };
    }
    case "get_clients": {
      const limit = Math.min(Number(args.limit ?? 20), 50);
      let q = admin.from("clients").select("id, company, contact, email, phone, ltv, deals_count, last_activity, created_at").order("created_at", { ascending: false }).limit(limit);
      if (args.search) {
        const s = String(args.search).replace(/%/g, "");
        q = q.or(`company.ilike.%${s}%,contact.ilike.%${s}%,email.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return { clients: data ?? [], count: data?.length ?? 0 };
    }
    case "get_payments_summary": {
      let q = admin.from("payments").select("id, invoice_ref, company, amount, method, status, received_at, currency").order("received_at", { ascending: false }).limit(Math.min(Number(args.limit ?? 15), 30));
      if (args.status) q = q.eq("status", args.status as string);
      const { data, error } = await q;
      if (error) throw error;
      const payments = data ?? [];
      const total = payments.reduce((s, p) => s + Number(p.amount), 0);
      return { payments, total_amount: total, count: payments.length };
    }
    case "get_split_rules": {
      const { data, error } = await admin.from("split_rules").select("id, name, mode, is_active, priority, leads_assigned, win_rate, rep_pool").order("priority");
      if (error) throw error;
      return { rules: data ?? [] };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
