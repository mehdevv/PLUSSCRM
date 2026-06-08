export const WRITE_TOOL_NAMES = new Set([
  "assign_lead",
  "bulk_assign_leads",
  "unassign_lead",
  "update_lead_status",
  "update_lead",
  "bulk_update_leads",
]);

const LEAD_EDIT_FIELDS = [
  "first_name", "last_name", "company", "email", "phone", "status", "source",
  "value", "country", "wilaya", "industry", "notes", "google_maps_link", "website_link",
];

const VALID_LEAD_STATUSES = new Set([
  "NEW", "ASSIGNED", "CONTACTED", "QUALIFYING", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "DORMANT",
]);

const LEAD_SELECT =
  "id, first_name, last_name, company, email, phone, status, source, value, assigned_to, country, wilaya, industry, notes, google_maps_link, website_link, created_at, updated_at";
const MAX_LEAD_PAGE = 50;
const DEFAULT_LEAD_PAGE = 20;
const MAX_REP_LEADS = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidLeadId(id) {
  return typeof id === "string" && UUID_RE.test(id);
}

function partitionLeadIds(ids) {
  const list = Array.isArray(ids) ? ids : [];
  const valid = [];
  const invalid = [];
  for (const id of list) {
    if (isValidLeadId(id)) valid.push(id);
    else invalid.push(String(id));
  }
  return { valid: valid.slice(0, 10), invalid };
}

