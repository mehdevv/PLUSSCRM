import {
  ACTIVE_PIPELINE_STAGES,
  normalizePipelineStage,
  PIPELINE_KANBAN_STAGES,
  toDbPipelineStage,
} from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { mapDeal } from "@/lib/mappers";
import {
  deleteClient,
  deleteClientIfZeroLtv,
  findClientByLead,
  findClientByWonDeal,
  syncClientLtvFromPayments,
} from "@/services/clients";
import { deleteMeetingBriefForDeal } from "@/services/meetingBriefs";
import { deletePaymentsForLead } from "@/services/payments";
import type { Deal, LeadStatus } from "@/types";

export async function fetchDeals(repId?: string): Promise<Deal[]> {
  let q = supabase.from("deals").select("*, leads(first_name, last_name, company, value)").order("created_at", { ascending: false });
  if (repId) q = q.eq("rep_id", repId);
  const { data, error } = await q;
  if (error) throw dealError(error);
  return (data ?? []).map((r) => {
    const lead = (r as { leads?: Record<string, unknown> }).leads;
    return mapDeal(r as Record<string, unknown>, lead);
  });
}

const LEAD_SYNC_STAGES: LeadStatus[] = [
  ...ACTIVE_PIPELINE_STAGES,
  "WON",
  "LOST",
];

function dealError(error: { message: string; details?: string; hint?: string; code?: string }): Error {
  const detail = [error.message, error.details, error.hint].filter(Boolean).join(" — ");
  if (detail.includes("invalid input value for enum lead_status")) {
    return new Error(
      `${detail} — Run supabase/migrations/019_pipeline_workflow.sql in the Supabase SQL editor, then reload the API schema.`,
    );
  }
  return new Error(detail || "Could not update deal");
}

function isActivePipelineStage(stage: LeadStatus): boolean {
  return ACTIVE_PIPELINE_STAGES.includes(stage);
}

/** Fetch deals for a lead and filter active pipeline stages in-app (avoids invalid enum in PostgREST .in()). */
async function fetchActiveDealsForLead(leadId: string) {
  const { data, error } = await supabase
    .from("deals")
    .select("*, leads(first_name, last_name, company, value)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw dealError(error);
  return (data ?? []).filter((r) => isActivePipelineStage(r.stage as LeadStatus));
}

async function syncLeadStatus(leadId: string, status: LeadStatus) {
  const { error } = await supabase.from("leads").update({
    status: toDbPipelineStage(status),
    updated_at: new Date().toISOString(),
  }).eq("id", leadId);
  if (error) throw dealError(error);
}

export async function createDeal(input: { lead_id: string; rep_id: string; value: number; stage?: LeadStatus; close_date?: string; currency?: string }) {
  const stage = input.stage ?? "CONTACTED";
  const dbStage = toDbPipelineStage(stage);
  const { data, error } = await supabase.from("deals").insert({
    lead_id: input.lead_id,
    rep_id: input.rep_id,
    value: input.value,
    stage: dbStage,
    close_date: input.close_date ?? null,
    currency: input.currency ?? "USD",
  }).select("*, leads(first_name, last_name, company, value)").single();
  if (error) throw dealError(error);
  await syncLeadStatus(input.lead_id, stage);
  const lead = (data as { leads?: Record<string, unknown> }).leads;
  return mapDeal(data as Record<string, unknown>, lead);
}

export async function deleteDeal(id: string) {
  const { data: deal, error: fetchErr } = await supabase
    .from("deals")
    .select("lead_id, stage, rep_id")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) throw dealError(fetchErr);
  if (!deal) return;

  const stage = normalizePipelineStage((deal.stage as LeadStatus) ?? "CONTACTED");
  if (stage === "WON") {
    await revertWonDealEffects(id, deal.lead_id as string, String(deal.rep_id ?? ""));
  }

  const { error: commErr } = await supabase.from("commissions").delete().eq("deal_id", id);
  if (commErr) throw dealError(commErr);
  const { error: actErr } = await supabase.from("activities").delete().eq("deal_id", id);
  if (actErr) throw dealError(actErr);
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) throw dealError(error);
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
  const payload: Record<string, unknown> = {
    stage: toDbPipelineStage(stage),
    stage_changed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (stage !== "WON") {
    payload.won_at = null;
  }
  const { error } = await supabase.from("deals").update(payload).eq("id", id);
  if (error) throw dealError(error);
}

