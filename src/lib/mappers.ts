import { normalizePipelineStage } from "@/lib/constants";
import type {
  Lead, Deal, Client, Payment, Activity, SplitRule, Profile, Commission, CompensationPlan, RepCompensation, ClientNote, ClientFile, ImportJob, AssignmentQueueItem,
} from "@/types";

export function mapLead(row: Record<string, unknown>): Lead {
  const first = row.first_name as string;
  const last = row.last_name as string;
  return {
    id: row.id as string,
    first_name: first,
    last_name: last,
    name: `${first} ${last}`.trim(),
    company: (row.company as string) ?? "",
    email: row.email as string,
    phone: (row.phone as string) ?? null,
    status: row.status as Lead["status"],
    source: (row.source as string) ?? null,
    assigned_to: (row.assigned_to as string) ?? null,
    split_rule_id: (row.split_rule_id as string) ?? null,
    country: (row.country as string) ?? null,
    wilaya: (row.wilaya as string) ?? null,
    google_maps_link: (row.google_maps_link as string) ?? null,
    website_link: (row.website_link as string) ?? null,
    industry: (row.industry as string) ?? null,
    notes: (row.notes as string) ?? null,
    value: Number(row.value ?? 0),
    last_activity: (row.last_activity as string) ?? null,
    last_activity_at: (row.last_activity_at as string) ?? null,
    created_at: row.created_at as string,
    deleted_at: (row.deleted_at as string) ?? null,
  };
}

export function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    role: row.role as Profile["role"],
    avatar_url: (row.avatar_url as string) ?? null,
    initials: row.initials as string,
    tier: row.tier as Profile["tier"],
    points: Number(row.points ?? 0),
    is_active: row.is_active as boolean,
    vacation_mode: row.vacation_mode as boolean,
    color: row.color as string,
    created_at: row.created_at as string,
  };
}

export function mapDeal(row: Record<string, unknown>, lead?: Record<string, unknown>): Deal {
  const stageChanged = row.stage_changed_at as string;
  const days = stageChanged
    ? Math.floor((Date.now() - new Date(stageChanged).getTime()) / 86400000)
    : 0;
  const closeDate = row.close_date as string | null;
  return {
    id: row.id as string,
    lead_id: row.lead_id as string,
    lead_name: lead ? `${lead.first_name} ${lead.last_name}` : "",
    company: (lead?.company as string) ?? "",
    value: Number(row.value ?? 0),
    stage: normalizePipelineStage(row.stage as Deal["stage"]),
    rep_id: row.rep_id as string,
    currency: (row.currency as string) ?? "USD",
    close_date: closeDate,
    won_at: (row.won_at as string) ?? null,
    days_in_stage: days,
    overdue: closeDate ? new Date(closeDate) < new Date() && row.stage !== "WON" : false,
    created_at: row.created_at as string,
  };
}

export function mapClient(row: Record<string, unknown>): Client {
  return {
    id: row.id as string,
    company: row.company as string,
    contact: row.contact as string,
    email: row.email as string,
    phone: (row.phone as string) ?? null,
    ltv: Number(row.ltv ?? 0),
    deals_count: Number(row.deals_count ?? 0),
    last_activity: (row.last_activity as string) ?? null,
    manager_id: row.manager_id as string,
    country: (row.country as string) ?? null,
    currency: (row.currency as string) ?? "USD",
    won_deal_id: (row.won_deal_id as string) ?? null,
    created_at: row.created_at as string,
  };
}

export function mapPayment(row: Record<string, unknown>, company?: string, dealValue?: number): Payment {
  return {
    id: row.id as string,
    lead_id: row.lead_id as string,
    deal_id: (row.deal_id as string) ?? null,
    invoice_ref: row.invoice_ref as string,
    company: company ?? "",
    deal_value: dealValue ?? 0,
    amount: Number(row.amount ?? 0),
    method: row.method as string,
    status: row.status as Payment["status"],
    received_at: (row.received_at as string) ?? null,
    currency: (row.currency as string) ?? "USD",
    notes: (row.notes as string) ?? null,
  };
}

