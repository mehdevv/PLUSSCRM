import { supabase } from "@/lib/supabase";
import { mapDeal } from "@/lib/mappers";
import type { Deal, LeadStatus } from "@/types";

export async function fetchDeals(repId?: string): Promise<Deal[]> {
  let q = supabase.from("deals").select("*, leads(first_name, last_name, company, value)").order("created_at", { ascending: false });
  if (repId) q = q.eq("rep_id", repId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => {
    const lead = (r as { leads?: Record<string, unknown> }).leads;
    return mapDeal(r as Record<string, unknown>, lead);
  });
}

const LEAD_SYNC_STAGES: LeadStatus[] = [
  "CONTACTED", "QUALIFYING", "PROPOSAL", "NEGOTIATION", "WON", "LOST",
];

function dealError(error: { message: string; details?: string; hint?: string }): Error {
  const detail = [error.message, error.details, error.hint].filter(Boolean).join(" — ");
  return new Error(detail || "Could not update deal");
}

async function syncLeadStatus(leadId: string, status: LeadStatus) {
  const { error } = await supabase.from("leads").update({
    status,
    updated_at: new Date().toISOString(),
  }).eq("id", leadId);
  if (error) throw dealError(error);
}

export async function createDeal(input: { lead_id: string; rep_id: string; value: number; stage?: LeadStatus; close_date?: string; currency?: string }) {
  const stage = input.stage ?? "CONTACTED";
  const { data, error } = await supabase.from("deals").insert({
    lead_id: input.lead_id,
    rep_id: input.rep_id,
    value: input.value,
    stage,
    close_date: input.close_date ?? null,
    currency: input.currency ?? "USD",
  }).select("*, leads(first_name, last_name, company, value)").single();
  if (error) throw error;
  await syncLeadStatus(input.lead_id, stage);
  const lead = (data as { leads?: Record<string, unknown> }).leads;
  return mapDeal(data as Record<string, unknown>, lead);
}

export async function deleteDeal(id: string) {
  await supabase.from("payments").delete().eq("deal_id", id);
  await supabase.from("commissions").delete().eq("deal_id", id);
  await supabase.from("activities").delete().eq("deal_id", id);
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) throw error;
}

export async function syncDealValue(
  dealId: string,
  value: number,
  currency: string,
) {
  if (value <= 0) return;
  const { error } = await supabase.from("deals").update({
    value,
    currency,
    updated_at: new Date().toISOString(),
  }).eq("id", dealId);
  if (error) throw dealError(error);
}