/** Remove payments, commissions, and client revenue when a deal leaves Won. */
export async function revertWonDealEffects(dealId: string, leadId: string, repId: string) {
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("company, email")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr) throw dealError(leadErr);

  await deletePaymentsForLead(leadId);

  const { data: commission } = await supabase
    .from("commissions")
    .select("id")
    .eq("deal_id", dealId)
    .maybeSingle();
  if (commission) {
    const { error: commErr } = await supabase.from("commissions").delete().eq("deal_id", dealId);
    if (commErr) throw dealError(commErr);
    const { data: profile } = await supabase.from("profiles").select("points").eq("id", repId).maybeSingle();
    if (profile) {
      await supabase
        .from("profiles")
        .update({ points: Math.max(0, Number(profile.points ?? 0) - 100) })
        .eq("id", repId);
    }
  }

  if (!lead) return;

  const linkedClient = await findClientByWonDeal(dealId);
  if (linkedClient) {
    await deleteClient(linkedClient.id);
    return;
  }

  const client = await findClientByLead(lead.company, lead.email);
  if (!client || client.manager_id !== repId || client.won_deal_id) return;

  const nextDealsCount = Math.max(0, client.deals_count - 1);
  await supabase
    .from("clients")
    .update({
      deals_count: nextDealsCount,
      last_activity: "Deal reopened",
      updated_at: new Date().toISOString(),
    })
    .eq("id", client.id);

  const updatedClient = { ...client, deals_count: nextDealsCount };
  const synced = await syncClientLtvFromPayments(updatedClient);
  if (!synced) {
    await deleteClientIfZeroLtv(updatedClient);
  }
}

export async function updateDealStageWithLead(dealId: string, stage: LeadStatus, leadId: string) {
  const { data: current, error: currentErr } = await supabase
    .from("deals")
    .select("stage, rep_id")
    .eq("id", dealId)
    .maybeSingle();
  if (currentErr) throw dealError(currentErr);

  const previousStage = normalizePipelineStage((current?.stage as LeadStatus) ?? stage);
  if (previousStage === "WON" && stage !== "WON") {
    await revertWonDealEffects(dealId, leadId, String(current?.rep_id ?? ""));
  }

  await updateDealStage(dealId, stage);
  if (TERMINAL_DEAL_STAGES.includes(stage)) {
    await removeDuplicateActiveDeals(leadId, dealId);
  }
  if (LEAD_SYNC_STAGES.includes(stage)) {
    await syncLeadStatus(leadId, stage);
  }
}

export function nextPipelineStage(current: LeadStatus): LeadStatus | null {
  const normalized = normalizePipelineStage(current);
  const idx = PIPELINE_KANBAN_STAGES.indexOf(normalized);
  if (idx < 0) return null;
  if (idx >= PIPELINE_KANBAN_STAGES.length - 1) return "WON";
  return PIPELINE_KANBAN_STAGES[idx + 1];
}

export function prevPipelineStage(current: LeadStatus): LeadStatus | null {
  const normalized = normalizePipelineStage(current);
  const idx = PIPELINE_KANBAN_STAGES.indexOf(normalized);
  if (idx <= 0) return null;
  return PIPELINE_KANBAN_STAGES[idx - 1];
}

/** Stage to return to when reversing (terminal Won/Lost → last active column). */
export function pipelinePreviousStage(current: LeadStatus): LeadStatus | null {
  const leaving = normalizePipelineStage(current);
  if (leaving === "WON" || leaving === "LOST") return "MEETING_PENDING";
  return prevPipelineStage(leaving);
}

/** Move deal back one pipeline step and remove data created for the current stage. */
export async function moveDealToPreviousStage(
  dealId: string,
  leadId: string,
  currentStage: LeadStatus,
): Promise<LeadStatus> {
  const prev = pipelinePreviousStage(currentStage);
  if (!prev) {
    throw new Error("Already at the first pipeline stage.");
  }

  const leaving = normalizePipelineStage(currentStage);
  if (leaving === "MEETING_PENDING") {
    await deleteMeetingBriefForDeal(dealId);
  }

  await updateDealStageWithLead(dealId, prev, leadId);
  return prev;
}

export const PIPELINE_STAGE_OPTIONS: LeadStatus[] = [
  ...PIPELINE_KANBAN_STAGES,
  "WON",
  "LOST",
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
  if (leadErr) throw dealError(leadErr);
}

/** Jump a deal (any current stage) to a new pipeline stage and sync the lead. */
export async function moveDealToStage(dealId: string, leadId: string, stage: LeadStatus) {
  if (!PIPELINE_STAGE_OPTIONS.includes(stage)) {
    throw new Error(`Invalid pipeline stage: ${stage}`);
  }
  await updateDealStageWithLead(dealId, stage, leadId);
}

const TERMINAL_DEAL_STAGES: LeadStatus[] = ["WON", "LOST"];

/** Remove extra active pipeline deals for the same lead (keeps one deal when closing). */
export async function removeDuplicateActiveDeals(leadId: string, keepDealId: string) {
  const { data, error } = await supabase
    .from("deals")
    .select("id, stage")
    .eq("lead_id", leadId)
    .neq("id", keepDealId);
  if (error) throw dealError(error);
  for (const row of data ?? []) {
    if (isActivePipelineStage(row.stage as LeadStatus)) {
      await deleteDeal(row.id as string);
    }
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

  const { data: closedRows, error: closedErr } = await supabase
    .from("deals")
    .select("id")
    .eq("lead_id", leadId)
    .in("stage", TERMINAL_DEAL_STAGES)
    .limit(1);
  if (closedErr) throw dealError(closedErr);
  if (closedRows?.length) {
    throw new Error("This lead already has a closed deal (Won or Lost).");
  }

  const activeRows = await fetchActiveDealsForLead(leadId);
  const existing = activeRows[0];
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