export function mapActivity(row: Record<string, unknown>, lead?: Record<string, unknown>): Activity {
  return {
    id: row.id as string,
    type: row.type as Activity["type"],
    lead_id: (row.lead_id as string) ?? null,
    deal_id: (row.deal_id as string) ?? null,
    lead_name: lead ? `${lead.first_name} ${lead.last_name}` : "",
    company: (lead?.company as string) ?? "",
    user_id: row.user_id as string,
    note: row.note as string,
    outcome: (row.outcome as string) ?? null,
    scheduled_at: (row.scheduled_at as string) ?? null,
    due_date: (row.due_date as string) ?? null,
    priority: (row.priority as Activity["priority"]) ?? null,
    done: row.done as boolean,
    created_at: row.created_at as string,
  };
}

export function mapSplitRule(row: Record<string, unknown>): SplitRule {
  return {
    id: row.id as string,
    name: row.name as string,
    mode: row.mode as SplitRule["mode"],
    rep_pool: (row.rep_pool as string[]) ?? [],
    weights_json: (row.weights_json as Record<string, number>) ?? {},
    rule_conditions: (row.rule_conditions as unknown[]) ?? [],
    fallback_mode: row.fallback_mode as string,
    max_per_rep: row.max_per_rep != null ? Number(row.max_per_rep) : null,
    is_active: row.is_active as boolean,
    priority: Number(row.priority ?? 0),
    leads_assigned: Number(row.leads_assigned ?? 0),
    win_rate: Number(row.win_rate ?? 0),
    created_at: row.created_at as string,
  };
}

export function mapCommission(row: Record<string, unknown>, repName?: string, dealLabel?: string): Commission {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    rep_name: repName ?? "",
    deal_label: dealLabel ?? "",
    rate: Number(row.rate ?? 0),
    amount: Number(row.amount ?? 0),
    status: row.status as Commission["status"],
    paid_at: (row.paid_at as string) ?? null,
    created_at: row.created_at as string,
  };
}

export function mapCompPlan(row: Record<string, unknown>): CompensationPlan {
  return {
    id: row.id as string,
    name: row.name as string,
    base_rate: Number(row.base_rate ?? 0),
    tier_multiplier: Number(row.tier_multiplier ?? 1),
    accelerator: Number(row.accelerator ?? 1),
    cap: row.cap != null ? Number(row.cap) : null,
    created_at: row.created_at as string,
  };
}

export function mapRepCompensation(row: Record<string, unknown>): RepCompensation {
  const plan = row.compensation_plans as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    plan_id: row.plan_id as string,
    plan_name: (plan?.name as string) ?? "Unassigned",
    base_rate: Number(plan?.base_rate ?? 0),
    tier_multiplier: Number(plan?.tier_multiplier ?? 1),
    accelerator: Number(plan?.accelerator ?? 1),
    created_at: row.created_at as string,
  };
}

export function mapClientNote(row: Record<string, unknown>): ClientNote {
  return {
    id: row.id as string,
    client_id: row.client_id as string,
    user_id: row.user_id as string,
    content: row.content as string,
    created_at: row.created_at as string,
  };
}

export function mapClientFile(row: Record<string, unknown>): ClientFile {
  return {
    id: row.id as string,
    client_id: row.client_id as string,
    file_name: row.file_name as string,
    file_path: row.file_path as string,
    payment_id: (row.payment_id as string) ?? null,
    created_at: row.created_at as string,
  };
}

export function mapImportJob(row: Record<string, unknown>): ImportJob {
  return {
    id: row.id as string,
    status: row.status as ImportJob["status"],
    file_path: (row.file_path as string) ?? null,
    mapping: (row.mapping as Record<string, string>) ?? {},
    error_report: (row.error_report as unknown[]) ?? [],
    split_summary: (row.split_summary as Record<string, unknown>) ?? null,
    total_rows: Number(row.total_rows ?? 0),
    success_rows: Number(row.success_rows ?? 0),
    failed_rows: Number(row.failed_rows ?? 0),
    created_at: row.created_at as string,
  };
}

export function mapQueueItem(row: Record<string, unknown>, lead: Lead): AssignmentQueueItem {
  return {
    id: row.id as string,
    lead_id: row.lead_id as string,
    lead,
    reason: row.reason as string,
    created_at: row.created_at as string,
  };
}
