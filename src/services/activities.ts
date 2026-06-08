import { supabase } from "@/lib/supabase";
import { mapActivity } from "@/lib/mappers";
import type { Activity, ActivityType } from "@/types";

export async function fetchActivities(): Promise<Activity[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("*, leads(first_name, last_name, company)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const lead = (r as { leads?: Record<string, unknown> }).leads;
    return mapActivity(r as Record<string, unknown>, lead);
  });
}

export async function createActivity(input: {
  user_id: string;
  type: ActivityType;
  note: string;
  lead_id?: string;
  deal_id?: string;
  outcome?: string;
  scheduled_at?: string;
  due_date?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  done?: boolean;
}) {
  const { data, error } = await supabase.from("activities").insert(input).select("*, leads(first_name, last_name, company)").single();
  if (error) throw error;
  const lead = (data as { leads?: Record<string, unknown> }).leads;
  return mapActivity(data as Record<string, unknown>, lead);
}

export async function deleteActivity(id: string) {
  const { error } = await supabase.from("activities").delete().eq("id", id);
  if (error) throw error;
}

export async function completeActivity(id: string) {
  const { error } = await supabase.from("activities").update({ done: true }).eq("id", id);
  if (error) throw error;
}
