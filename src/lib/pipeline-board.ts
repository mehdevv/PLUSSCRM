import {
  ACTIVE_PIPELINE_STAGES,
  normalizePipelineStage,
  PIPELINE_KANBAN_STAGES,
} from "@/lib/constants";
import type { Deal, LeadStatus } from "@/types";

const TERMINAL_STAGES: LeadStatus[] = ["WON", "LOST"];

function dedupeDealsByLead(dealList: Deal[]): Deal[] {
  const byLead = new Map<string, Deal>();
  for (const deal of dealList) {
    const prev = byLead.get(deal.lead_id);
    if (!prev || new Date(deal.created_at) > new Date(prev.created_at)) {
      byLead.set(deal.lead_id, deal);
    }
  }
  return Array.from(byLead.values());
}

/** Active pipeline deals only — excludes leads that already have a Won/Lost deal. */
export function activeBoardDeals(allDeals: Deal[]): Deal[] {
  const terminalLeadIds = new Set(
    allDeals.filter((d) => TERMINAL_STAGES.includes(d.stage)).map((d) => d.lead_id),
  );
  const active = allDeals.filter(
    (d) => ACTIVE_PIPELINE_STAGES.includes(d.stage) && !terminalLeadIds.has(d.lead_id),
  );
  return dedupeDealsByLead(active);
}

export function terminalBoardDeals(allDeals: Deal[], stage: "WON" | "LOST"): Deal[] {
  return dedupeDealsByLead(allDeals.filter((d) => d.stage === stage));
}

export function dealsInBoardColumn(boardDeals: Deal[], stage: LeadStatus): Deal[] {
  return boardDeals.filter((d) => normalizePipelineStage(d.stage) === stage);
}

export { PIPELINE_KANBAN_STAGES };
