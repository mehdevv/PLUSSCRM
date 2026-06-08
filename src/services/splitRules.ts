import { supabase } from "@/lib/supabase";
import { mapSplitRule } from "@/lib/mappers";
import type { SplitRule, SplitMode } from "@/types";

export async function fetchSplitRules(): Promise<SplitRule[]> {
  const { data, error } = await supabase.from("lead_splits").select("*").order("priority");
  if (error) throw error;
  return (data ?? []).map((r) => mapSplitRule(r as Record<string, unknown>));
}

export async function createSplitRule(input: {
  name: string;
  mode: SplitMode;
  rep_pool: string[];
  weights_json?: Record<string, number>;
  rule_conditions?: unknown[];
  max_per_rep?: number | null;
  priority?: number;
  is_active?: boolean;
}) {
  const { data, error } = await supabase.from("lead_splits").insert({
    ...input,
    weights_json: input.weights_json ?? {},
    rule_conditions: input.rule_conditions ?? [],
    is_active: input.is_active ?? true,
  }).select().single();
  if (error) throw error;
  return mapSplitRule(data as Record<string, unknown>);
}

export async function updateSplitRule(id: string, updates: Partial<SplitRule>) {
  const { error } = await supabase.from("lead_splits").update({
    name: updates.name,
    mode: updates.mode,
    rep_pool: updates.rep_pool,
    weights_json: updates.weights_json,
    rule_conditions: updates.rule_conditions,
    max_per_rep: updates.max_per_rep,
    is_active: updates.is_active,
    priority: updates.priority,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

export async function toggleSplitRule(id: string, active: boolean) {
  await updateSplitRule(id, { is_active: active } as Partial<SplitRule>);
}

export async function deleteSplitRule(id: string) {
  await supabase.from("leads").update({ split_rule_id: null }).eq("split_rule_id", id);
  const { error } = await supabase.from("lead_splits").delete().eq("id", id);
  if (error) throw error;
}

export async function rebalanceLeads(ruleId: string) {
  const { data, error } = await supabase.rpc("rebalance_new_leads", { p_rule_id: ruleId });
  if (error) throw error;
  return data;
}