export const READ_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_crm_overview",
      description: "Full CRM snapshot: total leads, counts by status, link stats (google_maps/website counts), unassigned count, and ALL sales reps. Use first for broad or link-access questions.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_all_leads",
      description: "List leads with full details. Supports pagination — use offset/limit to browse entire database. Returns total_count and has_more.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          unassigned_only: { type: "boolean" },
          rep_id: { type: "string" },
          rep_name: { type: "string" },
          offset: { type: "integer", description: "Skip N leads (default 0)" },
          limit: { type: "integer", description: "Page size up to 50 (default 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_lead_details",
      description: "Get one lead's full record by real lead_id from query_lead_segment, or search by partial company name. Never use placeholder IDs.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          company: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_rep_details",
      description: "Get a sales rep's full profile and ALL leads assigned to them.",
      parameters: {
        type: "object",
        properties: {
          rep_id: { type: "string" },
          rep_name: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_leads",
      description: "Quick text search on leads. For link/location filters prefer query_lead_segment.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string" },
          status: { type: "string" },
          unassigned_only: { type: "boolean" },
          rep_name: { type: "string" },
          has_google_maps: { type: "boolean" },
          has_website: { type: "boolean" },
          has_any_link: { type: "boolean" },
          limit: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "count_leads",
      description: "Get total lead count with optional filters.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          unassigned_only: { type: "boolean" },
          rep_id: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "count_lead_segment",
      description: "Count leads matching filters BEFORE loading data (saves tokens). Use first for link/status/location questions. Supports has_google_maps, has_website, has_both_links, has_any_link, missing_links.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string" },
          status: { type: "string" },
          unassigned_only: { type: "boolean" },
          rep_id: { type: "string" },
          rep_name: { type: "string" },
          country: { type: "string" },
          wilaya: { type: "string" },
          industry: { type: "string" },
          source: { type: "string" },
          has_google_maps: { type: "boolean", description: "Only leads with a Google Maps link" },
          has_website: { type: "boolean", description: "Only leads with a website link" },
          has_both_links: { type: "boolean", description: "Leads with both map and website links" },
          has_any_link: { type: "boolean", description: "Leads with Google Maps and/or website link" },
          missing_links: { type: "boolean", description: "Leads with neither link" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_sales_reps",
      description: "List ALL sales reps with full profile and assigned lead counts.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dashboard_stats",
      description: "Company KPIs.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_leaderboard",
      description: "Monthly rep leaderboard.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_queue_leads",
      description: "ALL unassigned NEW leads in the assignment queue.",
      parameters: { type: "object", properties: { limit: { type: "integer" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "get_clients",
      description: "List clients.",
      parameters: {
        type: "object",
        properties: { search: { type: "string" }, limit: { type: "integer" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_payments_summary",
      description: "Payment totals and recent payments.",
      parameters: {
        type: "object",
        properties: { status: { type: "string" }, limit: { type: "integer" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_split_rules",
      description: "List split rules.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "query_lead_segment",
      description: "PRIMARY tool for filtered lead reads. Apply filters, get lead IDs + preview rows (with google_maps_link, website_link). Paginate with offset/limit. Call count_lead_segment first to check totals.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string" },
          status: { type: "string" },
          unassigned_only: { type: "boolean" },
          rep_id: { type: "string" },
          rep_name: { type: "string" },
          country: { type: "string" },
          wilaya: { type: "string" },
          industry: { type: "string" },
          source: { type: "string" },
          has_google_maps: { type: "boolean" },
          has_website: { type: "boolean" },
          has_both_links: { type: "boolean" },
          has_any_link: { type: "boolean" },
          missing_links: { type: "boolean" },
          offset: { type: "integer" },
          limit: { type: "integer", description: "Page size up to 30 (default 15)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_leads_full",
      description: "Load FULL lead records for specific IDs (all fields). Call after query_lead_segment, max 10 IDs per call, before update_lead.",
      parameters: {
        type: "object",
        properties: {
          lead_ids: { type: "array", items: { type: "string" } },
        },
        required: ["lead_ids"],
      },
    },
  },
];

const WRITE_TOOLS = [
  {
    type: "function",
    function: {
      name: "assign_lead",
      description: "Assign one lead to a rep.",
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
      description: "Assign multiple leads to one rep.",
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
      name: "unassign_lead",
      description: "Remove rep assignment from a lead and set status to NEW.",
      parameters: {
        type: "object",
        properties: { lead_id: { type: "string" } },
        required: ["lead_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead_status",
      description: "Update a lead pipeline status.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          status: { type: "string", description: "NEW, ASSIGNED, CONTACTED, QUALIFYING, PROPOSAL, NEGOTIATION, WON, LOST, DORMANT" },
        },
        required: ["lead_id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead",
      description: "Update one lead's fields. Only provided fields change. Use get_leads_full first to read current data.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          first_name: { type: "string" },
          last_name: { type: "string" },
          company: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          status: { type: "string" },
          source: { type: "string" },
          value: { type: "number" },
          country: { type: "string" },
          wilaya: { type: "string" },
          industry: { type: "string" },
          notes: { type: "string" },
          google_maps_link: { type: "string" },
          website_link: { type: "string" },
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
      name: "bulk_update_leads",
      description: "Apply the same field updates to multiple leads by ID. Use after query_lead_segment + get_leads_full.",
      parameters: {
        type: "object",
        properties: {
          lead_ids: { type: "array", items: { type: "string" } },
          updates: {
            type: "object",
            description: "Fields to set on every lead",
            properties: {
              status: { type: "string" },
              source: { type: "string" },
              industry: { type: "string" },
              country: { type: "string" },
              wilaya: { type: "string" },
              notes: { type: "string" },
              value: { type: "number" },
            },
          },
        },
        required: ["lead_ids", "updates"],
      },
    },
  },
];

export const CRM_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS];

function hasTextLink(value) {
  return !!String(value ?? "").trim();
}

function formatLeadBrief(row, repMap) {
  const rep = row.assigned_to ? repMap.get(row.assigned_to) : null;
  return {
    id: row.id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    company: row.company,
    status: row.status,
    assigned_to: rep ? rep.name : null,
    value: row.value,
  };
}

/** Token-efficient lead row for AI — includes contact + map/website links */
function formatLeadForAi(row, repMap) {
  const rep = row.assigned_to ? repMap.get(row.assigned_to) : null;
  const maps = hasTextLink(row.google_maps_link) ? String(row.google_maps_link).trim() : null;
  const web = hasTextLink(row.website_link) ? String(row.website_link).trim() : null;
  return {
    id: row.id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    company: row.company,
    email: row.email,
    phone: row.phone,
    status: row.status,
    assigned_to: rep ? rep.name : null,
    wilaya: row.wilaya,
    country: row.country,
    industry: row.industry,
    source: row.source,
    value: row.value,
    google_maps_link: maps,
    website_link: web,
    has_google_maps: !!maps,
    has_website: !!web,
  };
}

function formatLead(row, repMap) {
  const rep = row.assigned_to ? repMap.get(row.assigned_to) : null;
  return {
    ...formatLeadBrief(row, repMap),
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    source: row.source,
    country: row.country,
    wilaya: row.wilaya,
    industry: row.industry,
    notes: row.notes,
    google_maps_link: row.google_maps_link,
    website_link: row.website_link,
    assigned_rep_id: row.assigned_to,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getLeadLinkStats(admin) {
  const { data, error } = await admin
    .from("leads")
    .select("google_maps_link, website_link")
    .is("deleted_at", null);
  if (error) throw error;
  let withMaps = 0;
  let withWeb = 0;
  let withBoth = 0;
  let withAny = 0;
  for (const r of data ?? []) {
    const m = hasTextLink(r.google_maps_link);
    const w = hasTextLink(r.website_link);
    if (m) withMaps++;
    if (w) withWeb++;
    if (m && w) withBoth++;
    if (m || w) withAny++;
  }
  const total = data?.length ?? 0;
  return {
    with_google_maps: withMaps,
    with_website: withWeb,
    with_both_links: withBoth,
    with_any_link: withAny,
    missing_links: total - withAny,
  };
}

async function getLeadsSummary(admin) {
  const { count: total, error: countErr } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  if (countErr) throw countErr;

  const { data, error } = await admin
    .from("leads")
    .select("status, assigned_to")
    .is("deleted_at", null);
  if (error) throw error;

  const byStatus = {};
  let unassigned = 0;
  for (const row of data ?? []) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    if (!row.assigned_to) unassigned++;
  }
  return { total_leads: total ?? 0, unassigned, by_status: byStatus };
}

async function getRepsWithLeadCounts(admin) {
  const { data: reps, error } = await admin
    .from("profiles")
    .select("id, name, email, initials, tier, points, is_active, vacation_mode, color, created_at")
    .eq("role", "sales_rep")
    .order("name");
  if (error) throw error;

  const { data: leads } = await admin
    .from("leads")
    .select("assigned_to, status")
    .is("deleted_at", null)
    .not("assigned_to", "is", null);

  const totalCounts = {};
  const activeCounts = {};
  for (const l of leads ?? []) {
    totalCounts[l.assigned_to] = (totalCounts[l.assigned_to] ?? 0) + 1;
    if (!["WON", "LOST", "DORMANT"].includes(l.status)) {
      activeCounts[l.assigned_to] = (activeCounts[l.assigned_to] ?? 0) + 1;
    }
  }

  return (reps ?? []).map((r) => ({
    ...r,
    total_assigned_leads: totalCounts[r.id] ?? 0,
    active_pipeline_leads: activeCounts[r.id] ?? 0,
  }));
}

function applyLeadFilters(q, args, repMap) {
  if (args.status) q = q.eq("status", args.status);
  if (args.unassigned_only) q = q.is("assigned_to", null);
  if (args.rep_id) q = q.eq("assigned_to", args.rep_id);
  if (args.rep_name) {
    const rep = [...repMap.values()].find((r) =>
      r.name.toLowerCase().includes(String(args.rep_name).toLowerCase()),
    );
    if (rep) q = q.eq("assigned_to", rep.id);
  }
  if (args.search) {
    const s = String(args.search).replace(/%/g, "");
    q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,company.ilike.%${s}%,email.ilike.%${s}%`);
  }
  if (args.country) q = q.ilike("country", `%${String(args.country).replace(/%/g, "")}%`);
  if (args.wilaya) q = q.ilike("wilaya", `%${String(args.wilaya).replace(/%/g, "")}%`);
  if (args.industry) q = q.ilike("industry", `%${String(args.industry).replace(/%/g, "")}%`);
  if (args.source) q = q.ilike("source", `%${String(args.source).replace(/%/g, "")}%`);
  if (args.has_google_maps) q = q.not("google_maps_link", "is", null).neq("google_maps_link", "");
  if (args.has_website) q = q.not("website_link", "is", null).neq("website_link", "");
  if (args.has_both_links) {
    q = q.not("google_maps_link", "is", null).neq("google_maps_link", "")
      .not("website_link", "is", null).neq("website_link", "");
  }
  return q;
}

function applyLinkFiltersInMemory(rows, args) {
  let out = rows;
  if (args.has_any_link) {
    out = out.filter((r) => hasTextLink(r.google_maps_link) || hasTextLink(r.website_link));
  }
  if (args.missing_links) {
    out = out.filter((r) => !hasTextLink(r.google_maps_link) && !hasTextLink(r.website_link));
  }
  return out;
}

function buildSegmentFilters(args) {
  const filters = {};
  for (const key of [
    "search", "status", "unassigned_only", "rep_id", "rep_name", "country", "wilaya", "industry", "source",
    "has_google_maps", "has_website", "has_both_links", "has_any_link", "missing_links",
  ]) {
    if (args[key] != null && args[key] !== "") filters[key] = args[key];
  }
  return filters;
}

async function fetchFilteredLeadRows(admin, args, repMap) {
  let q = admin
    .from("leads")
    .select(LEAD_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  q = applyLeadFilters(q, args, repMap);
  const { data, error } = await q;
  if (error) throw error;
  return applyLinkFiltersInMemory(data ?? [], args);
}

async function buildLeadPatch(admin, args, repMap) {
  const patch = {};
  const source = args.updates && typeof args.updates === "object" ? args.updates : args;

  for (const field of LEAD_EDIT_FIELDS) {
    if (source[field] != null && source[field] !== "") {
      patch[field] = field === "value" ? Number(source[field]) : source[field];
    }
  }

  if (source.status && !VALID_LEAD_STATUSES.has(String(source.status).toUpperCase())) {
    return { error: `Invalid status. Use: ${[...VALID_LEAD_STATUSES].join(", ")}` };
  }
  if (patch.status) patch.status = String(patch.status).toUpperCase();

  if (args.rep_id || args.rep_name || source.rep_id || source.rep_name) {
    const repResult = await resolveRepId(admin, {
      rep_id: args.rep_id ?? source.rep_id,
      rep_name: args.rep_name ?? source.rep_name,
    });
    if (typeof repResult === "object" && repResult.error) return repResult;
    patch.assigned_to = repResult;
    if (!patch.status) patch.status = "ASSIGNED";
  }

  if (!Object.keys(patch).length) return { error: "No valid fields to update" };
  patch.updated_at = new Date().toISOString();
  return patch;
}

async function resolveRepId(admin, { rep_id, rep_name }) {
  if (rep_id) return rep_id;
  if (!rep_name) throw new Error("Provide rep_id or rep_name");

  const { data, error } = await admin
    .from("profiles")
    .select("id, name")
    .eq("role", "sales_rep")
    .ilike("name", `%${rep_name}%`)
    .limit(5);
  if (error) throw error;
  if (!data?.length) throw new Error(`No sales rep found matching "${rep_name}"`);
  if (data.length > 1) {
    return {
      error: `Multiple reps match "${rep_name}": ${data.map((r) => r.name).join(", ")}. Ask the user to be more specific.`,
    };
  }
  return data[0].id;
}

async function getRepMap(admin) {
  const { data } = await admin
    .from("profiles")
    .select("id, name, email, tier")
    .eq("role", "sales_rep");
  return new Map((data ?? []).map((r) => [r.id, r]));
}

export function getToolsForMode(mode) {
  if (mode === "ask") return READ_TOOLS;
  return [...READ_TOOLS, ...WRITE_TOOLS];
}

export function buildSystemPrompt(mode, execution) {
  let prompt = SYSTEM_PROMPT;
  if (mode === "ask") {
    prompt += `\n\nMODE: ASK — read-only. You HAVE full access to all leads via tools.

Lead data workflow (always follow — never invent IDs or example companies):
1. count_lead_segment — apply filters first (status, wilaya, has_google_maps, has_website, has_any_link, etc.)
2. query_lead_segment — load a small page (limit 15) with google_maps_link and website_link included
3. get_leads_full — only when user needs every field for specific lead_ids from step 2

For "do you have access to links/leads?" — call count_lead_segment (no filters) or get_crm_overview, then answer YES with total and link_stats. Do NOT call get_leads_full for access questions.
Never use placeholder values like "example company", "12345", or "67890". lead_ids must be UUIDs from query_lead_segment only.`;
  } else if (execution === "recursive") {
    prompt += `\n\nMODE: AGENT (RECURSIVE) — for lead edits you MUST follow this order:
1. query_lead_segment — write filters, paginate with offset/limit until has_more is false
2. get_leads_full — load ALL fields for each batch of lead_ids (max 10 IDs per call)
3. update_lead or bulk_update_leads — only after full records are loaded

Never edit leads without reading their full data first. Summarize the segment and planned changes before writing.`;
  } else if (execution === "confirm") {
    prompt += "\n\nMODE: AGENT (CONFIRM) — write tools queue for approval before execution.";
  } else {
    prompt += "\n\nMODE: AGENT (FREEWILL) — you may assign leads and update records when asked. Use get_leads_full before update_lead when editing fields.";
  }
  return prompt;
}

export function extractSnippets(toolName, result) {
  if (!result || result.error) return [];
  if (result.reps?.length && toolName === "get_crm_overview") {
    return [
      {
        type: "stats",
        title: "Lead Summary",
        rows: [{ total: result.total_leads, unassigned: result.unassigned, ...result.by_status, ...result.link_stats }],
      },
      { type: "reps", title: "All Sales Reps", rows: result.reps },
    ];
  }
  if (result.leads?.length) {
    const title = toolName === "get_leads_full" ? "Full lead records" : "Leads";
    return [{ type: "leads", title, rows: result.leads }];
  }
  if (result.lead_ids?.length && toolName === "query_lead_segment") {
    return [
      { type: "stats", title: "Segment", rows: [{ total: result.total_count, returned: result.returned, has_more: result.has_more }] },
      { type: "leads", title: "Segment preview", rows: result.leads },
    ];
  }
  if (result.queue?.length) return [{ type: "queue", title: "Queue", rows: result.queue }];
  if (result.reps?.length) return [{ type: "reps", title: "Sales Reps", rows: result.reps }];
  if (result.rep) return [{ type: "reps", title: result.rep.name, rows: [result.rep] }];
  if (result.clients?.length) return [{ type: "clients", title: "Clients", rows: result.clients }];
  if (result.leaderboard?.length) return [{ type: "leaderboard", title: "Leaderboard", rows: result.leaderboard }];
  if (result.payments?.length) return [{ type: "payments", title: "Payments", rows: result.payments }];
  if (result.rules?.length) return [{ type: "rules", title: "Split Rules", rows: result.rules }];
  if (toolName === "get_dashboard_stats" && result.totalRevenueMtd != null) {
    return [{ type: "stats", title: "Dashboard KPIs", rows: [result] }];
  }
  if (result.total != null && (toolName === "count_leads" || toolName === "count_lead_segment")) {
    return [{ type: "stats", title: "Lead Count", rows: [{ total: result.total, ...result.link_stats }] }];
  }
  return [];
}

export async function previewWriteAction(admin, name, args) {
  const repMap = await getRepMap(admin);
  switch (name) {
    case "assign_lead": {
      const { data: lead } = await admin.from("leads").select("first_name, last_name, company").eq("id", args.lead_id).single();
      let repName = args.rep_name;
      if (args.rep_id) repName = repMap.get(args.rep_id)?.name ?? args.rep_id;
      return {
        label: "Assign lead",
        description: lead ? `Assign ${lead.company} (${lead.first_name} ${lead.last_name}) to ${repName ?? "selected rep"}` : `Assign lead to ${repName ?? "rep"}`,
      };
    }
    case "bulk_assign_leads": {
      const repResult = await resolveRepId(admin, args);
      const repName = typeof repResult === "string" ? (repMap.get(repResult)?.name ?? repResult) : args.rep_name;
      return {
        label: "Bulk assign leads",
        description: `Assign ${args.lead_ids?.length ?? 0} lead(s) to ${repName ?? "selected rep"}`,
      };
    }
    case "unassign_lead": {
      const { data: lead } = await admin.from("leads").select("company").eq("id", args.lead_id).single();
      return { label: "Unassign lead", description: lead ? `Unassign ${lead.company} from current rep` : "Unassign lead" };
    }
    case "update_lead_status": {
      const { data: lead } = await admin.from("leads").select("company").eq("id", args.lead_id).single();
      return { label: "Update status", description: lead ? `Set ${lead.company} to ${args.status}` : `Set status to ${args.status}` };
    }
    case "update_lead": {
      const { data: lead } = await admin.from("leads").select("company, first_name, last_name").eq("id", args.lead_id).single();
      const fields = LEAD_EDIT_FIELDS.filter((f) => args[f] != null && args[f] !== "");
      const name = lead ? `${lead.company} (${lead.first_name} ${lead.last_name})` : args.lead_id;
      return {
        label: "Update lead",
        description: `Edit ${name}: ${fields.join(", ") || "fields"}`,
      };
    }
    case "bulk_update_leads": {
      const count = args.lead_ids?.length ?? 0;
      const fields = args.updates ? Object.keys(args.updates) : LEAD_EDIT_FIELDS.filter((f) => args[f] != null);
      return {
        label: "Bulk update leads",
        description: `Update ${count} lead(s): ${fields.join(", ")}`,
      };
    }
    default:
      return { label: name, description: "Perform action" };
  }
}

export async function executeCrmTool(admin, name, args) {
  const repMap = await getRepMap(admin);

  switch (name) {
    case "get_crm_overview": {
      const summary = await getLeadsSummary(admin);
      const linkStats = await getLeadLinkStats(admin);
      const reps = await getRepsWithLeadCounts(admin);
      return { ...summary, link_stats: linkStats, reps };
    }

    case "list_all_leads": {
      const offset = Math.max(0, Number(args.offset ?? 0));
      const limit = Math.min(Math.max(1, Number(args.limit ?? DEFAULT_LEAD_PAGE)), MAX_LEAD_PAGE);

      let countQ = admin
        .from("leads")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);
      countQ = applyLeadFilters(countQ, args, repMap);
      const { count: totalCount, error: countErr } = await countQ;
      if (countErr) throw countErr;

      let q = admin
        .from("leads")
        .select(LEAD_SELECT)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      q = applyLeadFilters(q, args, repMap);
      const { data, error } = await q;
      if (error) throw error;

      const leads = (data ?? []).map((r) => formatLeadForAi(r, repMap));
      return {
        leads,
        total_count: totalCount ?? 0,
        offset,
        limit,
        returned: leads.length,
        has_more: offset + leads.length < (totalCount ?? 0),
      };
    }

    case "count_lead_segment": {
      const rows = await fetchFilteredLeadRows(admin, args, repMap);
      const withMaps = rows.filter((r) => hasTextLink(r.google_maps_link)).length;
      const withWeb = rows.filter((r) => hasTextLink(r.website_link)).length;
      const withBoth = rows.filter((r) => hasTextLink(r.google_maps_link) && hasTextLink(r.website_link)).length;
      return {
        total: rows.length,
        filters: buildSegmentFilters(args),
        link_stats: {
          with_google_maps: withMaps,
          with_website: withWeb,
          with_both_links: withBoth,
          with_any_link: rows.filter((r) => hasTextLink(r.google_maps_link) || hasTextLink(r.website_link)).length,
        },
      };
    }

    case "get_lead_details": {
      if (args.lead_id) {
        if (!isValidLeadId(args.lead_id)) {
          return {
            error: `Invalid lead_id "${args.lead_id}". Use a UUID from query_lead_segment, or search by company name instead.`,
            hint: "Call query_lead_segment first — never invent numeric IDs",
          };
        }
        const { data, error } = await admin
          .from("leads")
          .select(LEAD_SELECT)
          .eq("id", args.lead_id)
          .is("deleted_at", null)
          .single();
        if (error || !data) return { error: `Lead not found: ${args.lead_id}` };
        return { lead: formatLead(data, repMap) };
      }
      if (args.company) {
        const s = String(args.company).replace(/%/g, "");
        const { data, error } = await admin
          .from("leads")
          .select(LEAD_SELECT)
          .is("deleted_at", null)
          .ilike("company", `%${s}%`)
          .limit(10);
        if (error) throw error;
        const leads = (data ?? []).map((r) => formatLead(r, repMap));
        if (!leads.length) return { error: `No lead found for company: ${args.company}` };
        if (leads.length === 1) return { lead: leads[0] };
        return { leads, count: leads.length };
      }
      return { error: "Provide a real lead_id from query_lead_segment or a company name to search" };
    }

    case "get_rep_details": {
      const repResult = await resolveRepId(admin, args);
      if (typeof repResult === "object" && repResult.error) return repResult;
      const repId = repResult;

      const { data: rep, error: repErr } = await admin
        .from("profiles")
        .select("id, name, email, initials, tier, points, is_active, vacation_mode, color, created_at")
        .eq("id", repId)
        .single();
      if (repErr || !rep) return { error: "Rep not found" };

      const { count: leadCount, error: countErr } = await admin
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", repId)
        .is("deleted_at", null);
      if (countErr) throw countErr;

      const { data: leadRows, error: leadsErr } = await admin
        .from("leads")
        .select(LEAD_SELECT)
        .eq("assigned_to", repId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(MAX_REP_LEADS);
      if (leadsErr) throw leadsErr;

      const leads = (leadRows ?? []).map((r) => formatLeadBrief(r, repMap));
      const total = leadCount ?? leads.length;
      return {
        rep: {
          ...rep,
          total_assigned_leads: total,
          active_pipeline_leads: leads.filter((l) => !["WON", "LOST", "DORMANT"].includes(l.status)).length,
        },
        leads,
        lead_count: total,
        has_more: total > leads.length,
      };
    }

    case "search_leads": {
      const limit = Math.min(args.limit ?? DEFAULT_LEAD_PAGE, MAX_LEAD_PAGE);
      const allRows = await fetchFilteredLeadRows(admin, args, repMap);
      const leads = allRows.slice(0, limit).map((r) => formatLeadForAi(r, repMap));
      return { leads, count: leads.length, total_matched: allRows.length };
    }

    case "count_leads": {
      let q = admin
        .from("leads")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);
      if (args.rep_id) q = q.eq("assigned_to", args.rep_id);
      if (args.status) q = q.eq("status", args.status);
      if (args.unassigned_only) q = q.is("assigned_to", null);
      const { count, error } = await q;
      if (error) throw error;
      return { total: count ?? 0 };
    }

    case "list_sales_reps": {
      const reps = await getRepsWithLeadCounts(admin);
      return { reps, count: reps.length };
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
      const limit = Math.min(args.limit ?? 30, 50);
      const { data, error } = await admin
        .from("leads")
        .select(LEAD_SELECT)
        .is("assigned_to", null)
        .eq("status", "NEW")
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return {
        queue: (data ?? []).map((r) => formatLeadBrief(r, repMap)),
        count: data?.length ?? 0,
      };
    }

    case "assign_lead": {
      const repResult = await resolveRepId(admin, args);
      if (typeof repResult === "object" && repResult.error) return repResult;
      const repId = repResult;

      const { data: lead, error: leadErr } = await admin
        .from("leads")
        .select("id, first_name, last_name, company")
        .eq("id", args.lead_id)
        .single();
      if (leadErr || !lead) return { error: `Lead not found: ${args.lead_id}` };

      const { error } = await admin.from("leads").update({
        assigned_to: repId,
        status: "ASSIGNED",
        updated_at: new Date().toISOString(),
      }).eq("id", args.lead_id);
      if (error) throw error;

      await admin.from("assignment_audit").insert({
        lead_id: args.lead_id,
        rep_id: repId,
        reason: "ai_assistant",
      });
      await admin.from("notifications").insert({
        user_id: repId,
        title: "Lead Assigned",
        message: `Lead ${lead.company} has been assigned to you via AI assistant`,
      });

      const rep = repMap.get(repId);
      return {
        success: true,
        action: "assign_lead",
        lead: `${lead.first_name} ${lead.last_name} @ ${lead.company}`,
        assigned_to: rep?.name ?? repId,
      };
    }

    case "bulk_assign_leads": {
      const repResult = await resolveRepId(admin, args);
      if (typeof repResult === "object" && repResult.error) return repResult;
      const repId = repResult;
      const leadIds = args.lead_ids ?? [];
      const results = [];

      for (const leadId of leadIds) {
        const { data: lead } = await admin
          .from("leads")
          .select("id, first_name, last_name, company")
          .eq("id", leadId)
          .single();
        if (!lead) {
          results.push({ lead_id: leadId, success: false, error: "Not found" });
          continue;
        }
        const { error } = await admin.from("leads").update({
          assigned_to: repId,
          status: "ASSIGNED",
          updated_at: new Date().toISOString(),
        }).eq("id", leadId);
        if (error) {
          results.push({ lead_id: leadId, success: false, error: error.message });
          continue;
        }
        await admin.from("assignment_audit").insert({ lead_id: leadId, rep_id: repId, reason: "ai_assistant" });
        results.push({ lead_id: leadId, success: true, company: lead.company });
      }

      await admin.from("notifications").insert({
        user_id: repId,
        title: "Leads Assigned",
        message: `${results.filter((r) => r.success).length} lead(s) assigned to you via AI assistant`,
      });

      const rep = repMap.get(repId);
      return {
        success: true,
        action: "bulk_assign_leads",
        assigned_to: rep?.name ?? repId,
        results,
        assigned_count: results.filter((r) => r.success).length,
      };
    }

    case "get_clients": {
      const limit = Math.min(args.limit ?? 20, 50);
      let q = admin
        .from("clients")
        .select("id, company, contact, email, phone, ltv, deals_count, last_activity, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (args.search) {
        const s = args.search.replace(/%/g, "");
        q = q.or(`company.ilike.%${s}%,contact.ilike.%${s}%,email.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return { clients: data ?? [], count: data?.length ?? 0 };
    }

    case "get_payments_summary": {
      let q = admin
        .from("payments")
        .select("id, invoice_ref, company, amount, method, status, received_at, currency")
        .order("received_at", { ascending: false })
        .limit(Math.min(args.limit ?? 15, 30));
      if (args.status) q = q.eq("status", args.status);
      const { data, error } = await q;
      if (error) throw error;
      const payments = data ?? [];
      const total = payments.reduce((s, p) => s + Number(p.amount), 0);
      return { payments, total_amount: total, count: payments.length };
    }

    case "get_split_rules": {
      const { data, error } = await admin
        .from("split_rules")
        .select("id, name, mode, is_active, priority, leads_assigned, win_rate, rep_pool")
        .order("priority");
      if (error) throw error;
      return { rules: data ?? [] };
    }

    case "unassign_lead": {
      const { data: lead, error: leadErr } = await admin
        .from("leads")
        .select("id, first_name, last_name, company")
        .eq("id", args.lead_id)
        .single();
      if (leadErr || !lead) return { error: `Lead not found: ${args.lead_id}` };
      const { error } = await admin.from("leads").update({
        assigned_to: null,
        status: "NEW",
        updated_at: new Date().toISOString(),
      }).eq("id", args.lead_id);
      if (error) throw error;
      return { success: true, action: "unassign_lead", lead: `${lead.company}` };
    }

    case "update_lead_status": {
      const { data: lead, error: leadErr } = await admin
        .from("leads")
        .select("id, company")
        .eq("id", args.lead_id)
        .single();
      if (leadErr || !lead) return { error: `Lead not found: ${args.lead_id}` };
      const { error } = await admin.from("leads").update({
        status: args.status,
        updated_at: new Date().toISOString(),
      }).eq("id", args.lead_id);
      if (error) throw error;
      return { success: true, action: "update_lead_status", lead: lead.company, status: args.status };
    }

    case "query_lead_segment": {
      const offset = Math.max(0, Number(args.offset ?? 0));
      const limit = Math.min(Math.max(1, Number(args.limit ?? 15)), 30);
      const segment = buildSegmentFilters(args);
      const allRows = await fetchFilteredLeadRows(admin, args, repMap);
      const page = allRows.slice(offset, offset + limit);
      const leads = page.map((r) => formatLeadForAi(r, repMap));

      return {
        segment,
        lead_ids: leads.map((l) => l.id),
        leads,
        total_count: allRows.length,
        offset,
        limit,
        returned: leads.length,
        has_more: offset + leads.length < allRows.length,
        next_offset: offset + leads.length < allRows.length ? offset + limit : null,
        with_google_maps_in_page: leads.filter((l) => l.has_google_maps).length,
        with_website_in_page: leads.filter((l) => l.has_website).length,
      };
    }

    case "get_leads_full": {
      const { valid, invalid } = partitionLeadIds(args.lead_ids);
      if (!valid.length) {
        return {
          error: invalid.length
            ? `Invalid lead IDs: ${invalid.join(", ")}. Use UUIDs returned by query_lead_segment — never invent IDs.`
            : "lead_ids array is required (max 10 UUIDs from query_lead_segment)",
          invalid_ids: invalid.length ? invalid : undefined,
          hint: "Call query_lead_segment first to obtain real lead_ids",
        };
      }

      const { data, error } = await admin
        .from("leads")
        .select(LEAD_SELECT)
        .in("id", valid)
        .is("deleted_at", null);
      if (error) throw error;

      const leads = (data ?? []).map((r) => formatLead(r, repMap));
      const foundIds = new Set(leads.map((l) => l.id));
      const missing = valid.filter((id) => !foundIds.has(id));

      return {
        leads,
        count: leads.length,
        invalid_ids: invalid.length ? invalid : undefined,
        missing_ids: missing.length ? missing : undefined,
        ...(invalid.length ? { warning: "Some IDs were rejected because they are not valid UUIDs" } : {}),
      };
    }

    case "update_lead": {
      if (!args.lead_id) return { error: "lead_id is required" };

      const patch = await buildLeadPatch(admin, args, repMap);
      if (patch.error) return patch;

      const { data: before, error: leadErr } = await admin
        .from("leads")
        .select("id, company, first_name, last_name")
        .eq("id", args.lead_id)
        .is("deleted_at", null)
        .single();
      if (leadErr || !before) return { error: `Lead not found: ${args.lead_id}` };

      const { data: updated, error } = await admin
        .from("leads")
        .update(patch)
        .eq("id", args.lead_id)
        .select(LEAD_SELECT)
        .single();
      if (error) throw error;

      return {
        success: true,
        action: "update_lead",
        lead: `${before.company} (${before.first_name} ${before.last_name})`,
        lead_id: args.lead_id,
        fields_updated: Object.keys(patch).filter((k) => k !== "updated_at"),
        lead_after: formatLead(updated, repMap),
      };
    }

    case "bulk_update_leads": {
      const leadIds = (args.lead_ids ?? []).slice(0, 50);
      if (!leadIds.length) return { error: "lead_ids array is required" };

      const patch = await buildLeadPatch(admin, args, repMap);
      if (patch.error) return patch;

      const results = [];
      for (const leadId of leadIds) {
        const { data: before } = await admin
          .from("leads")
          .select("id, company")
          .eq("id", leadId)
          .is("deleted_at", null)
          .single();
        if (!before) {
          results.push({ lead_id: leadId, success: false, error: "Not found" });
          continue;
        }
        const { error } = await admin.from("leads").update(patch).eq("id", leadId);
        if (error) {
          results.push({ lead_id: leadId, success: false, error: error.message });
          continue;
        }
        results.push({ lead_id: leadId, success: true, company: before.company });
      }

      return {
        success: true,
        action: "bulk_update_leads",
        fields_updated: Object.keys(patch).filter((k) => k !== "updated_at"),
        updated_count: results.filter((r) => r.success).length,
        results,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export const SYSTEM_PROMPT = `You are the PLUSS CRM Admin Assistant for company administrators with FULL read access to all leads.

Token-efficient lead reads:
1. count_lead_segment(filters) — count before loading
2. query_lead_segment(filters, limit 15) — filtered preview with google_maps_link & website_link
3. get_leads_full(lead_ids) — full records only when needed

Link filters: has_google_maps, has_website, has_both_links, has_any_link, missing_links.
Also: status, wilaya, country, industry, source, search, rep_name, unassigned_only.

Never invent lead IDs or company names. Use real tool results only.`;
