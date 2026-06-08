import { supabase } from "@/lib/supabase";
import { mapProfile } from "@/lib/mappers";
import type { Profile } from "@/types";

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("profiles").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((r) => mapProfile(r as Record<string, unknown>));
}

export async function fetchSalesReps(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "sales_rep")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => mapProfile(r as Record<string, unknown>));
}

export async function updateProfile(id: string, updates: Partial<Profile>) {
  const { error } = await supabase.from("profiles").update({
    name: updates.name,
    initials: updates.initials,
    tier: updates.tier,
    color: updates.color,
    is_active: updates.is_active,
    vacation_mode: updates.vacation_mode,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}
