import { supabase } from "@/lib/supabase";
import type {
  ActivityFeedItem,
  DashboardKpis,
  LeaderboardEntry,
  LeadsBySourceItem,
  PipelineFunnelItem,
  SplitRuleEfficiencyItem,
} from "@/types";

function asArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  return [];
}

export async function fetchDashboardKpis(userId?: string): Promise<DashboardKpis> {
  const { data, error } = await supabase.rpc("get_dashboard_kpis", { p_user_id: userId ?? null });
  if (error) throw error;
  return data as DashboardKpis;
}

export async function fetchRevenueTrend(userId?: string) {
  const { data, error } = await supabase.rpc("get_revenue_trend", { p_user_id: userId ?? null });
  if (error) throw error;
  return asArray<{ month: string; revenue: number }>(data);
}

export async function fetchActivityVolume(userId?: string) {
  const { data, error } = await supabase.rpc("get_activity_volume", { p_user_id: userId ?? null });
  if (error) throw error;
  return asArray<{ day: string; calls: number; emails: number; meetings: number }>(data);
}

export async function fetchLeadsBySource(userId?: string): Promise<LeadsBySourceItem[]> {
  const { data, error } = await supabase.rpc("get_leads_by_source", { p_user_id: userId ?? null });
  if (error) throw error;
  return asArray<LeadsBySourceItem>(data);
}

export async function fetchPipelineFunnel(userId?: string): Promise<PipelineFunnelItem[]> {
  const { data, error } = await supabase.rpc("get_pipeline_funnel", { p_user_id: userId ?? null });
  if (error) throw error;
  return asArray<PipelineFunnelItem>(data);
}

export async function fetchSplitRuleEfficiency(): Promise<SplitRuleEfficiencyItem[]> {
  const { data, error } = await supabase.rpc("get_split_rule_efficiency");
  if (error) {
    console.warn("get_split_rule_efficiency:", error.message);
    return [];
  }
  return asArray<SplitRuleEfficiencyItem>(data);
}

export async function fetchActivityFeed(userId?: string, limit = 10): Promise<ActivityFeedItem[]> {
  const { data, error } = await supabase.rpc("get_activity_feed", {
    p_user_id: userId ?? null,
    p_limit: limit,
  });
  if (error) throw error;
  return asArray<ActivityFeedItem>(data);
}

export async function fetchLeaderboard(period = "monthly"): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc("get_leaderboard", { p_period: period });
  if (error) throw error;
  return asArray<LeaderboardEntry>(data);
}