export async function updateDealStage(id: string, stage: LeadStatus) {
  const { error } = await supabase.from("deals").update({
    stage,
    stage_changed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw dealError(error);
}

export async function updateDealStageWithLead(dealId: string, stage: LeadStatus, leadId: string) {
  await updateDealStage(dealId, stage);
  if (TERMINAL_DEAL_STAGES.includes(stage)) {
    await removeDuplicateActiveDeals(leadId, dealId);
  }
  if (LEAD_SYNC_STAGES.includes(stage)) {
    await syncLeadStatus(leadId, stage);
  }
}

const PIPELINE_FLOW: LeadStatus[] = ["CONTACTED", "QUALIFYING", "NEGOTIATION"];

export function nextPipelineStage(current: LeadStatus): LeadStatus | null {
  if (current === "PROPOSAL") return "NEGOTIATION";
  const idx = PIPELINE_FLOW.indexOf(current);
  if (idx < 0 || idx >= PIPELINE_FLOW.length - 1) return idx === PIPELINE_FLOW.length - 1 ? "WON" : null;
  return PIPELINE_FLOW[idx + 1];
}

export function prevPipelineStage(current: LeadStatus): LeadStatus | null {
  if (current === "PROPOSAL") return "QUALIFYING";
  const idx = PIPELINE_FLOW.indexOf(current);
  if (idx <= 0) return null;
  return PIPELINE_FLOW[idx - 1];
}

export const PIPELINE_STAGE_OPTIONS: LeadStatus[] = [
  "CONTACTED", "QUALIFYING", "NEGOTIATION", "WON", "LOST",
];

export type LeadsBoardTarget = "ASSIGNED" | "CONTACTED";

/** Remove active deal and put lead back on the Leads board. */
export async function returnLeadToBoard(
  leadId: string,
  dealId: string,
  target: LeadsBoardTarget = "ASSIGNED",
) {
  await deleteDeal(dealId);
  const { error: leadErr } = await supabase.from("leads").update({
    status: target,
    updated_at: new Date().toISOString(),
  }).eq("id", leadId);
  if (leadErr) throw leadErr;
}

/** Jump a deal (any current stage) to a new pipeline stage and sync the lead. */
export async function moveDealToStage(dealId: string, leadId: string, stage: LeadStatus) {
  if (!PIPELINE_STAGE_OPTIONS.includes(stage)) {
    throw new Error(`Invalid pipeline stage: ${stage}`);
  }
  await updateDealStageWithLead(dealId, stage, leadId);
}

const ACTIVE_PIPELINE_STAGES: LeadStatus[] = [
  "CONTACTED", "QUALIFYING", "NEGOTIATION", "PROPOSAL",
];

const TERMINAL_DEAL_STAGES: LeadStatus[] = ["WON", "LOST"];

/** Remove extra active pipeline deals for the same lead (keeps one deal when closing). */
export async function removeDuplicateActiveDeals(leadId: string, keepDealId: string) {
  const { data, error } = await supabase
    .from("deals")
    .select("id")
    .eq("lead_id", leadId)
    .neq("id", keepDealId)
    .in("stage", ACTIVE_PIPELINE_STAGES);
  if (error) throw dealError(error);
  for (const row of data ?? []) {
    await deleteDeal(row.id as string);
  }
}

export function leadHasTerminalDeal(
  leadId: string,
  deals: { lead_id: string; stage: LeadStatus }[],
): boolean {
  return deals.some(
    (d) => d.lead_id === leadId && TERMINAL_DEAL_STAGES.includes(d.stage),
  );
}

/** Ensure a lead has an active pipeline deal (creates one in Contacted if missing). */
export async function ensureLeadInPipeline(
  leadId: string,
  repId: string,
  value: number,
  stage: LeadStatus = "CONTACTED",
) {
  const targetStage = ACTIVE_PIPELINE_STAGES.includes(stage) ? stage : "CONTACTED";

  const { data: closedRows } = await supabase
    .from("deals")
    .select("id, stage")
    .eq("lead_id", leadId)
    .in("stage", TERMINAL_DEAL_STAGES)
    .limit(1);
  if (closedRows?.length) {
    throw new Error("This lead already has a closed deal (Won or Lost).");
  }

  const { data: rows, error: fetchErr } = await supabase
    .from("deals")
    .select("*, leads(first_name, last_name, company, value)")
    .eq("lead_id", leadId)
    .in("stage", ACTIVE_PIPELINE_STAGES)
    .order("created_at", { ascending: false })
    .limit(1);

  if (fetchErr) throw fetchErr;

  const existing = rows?.[0];
  if (existing) {
    const mapped = mapDeal(
      existing as Record<string, unknown>,
      (existing as { leads?: Record<string, unknown> }).leads,
    );
    if (mapped.stage !== targetStage) {
      await updateDealStageWithLead(mapped.id, targetStage, leadId);
      return { ...mapped, stage: targetStage };
    }
    await syncLeadStatus(leadId, targetStage);
    return mapped;
  }

  return createDeal({
    lead_id: leadId,
    rep_id: repId,
    value,
    stage: targetStage,
  });
}

export async function syncOrphanedPipelineLeads(
  repId: string,
  leads: { id: string; status: LeadStatus; value: number; assigned_to: string | null }[],
  deals: { lead_id: string; stage: LeadStatus }[],
) {
  const orphans = leads.filter(
    (l) =>
      l.assigned_to === repId &&
      ACTIVE_PIPELINE_STAGES.includes(l.status) &&
      !leadHasTerminalDeal(l.id, deals) &&
      !deals.some((d) => d.lead_id === l.id && ACTIVE_PIPELINE_STAGES.includes(d.stage)),
  );

  for (const lead of orphans) {
    await ensureLeadInPipeline(lead.id, repId, lead.value, lead.status);
  }

  return orphans.length;
}
